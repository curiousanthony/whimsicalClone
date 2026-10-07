/**
 * Flowchart / diagram-shape shortcuts (owner: flowchart module). Scope "canvas.diagram":
 * active when the board is NOT in wireframe mode.
 *
 * Collision decisions (SPEC "Key collisions"): H is the freehand marker, so Hexagon moves to
 * F (live app keymap); A is Annotation, so Trapezoid has no key; P is Parallelogram;
 * L is the Line shape (connector is C only).
 */

import { shortcutTable } from '@renderer/core/shortcutTable';

export const flowchartShortcuts = shortcutTable('flowchart', [
  { id: 'flowchart.shapesMenu', keys: ['S'], scope: 'canvas.diagram', group: 'diagram', icon: 'Shapes' },
  { id: 'flowchart.rectangle', keys: ['R'], scope: 'canvas.diagram', group: 'diagram', icon: 'Square' },
  { id: 'flowchart.pill', keys: ['U'], scope: 'canvas.diagram', group: 'diagram', icon: 'RectangleHorizontal' },
  { id: 'flowchart.oval', keys: ['O'], scope: 'canvas.diagram', group: 'diagram', icon: 'Circle' },
  { id: 'flowchart.diamond', keys: ['D'], scope: 'canvas.diagram', group: 'diagram', icon: 'Diamond' },
  { id: 'flowchart.hexagon', keys: ['F'], scope: 'canvas.diagram', group: 'diagram', icon: 'Hexagon' },
  { id: 'flowchart.parallelogram', keys: ['P'], scope: 'canvas.diagram', group: 'diagram', icon: 'Box' },
  { id: 'flowchart.parallelogramFlipped', keys: [], scope: 'canvas.diagram', group: 'diagram', icon: 'FlipHorizontal2' },
  { id: 'flowchart.trapezoid', keys: [], scope: 'canvas.diagram', group: 'diagram', icon: 'Pentagon' },
  { id: 'flowchart.triangle', keys: ['G'], scope: 'canvas.diagram', group: 'diagram', icon: 'Triangle' },
  { id: 'flowchart.cylinder', keys: ['Y'], scope: 'canvas.diagram', group: 'diagram', icon: 'Cylinder' },
  { id: 'flowchart.line', keys: ['L'], scope: 'canvas.diagram', group: 'diagram', icon: 'Minus' },
  { id: 'flowchart.bracket', keys: ['B'], scope: 'canvas.diagram', group: 'diagram', icon: 'Brackets' },
  { id: 'flowchart.star', keys: ['V'], scope: 'canvas.diagram', group: 'diagram', icon: 'Star' },
  { id: 'flowchart.cloud', keys: ['J'], scope: 'canvas.diagram', group: 'diagram', icon: 'Cloud' },
  { id: 'flowchart.actor', keys: [], scope: 'canvas.diagram', group: 'diagram', icon: 'PersonStanding' },
  { id: 'flowchart.cross', keys: [], scope: 'canvas.diagram', group: 'diagram', icon: 'X' },
  { id: 'flowchart.layoutVertical', keys: ['Alt+Shift+V'], scope: 'canvas.diagram', group: 'arrange', icon: 'ArrowDownWideNarrow' },
  { id: 'flowchart.layoutHorizontal', keys: ['Alt+Shift+H'], scope: 'canvas.diagram', group: 'arrange', icon: 'ArrowRightLeft' },
]);
