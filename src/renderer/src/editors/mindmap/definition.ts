/**
 * ElementDefinition of the `mindmapNode` element (owner: mindmap).
 *
 * Nodes are laid out by the module (afterChange), never resized or rotated by hand; the
 * canvas still selects, hit-tests, deletes and copies them like any other element.
 */

import type { ElementDefinition, MindMapNodeElement } from '@renderer/core/types';
import { MindContextBar } from './ContextBar';
import { MindNodeRender } from './MindNode';

export const mindNodeDefinition: ElementDefinition<MindMapNodeElement> = {
  type: 'mindmapNode',
  module: 'mindmap',
  layer: 'box',
  Render: MindNodeRender,
  getBounds: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
  // Nodes inside a collapsed branch have no size and must never be hit.
  hitTest: (e, world, tolerance) =>
    !(e.w === 0 && e.h === 0) &&
    world.x >= e.x - tolerance &&
    world.x <= e.x + e.w + tolerance &&
    world.y >= e.y - tolerance &&
    world.y <= e.y + e.h + tolerance,
  resize: 'none',
  rotatable: false,
  connectable: true,
  textEditable: true,
  styleProps: ['color', 'textSize'],
  getText: (e) => e.text,
  setText: (d, text) => {
    d.text = text;
  },
  ContextBar: MindContextBar,
};
