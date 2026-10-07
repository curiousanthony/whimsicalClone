/**
 * Tab strip in the window title area (macOS hidden-inset traffic lights on the left).
 * Right-click: copy link, duplicate, pin, close, close others. Drag to reorder.
 */

import { clsx } from 'clsx';
import { Pin, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { kindFromPath } from '@shared/fileKinds';
import { useShortcutLabel } from '@renderer/core/shortcuts';
import { FileIcon, Menu, Tooltip, useMenuState, type MenuEntry } from '@renderer/ui';
import { copyFileLink } from '../fileActions';
import { useDocuments } from '../state/documents';
import { useResolvedTheme } from '../state/prefs';
import {
  activateTab,
  closeOtherTabs,
  closeTab,
  duplicateTab,
  moveTab,
  openHomeTab,
  togglePinTab,
  useTabs,
  type Tab,
} from '../state/tabs';
import { useWorkspace } from '../state/workspace';
import { displayName } from '../tree';

const TAB_MIME = 'application/x-wc-tab';

export function requestCloseTab(id: string): void {
  if (!closeTab(id)) window.close();
}

export function TabBar(): JSX.Element {
  const { t } = useTranslation('shell');
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const newTabLabel = useShortcutLabel('tab.new');
  const menu = useMenuState();
  const [menuItems, setMenuItems] = useState<MenuEntry[]>([]);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const openMenu = (tab: Tab, x: number, y: number) => {
    const items: MenuEntry[] = [];
    if (tab.kind === 'file')
      items.push({
        type: 'item',
        label: t('tabs.copyLink'),
        icon: 'Link',
        onSelect: () => void copyFileLink(tab.path),
      });
    items.push(
      { type: 'item', label: t('tabs.duplicate'), icon: 'Copy', onSelect: () => duplicateTab(tab.id) },
      {
        type: 'item',
        label: tab.pinned ? t('tabs.unpin') : t('tabs.pin'),
        icon: tab.pinned ? 'PinOff' : 'Pin',
        onSelect: () => togglePinTab(tab.id),
      },
      { type: 'separator' },
      { type: 'item', label: t('tabs.close'), icon: 'X', onSelect: () => requestCloseTab(tab.id) },
      { type: 'item', label: t('tabs.closeOthers'), onSelect: () => closeOtherTabs(tab.id) },
    );
    setMenuItems(items);
    menu.open({ x, y });
  };

  return (
    <div className="shell-tabbar" role="tablist">
      <div className="shell-tabbar__tabs">
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            dropBefore={dropIndex === index}
            onContextMenu={(x, y) => openMenu(tab, x, y)}
            onDragOver={() => setDropIndex(index)}
            onDrop={(id) => {
              setDropIndex(null);
              moveTab(id, index);
            }}
          />
        ))}
        <Tooltip label={t('tabs.newTab')} shortcut={newTabLabel}>
          <button
            type="button"
            className="shell-tabbar__new"
            aria-label={t('tabs.newTab')}
            onClick={() => openHomeTab()}
          >
            <Plus size={16} aria-hidden />
          </button>
        </Tooltip>
      </div>
      {menu.anchor && <Menu items={menuItems} anchor={menu.anchor} onClose={menu.close} />}
    </div>
  );
}

function TabItem({
  tab,
  active,
  dropBefore,
  onContextMenu,
  onDragOver,
  onDrop,
}: {
  tab: Tab;
  active: boolean;
  dropBefore: boolean;
  onContextMenu: (x: number, y: number) => void;
  onDragOver: () => void;
  onDrop: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation('shell');
  const theme = useResolvedTheme();
  const rootName = useWorkspace((s) => s.info?.name ?? '');
  const meta = useWorkspace((s) => s.meta);
  const doc = useDocuments((s) => (tab.kind === 'file' ? s.docs[tab.path] : undefined));
  const title = tab.kind === 'home' ? t('tabs.home') : displayName(tab.path, rootName);
  const custom = tab.kind === 'home' ? undefined : meta.fileIcons[tab.path];
  return (
    <div
      role="tab"
      aria-selected={active}
      className={clsx(
        'shell-tab',
        active && 'is-active',
        tab.pinned && 'is-pinned',
        dropBefore && 'is-drop-before',
        doc?.deletedOnDisk && 'is-deleted',
      )}
      title={tab.kind === 'home' ? title : tab.path || rootName}
      draggable
      onDragStart={(e) => e.dataTransfer.setData(TAB_MIME, tab.id)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TAB_MIME)) return;
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(TAB_MIME);
        if (id) onDrop(id);
      }}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          requestCloseTab(tab.id);
        } else if (e.button === 0) activateTab(tab.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
    >
      {tab.kind === 'home' ? (
        <FileIcon kind={null} customIcon="House" size={14} />
      ) : (
        <FileIcon
          kind={tab.kind === 'folder' ? 'folder' : kindFromPath(tab.path)}
          size={14}
          customIcon={custom?.icon}
          customColor={custom?.color}
          dark={theme === 'dark'}
        />
      )}
      {!tab.pinned && <span className="shell-tab__title">{title}</span>}
      {tab.pinned ? (
        <Pin size={10} className="shell-tab__pin" aria-hidden />
      ) : (
        <button
          type="button"
          className={clsx('shell-tab__close', doc?.dirty && 'is-dirty')}
          aria-label={t('tabs.closeTab', { name: title })}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            requestCloseTab(tab.id);
          }}
        >
          <X size={12} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}
