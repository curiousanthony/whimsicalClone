/**
 * Viewport helpers for commands that place objects "where the user is looking".
 * CanvasApi has no viewport size yet; the engine instance behind it does (visibleWorldRect),
 * so this duck-types it and falls back to a fixed screen point. (Change request: add
 * visibleWorldRect() to CanvasApi.)
 */

import type { CanvasApi, Point, Rect } from '@renderer/core/types';

export function visibleRect(api: CanvasApi): Rect {
  const maybe = api as unknown as { visibleWorldRect?: () => Rect };
  if (typeof maybe.visibleWorldRect === 'function') return maybe.visibleWorldRect();
  const a = api.screenToWorld({ x: 0, y: 0 });
  const b = api.screenToWorld({ x: 960, y: 640 });
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

export function viewCentre(api: CanvasApi): Point {
  const r = visibleRect(api);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Rounds a world point to the current grid. */
export function snapToGridPoint(api: CanvasApi, p: Point): Point {
  const g = Math.max(api.getGridSize(), 1);
  return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
}
