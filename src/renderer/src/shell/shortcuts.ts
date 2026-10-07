/**
 * App-level shortcuts (owner: shell module). Scope "app" is always active; "folderView"
 * while a folder view has focus. Handlers for "edit.*" route to the active editor:
 *   - native <input>/<textarea> focused -> document.execCommand / element.select()
 *   - editor with historyMode "host"    -> shell snapshot history
 *   - editor with historyMode "editor"  -> the editor binds its own "edit.undo"/"edit.redo"
 */

import { shortcutTable } from '@renderer/core/shortcutTable';

export const shellShortcuts = shortcutTable('shell', [
  { id: 'app.commandMenu', keys: ['Mod+K'], scope: 'app', group: 'general', allowInTextInput: true, icon: 'Command' },
  { id: 'app.searchFile', keys: ['Mod+F'], scope: 'app', group: 'general', allowInTextInput: true, icon: 'Search' },
  {
    id: 'app.searchWorkspace',
    keys: ['Mod+J', 'Mod+Shift+F'],
    scope: 'app',
    group: 'general',
    allowInTextInput: true,
    icon: 'Search',
  },
  {
    id: 'app.toggleSidebar',
    keys: ['Mod+E'],
    scope: 'app',
    group: 'general',
    allowInTextInput: true,
    icon: 'PanelLeft',
  },
  { id: 'app.shortcutsHelp', keys: ['Shift+/'], scope: 'app', group: 'general', icon: 'Keyboard' },
  { id: 'app.preferences', keys: ['Mod+,'], scope: 'app', group: 'general', allowInTextInput: true, icon: 'Settings' },
  { id: 'app.cycleTheme', keys: [], scope: 'app', group: 'general', icon: 'SunMoon' },
  { id: 'app.themeSystem', keys: [], scope: 'app', group: 'general', icon: 'Monitor', hidden: true },
  { id: 'app.themeLight', keys: [], scope: 'app', group: 'general', icon: 'Sun', hidden: true },
  { id: 'app.themeDark', keys: [], scope: 'app', group: 'general', icon: 'Moon', hidden: true },
  { id: 'app.closeWorkspace', keys: [], scope: 'app', group: 'file', icon: 'FolderX', extension: true, hidden: true },

  {
    id: 'app.newBoard',
    keys: ['Mod+Alt+N'],
    scope: 'app',
    group: 'file',
    allowInTextInput: true,
    icon: 'LayoutDashboard',
  },
  { id: 'app.newFlowchart', keys: [], scope: 'app', group: 'file', icon: 'Workflow' },
  { id: 'app.newMindmap', keys: [], scope: 'app', group: 'file', icon: 'Network' },
  { id: 'app.newWireframe', keys: [], scope: 'app', group: 'file', icon: 'AppWindow' },
  { id: 'app.newDrawing', keys: [], scope: 'app', group: 'file', icon: 'PenLine' },
  { id: 'app.newDoc', keys: [], scope: 'app', group: 'file', icon: 'FileText' },
  { id: 'app.newFolder', keys: [], scope: 'app', group: 'file', icon: 'Folder' },
  {
    id: 'app.openWorkspace',
    keys: ['Mod+O'],
    scope: 'app',
    group: 'file',
    allowInTextInput: true,
    extension: true,
    icon: 'FolderOpen',
  },
  { id: 'app.newWindow', keys: ['Mod+Shift+N'], scope: 'app', group: 'file', allowInTextInput: true, extension: true },
  { id: 'app.export', keys: ['Mod+Shift+E'], scope: 'app', group: 'file', allowInTextInput: true, icon: 'Download' },
  { id: 'app.print', keys: ['Mod+P'], scope: 'app', group: 'file', allowInTextInput: true, icon: 'Printer' },
  { id: 'app.copyFileLink', keys: ['Mod+L'], scope: 'app', group: 'file', allowInTextInput: true, icon: 'Link' },
  { id: 'app.revealInFinder', keys: [], scope: 'app', group: 'file', icon: 'FolderSearch' },
  { id: 'app.renameFile', keys: [], scope: 'app', group: 'file', icon: 'Pencil' },
  { id: 'app.deleteFile', keys: [], scope: 'app', group: 'file', icon: 'Trash2' },
  { id: 'app.toggleFavorite', keys: [], scope: 'app', group: 'file', icon: 'Star' },

  { id: 'tab.new', keys: ['Mod+T'], scope: 'app', group: 'tabs', allowInTextInput: true },
  { id: 'tab.close', keys: ['Mod+W'], scope: 'app', group: 'tabs', allowInTextInput: true },
  { id: 'tab.next', keys: ['Ctrl+Tab'], scope: 'app', group: 'tabs', allowInTextInput: true, extension: true },
  {
    id: 'tab.previous',
    keys: ['Ctrl+Shift+Tab'],
    scope: 'app',
    group: 'tabs',
    allowInTextInput: true,
    extension: true,
  },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `tab.select${i + 1}`,
    keys: [`Mod+${i + 1}`],
    scope: 'app' as const,
    group: 'tabs' as const,
    allowInTextInput: true,
    hidden: i > 0,
  })),

  { id: 'edit.undo', keys: ['Mod+Z'], scope: 'app', group: 'edit', allowInTextInput: true, icon: 'Undo2' },
  {
    id: 'edit.redo',
    keys: ['Mod+Shift+Z', 'Mod+Y'],
    scope: 'app',
    group: 'edit',
    allowInTextInput: true,
    icon: 'Redo2',
  },
  { id: 'edit.selectAll', keys: ['Mod+A'], scope: 'app', group: 'edit', allowInTextInput: true },

  { id: 'folder.listView', keys: ['L'], scope: 'folderView', group: 'folder', icon: 'List' },
  { id: 'folder.gridView', keys: ['G'], scope: 'folderView', group: 'folder', icon: 'LayoutGrid' },
  { id: 'folder.delete', keys: ['Backspace', 'Delete'], scope: 'folderView', group: 'folder', icon: 'Trash2' },
  { id: 'folder.open', keys: ['Enter'], scope: 'folderView', group: 'folder', extension: true },
  { id: 'folder.selectMultiple', keys: [], gestures: ['Shift+Click'], scope: 'folderView', group: 'folder' },
]);
