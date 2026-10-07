/**
 * Sidebar file tree: folders = folders, documents = files. Disclosure arrows, per-kind
 * icons, inline rename, context menu, drag-and-drop move, Shift+click multi-select and
 * keyboard navigation (arrows; Return and Delete go through the folderView shortcuts).
 */

import { clsx } from 'clsx';
import { ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { RelPath, TreeNode } from '@shared/ipc';
import { FileIcon, Menu, useMenuState, type MenuEntry } from '@renderer/ui';
import { createMenuEntries } from '../createMenu';
import { movePath, openPath, renamePath, trashPaths } from '../fileActions';
import { nodeMenuEntries } from '../nodeMenu';
import { clearFolderSurface, setFolderSurface, type FolderSurface } from '../state/folderSurface';
import { useResolvedTheme } from '../state/prefs';
import { useActiveTab } from '../state/tabs';
import { useUi } from '../state/ui';
import { useWorkspace } from '../state/workspace';
import { canMoveInto, displayName, findNode, parentOf, visibleRows } from '../tree';

export const DRAG_MIME = 'application/x-wc-path';

export function blurActive(): void {
  const el = document.activeElement as HTMLElement | null;
  el?.blur?.();
}

interface FileTreeProps {
  expanded: ReadonlySet<RelPath>;
  setExpanded: (next: Set<RelPath>) => void;
}

export function FileTree({ expanded, setExpanded }: FileTreeProps): JSX.Element {
  const { t } = useTranslation('shell');
  const tree = useWorkspace((s) => s.tree);
  const meta = useWorkspace((s) => s.meta);
  const selection = useUi((s) => s.treeSelection);
  const renaming = useUi((s) => s.renaming);
  const activeTab = useActiveTab();
  const activePath = activeTab && activeTab.kind !== 'home' ? activeTab.path : null;
  const theme = useResolvedTheme();
  const rows = useMemo(() => visibleRows(tree, expanded, meta), [tree, expanded, meta]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menu = useMenuState();
  const [menuItems, setMenuItems] = useState<MenuEntry[]>([]);
  const [dropTarget, setDropTarget] = useState<RelPath | null>(null);
  const anchorRef = useRef<RelPath | null>(null);

  // Expand ancestors of a path that must be visible (rename of a new folder, active file).
  useEffect(() => {
    if (!renaming) return;
    const parents: string[] = [];
    for (let p = parentOf(renaming); p !== ''; p = parentOf(p)) parents.push(p);
    if (parents.some((p) => !expanded.has(p))) setExpanded(new Set([...expanded, ...parents]));
  }, [renaming, expanded, setExpanded]);

  const select = (paths: RelPath[]) => useUi.setState({ treeSelection: paths });

  const expandedRef = useRef({ expanded, setExpanded });
  expandedRef.current = { expanded, setExpanded };

  const toggle = (path: RelPath) => {
    const { expanded, setExpanded } = expandedRef.current;
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
  };

  const surface = useMemo<FolderSurface>(
    () => ({
      open: () => {
        const sel = useUi.getState().treeSelection;
        const last = sel[sel.length - 1];
        if (last === undefined) return;
        const node = findNode(useWorkspace.getState().tree, last);
        if (node?.type === 'folder') toggle(last);
        else {
          openPath(last);
          blurActive();
        }
      },
      deleteSelection: () => void trashPaths(useUi.getState().treeSelection),
    }),
    [],
  );
  useEffect(() => () => clearFolderSurface(surface), [surface]);

  const onRowClick = (e: MouseEvent, node: TreeNode) => {
    if (e.shiftKey) {
      // Shift+click: toggle the row in a multi-selection.
      const current = useUi.getState().treeSelection;
      select(current.includes(node.path) ? current.filter((p) => p !== node.path) : [...current, node.path]);
      anchorRef.current = node.path;
      return;
    }
    select([node.path]);
    anchorRef.current = node.path;
    if (node.type === 'folder') {
      if (!expanded.has(node.path)) toggle(node.path);
      openPath(node.path, { newTab: e.metaKey });
    } else {
      openPath(node.path, { newTab: e.metaKey });
      blurActive();
    }
  };

  const onContextMenu = (e: MouseEvent, node: TreeNode) => {
    e.preventDefault();
    const sel = useUi.getState().treeSelection;
    if (!sel.includes(node.path)) select([node.path]);
    setMenuItems(nodeMenuEntries(node, sel.includes(node.path) ? sel : [node.path]));
    menu.open({ x: e.clientX, y: e.clientY });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (renaming) return;
    const last = selection[selection.length - 1];
    const index = rows.findIndex((r) => r.node.path === last);
    const current = rows[index];
    const move = (delta: number) => {
      const next = rows[Math.max(0, Math.min(rows.length - 1, (index < 0 ? -1 : index) + delta))];
      if (next) {
        select([next.node.path]);
        document.getElementById(rowId(next.node.path))?.scrollIntoView({ block: 'nearest' });
      }
    };
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'ArrowRight':
        if (current?.node.type === 'folder') {
          e.preventDefault();
          if (!expanded.has(current.node.path)) toggle(current.node.path);
          else move(1);
        }
        break;
      case 'ArrowLeft':
        if (current) {
          e.preventDefault();
          if (current.node.type === 'folder' && expanded.has(current.node.path)) toggle(current.node.path);
          else if (parentOf(current.node.path) !== '') select([parentOf(current.node.path)]);
        }
        break;
      case 'F2':
        if (last) useUi.setState({ renaming: last });
        break;
      case 'Escape':
        select([]);
        blurActive();
        break;
      default:
        break;
    }
  };

  const onDragStart = (e: DragEvent, node: TreeNode) => {
    e.dataTransfer.setData(DRAG_MIME, node.path);
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const dropProps = (dest: RelPath) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dropTarget !== dest) setDropTarget(dest);
    },
    onDragLeave: (e: DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null))
        setDropTarget((d) => (d === dest ? null : d));
    },
    onDrop: (e: DragEvent) => {
      const source = e.dataTransfer.getData(DRAG_MIME);
      setDropTarget(null);
      if (!source) return;
      e.preventDefault();
      e.stopPropagation();
      if (canMoveInto(source, dest)) void movePath(source, dest);
    },
  });

  return (
    <div
      ref={containerRef}
      className="shell-tree"
      role="tree"
      tabIndex={0}
      aria-label={t('sidebar.files')}
      onKeyDown={onKeyDown}
      onFocus={() => setFolderSurface(surface)}
      {...dropProps('')}
      data-drop={dropTarget === '' ? 'true' : undefined}
    >
      {rows.length === 0 && <div className="shell-tree__empty">{t('sidebar.empty')}</div>}
      {rows.map(({ node, depth }) => {
        const isFolder = node.type === 'folder';
        const isOpen = isFolder && expanded.has(node.path);
        const custom = meta.fileIcons[node.path];
        return (
          <div
            key={node.path}
            id={rowId(node.path)}
            role="treeitem"
            aria-expanded={isFolder ? isOpen : undefined}
            aria-selected={selection.includes(node.path)}
            className={clsx(
              'shell-tree__row',
              selection.includes(node.path) && 'is-selected',
              activePath === node.path && 'is-active',
              dropTarget === node.path && 'is-drop-target',
            )}
            style={{ paddingLeft: 8 + depth * 16 }}
            draggable={renaming !== node.path}
            onDragStart={(e) => onDragStart(e, node)}
            {...(isFolder ? dropProps(node.path) : {})}
            onClick={(e) => onRowClick(e, node)}
            onContextMenu={(e) => onContextMenu(e, node)}
          >
            <span
              className={clsx('shell-tree__chevron', isOpen && 'is-open', !isFolder && 'is-hidden')}
              onClick={(e) => {
                if (!isFolder) return;
                e.stopPropagation();
                toggle(node.path);
              }}
            >
              <ChevronRight size={12} strokeWidth={2} aria-hidden />
            </span>
            <FileIcon
              kind={isFolder ? 'folder' : node.kind}
              open={isOpen}
              customIcon={custom?.icon}
              customColor={custom?.color}
              dark={theme === 'dark'}
            />
            {renaming === node.path ? (
              <RenameInput path={node.path} initial={isFolder ? node.name : displayName(node.path)} />
            ) : (
              <span className="shell-tree__name">{isFolder || node.kind ? displayName(node.path) : node.name}</span>
            )}
            <span className="shell-tree__actions">
              {isFolder && (
                <button
                  type="button"
                  className="shell-tree__action"
                  aria-label={t('sidebar.newIn', { name: node.name })}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuItems(createMenuEntries(node.path));
                    menu.open(e.currentTarget);
                  }}
                >
                  <Plus size={14} aria-hidden />
                </button>
              )}
              <button
                type="button"
                className="shell-tree__action"
                aria-label={t('sidebar.moreActions')}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuItems(nodeMenuEntries(node, useUi.getState().treeSelection));
                  menu.open(e.currentTarget);
                }}
              >
                <MoreHorizontal size={14} aria-hidden />
              </button>
            </span>
          </div>
        );
      })}
      {menu.anchor && <Menu items={menuItems} anchor={menu.anchor} onClose={menu.close} />}
    </div>
  );
}

function rowId(path: RelPath): string {
  return `tree-row-${encodeURIComponent(path)}`;
}

/** Inline rename field used by tree rows, folder views and the title bar. */
export function RenameInput({
  path,
  initial,
  className,
  onDone,
}: {
  path: RelPath;
  initial: string;
  className?: string;
  /** Called when editing ends; without it the shared `renaming` state is cleared. */
  onDone?: () => void;
}): JSX.Element {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement | null>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (onDone) onDone();
    else useUi.setState({ renaming: null });
    if (commit && value.trim() && value !== initial) void renamePath(path, value);
  };
  return (
    <input
      ref={ref}
      className={clsx('shell-rename-input', className)}
      value={value}
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // Cmd shortcuts (undo, select all...) still reach the registry, which routes them to
        // the native field; bare keys stay in the field.
        if (!e.metaKey) e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
    />
  );
}
