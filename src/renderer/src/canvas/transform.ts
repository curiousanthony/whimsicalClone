/**
 * Resize / move / rotate maths for selection handles (pure).
 *
 * Handles: n s e w ne nw se sw. Shift locks the aspect ratio, Alt resizes from the centre.
 * Rects never flip: dragging past the opposite edge clamps at the minimum size.
 */

import type { Point, Rect, Rotation } from '@renderer/core/types';
import { rectCenter, snapToGrid } from './geometry';

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const ALL_HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const CORNER_HANDLES: readonly Handle[] = ['nw', 'ne', 'se', 'sw'];
export const WIDTH_HANDLES: readonly Handle[] = ['e', 'w'];

export type ResizeMode = 'free' | 'aspect' | 'width' | 'none';

export const MIN_SIZE = 8;

/** Handles offered for a resize mode. */
export function handlesFor(mode: ResizeMode): readonly Handle[] {
  switch (mode) {
    case 'free':
      return ALL_HANDLES;
    case 'aspect':
      return CORNER_HANDLES;
    case 'width':
      return WIDTH_HANDLES;
    case 'none':
      return [];
  }
}

export function handleCursor(handle: Handle): string {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
  }
}

/** Position of a handle on a rect. */
export function handlePosition(r: Rect, handle: Handle): Point {
  const x = handle.includes('w') ? r.x : handle.includes('e') ? r.x + r.w : r.x + r.w / 2;
  const y = handle.includes('n') ? r.y : handle.includes('s') ? r.y + r.h : r.y + r.h / 2;
  return { x, y };
}

export interface ResizeOptions {
  /** Shift held, or the element only resizes with a locked aspect ratio. */
  keepAspect?: boolean;
  /** Alt held: resize symmetrically around the centre. */
  fromCenter?: boolean;
  minWidth?: number;
  minHeight?: number;
  /** Snap moving edges to this grid (0 / undefined = no grid). */
  grid?: number;
}

/**
 * Resizes `start` by dragging `handle` by `delta` (world units). Returns the new rect.
 */
export function resizeRect(start: Rect, handle: Handle, delta: Point, options: ResizeOptions = {}): Rect {
  const minW = options.minWidth ?? MIN_SIZE;
  const minH = options.minHeight ?? MIN_SIZE;
  const hasW = handle.includes('w');
  const hasE = handle.includes('e');
  const hasN = handle.includes('n');
  const hasS = handle.includes('s');
  const k = options.fromCenter ? 2 : 1;

  let left = start.x;
  let right = start.x + start.w;
  let top = start.y;
  let bottom = start.y + start.h;
  const g = options.grid && options.grid > 1 ? options.grid : 0;
  const snap = (v: number) => (g ? snapToGrid(v, g) : v);

  if (hasE) right = snap(right + delta.x);
  if (hasW) left = snap(left + delta.x);
  if (hasS) bottom = snap(bottom + delta.y);
  if (hasN) top = snap(top + delta.y);

  let w = hasE ? right - start.x : hasW ? start.x + start.w - left : start.w;
  let h = hasS ? bottom - start.y : hasN ? start.y + start.h - top : start.h;
  if (options.fromCenter) {
    w = start.w + (w - start.w) * k;
    h = start.h + (h - start.h) * k;
  }
  w = Math.max(minW, w);
  h = Math.max(minH, h);

  if (options.keepAspect && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    const edgeOnly = !(hasN || hasS) || !(hasE || hasW);
    if (edgeOnly) {
      if (hasE || hasW) h = w / ratio;
      else w = h * ratio;
    } else if (w / start.w > h / start.h) {
      h = w / ratio;
    } else {
      w = h * ratio;
    }
    if (w < minW) {
      w = minW;
      h = w / ratio;
    }
    if (h < minH) {
      h = minH;
      w = h * ratio;
    }
  }

  if (options.fromCenter) {
    const c = rectCenter(start);
    return { x: c.x - w / 2, y: c.y - h / 2, w, h };
  }
  let x = start.x;
  let y = start.y;
  if (hasW) x = start.x + start.w - w;
  else if (!hasE) x = start.x + (start.w - w) / 2;
  if (hasN) y = start.y + start.h - h;
  else if (!hasS) y = start.y + (start.h - h) / 2;
  return { x, y, w, h };
}

/** Maps `child` from `from` to `to` proportionally (multi-selection resize). */
export function scaleRectWithin(child: Rect, from: Rect, to: Rect): Rect {
  const sx = from.w > 0 ? to.w / from.w : 1;
  const sy = from.h > 0 ? to.h / from.h : 1;
  return { x: to.x + (child.x - from.x) * sx, y: to.y + (child.y - from.y) * sy, w: child.w * sx, h: child.h * sy };
}

/** Maps a point from `from` to `to` proportionally. */
export function scalePointWithin(p: Point, from: Rect, to: Rect): Point {
  const sx = from.w > 0 ? to.w / from.w : 1;
  const sy = from.h > 0 ? to.h / from.h : 1;
  return { x: to.x + (p.x - from.x) * sx, y: to.y + (p.y - from.y) * sy };
}

/**
 * 90° clockwise rotation of an element box about its centre. Element boxes keep their
 * un-rotated w/h; only `rotation` changes (rendering rotates the wrapper).
 */
export function rotateClockwise(rotation: Rotation | undefined): Rotation {
  return (((rotation ?? 0) + 90) % 360) as Rotation;
}

/** Rotates point p 90° clockwise around centre c (used for groups of rotated items). */
export function rotatePoint90(p: Point, c: Point): Point {
  return { x: c.x - (p.y - c.y), y: c.y + (p.x - c.x) };
}
