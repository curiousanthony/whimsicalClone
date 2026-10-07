/**
 * Open documents (one entry per file path, shared by every tab showing it): parsed content,
 * host undo history, dirty flag, disk hash, autosave (500 ms debounce, serialized per file,
 * `expectedHash` conflict detection with "local edits win"), external change handling and
 * per-file view state.
 */

import { create } from 'zustand';
import type { FsEvent, RelPath } from '@shared/ipc';
import { titleFromPath } from '@shared/fileKinds';
import { editorRegistry } from '@renderer/app/editors';
import { SnapshotHistory } from '@renderer/core/history';
import type { ChangeOptions, EditorPlugin, HistoryAction } from '@renderer/core/types';
import { translateKey } from '@renderer/i18n';
import { isWithin, rebasePath } from '../tree';
import { errorMessage, showToast } from './ui';

export const AUTOSAVE_DELAY_MS = 500;

export interface DocEntry {
  path: RelPath;
  status: 'loading' | 'ready' | 'error' | 'unsupported' | 'missing';
  content: unknown;
  /** sha256 of the content on disk as last read or written by us. */
  hash: string | undefined;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  error: string | null;
  deletedOnDisk: boolean;
  lastHistoryAction: HistoryAction | undefined;
  /** Bumped when the content is replaced from disk (editors with own history may reset). */
  revision: number;
}

interface DocumentsState {
  docs: Record<RelPath, DocEntry>;
}

export const useDocuments = create<DocumentsState>()(() => ({ docs: {} }));

const histories = new Map<RelPath, SnapshotHistory<unknown>>();
const saveTimers = new Map<RelPath, number>();
const saveChains = new Map<RelPath, Promise<void>>();
const viewStates = new Map<RelPath, Record<string, unknown>>();
const viewStateTimers = new Map<RelPath, number>();
const loading = new Map<RelPath, Promise<void>>();
let historySeq = 0;

export function pluginFor(path: RelPath): EditorPlugin<unknown> | undefined {
  return editorRegistry.forPath(path) as EditorPlugin<unknown> | undefined;
}

function patch(path: RelPath, update: Partial<DocEntry>): void {
  useDocuments.setState((s) => {
    const entry = s.docs[path];
    if (!entry) return s;
    return { docs: { ...s.docs, [path]: { ...entry, ...update } } };
  });
}

function getDoc(path: RelPath): DocEntry | undefined {
  return useDocuments.getState().docs[path];
}

export function viewStateKey(path: RelPath): string {
  return `file:${path}`;
}

/** Loads a file once (subsequent calls reuse the entry). */
export function ensureDocument(path: RelPath): Promise<void> {
  if (getDoc(path)) return loading.get(path) ?? Promise.resolve();
  const plugin = pluginFor(path);
  const entry: DocEntry = {
    path,
    status: plugin ? 'loading' : 'unsupported',
    content: undefined,
    hash: undefined,
    dirty: false,
    saving: false,
    saveError: null,
    error: null,
    deletedOnDisk: false,
    lastHistoryAction: undefined,
    revision: 0,
  };
  useDocuments.setState((s) => ({ docs: { ...s.docs, [path]: entry } }));
  if (!plugin) return Promise.resolve();
  const job = (async () => {
    const [result, vs] = await Promise.all([
      window.api.fs.readFile(path),
      window.api.viewState.get<Record<string, unknown>>(viewStateKey(path)).catch(() => undefined),
    ]);
    viewStates.set(path, vs && typeof vs === 'object' ? { ...vs } : {});
    if (!result.ok) {
      patch(path, {
        status: result.code === 'NOT_FOUND' ? 'missing' : 'error',
        error: errorMessage(result.code, result.message),
      });
      return;
    }
    try {
      const content = plugin.parse(result.value.content, path);
      histories.set(path, new SnapshotHistory<unknown>());
      patch(path, { status: 'ready', content, hash: result.value.stat.hash, error: null });
    } catch (error) {
      patch(path, { status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  })().finally(() => loading.delete(path));
  loading.set(path, job);
  return job;
}

/** Commits a new content value from an editor. */
export function changeDocument(path: RelPath, next: unknown, options: ChangeOptions = {}): void {
  const entry = getDoc(path);
  if (!entry || entry.status !== 'ready' || entry.content === next) return;
  const plugin = pluginFor(path);
  if (plugin?.historyMode === 'host') histories.get(path)?.record(entry.content, next, options);
  patch(path, { content: next, dirty: true });
  scheduleSave(path);
}

export function sealHistory(path: RelPath): void {
  histories.get(path)?.seal();
}

export function canUndo(path: RelPath): boolean {
  return histories.get(path)?.canUndo() ?? false;
}

export function canRedo(path: RelPath): boolean {
  return histories.get(path)?.canRedo() ?? false;
}

export function undoDocument(path: RelPath): boolean {
  const entry = histories.get(path)?.undo();
  if (!entry) return false;
  patch(path, {
    content: entry.before,
    dirty: true,
    lastHistoryAction: { kind: 'undo', selection: entry.selection, seq: ++historySeq },
  });
  scheduleSave(path);
  return true;
}

export function redoDocument(path: RelPath): boolean {
  const entry = histories.get(path)?.redo();
  if (!entry) return false;
  patch(path, {
    content: entry.after,
    dirty: true,
    lastHistoryAction: { kind: 'redo', selection: entry.selection, seq: ++historySeq },
  });
  scheduleSave(path);
  return true;
}

/* ------------------------------------------------------------------ saving */

export function scheduleSave(path: RelPath, delay = AUTOSAVE_DELAY_MS): void {
  const existing = saveTimers.get(path);
  if (existing !== undefined) window.clearTimeout(existing);
  saveTimers.set(
    path,
    window.setTimeout(() => {
      saveTimers.delete(path);
      void saveDocument(path);
    }, delay),
  );
}

/** Saves now (serialized after any in-flight save of the same file). */
export function saveDocument(path: RelPath): Promise<void> {
  const timer = saveTimers.get(path);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    saveTimers.delete(path);
  }
  const previous = saveChains.get(path) ?? Promise.resolve();
  const job = previous.then(() => writeNow(path)).catch(() => undefined);
  saveChains.set(path, job);
  void job.finally(() => {
    if (saveChains.get(path) === job) saveChains.delete(path);
  });
  return job;
}

async function writeNow(path: RelPath): Promise<void> {
  const entry = getDoc(path);
  const plugin = pluginFor(path);
  if (!entry || !plugin || entry.status !== 'ready' || !entry.dirty) return;
  const content = entry.content;
  let text: string;
  try {
    text = plugin.serialize(content);
  } catch (error) {
    patch(path, { saveError: error instanceof Error ? error.message : String(error) });
    return;
  }
  patch(path, { saving: true });
  const options = entry.hash && !entry.deletedOnDisk ? { expectedHash: entry.hash } : {};
  let result = await window.api.fs.writeFile(path, text, options);
  if (!result.ok && result.code === 'CONFLICT') {
    // Single user, local edits win: overwrite what changed on disk.
    result = await window.api.fs.writeFile(path, text);
  }
  const current = getDoc(path);
  if (!current) return;
  if (result.ok) {
    patch(path, {
      saving: false,
      saveError: null,
      hash: result.value.hash,
      deletedOnDisk: false,
      dirty: current.content !== content,
    });
  } else {
    patch(path, { saving: false, saveError: errorMessage(result.code, result.message) });
    showToast(`${translateKey('shell:status.saveFailed')}: ${titleFromPath(path)}`, 'error');
  }
}

/** Flushes pending and in-flight saves for files within `prefix` (all when omitted). */
export async function flushDocuments(prefix?: RelPath): Promise<void> {
  const docs = useDocuments.getState().docs;
  const jobs: Promise<void>[] = [];
  for (const path of Object.keys(docs)) {
    if (prefix !== undefined && !isWithin(path, prefix)) continue;
    const entry = docs[path];
    if (saveTimers.has(path) || entry?.dirty) jobs.push(saveDocument(path));
    else {
      const chain = saveChains.get(path);
      if (chain) jobs.push(chain);
    }
  }
  await Promise.all(jobs);
  await flushViewStates(prefix);
}

/** Drops a document no tab shows any more (after flushing its save). */
export async function releaseDocument(path: RelPath): Promise<void> {
  await flushDocuments(path === '' ? undefined : path);
  if (!getDoc(path)) return;
  histories.delete(path);
  viewStates.delete(path);
  useDocuments.setState((s) => {
    const docs = { ...s.docs };
    delete docs[path];
    return { docs };
  });
}

/* ------------------------------------------------------------------ disk changes */

async function reloadFromDisk(path: RelPath): Promise<void> {
  const plugin = pluginFor(path);
  const result = await window.api.fs.readFile(path);
  if (!plugin || !result.ok) return;
  const entry = getDoc(path);
  if (!entry || entry.dirty) return;
  try {
    const content = plugin.parse(result.value.content, path);
    histories.get(path)?.clear();
    patch(path, {
      status: 'ready',
      content,
      hash: result.value.stat.hash,
      deletedOnDisk: false,
      error: null,
      revision: entry.revision + 1,
      lastHistoryAction: undefined,
    });
    showToast(translateKey('shell:dialogs.fileChangedOnDisk', { name: titleFromPath(path) }));
  } catch (error) {
    patch(path, { status: 'error', error: error instanceof Error ? error.message : String(error) });
  }
}

/** Applies watcher events to open documents (SPEC section 8). */
export function handleFsEvents(events: readonly FsEvent[]): void {
  const docs = useDocuments.getState().docs;
  for (const event of events) {
    if (event.type === 'unlinkDir') {
      for (const path of Object.keys(docs)) {
        if (isWithin(path, event.path)) markDeleted(path);
      }
      continue;
    }
    const entry = docs[event.path];
    if (!entry) continue;
    if (event.type === 'unlink') {
      markDeleted(event.path);
    } else if (event.type === 'change' || event.type === 'add') {
      if (event.hash && event.hash === entry.hash) {
        if (entry.deletedOnDisk) patch(event.path, { deletedOnDisk: false });
        continue;
      }
      if (entry.status === 'missing' || entry.status === 'error') {
        void retryLoad(event.path);
      } else if (entry.dirty || saveTimers.has(event.path) || entry.saving) {
        // Keep local edits; adopt the new hash so the next save overwrites without conflict.
        patch(event.path, { hash: event.hash, deletedOnDisk: false });
        showToast(translateKey('shell:dialogs.fileChangedKeptLocal', { name: titleFromPath(event.path) }));
        scheduleSave(event.path);
      } else {
        void reloadFromDisk(event.path);
      }
    }
  }
}

function markDeleted(path: RelPath): void {
  const entry = getDoc(path);
  if (!entry || entry.deletedOnDisk) return;
  patch(path, { deletedOnDisk: true });
  showToast(translateKey('shell:dialogs.fileDeleted', { name: titleFromPath(path) }));
}

async function retryLoad(path: RelPath): Promise<void> {
  histories.delete(path);
  useDocuments.setState((s) => {
    const docs = { ...s.docs };
    delete docs[path];
    return { docs };
  });
  await ensureDocument(path);
}

/** Re-keys documents after an in-app rename/move of `from` to `to`. Flush saves first. */
export function rebaseDocuments(from: RelPath, to: RelPath): void {
  const docs = useDocuments.getState().docs;
  const affected = Object.keys(docs).filter((p) => isWithin(p, from));
  if (affected.length === 0) return;
  const next = { ...docs };
  for (const oldPath of affected) {
    const newPath = rebasePath(oldPath, from, to);
    const entry = next[oldPath]!;
    delete next[oldPath];
    next[newPath] = { ...entry, path: newPath };
    const history = histories.get(oldPath);
    if (history) {
      histories.delete(oldPath);
      histories.set(newPath, history);
    }
    const vs = viewStates.get(oldPath);
    if (vs) {
      viewStates.delete(oldPath);
      viewStates.set(newPath, vs);
      void window.api.viewState.set(viewStateKey(oldPath), undefined);
      void window.api.viewState.set(viewStateKey(newPath), vs);
    }
  }
  useDocuments.setState({ docs: next });
}

/* ------------------------------------------------------------------ view state */

export function getViewState<T>(path: RelPath, key: string): T | undefined {
  return viewStates.get(path)?.[key] as T | undefined;
}

export function setViewState(path: RelPath, key: string, value: unknown): void {
  const state = viewStates.get(path) ?? {};
  if (value === undefined) delete state[key];
  else state[key] = value;
  viewStates.set(path, state);
  const existing = viewStateTimers.get(path);
  if (existing !== undefined) window.clearTimeout(existing);
  viewStateTimers.set(
    path,
    window.setTimeout(() => {
      viewStateTimers.delete(path);
      void window.api.viewState.set(viewStateKey(path), viewStates.get(path) ?? {});
    }, 400),
  );
}

async function flushViewStates(prefix?: RelPath): Promise<void> {
  const writes: Promise<void>[] = [];
  for (const [path, timer] of [...viewStateTimers]) {
    if (prefix !== undefined && !isWithin(path, prefix)) continue;
    window.clearTimeout(timer);
    viewStateTimers.delete(path);
    writes.push(window.api.viewState.set(viewStateKey(path), viewStates.get(path) ?? {}));
  }
  await Promise.all(writes);
}

/** Drops every open document (workspace switch; tests). */
export function resetDocuments(): void {
  for (const t of saveTimers.values()) window.clearTimeout(t);
  for (const t of viewStateTimers.values()) window.clearTimeout(t);
  histories.clear();
  saveTimers.clear();
  saveChains.clear();
  viewStates.clear();
  viewStateTimers.clear();
  loading.clear();
  useDocuments.setState({ docs: {} });
}
