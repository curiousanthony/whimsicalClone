/**
 * Freehand shortcuts (owner: draw module). H / Shift+H enter the freehand tool group from
 * any board mode; inside the group (scope "canvas.freehand") E = eraser, S = selector and
 * Escape returns to the select tool. Other letters fall through to the board scopes.
 */

import { shortcutTable } from '@renderer/core/shortcutTable';

export const drawShortcuts = shortcutTable('draw', [
  { id: 'draw.marker', keys: ['H'], scope: 'canvas', group: 'freehand', icon: 'Pencil' },
  { id: 'draw.highlighter', keys: ['Shift+H'], scope: 'canvas', group: 'freehand', icon: 'Highlighter' },
  { id: 'draw.eraser', keys: ['E'], scope: 'canvas.freehand', group: 'freehand', icon: 'Eraser' },
  { id: 'draw.selector', keys: ['S'], scope: 'canvas.freehand', group: 'freehand', icon: 'MousePointer2' },
  { id: 'draw.exit', keys: ['Escape'], scope: 'canvas.freehand', group: 'freehand' },
  { id: 'draw.toggleThickness', keys: [], scope: 'canvas', group: 'freehand' },
  { id: 'draw.detectShapes', keys: [], scope: 'canvas', group: 'freehand', icon: 'WandSparkles' },
  // Clone extension: the pen colour / type panel (Whimsical shows it in the pencil flyout).
  { id: 'draw.penOptions', keys: ['Shift+C'], scope: 'canvas', group: 'freehand', icon: 'Palette', extension: true },
]);
