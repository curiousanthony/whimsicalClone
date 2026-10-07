/** Right-click menu of a file or folder (sidebar tree, folder view). */

import type { TreeNode } from '@shared/ipc';
import { translateKey } from '@renderer/i18n';
import type { MenuEntry } from '@renderer/ui';
import { createMenuEntries } from './createMenu';
import { copyFileLink, duplicatePath, openPath, revealPath, trashPaths } from './fileActions';
import { useUi } from './state/ui';
import { toggleFavorite, useWorkspace } from './state/workspace';

export function nodeMenuEntries(node: TreeNode, selection: readonly string[] = []): MenuEntry[] {
  const t = (key: string) => translateKey(`shell:contextMenu.${key}`);
  const isFolder = node.type === 'folder';
  const favorite = useWorkspace.getState().meta.favorites.includes(node.path);
  const targets = selection.includes(node.path) && selection.length > 1 ? selection : [node.path];
  const entries: MenuEntry[] = [
    {
      type: 'item',
      label: t('open'),
      icon: isFolder ? 'FolderOpen' : 'SquareArrowOutUpRight',
      onSelect: () => openPath(node.path),
    },
    {
      type: 'item',
      label: t('openInNewTab'),
      icon: 'AppWindow',
      onSelect: () => openPath(node.path, { newTab: true }),
    },
  ];
  if (!isFolder && node.kind) {
    entries.push({
      type: 'item',
      label: t('openInNewWindow'),
      icon: 'PanelTop',
      onSelect: () => void window.api.app.newWindow(node.path),
    });
  }
  if (isFolder) {
    entries.push(
      { type: 'separator' },
      { type: 'submenu', label: t('new'), icon: 'Plus', items: createMenuEntries(node.path) },
    );
  }
  entries.push(
    { type: 'separator' },
    { type: 'item', label: t('rename'), icon: 'Pencil', onSelect: () => useUi.setState({ renaming: node.path }) },
    { type: 'item', label: t('duplicate'), icon: 'Copy', onSelect: () => void duplicatePath(node.path) },
    {
      type: 'item',
      label: favorite ? t('removeFavorite') : t('addFavorite'),
      icon: favorite ? 'StarOff' : 'Star',
      onSelect: () => void toggleFavorite(node.path),
    },
  );
  if (!isFolder)
    entries.push({ type: 'item', label: t('copyLink'), icon: 'Link', onSelect: () => void copyFileLink(node.path) });
  entries.push(
    { type: 'item', label: t('revealInFinder'), icon: 'FolderSearch', onSelect: () => revealPath(node.path) },
    { type: 'separator' },
    { type: 'item', label: t('moveToTrash'), icon: 'Trash2', danger: true, onSelect: () => void trashPaths(targets) },
  );
  return entries;
}
