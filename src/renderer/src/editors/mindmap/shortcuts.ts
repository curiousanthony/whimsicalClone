/**
 * Mind-map shortcuts (owner: mindmap module).
 *
 * Scope "canvas.mindmap" is active while one or more mind-map nodes are selected and no
 * text is being edited. While editing a node (scope "textEdit"), the node's text editor
 * handles Enter / Tab / Shift+Enter / Cmd+Enter / Escape itself (dispatch "native").
 *
 * Decision (SPEC): Enter on a SELECTED node starts editing; Enter WHILE EDITING commits and
 * adds a sibling below (Whimsical). Selected -> Enter -> Enter therefore adds a sibling.
 */

import { shortcutTable } from '@renderer/core/shortcutTable';
import type { ShortcutRow } from '@renderer/core/shortcutTable';

const navigation: ShortcutRow[] = (['Up', 'Down', 'Left', 'Right'] as const).map((d) => ({
  id: `mindmap.navigate${d}`,
  keys: [`Arrow${d}`],
  scope: 'canvas.mindmap',
  group: 'mindmap',
  repeat: true,
}));

export const mindmapShortcuts = shortcutTable('mindmap', [
  { id: 'mindmap.addRoot', keys: ['M'], scope: 'canvas', group: 'mindmap', icon: 'Network' },
  { id: 'mindmap.addChild', keys: ['Tab'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.editNode', keys: ['Enter'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.addSiblingAbove', keys: ['Mod+Enter'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.addParent', keys: ['Alt+Enter'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.selectParent', keys: ['Shift+Tab'], scope: 'canvas.mindmap', group: 'mindmap' },
  ...navigation,
  { id: 'mindmap.toggleCollapse', keys: ['Mod+/'], scope: 'canvas.mindmap', group: 'mindmap', icon: 'ChevronsDownUp' },
  { id: 'mindmap.collapse', keys: ['Mod+Alt+['], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.expand', keys: ['Mod+Alt+]'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.collapseAll', keys: [], gestures: ['Alt+Click'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.collapseSiblings', keys: [], gestures: ['Shift+Click'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.collapseLevel', keys: [], gestures: ['Alt+Shift+Click'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.deleteNode', keys: ['Backspace', 'Delete'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.duplicateNode', keys: ['Mod+D'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.addIcon', keys: ['Shift+X'], scope: 'canvas.mindmap', group: 'mindmap', icon: 'Smile' },
  { id: 'mindmap.addLink', keys: ['Mod+Shift+U'], scope: 'canvas.mindmap', group: 'mindmap', icon: 'Link' },
  { id: 'mindmap.indent', keys: ['Mod+Ctrl+]'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.outdent', keys: ['Mod+Ctrl+['], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.moveUp', keys: ['Mod+Shift+ArrowUp'], scope: 'canvas.mindmap', group: 'mindmap', extension: true },
  { id: 'mindmap.moveDown', keys: ['Mod+Shift+ArrowDown'], scope: 'canvas.mindmap', group: 'mindmap', extension: true },
  { id: 'mindmap.relayout', keys: ['Shift+F12'], scope: 'canvas.mindmap', group: 'mindmap' },
  { id: 'mindmap.pasteAsMindmap', keys: [], scope: 'canvas', group: 'mindmap', icon: 'ClipboardPaste' },
  { id: 'mindmap.copyAsList', keys: [], scope: 'canvas.mindmap', group: 'mindmap' },

  { id: 'mindmap.editAddSibling', keys: ['Enter'], scope: 'textEdit', group: 'mindmap', dispatch: 'native' },
  { id: 'mindmap.editAddChild', keys: ['Tab'], scope: 'textEdit', group: 'mindmap', dispatch: 'native' },
  { id: 'mindmap.editAddSiblingAbove', keys: ['Mod+Enter'], scope: 'textEdit', group: 'mindmap', dispatch: 'native' },
  { id: 'mindmap.editLineBreak', keys: ['Shift+Enter'], scope: 'textEdit', group: 'mindmap', dispatch: 'native' },
  { id: 'mindmap.editStop', keys: ['Escape'], scope: 'textEdit', group: 'mindmap', dispatch: 'native' },
]);
