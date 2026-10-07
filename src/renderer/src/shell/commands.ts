/**
 * Shell command handlers (app.*, tab.*, edit.*, folder.*), bound once at startup. Editors
 * stack their own bindings on top (e.g. the docs editor binds edit.undo while active).
 * Also keeps the native menu in sync and routes menu clicks to the registry.
 */

import { shortcutRegistry, isTextInputTarget } from '@renderer/core/shortcuts';
import type { ShortcutHandler } from '@renderer/core/types';
import { i18n, translateKey } from '@renderer/i18n';
import { createDocument, createFolder, copyFileLink, revealPath, trashPaths, defaultCreateDir } from './fileActions';
import { buildMenuSpec } from './menuSpec';
import { printDocument } from './print';
import { pluginFor, redoDocument, undoDocument } from './state/documents';
import { folderSurface } from './state/folderSurface';
import { cycleTheme, setPrefs, usePrefs } from './state/prefs';
import { activeTab, cycleTab, openHomeTab, selectTabByNumber, useTabs } from './state/tabs';
import { closeOverlay, openOverlay, useUi, type Overlay } from './state/ui';
import { pickWorkspace, toggleFavorite, useWorkspace } from './state/workspace';
import { requestCloseTab } from './chrome/TabBar';
import { switchWorkspace } from './workspaceSession';

function hasWorkspace(): boolean {
  return useWorkspace.getState().status === 'ready';
}

function toggleOverlay(overlay: Exclude<Overlay, null>): void {
  if (useUi.getState().overlay === overlay) closeOverlay();
  else openOverlay(overlay);
}

/** Path of the active file or folder tab (not the workspace root). */
function activePath(): string | null {
  const tab = activeTab();
  return tab && tab.kind !== 'home' && tab.path !== '' ? tab.path : null;
}

/** Focused native text field (input / textarea / contenteditable) for edit.* routing. */
function focusedField(): HTMLElement | null {
  const el = document.activeElement as HTMLElement | null;
  return el && isTextInputTarget(el) ? el : null;
}

function folderFocused(): boolean {
  return useUi.getState().folderFocus && folderSurface() !== null;
}

function activeHostHistoryPath(): string | null {
  const tab = activeTab();
  if (tab?.kind !== 'file') return null;
  return pluginFor(tab.path)?.historyMode === 'host' ? tab.path : null;
}

export function shellHandlers(): ShortcutHandler[] {
  const ws = { isEnabled: hasWorkspace };
  const newKind = (kind: Parameters<typeof createDocument>[0]) => () => void createDocument(kind, defaultCreateDir());
  return [
    { id: 'app.commandMenu', run: () => toggleOverlay('commandMenu'), ...ws },
    { id: 'app.searchFile', run: () => useUi.setState({ search: 'file', overlay: null }), ...ws },
    { id: 'app.searchWorkspace', run: () => useUi.setState({ search: 'workspace', overlay: null }), ...ws },
    {
      id: 'app.toggleSidebar',
      run: () => {
        void setPrefs({ sidebarPinned: !usePrefs.getState().prefs.sidebarPinned });
        useUi.setState({ sidebarPeek: false });
      },
      ...ws,
    },
    { id: 'app.shortcutsHelp', run: () => toggleOverlay('help') },
    { id: 'app.preferences', run: () => toggleOverlay('preferences') },
    { id: 'app.cycleTheme', run: () => cycleTheme() },
    { id: 'app.themeSystem', run: () => void setPrefs({ theme: 'system' }) },
    { id: 'app.themeLight', run: () => void setPrefs({ theme: 'light' }) },
    { id: 'app.themeDark', run: () => void setPrefs({ theme: 'dark' }) },

    { id: 'app.newBoard', run: newKind('board'), ...ws },
    { id: 'app.newFlowchart', run: newKind('flowchart'), ...ws },
    { id: 'app.newMindmap', run: newKind('mindmap'), ...ws },
    { id: 'app.newWireframe', run: newKind('wireframe'), ...ws },
    { id: 'app.newDrawing', run: newKind('draw'), ...ws },
    { id: 'app.newDoc', run: newKind('doc'), ...ws },
    { id: 'app.newFolder', run: () => void createFolder(defaultCreateDir()), ...ws },
    {
      id: 'app.openWorkspace',
      run: async () => {
        const info = await pickWorkspace();
        if (info) await switchWorkspace(info);
      },
    },
    { id: 'app.closeWorkspace', run: () => void switchWorkspace(null), ...ws },
    { id: 'app.newWindow', run: () => void window.api.app.newWindow() },
    { id: 'app.export', run: () => toggleOverlay('export'), isEnabled: () => activeTab()?.kind === 'file' },
    { id: 'app.print', run: () => printDocument(), isEnabled: () => activeTab()?.kind === 'file' },
    { id: 'app.copyFileLink', run: () => void copyFileLink(activePath()!), isEnabled: () => activePath() !== null },
    { id: 'app.revealInFinder', run: () => revealPath(activePath() ?? ''), ...ws },
    {
      id: 'app.renameFile',
      run: () => useUi.setState((s) => ({ titleRename: s.titleRename + 1 })),
      isEnabled: () => activePath() !== null,
    },
    { id: 'app.deleteFile', run: () => void trashPaths([activePath()!]), isEnabled: () => activePath() !== null },
    { id: 'app.toggleFavorite', run: () => void toggleFavorite(activePath()!), isEnabled: () => activePath() !== null },

    { id: 'tab.new', run: () => openHomeTab(), ...ws },
    {
      id: 'tab.close',
      run: () => {
        const { activeId } = useTabs.getState();
        if (useUi.getState().overlay) closeOverlay();
        else if (activeId) requestCloseTab(activeId);
        else window.close();
      },
    },
    { id: 'tab.next', run: () => cycleTab(1), ...ws },
    { id: 'tab.previous', run: () => cycleTab(-1), ...ws },
    ...Array.from({ length: 9 }, (_, i) => ({ id: `tab.select${i + 1}`, run: () => selectTabByNumber(i + 1), ...ws })),

    {
      id: 'edit.undo',
      run: () => {
        if (focusedField()) return void document.execCommand('undo');
        const path = activeHostHistoryPath();
        if (path) undoDocument(path);
      },
      isEnabled: () => !!focusedField() || activeHostHistoryPath() !== null,
    },
    {
      id: 'edit.redo',
      run: () => {
        if (focusedField()) return void document.execCommand('redo');
        const path = activeHostHistoryPath();
        if (path) redoDocument(path);
      },
      isEnabled: () => !!focusedField() || activeHostHistoryPath() !== null,
    },
    {
      id: 'edit.selectAll',
      run: () => {
        const field = focusedField();
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.select();
        else document.execCommand('selectAll');
      },
      isEnabled: () => !!focusedField(),
    },

    { id: 'folder.open', run: () => folderSurface()?.open(), isEnabled: folderFocused },
    { id: 'folder.delete', run: () => folderSurface()?.deleteSelection(), isEnabled: folderFocused },
    { id: 'folder.listView', run: () => folderSurface()?.setView?.('list'), isEnabled: folderFocused },
    { id: 'folder.gridView', run: () => folderSurface()?.setView?.('grid'), isEnabled: folderFocused },
  ];
}

/* ------------------------------------------------------------------ native menu sync */

let menuTimer: number | null = null;

export function syncMenu(): void {
  if (menuTimer !== null) window.clearTimeout(menuTimer);
  menuTimer = window.setTimeout(() => {
    menuTimer = null;
    const spec = buildMenuSpec({
      registry: shortcutRegistry,
      translate: (key, values) => translateKey(key, values),
      theme: usePrefs.getState().prefs.theme,
      isDev: import.meta.env.DEV,
    });
    void window.api.app.setMenu(spec);
  }, 120);
}

/** Binds the shell handlers, menu routing and menu sync. Returns a disposer. */
export function initCommands(): () => void {
  const unbind = shortcutRegistry.bind(shellHandlers());
  const offMenu = window.api.app.onMenuCommand((id) => {
    shortcutRegistry.run(id, { source: 'menu' });
  });
  const offRegistry = shortcutRegistry.subscribe(syncMenu);
  const offPrefs = usePrefs.subscribe((s, prev) => {
    if (s.prefs.theme !== prev.prefs.theme) syncMenu();
  });
  const offTabs = useTabs.subscribe((s, prev) => {
    if (s.activeId !== prev.activeId) syncMenu();
  });
  const offWorkspace = useWorkspace.subscribe((s, prev) => {
    if (s.status !== prev.status) syncMenu();
  });
  const onLanguage = () => syncMenu();
  i18n.on('languageChanged', onLanguage);
  syncMenu();
  return () => {
    unbind();
    offMenu();
    offRegistry();
    offPrefs();
    offTabs();
    offWorkspace();
    i18n.off('languageChanged', onLanguage);
  };
}
