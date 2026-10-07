/**
 * Wireframe shortcuts (owner: wireframe module). Scope "canvas.wireframe" is active in
 * wireframe mode (W toggles, Q exits; those two belong to the canvas engine).
 * A (annotation) works in both modes. L or D = line; C = connector (engine).
 */

import { shortcutTable } from '@renderer/core/shortcutTable';

export const wireframeShortcuts = shortcutTable('wireframe', [
  { id: 'wireframe.annotation', keys: ['A'], scope: 'canvas', group: 'wireframe', icon: 'MessageSquareText' },
  { id: 'wireframe.button', keys: ['B'], scope: 'canvas.wireframe', group: 'wireframe', icon: 'RectangleHorizontal' },
  { id: 'wireframe.line', keys: ['L', 'D'], scope: 'canvas.wireframe', group: 'wireframe', icon: 'Minus' },
  { id: 'wireframe.components', keys: ['E'], scope: 'canvas.wireframe', group: 'wireframe', icon: 'Component' },
  { id: 'wireframe.frames', keys: ['F'], scope: 'canvas.wireframe', group: 'wireframe', icon: 'Frame' },
  { id: 'wireframe.image', keys: ['G'], scope: 'canvas.wireframe', group: 'wireframe', icon: 'Image' },
  { id: 'wireframe.circle', keys: ['O'], scope: 'canvas.wireframe', group: 'wireframe', icon: 'Circle' },
  { id: 'wireframe.input', keys: ['P'], scope: 'canvas.wireframe', group: 'wireframe', icon: 'TextCursorInput' },
  { id: 'wireframe.rectangle', keys: ['R'], scope: 'canvas.wireframe', group: 'wireframe', icon: 'Square' },
  { id: 'wireframe.avatar', keys: ['V'], scope: 'canvas.wireframe', group: 'wireframe', icon: 'CircleUserRound' },
  { id: 'wireframe.renameFrame', keys: [], gestures: ['Enter'], scope: 'canvas.wireframe', group: 'wireframe' },
  { id: 'wireframe.lineDirection', keys: [], gestures: ['Shift'], scope: 'canvas.wireframe', group: 'wireframe' },
  { id: 'wireframe.lineFullSize', keys: [], gestures: ['Mod'], scope: 'canvas.wireframe', group: 'wireframe' },
]);
