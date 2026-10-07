/**
 * ElementDefinition of the `shape` element (owner: flowchart).
 */

import type { Draft } from 'immer';
import { rotatedBounds } from '@renderer/canvas';
import type { ElementDefinition, Point, Rect, ShapeElement } from '@renderer/core/types';
import { ShapeContextBar } from './ShapeContextBar';
import { ShapeRender } from './ShapeRender';
import { SHAPE_SPECS, SHAPE_STYLE_PROPS, normalizeShape } from './shapes';
import { newSeed, pointInShape, shapeGeometry } from './shapeGeometry';

/** World point to the shape's local frame (inverse of the 90 degree rotation about the centre). */
export function toLocal(el: Pick<ShapeElement, 'x' | 'y' | 'w' | 'h' | 'rotation'>, world: Point): Point {
  const dx = world.x - (el.x + el.w / 2);
  const dy = world.y - (el.y + el.h / 2);
  let x = dx;
  let y = dy;
  switch (el.rotation ?? 0) {
    case 90:
      x = dy;
      y = -dx;
      break;
    case 180:
      x = -dx;
      y = -dy;
      break;
    case 270:
      x = -dy;
      y = dx;
      break;
  }
  return { x: x + el.w / 2, y: y + el.h / 2 };
}

/** Resize hook: a manual height switches auto-height off; cloud / star regenerate their outline. */
export function applyShapeResize(draft: Draft<ShapeElement>, next: Rect, previous: Rect): void {
  draft.x = next.x;
  draft.y = next.y;
  draft.w = next.w;
  draft.h = next.h;
  if (Math.abs(next.h - previous.h) > 0.5) draft.autoHeight = false;
  if (SHAPE_SPECS[draft.kind].seeded && (Math.abs(next.w - previous.w) > 0.5 || Math.abs(next.h - previous.h) > 0.5)) draft.seed = newSeed();
}

export const shapeDefinition: ElementDefinition<ShapeElement> = {
  type: 'shape',
  module: 'flowchart',
  layer: 'box',
  Render: ShapeRender,
  getBounds: (el) => rotatedBounds({ x: el.x, y: el.y, w: el.w, h: el.h }, el.rotation),
  hitTest(el, world, tolerance) {
    const geometry = shapeGeometry(el.kind, el.w, el.h, el.seed);
    return pointInShape(geometry, el.w, el.h, toLocal(el, world), tolerance);
  },
  resize: 'free',
  rotatable: true,
  connectable: true,
  textEditable: true,
  quickAdd: { connect: true },
  styleProps: SHAPE_STYLE_PROPS,
  getText: (el) => el.text,
  setText(draft, text) {
    draft.text = text;
  },
  applyResize: applyShapeResize,
  ContextBar: ShapeContextBar,
  normalize: normalizeShape,
};
