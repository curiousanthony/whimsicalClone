/**
 * File and folder operations from the UI (create, rename, move, duplicate, trash, links),
 * keeping open tabs, documents, exporters and recents in sync.
 */

import { extensionOf, getFileKindInfo, kindFromPath, type FileKind } from '@shared/fileKinds';
import type { RelPath } from '@shared/ipc';
import { editorRegistry } from '@renderer/app/editors';
import { translateKey } from '@renderer/i18n';
import { rebaseExporters } from './exporters';
import { flushDocuments, rebaseDocuments } from './state/documents';
import { activeTab, forgetRecent, openFile, openFolder, rebaseTabs } from './state/tabs';
import { showToast, useUi } from './state/ui';
import { loadMeta, refreshTree, unwrap, useWorkspace } from './state/workspace';
import { baseName, containingFolder, displayName, fileLink, findNode, parentOf } from './tree';

/** Folder where "New ..." commands create files: tree selection, folder view, active file's folder, root. */
export function defaultCreateDir(): RelPath {
  const { tree } = useWorkspace.getState();
  const selection = useUi.getState().treeSelection;
  if (useUi.getState().folderFocus && selection.length > 0)
    return containingFolder(tree, selection[selection.length - 1]);
  const tab = activeTab();
  if (tab?.kind === 'folder') return tab.path;
  if (tab?.kind === 'file') return parentOf(tab.path);
  return '';
}

export async function createDocument(
  kind: FileKind,
  dir: RelPath = defaultCreateDir(),
  options: { newTab?: boolean } = {},
): Promise<RelPath | null> {
  const plugin = editorRegistry.forKind(kind);
  if (!plugin) return null;
  const ext = plugin.extensions[0] ?? getFileKindInfo(kind).extension;
  const name = translateKey(plugin.newFileNameKey);
  const content = plugin.serialize(plugin.createEmpty());
  const path = unwrap(await window.api.fs.createFile(dir, name, ext, content));
  if (!path) return null;
  await refreshTree();
  openFile(path, { newTab: options.newTab ?? false });
  // Whimsical focuses the title of a new file for naming.
  useUi.setState((s) => ({ titleRename: s.titleRename + 1 }));
  return path;
}

export async function createFolder(dir: RelPath = defaultCreateDir()): Promise<RelPath | null> {
  const path = unwrap(await window.api.fs.createFolder(dir, translateKey('common:newFile.folder')));
  if (!path) return null;
  await refreshTree();
  useUi.setState({ renaming: path });
  return path;
}

async function applyRebase(from: RelPath, to: RelPath): Promise<void> {
  rebaseDocuments(from, to);
  rebaseExporters(from, to);
  rebaseTabs(from, to);
  useUi.setState((s) => ({ treeSelection: s.treeSelection.map((p) => (p === from ? to : p)) }));
  await Promise.all([refreshTree(), loadMeta()]);
}

/**
 * Renames a file or folder. For documents `title` is the name without extension (the
 * extension is kept); for folders and other files it is the full name.
 */
export async function renamePath(path: RelPath, title: string): Promise<RelPath | null> {
  const trimmed = title.trim();
  if (!trimmed || path === '') return null;
  const node = findNode(useWorkspace.getState().tree, path);
  const isDocument = node?.type !== 'folder' && kindFromPath(path) !== null;
  const ext = isDocument ? extensionOf(path) : '';
  // Keep the original extension spelling ("Notes.MD" stays ".MD").
  const newName = isDocument ? `${trimmed}${baseName(path).slice(baseName(path).length - ext.length)}` : trimmed;
  if (newName === baseName(path)) return path;
  await flushDocuments(path);
  const to = unwrap(await window.api.fs.rename(path, newName));
  if (!to) return null;
  await applyRebase(path, to);
  return to;
}

export async function movePath(path: RelPath, destDir: RelPath): Promise<RelPath | null> {
  await flushDocuments(path);
  const result = await window.api.fs.move(path, destDir);
  if (!result.ok) {
    showToast(
      translateKey('shell:dialogs.moveFailed', {
        name: displayName(path),
        message: translateKey(`common:errors.${result.code}`),
      }),
      'error',
    );
    return null;
  }
  if (result.value !== path) await applyRebase(path, result.value);
  return result.value;
}

export async function duplicatePath(path: RelPath): Promise<RelPath | null> {
  await flushDocuments(path);
  const copy = unwrap(await window.api.fs.duplicate(path));
  if (!copy) return null;
  await refreshTree();
  return copy;
}

/** Asks for confirmation, then moves the paths to the macOS Trash. */
export async function trashPaths(paths: readonly RelPath[]): Promise<boolean> {
  const unique = [...new Set(paths)].filter((p) => p !== '');
  if (unique.length === 0) return false;
  const message =
    unique.length === 1
      ? translateKey('shell:dialogs.deleteTitle', { name: displayName(unique[0]!) })
      : translateKey('shell:dialogs.deleteMany', { count: unique.length });
  const confirmed = await window.api.app.confirm({
    message,
    detail: translateKey('shell:dialogs.deleteDetail'),
    confirmLabel: translateKey('shell:dialogs.confirmDelete'),
    cancelLabel: translateKey('common:actions.cancel'),
    destructive: true,
  });
  if (!confirmed) return false;
  for (const path of unique) {
    await flushDocuments(path);
    const ok = unwrap(await window.api.fs.trash(path));
    if (ok !== undefined) forgetRecent(path);
  }
  useUi.setState({ treeSelection: [] });
  await Promise.all([refreshTree(), loadMeta()]);
  return true;
}

export function openPath(path: RelPath, options: { newTab?: boolean } = {}): void {
  if (kindFromPath(path)) openFile(path, options);
  else openFolder(path, options);
}

export async function copyFileLink(path: RelPath): Promise<void> {
  await navigator.clipboard.writeText(fileLink(path));
  showToast(translateKey('shell:dialogs.linkCopied'));
}

export function revealPath(path: RelPath): void {
  void window.api.fs.revealInFinder(path);
}
