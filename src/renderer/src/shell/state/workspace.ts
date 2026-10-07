/**
 * Open workspace of this window: info, file tree (refreshed from watcher events) and
 * metadata (favourites, custom icons, manual order).
 */

import { create } from 'zustand';
import type { IpcResult, RelPath, TreeNode, WorkspaceInfo, WorkspaceMeta } from '@shared/ipc';
import { translateKey } from '@renderer/i18n';
import { errorMessage, showToast } from './ui';

const EMPTY_META: WorkspaceMeta = { version: 1, favorites: [], fileIcons: {}, manualOrder: {} };

interface WorkspaceState {
  status: 'booting' | 'welcome' | 'ready';
  info: WorkspaceInfo | null;
  tree: TreeNode | null;
  meta: WorkspaceMeta;
  /** Monotonic counter bumped on every tree refresh. */
  treeVersion: number;
}

export const useWorkspace = create<WorkspaceState>()(() => ({
  status: 'booting',
  info: null,
  tree: null,
  meta: EMPTY_META,
  treeVersion: 0,
}));

/** Unwraps an IpcResult, showing a toast and returning undefined on failure. */
export function unwrap<T>(result: IpcResult<T>, quiet = false): T | undefined {
  if (result.ok) return result.value;
  if (!quiet) showToast(errorMessage(result.code, result.message), 'error');
  return undefined;
}

let refreshTimer: number | null = null;
let refreshing: Promise<void> | null = null;

export async function refreshTree(): Promise<void> {
  if (refreshing) {
    await refreshing;
  }
  refreshing = (async () => {
    const result = await window.api.fs.listTree();
    if (result.ok) useWorkspace.setState((s) => ({ tree: result.value, treeVersion: s.treeVersion + 1 }));
  })();
  try {
    await refreshing;
  } finally {
    refreshing = null;
  }
}

/** Debounced refresh used for bursts of watcher events. */
export function scheduleTreeRefresh(delay = 80): void {
  if (refreshTimer !== null) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    void refreshTree();
  }, delay);
}

export async function loadMeta(): Promise<void> {
  const result = await window.api.workspace.readMeta();
  useWorkspace.setState({ meta: result.ok ? result.value : EMPTY_META });
}

export async function updateMeta(update: (meta: WorkspaceMeta) => WorkspaceMeta): Promise<void> {
  const next = update(useWorkspace.getState().meta);
  useWorkspace.setState({ meta: next });
  unwrap(await window.api.workspace.writeMeta(next));
}

export function isFavorite(path: RelPath): boolean {
  return useWorkspace.getState().meta.favorites.includes(path);
}

export async function toggleFavorite(path: RelPath): Promise<void> {
  await updateMeta((m) => ({
    ...m,
    favorites: m.favorites.includes(path) ? m.favorites.filter((p) => p !== path) : [...m.favorites, path],
  }));
}

/** Sets the workspace after main opened it. */
export async function adoptWorkspace(info: WorkspaceInfo): Promise<void> {
  useWorkspace.setState({ info, status: 'ready', tree: null, meta: EMPTY_META });
  await Promise.all([refreshTree(), loadMeta()]);
}

export async function pickWorkspace(): Promise<WorkspaceInfo | null> {
  const result = await window.api.workspace.pick(translateKey('shell:welcome.dialogTitle'));
  const info = unwrap(result);
  return info ?? null;
}

export async function openWorkspacePath(absPath: string, quiet = false): Promise<WorkspaceInfo | null> {
  const result = await window.api.workspace.open(absPath);
  if (!result.ok) {
    if (!quiet) showToast(translateKey('shell:welcome.openFailed', { path: absPath }), 'error');
    return null;
  }
  return result.value;
}
