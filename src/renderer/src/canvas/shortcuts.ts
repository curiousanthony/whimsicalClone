/**
 * Canvas engine shortcuts (owner: canvas module). Shared by every canvas kind.
 *
 * Whimsical sources: research 01 section 3, 06 section 3.9, 07 sections 7.2 and 8.
 * Decisions taken for the clone are listed in docs/SPEC.md "Key collisions".
 */

import { shortcutTable } from '@renderer/core/shortcutTable';
import type { ShortcutRow } from '@renderer/core/shortcutTable';

const arrows = ['Up', 'Down', 'Left', 'Right'] as const;

const nudges: ShortcutRow[] = arrows.flatMap((d) => [
  { id: `canvas.nudge${d}`, keys: [`Arrow${d}`], scope: 'canvas', group: 'arrange', repeat: true, hidden: d !== 'Up' },
  { id: `canvas.nudge${d}Large`, keys: [`Shift+Arrow${d}`], scope: 'canvas', group: 'arrange', repeat: true, hidden: d !== 'Up' },
  { id: `canvas.nudge${d}Fine`, keys: [`Mod+Arrow${d}`], scope: 'canvas', group: 'arrange', repeat: true, hidden: d !== 'Up' },
]);

const quickAdd: ShortcutRow[] = arrows.map((d) => ({
  id: `canvas.quickAdd${d}`,
  keys: [`Alt+Arrow${d}`],
  scope: 'canvas',
  group: 'quickAdd',
  hidden: d !== 'Up',
}));

const neighbours: ShortcutRow[] = arrows.map((d) => ({
  id: `canvas.selectNeighbor${d}`,
  keys: [`Alt+Shift+Arrow${d}`],
  scope: 'canvas',
  group: 'selection',
  extension: true,
  hidden: d !== 'Up',
}));

export const canvasShortcuts = shortcutTable('canvas', [
  // Zoom & pan
  { id: 'canvas.zoomIn', keys: ['=', 'Shift+=', 'Mod+='], scope: 'canvas', group: 'zoom', icon: 'ZoomIn', repeat: true },
  { id: 'canvas.zoomOut', keys: ['-', 'Mod+-'], scope: 'canvas', group: 'zoom', icon: 'ZoomOut', repeat: true },
  { id: 'canvas.zoomReset', keys: ['0', 'Mod+0'], scope: 'canvas', group: 'zoom' },
  { id: 'canvas.zoomToFit', keys: ['1'], scope: 'canvas', group: 'zoom', icon: 'Maximize' },
  { id: 'canvas.zoomToSelection', keys: ['2'], scope: 'canvas', group: 'zoom' },
  { id: 'canvas.zoomGesture', keys: [], gestures: ['Z+Click', 'Z+Drag', 'Mod+Scroll'], scope: 'canvas', group: 'zoom' },
  { id: 'canvas.panGesture', keys: [], gestures: ['Space+Drag', 'Shift+Scroll'], scope: 'canvas', group: 'zoom' },

  // Tools & modes
  { id: 'canvas.selectTool', keys: [], scope: 'canvas', group: 'tools', icon: 'MousePointer2' },
  { id: 'canvas.panTool', keys: [], scope: 'canvas', group: 'tools', icon: 'Hand' },
  { id: 'canvas.allTools', keys: ['/'], scope: 'canvas', group: 'tools', icon: 'Plus' },
  { id: 'canvas.connector', keys: ['C'], scope: 'canvas', group: 'connectors', icon: 'MoveUpRight' },
  { id: 'canvas.toggleWireframe', keys: ['W'], scope: 'canvas', group: 'wireframe', icon: 'AppWindow' },
  { id: 'canvas.exitWireframe', keys: ['Q'], scope: 'canvas.wireframe', group: 'wireframe' },
  { id: 'canvas.toggleQuickAdd', keys: ['Q'], scope: 'canvas.diagram', group: 'quickAdd' },

  // Quick add (Alt+Arrow): clones the selected shape / sticky in that direction
  ...quickAdd,
  { id: 'canvas.quickAddDirection', keys: [], gestures: ['Shift+Hover'], scope: 'canvas', group: 'quickAdd' },

  // Selection
  { id: 'canvas.escape', keys: ['Escape'], scope: 'canvas', group: 'selection' },
  { id: 'canvas.selectMultiple', keys: [], gestures: ['Shift+Click'], scope: 'canvas', group: 'selection' },
  { id: 'canvas.deepSelect', keys: [], gestures: ['Mod+Click'], scope: 'canvas', group: 'selection' },
  { id: 'canvas.selectAllLocked', keys: [], gestures: ['Mod+A+A'], scope: 'canvas', group: 'selection' },
  { id: 'canvas.selectNext', keys: ['Tab'], scope: 'canvas', group: 'selection', extension: true },
  { id: 'canvas.selectPrevious', keys: ['Shift+Tab'], scope: 'canvas', group: 'selection', extension: true },
  ...neighbours,

  // Edit
  { id: 'canvas.editText', keys: ['Enter', 'Mod+R'], scope: 'canvas', group: 'text' },
  { id: 'canvas.delete', keys: ['Backspace', 'Delete'], scope: 'canvas', group: 'edit', icon: 'Trash2' },
  { id: 'canvas.duplicate', keys: ['Mod+D'], gestures: ['Alt+Drag'], scope: 'canvas', group: 'edit', icon: 'Copy' },
  { id: 'canvas.copyStyle', keys: ['Mod+Alt+C'], scope: 'canvas', group: 'edit', icon: 'Paintbrush' },
  { id: 'canvas.pasteStyle', keys: ['Mod+Alt+V'], scope: 'canvas', group: 'edit', icon: 'PaintBucket' },
  { id: 'canvas.copyLink', keys: ['Mod+Alt+Shift+C'], scope: 'canvas', group: 'edit', icon: 'Link' },
  { id: 'canvas.copyAsImage', keys: ['Mod+Shift+C'], scope: 'canvas', group: 'edit', icon: 'Image' },
  { id: 'canvas.saveDefaultStyle', keys: ['Mod+Shift+D'], scope: 'canvas', group: 'edit' },
  { id: 'canvas.textSizeUp', keys: ['Mod+Alt+='], scope: 'canvas', group: 'text', allowInTextInput: true },
  { id: 'canvas.textSizeDown', keys: ['Mod+Alt+-'], scope: 'canvas', group: 'text', allowInTextInput: true },

  // Arrange
  { id: 'canvas.bringToFront', keys: [']'], scope: 'canvas', group: 'arrange', icon: 'BringToFront' },
  { id: 'canvas.bringForward', keys: ['Mod+]'], scope: 'canvas', group: 'arrange' },
  { id: 'canvas.sendToBack', keys: ['['], scope: 'canvas', group: 'arrange', icon: 'SendToBack' },
  { id: 'canvas.sendBackward', keys: ['Mod+['], scope: 'canvas', group: 'arrange' },
  { id: 'canvas.group', keys: ['Mod+G'], scope: 'canvas', group: 'arrange', icon: 'Group' },
  { id: 'canvas.ungroup', keys: ['Mod+Shift+G'], scope: 'canvas', group: 'arrange', icon: 'Ungroup' },
  { id: 'canvas.lock', keys: ['Mod+Shift+L'], scope: 'canvas', group: 'arrange', icon: 'Lock' },
  { id: 'canvas.resizeAspect', keys: [], gestures: ['Shift+Drag'], scope: 'canvas', group: 'arrange' },
  { id: 'canvas.resizeFromCenter', keys: [], gestures: ['Alt+Drag'], scope: 'canvas', group: 'arrange' },
  { id: 'canvas.snapGridOnly', keys: [], gestures: ['Mod+Drag'], scope: 'canvas', group: 'arrange' },
  { id: 'canvas.snapNone', keys: [], gestures: ['`+Drag'], scope: 'canvas', group: 'arrange' },
  { id: 'canvas.measure', keys: [], gestures: ['Alt+Hover'], scope: 'canvas', group: 'arrange', icon: 'Ruler' },
  { id: 'canvas.cancelDrag', keys: [], gestures: ['Escape'], scope: 'canvas', group: 'arrange' },
  { id: 'canvas.growWidth', keys: ['Mod+Shift+ArrowRight'], scope: 'canvas', group: 'arrange', repeat: true },
  { id: 'canvas.shrinkWidth', keys: ['Mod+Shift+ArrowLeft'], scope: 'canvas', group: 'arrange', repeat: true },
  { id: 'canvas.growHeight', keys: ['Mod+Shift+ArrowDown'], scope: 'canvas', group: 'arrange', repeat: true },
  { id: 'canvas.shrinkHeight', keys: ['Mod+Shift+ArrowUp'], scope: 'canvas', group: 'arrange', repeat: true },
  ...nudges,
  { id: 'canvas.alignLeft', keys: [], scope: 'canvas', group: 'arrange', icon: 'AlignStartVertical' },
  { id: 'canvas.alignCenterH', keys: [], scope: 'canvas', group: 'arrange', icon: 'AlignCenterVertical' },
  { id: 'canvas.alignRight', keys: [], scope: 'canvas', group: 'arrange', icon: 'AlignEndVertical' },
  { id: 'canvas.alignTop', keys: [], scope: 'canvas', group: 'arrange', icon: 'AlignStartHorizontal' },
  { id: 'canvas.alignCenterV', keys: [], scope: 'canvas', group: 'arrange', icon: 'AlignCenterHorizontal' },
  { id: 'canvas.alignBottom', keys: [], scope: 'canvas', group: 'arrange', icon: 'AlignEndHorizontal' },
  { id: 'canvas.distributeH', keys: [], scope: 'canvas', group: 'arrange', icon: 'AlignHorizontalSpaceBetween' },
  { id: 'canvas.distributeV', keys: [], scope: 'canvas', group: 'arrange', icon: 'AlignVerticalSpaceBetween' },
  { id: 'canvas.snapToGrid', keys: [], scope: 'canvas', group: 'arrange', icon: 'Grid3x3' },
  { id: 'canvas.wrapInSection', keys: [], scope: 'canvas', group: 'arrange', icon: 'SquareDashed' },
  { id: 'canvas.rotate', keys: [], scope: 'canvas', group: 'arrange', icon: 'RotateCw' },

  // Connectors
  { id: 'canvas.animateConnector', keys: [], gestures: ['Mod+Click'], scope: 'canvas', group: 'connectors' },
  { id: 'canvas.jumpConnectorEnd', keys: [], gestures: ['Mod+Click'], scope: 'canvas', group: 'connectors' },

  // Text editing inside canvas objects (handled natively by the RichTextEditor)
  { id: 'canvasText.bold', keys: ['Mod+B'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'Bold' },
  { id: 'canvasText.italic', keys: ['Mod+I'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'Italic' },
  { id: 'canvasText.strike', keys: ['Mod+Shift+X'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'Strikethrough' },
  { id: 'canvasText.code', keys: ['Mod+Shift+K'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'Code' },
  { id: 'canvasText.highlight', keys: ['Mod+Shift+H'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'Highlighter' },
  { id: 'canvasText.link', keys: ['Mod+Shift+U'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'Link' },
  { id: 'canvasText.paragraph', keys: ['Mod+\\'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'Pilcrow' },
  { id: 'canvasText.bulletList', keys: ['Mod+Shift+8'], gestures: ['*+Space', '-+Space'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'List' },
  { id: 'canvasText.numberedList', keys: ['Mod+Shift+7'], gestures: ['1.+Space'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'ListOrdered' },
  { id: 'canvasText.checklist', keys: [], gestures: ['_+Space'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'ListChecks' },
  { id: 'canvasText.lineBreak', keys: ['Shift+Enter'], scope: 'textEdit', group: 'text', dispatch: 'native' },
  { id: 'canvasText.mention', keys: [], gestures: ['@'], scope: 'textEdit', group: 'text', dispatch: 'native', icon: 'AtSign' },
  { id: 'canvasText.stopEditing', keys: ['Escape'], scope: 'textEdit', group: 'text', dispatch: 'native' },
]);
