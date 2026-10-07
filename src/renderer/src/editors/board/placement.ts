/**
 * Pure placement helpers for board objects: centring a default-size object on a point, squaring
 * a dragged sticky rect, laying out several imported images in a row, and finding the objects a
 * new section wraps. No React, no DOM.
 */

import type { BoardElement, Point, Rect } from '@renderer/core/types';

/** Top-left of a `w` x `h` box centred on `centre`, rounded to the grid. */
export function centredTopLeft(centre: Point, w: number, h: number, grid = 1): Point {
  const g = Math.max(grid, 1);
  return { x: Math.round((centre.x - w / 2) / g) * g, y: Math.round((centre.y - h / 2) / g) * g };
}

/** Largest square inside the dragged rect's smaller side anchored at its top-left (stickies are square). */
export function squareRect(rect: Rect): Rect {
  const side = Math.max(rect.w, rect.h);
  return { x: rect.x, y: rect.y, w: side, h: side };
}

export interface ImagePlacement {
  x: number;
  y: number;
}

/** Positions for images of the given sizes laid out in one row centred on `centre`. */
export function rowLayout(sizes: ReadonlyArray<{ w: number; h: number }>, centre: Point, gap = 24): ImagePlacement[] {
  if (sizes.length === 0) return [];
  const total = sizes.reduce((s, size) => s + size.w, 0) + gap * (sizes.length - 1);
  let x = centre.x - total / 2;
  return sizes.map((size) => {
    const placement = { x: Math.round(x), y: Math.round(centre.y - size.h / 2) };
    x += size.w + gap;
    return placement;
  });
}

function insideRect(inner: Rect, outer: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

/**
 * Ids of objects that a freshly drawn section at `section` wraps: boxes fully inside it that are
 * not already in another container and not containers themselves.
 */
export function wrappedByNewSection(
  elements: readonly BoardElement[],
  section: Rect,
  boundsOf: (element: BoardElement) => Rect | undefined,
  isContainer: (element: BoardElement) => boolean,
): string[] {
  const ids: string[] = [];
  for (const el of elements) {
    if (el.type === 'connector' || el.containerId || isContainer(el)) continue;
    const bounds = boundsOf(el);
    if (bounds && insideRect(bounds, section)) ids.push(el.id);
  }
  return ids;
}
