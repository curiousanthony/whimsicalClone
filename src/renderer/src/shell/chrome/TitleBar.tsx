/**
 * File header above the editor (Whimsical title bar): sidebar button when the sidebar is
 * hidden, breadcrumb (parent > name, click-to-rename), file actions chevron, save status,
 * search and export buttons on the right.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { kindFromPath } from '@shared/fileKinds';
import { useShortcutLabel } from '@renderer/core/shortcuts';
import { FileIcon, IconButton, Menu, useMenuState, type MenuEntry } from '@renderer/ui';
import { copyFileLink, duplicatePath, openPath, revealPath, trashPaths } from '../fileActions';
import { RenameInput } from '../sidebar/FileTree';
import { useDocuments } from '../state/documents';
import { usePrefs, useResolvedTheme } from '../state/prefs';
import { useActiveTab } from '../state/tabs';
import { openOverlay, useUi } from '../state/ui';
import { toggleFavorite, useWorkspace } from '../state/workspace';
import { displayName, parentOf } from '../tree';

export function TitleBar(): JSX.Element {
  const { t } = useTranslation('shell');
  const tab = useActiveTab();
  const pinned = usePrefs((s) => s.prefs.sidebarPinned);
  const rootName = useWorkspace((s) => s.info?.name ?? '');
  const favorites = useWorkspace((s) => s.meta.favorites);
  const meta = useWorkspace((s) => s.meta);
  const titleRename = useUi((s) => s.titleRename);
  const theme = useResolvedTheme();
  const path = tab && tab.kind !== 'home' ? tab.path : null;
  const doc = useDocuments((s) => (path !== null ? s.docs[path] : undefined));
  const menu = useMenuState();
  const [items, setItems] = useState<MenuEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const lastRename = useRef(titleRename);
  const searchLabel = useShortcutLabel('app.searchFile');
  const exportLabel = useShortcutLabel('app.export');
  const sidebarLabel = useShortcutLabel('app.toggleSidebar');

  useEffect(() => {
    if (titleRename !== lastRename.current) {
      lastRename.current = titleRename;
      if (path) setEditing(true);
    }
  }, [titleRename, path]);

  useEffect(() => {
    const title = tab?.kind === 'home' ? t('tabs.home') : path !== null ? displayName(path, rootName) : rootName;
    void window.api.app.setWindowTitle(rootName ? `${title} — ${rootName}` : title);
  }, [tab, path, rootName, t]);

  const fileActions = (anchor: HTMLElement) => {
    if (path === null || path === '') return;
    const favorite = favorites.includes(path);
    const isFile = tab?.kind === 'file';
    const entries: MenuEntry[] = [
      { type: 'item', label: t('contextMenu.rename'), icon: 'Pencil', onSelect: () => startRename() },
      {
        type: 'item',
        label: t('contextMenu.duplicate'),
        icon: 'Copy',
        onSelect: () => void duplicatePath(path).then((p) => p && openPath(p)),
      },
      {
        type: 'item',
        label: favorite ? t('contextMenu.removeFavorite') : t('contextMenu.addFavorite'),
        icon: 'Star',
        onSelect: () => void toggleFavorite(path),
      },
    ];
    if (isFile) {
      entries.push(
        { type: 'separator' },
        {
          type: 'item',
          label: t('commands.export'),
          icon: 'Download',
          shortcut: exportLabel,
          onSelect: () => openOverlay('export'),
        },
        { type: 'item', label: t('commands.print'), icon: 'Printer', onSelect: () => window.print() },
        { type: 'item', label: t('contextMenu.copyLink'), icon: 'Link', onSelect: () => void copyFileLink(path) },
      );
    }
    entries.push(
      { type: 'item', label: t('contextMenu.revealInFinder'), icon: 'FolderSearch', onSelect: () => revealPath(path) },
      { type: 'separator' },
      {
        type: 'item',
        label: t('contextMenu.moveToTrash'),
        icon: 'Trash2',
        danger: true,
        onSelect: () => void trashPaths([path]),
      },
    );
    setItems(entries);
    menu.open(anchor);
  };

  const startRename = () => {
    if (path === null || path === '') return;
    setEditing(true);
  };

  const parent = path !== null && path !== '' ? parentOf(path) : null;
  const title = tab?.kind === 'home' ? t('tabs.home') : path !== null ? displayName(path, rootName) : '';
  const custom = path !== null ? meta.fileIcons[path] : undefined;

  return (
    <header className="shell-titlebar">
      <div className="shell-titlebar__left">
        {!pinned && (
          <IconButton
            icon="PanelLeft"
            label={t('titleBar.showSidebar')}
            shortcut={sidebarLabel}
            onMouseEnter={() => useUi.setState({ sidebarPeek: true })}
            onClick={() => useUi.setState((s) => ({ sidebarPeek: !s.sidebarPeek }))}
          />
        )}
        {parent !== null && (
          <>
            <button type="button" className="shell-breadcrumb" onClick={() => openPath(parent)}>
              {parent === '' ? rootName : displayName(parent)}
            </button>
            <ChevronRight size={14} className="shell-breadcrumb__sep" aria-hidden />
          </>
        )}
        {path !== null && tab?.kind !== 'home' && (
          <FileIcon
            kind={tab?.kind === 'folder' ? 'folder' : kindFromPath(path)}
            customIcon={custom?.icon}
            customColor={custom?.color}
            dark={theme === 'dark'}
          />
        )}
        {editing && path ? (
          <RenameInput
            path={path}
            initial={tab?.kind === 'folder' ? (path.split('/').pop() ?? '') : displayName(path)}
            className="shell-title-input"
            onDone={() => setEditing(false)}
          />
        ) : (
          <button
            type="button"
            className="shell-title"
            onClick={startRename}
            disabled={path === null || path === ''}
            title={t('titleBar.rename')}
          >
            {title}
          </button>
        )}
        {path !== null && path !== '' && (
          <button
            type="button"
            className="shell-title-actions"
            aria-label={t('titleBar.fileActions')}
            onClick={(e) => fileActions(e.currentTarget)}
          >
            <ChevronDown size={14} aria-hidden />
          </button>
        )}
        {doc && <SaveStatus saving={doc.saving} dirty={doc.dirty} error={doc.saveError} />}
      </div>
      <div className="shell-titlebar__right">
        <IconButton
          icon="Search"
          label={t('titleBar.search')}
          shortcut={searchLabel}
          onClick={() => useUi.setState({ search: 'file' })}
        />
        <IconButton
          icon="Download"
          label={t('titleBar.export')}
          shortcut={exportLabel}
          disabled={tab?.kind !== 'file'}
          onClick={() => openOverlay('export')}
        />
      </div>
      {menu.anchor && <Menu items={items} anchor={menu.anchor} onClose={menu.close} />}
    </header>
  );
}

function SaveStatus({
  saving,
  dirty,
  error,
}: {
  saving: boolean;
  dirty: boolean;
  error: string | null;
}): JSX.Element | null {
  const { t } = useTranslation('shell');
  if (error) return <span className="shell-save-status is-error">{t('status.saveFailed')}</span>;
  if (saving) return <span className="shell-save-status">{t('status.saving')}</span>;
  if (dirty)
    return (
      <span className="shell-save-status" aria-label={t('status.unsaved')}>
        •
      </span>
    );
  return null;
}
