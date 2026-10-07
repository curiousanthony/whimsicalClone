/**
 * Folder view (Whimsical grid / list of a folder's files; G and L switch, Return opens,
 * Delete moves to the Trash, Shift+click multi-selects). Its focus activates "folderView".
 */

import { clsx } from 'clsx';
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { RelPath, TreeNode } from '@shared/ipc';
import { useShortcutLabel } from '@renderer/core/shortcuts';
import { Button, FileIcon, IconButton, Menu, useMenuState, type MenuEntry } from '@renderer/ui';
import { createMenuEntries } from '../createMenu';
import { movePath, openPath, trashPaths } from '../fileActions';
import { nodeMenuEntries } from '../nodeMenu';
import { DRAG_MIME, RenameInput } from '../sidebar/FileTree';
import { clearFolderSurface, setFolderSurface, type FolderSurface } from '../state/folderSurface';
import { useResolvedTheme } from '../state/prefs';
import { useUi } from '../state/ui';
import { useWorkspace } from '../state/workspace';
import { canMoveInto, displayName, findNode, orderedChildren } from '../tree';

type ViewMode = 'grid' | 'list';

export function FolderView({ path }: { path: RelPath }): JSX.Element {
  const { t, i18n } = useTranslation(['shell', 'common']);
  const tree = useWorkspace((s) => s.tree);
  const meta = useWorkspace((s) => s.meta);
  const renaming = useUi((s) => s.renaming);
  const theme = useResolvedTheme();
  const node = findNode(tree, path);
  const children = useMemo(() => (node ? orderedChildren(node, meta) : []), [node, meta]);
  const [mode, setMode] = useState<ViewMode>('grid');
  const [selection, setSelection] = useState<RelPath[]>([]);
  const [dropTarget, setDropTarget] = useState<RelPath | null>(null);
  const menu = useMenuState();
  const [menuItems, setMenuItems] = useState<MenuEntry[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ selection, children });
  stateRef.current = { selection, children };
  const listLabel = useShortcutLabel('folder.listView');
  const gridLabel = useShortcutLabel('folder.gridView');

  useEffect(() => {
    void window.api.viewState.get<ViewMode>(`folder:${path}:view`).then((v) => {
      if (v === 'grid' || v === 'list') setMode(v);
    });
    setSelection([]);
  }, [path]);

  useEffect(() => () => useUi.setState({ folderFocus: false }), []);

  const changeMode = (next: ViewMode) => {
    setMode(next);
    void window.api.viewState.set(`folder:${path}:view`, next);
  };

  const surface = useMemo<FolderSurface>(
    () => ({
      open: () => {
        const last = stateRef.current.selection[stateRef.current.selection.length - 1];
        if (last !== undefined) openPath(last);
      },
      deleteSelection: () => void trashPaths(stateRef.current.selection),
      setView: (v) => changeMode(v),
    }),
    [path],
  );
  useEffect(() => () => clearFolderSurface(surface), [surface]);

  const onItemClick = (e: MouseEvent, child: TreeNode) => {
    e.stopPropagation();
    if (e.shiftKey)
      setSelection((s) => (s.includes(child.path) ? s.filter((p) => p !== child.path) : [...s, child.path]));
    else setSelection([child.path]);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (renaming) return;
    const list = stateRef.current.children;
    const last = stateRef.current.selection[stateRef.current.selection.length - 1];
    const index = list.findIndex((c) => c.path === last);
    const columns = mode === 'grid' ? Math.max(1, Math.floor((rootRef.current?.clientWidth ?? 800) / 196)) : 1;
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    const delta = step[e.key];
    if (delta === undefined) return;
    if (mode === 'list' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    e.preventDefault();
    const next = list[Math.max(0, Math.min(list.length - 1, index < 0 ? 0 : index + delta))];
    if (next) setSelection([next.path]);
  };

  const dragHandlers = (dest: RelPath) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
      e.preventDefault();
      setDropTarget(dest);
    },
    onDragLeave: () => setDropTarget((d) => (d === dest ? null : d)),
    onDrop: (e: DragEvent) => {
      const source = e.dataTransfer.getData(DRAG_MIME);
      setDropTarget(null);
      if (source && canMoveInto(source, dest)) {
        e.preventDefault();
        void movePath(source, dest);
      }
    },
  });

  if (!node || node.type !== 'folder') {
    return <div className="shell-editor-message">{t('editor.notFound')}</div>;
  }

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div
      ref={rootRef}
      className="shell-folder"
      tabIndex={0}
      onFocus={() => {
        setFolderSurface(surface);
        useUi.setState({ folderFocus: true });
      }}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) useUi.setState({ folderFocus: false });
      }}
      onKeyDown={onKeyDown}
      onClick={() => setSelection([])}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuItems(createMenuEntries(path));
        menu.open({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="shell-folder__toolbar">
        <span className="shell-folder__count">{t('folderView.items', { count: children.length })}</span>
        <div className="shell-folder__toolbar-actions">
          <Button
            variant="primary"
            size="sm"
            icon="Plus"
            onClick={(e) => {
              e.stopPropagation();
              setMenuItems(createMenuEntries(path));
              menu.open(e.currentTarget);
            }}
          >
            {t('sidebar.create')}
          </Button>
          <IconButton
            icon="LayoutGrid"
            label={t('folderView.gridView')}
            shortcut={gridLabel}
            active={mode === 'grid'}
            onClick={() => changeMode('grid')}
          />
          <IconButton
            icon="List"
            label={t('folderView.listView')}
            shortcut={listLabel}
            active={mode === 'list'}
            onClick={() => changeMode('list')}
          />
        </div>
      </div>
      {children.length === 0 ? (
        <div className="shell-folder__empty">{t('folderView.empty')}</div>
      ) : mode === 'grid' ? (
        <div className="shell-folder__grid">
          {children.map((child) => (
            <div
              key={child.path}
              className={clsx(
                'shell-folder__card',
                selection.includes(child.path) && 'is-selected',
                dropTarget === child.path && 'is-drop-target',
              )}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, child.path)}
              {...(child.type === 'folder' ? dragHandlers(child.path) : {})}
              onClick={(e) => onItemClick(e, child)}
              onDoubleClick={() => openPath(child.path)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!selection.includes(child.path)) setSelection([child.path]);
                setMenuItems(nodeMenuEntries(child, selection.includes(child.path) ? selection : [child.path]));
                menu.open({ x: e.clientX, y: e.clientY });
              }}
            >
              <div className="shell-folder__preview">
                <FileIcon
                  kind={child.type === 'folder' ? 'folder' : child.kind}
                  size={40}
                  customIcon={meta.fileIcons[child.path]?.icon}
                  customColor={meta.fileIcons[child.path]?.color}
                  dark={theme === 'dark'}
                />
              </div>
              <div className="shell-folder__card-name">
                {renaming === child.path ? (
                  <RenameInput
                    path={child.path}
                    initial={child.type === 'folder' ? child.name : displayName(child.path)}
                  />
                ) : (
                  displayName(child.path)
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table className="shell-folder__list">
          <thead>
            <tr>
              <th>{t('folderView.name')}</th>
              <th>{t('folderView.kind')}</th>
              <th>{t('folderView.modified')}</th>
            </tr>
          </thead>
          <tbody>
            {children.map((child) => (
              <tr
                key={child.path}
                className={clsx(
                  selection.includes(child.path) && 'is-selected',
                  dropTarget === child.path && 'is-drop-target',
                )}
                draggable
                onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, child.path)}
                {...(child.type === 'folder' ? dragHandlers(child.path) : {})}
                onClick={(e) => onItemClick(e, child)}
                onDoubleClick={() => openPath(child.path)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelection([child.path]);
                  setMenuItems(nodeMenuEntries(child));
                  menu.open({ x: e.clientX, y: e.clientY });
                }}
              >
                <td>
                  <span className="shell-folder__list-name">
                    <FileIcon kind={child.type === 'folder' ? 'folder' : child.kind} dark={theme === 'dark'} />
                    {renaming === child.path ? (
                      <RenameInput
                        path={child.path}
                        initial={child.type === 'folder' ? child.name : displayName(child.path)}
                      />
                    ) : (
                      displayName(child.path)
                    )}
                  </span>
                </td>
                <td>
                  {t(
                    child.type === 'folder'
                      ? 'common:fileKinds.folder'
                      : (`common:fileKinds.${child.kind ?? 'board'}` as 'common:fileKinds.board'),
                  )}
                </td>
                <td>{dateFormat.format(child.mtimeMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {menu.anchor && <Menu items={menuItems} anchor={menu.anchor} onClose={menu.close} />}
    </div>
  );
}
