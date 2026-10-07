/**
 * Left sidebar (Whimsical: workspace switcher, "Create new", Recent, Favorites, the
 * workspace tree, settings at the bottom). Pinnable (Cmd+E), resizable by its right edge.
 * While it has keyboard focus the active scopes are ["folderView"].
 */

import { clsx } from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { kindFromPath } from '@shared/fileKinds';
import type { RelPath } from '@shared/ipc';
import { useShortcutLabel } from '@renderer/core/shortcuts';
import { Button, FileIcon, IconButton, Menu, useMenuState, type MenuEntry } from '@renderer/ui';
import { createMenuEntries } from '../createMenu';
import { openPath } from '../fileActions';
import { nodeMenuEntries } from '../nodeMenu';
import { setPrefs, useResolvedTheme, usePrefs } from '../state/prefs';
import { useActiveTab, useTabs } from '../state/tabs';
import { openOverlay, useUi } from '../state/ui';
import { pickWorkspace, useWorkspace } from '../state/workspace';
import { displayName, findNode } from '../tree';
import { blurActive, FileTree } from './FileTree';
import { switchWorkspace } from '../workspaceSession';

const RECENT_IN_SIDEBAR = 5;

export function Sidebar({ floating = false }: { floating?: boolean }): JSX.Element {
  const { t } = useTranslation('shell');
  const width = usePrefs((s) => s.prefs.sidebarWidth);
  const pinned = usePrefs((s) => s.prefs.sidebarPinned);
  const info = useWorkspace((s) => s.info);
  const tree = useWorkspace((s) => s.tree);
  const favorites = useWorkspace((s) => s.meta.favorites);
  const recent = useTabs((s) => s.recent);
  const createLabel = useShortcutLabel('app.newBoard');
  const toggleLabel = useShortcutLabel('app.toggleSidebar');
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [expanded, setExpandedState] = useState<Set<RelPath>>(new Set());
  const [sections, setSections] = useState({ recent: true, favorites: true, files: true });
  const menu = useMenuState();
  const [menuItems, setMenuItems] = useState<MenuEntry[]>([]);
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void window.api.viewState.get<string[]>('sidebar:expanded').then((saved) => {
      if (Array.isArray(saved)) setExpandedState(new Set(saved));
    });
    void window.api.viewState.get<typeof sections>('sidebar:sections').then((saved) => {
      if (saved && typeof saved === 'object') setSections((s) => ({ ...s, ...saved }));
    });
  }, [info?.rootPath]);

  // An unmounted sidebar (unpinned while focused) must not keep the folderView scope.
  useEffect(() => () => useUi.setState({ folderFocus: false }), []);

  const setExpanded = useCallback((next: Set<RelPath>) => {
    setExpandedState(next);
    void window.api.viewState.set('sidebar:expanded', [...next]);
  }, []);

  const toggleSection = (key: keyof typeof sections) => {
    setSections((s) => {
      const next = { ...s, [key]: !s[key] };
      void window.api.viewState.set('sidebar:sections', next);
      return next;
    });
  };

  const openWorkspaceMenu = (anchor: HTMLElement) => {
    setMenuItems([
      {
        type: 'item',
        label: t('sidebar.openAnother'),
        icon: 'FolderOpen',
        onSelect: () => void pickWorkspace().then((i) => i && switchWorkspace(i)),
      },
      {
        type: 'item',
        label: t('sidebar.revealWorkspace'),
        icon: 'FolderSearch',
        onSelect: () => void window.api.fs.revealInFinder(''),
      },
      { type: 'separator' },
      {
        type: 'item',
        label: t('commands.closeWorkspace'),
        icon: 'FolderX',
        onSelect: () => void switchWorkspace(null),
      },
    ]);
    menu.open(anchor);
  };

  const onResizeStart = (e: ReactPointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    let latest = startWidth;
    const onMove = (ev: PointerEvent) => {
      latest = Math.min(480, Math.max(200, startWidth + ev.clientX - startX));
      setLiveWidth(latest);
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      setLiveWidth(null);
      void setPrefs({ sidebarWidth: latest });
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  };

  const recentFiles = recent.filter((p) => findNode(tree, p)).slice(0, RECENT_IN_SIDEBAR);
  const favoriteNodes = favorites.map((p) => findNode(tree, p)).filter((n): n is NonNullable<typeof n> => !!n);

  return (
    <aside
      ref={asideRef}
      className={clsx('shell-sidebar', floating && 'is-floating')}
      style={{ width: liveWidth ?? width }}
      onFocus={() => useUi.setState({ folderFocus: true })}
      onBlur={(e) => {
        if (!asideRef.current?.contains(e.relatedTarget as Node | null)) useUi.setState({ folderFocus: false });
      }}
      onMouseLeave={() => {
        if (floating) useUi.setState({ sidebarPeek: false });
      }}
    >
      <div className="shell-sidebar__header">
        <button
          type="button"
          className="shell-workspace-button"
          onClick={(e) => openWorkspaceMenu(e.currentTarget)}
          aria-label={t('sidebar.workspaceMenu')}
        >
          <span className="shell-workspace-button__avatar">{(info?.name ?? '?').slice(0, 1).toUpperCase()}</span>
          <span className="shell-workspace-button__name">{info?.name}</span>
          <ChevronDown size={14} aria-hidden />
        </button>
        <IconButton
          icon={pinned ? 'PanelLeftClose' : 'Pin'}
          label={pinned ? t('sidebar.unpin') : t('sidebar.pin')}
          shortcut={toggleLabel}
          size="sm"
          onClick={() => {
            void setPrefs({ sidebarPinned: !pinned });
            useUi.setState({ sidebarPeek: false });
          }}
        />
      </div>

      <div className="shell-sidebar__create">
        <Button
          variant="ghost"
          icon="SquarePlus"
          className="shell-create-button"
          title={createLabel ? `${t('sidebar.create')} (${createLabel})` : t('sidebar.create')}
          onClick={(e) => {
            setMenuItems(createMenuEntries());
            menu.open(e.currentTarget);
          }}
        >
          {t('sidebar.create')}
        </Button>
      </div>

      <nav className="shell-sidebar__scroll">
        <Section
          title={t('sidebar.recent')}
          icon="Clock"
          open={sections.recent}
          onToggle={() => toggleSection('recent')}
        >
          {recentFiles.length === 0 ? (
            <div className="shell-sidebar__hint">{t('sidebar.noRecent')}</div>
          ) : (
            recentFiles.map((path) => (
              <FlatRow key={path} path={path} onMenu={(items, anchor) => (setMenuItems(items), menu.open(anchor))} />
            ))
          )}
        </Section>
        <Section
          title={t('sidebar.favorites')}
          icon="Star"
          open={sections.favorites}
          onToggle={() => toggleSection('favorites')}
        >
          {favoriteNodes.length === 0 ? (
            <div className="shell-sidebar__hint">{t('sidebar.noFavorites')}</div>
          ) : (
            favoriteNodes.map((node) => (
              <FlatRow
                key={node.path}
                path={node.path}
                onMenu={(items, anchor) => (setMenuItems(items), menu.open(anchor))}
              />
            ))
          )}
        </Section>
        <Section
          title={info?.name ?? t('sidebar.files')}
          icon="HardDrive"
          open={sections.files}
          onToggle={() => toggleSection('files')}
          action={
            <IconButton
              icon="Plus"
              label={t('sidebar.create')}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setMenuItems(createMenuEntries(''));
                menu.open(e.currentTarget);
              }}
            />
          }
        >
          <FileTree expanded={expanded} setExpanded={setExpanded} />
        </Section>
      </nav>

      <div className="shell-sidebar__footer">
        <SidebarLink icon="Keyboard" label={t('sidebar.shortcuts')} onClick={() => openOverlay('help')} />
        <SidebarLink icon="Settings" label={t('sidebar.settings')} onClick={() => openOverlay('preferences')} />
      </div>
      {!floating && (
        <div
          className="shell-sidebar__resize"
          role="separator"
          aria-label={t('sidebar.resize')}
          onPointerDown={onResizeStart}
        />
      )}
      {menu.anchor && <Menu items={menuItems} anchor={menu.anchor} onClose={menu.close} />}
    </aside>
  );
}

function Section({
  title,
  icon,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  icon: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="shell-sidebar__section">
      <div className="shell-sidebar__section-header" onClick={onToggle} role="button" aria-expanded={open}>
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={clsx('shell-sidebar__section-chevron', open && 'is-open')}
          aria-hidden
        />
        <span className="shell-sidebar__section-title" data-icon={icon}>
          {title}
        </span>
        {action && <span className="shell-sidebar__section-action">{action}</span>}
      </div>
      {open && <div className="shell-sidebar__section-body">{children}</div>}
    </section>
  );
}

function FlatRow({
  path,
  onMenu,
}: {
  path: RelPath;
  onMenu: (items: MenuEntry[], anchor: { x: number; y: number }) => void;
}): JSX.Element {
  const tree = useWorkspace((s) => s.tree);
  const meta = useWorkspace((s) => s.meta);
  const theme = useResolvedTheme();
  const active = useActiveTab();
  const node = findNode(tree, path);
  const isFolder = node?.type === 'folder';
  const custom = meta.fileIcons[path];
  return (
    <div
      className={clsx('shell-tree__row', active && active.kind !== 'home' && active.path === path && 'is-active')}
      style={{ paddingLeft: 26 }}
      onClick={(e) => {
        openPath(path, { newTab: e.metaKey });
        blurActive();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (node) onMenu(nodeMenuEntries(node), { x: e.clientX, y: e.clientY });
      }}
    >
      <FileIcon
        kind={isFolder ? 'folder' : kindFromPath(path)}
        customIcon={custom?.icon}
        customColor={custom?.color}
        dark={theme === 'dark'}
      />
      <span className="shell-tree__name">{displayName(path)}</span>
    </div>
  );
}

function SidebarLink({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }): JSX.Element {
  return (
    <Button variant="ghost" icon={icon} className="shell-sidebar__link" onClick={onClick}>
      {label}
    </Button>
  );
}
