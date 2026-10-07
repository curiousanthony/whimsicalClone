/**
 * Pure 2D geometry helpers used by the canvas engine and exported for canvas plugins.
 * World coordinates everywhere; no DOM.
 */

import type { Point, Rect, Rotation, Side } from '@renderer/core/types';

export const EMPTY_RECT: Rect = { x: 0, y: 0, w: 0, h: 0 };

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

/** Normalised rect from two corner points (any order). */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

export function rectRight(r: Rect): number {
  return r.x + r.w;
}

export function rectBottom(r: Rect): number {
  return r.y + r.h;
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Smallest rect containing every rect; undefined for an empty list. */
export function unionRects(rects: readonly Rect[]): Rect | undefined {
  if (rects.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Bounding rect of points; undefined for an empty list. */
export function boundsOfPoints(points: readonly Point[]): Rect | undefined {
  if (points.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function rectContainsPoint(r: Rect, p: Point, tolerance = 0): boolean {
  return p.x >= r.x - tolerance && p.x <= r.x + r.w + tolerance && p.y >= r.y - tolerance && p.y <= r.y + r.h + tolerance;
}

/** True when `inner` lies completely inside `outer`. */
export function rectContainsRect(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

/** True when the rects overlap or touch. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

export function intersectRects(a: Rect, b: Rect): Rect | undefined {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bt = Math.min(a.y + a.h, b.y + b.h);
  if (r < x || bt < y) return undefined;
  return { x, y, w: r - x, h: bt - y };
}

export function expandRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

export function translateRect(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };
}

export function rectsEqual(a: Rect, b: Rect, epsilon = 1e-9): boolean {
  return (
    Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon && Math.abs(a.w - b.w) < epsilon && Math.abs(a.h - b.h) < epsilon
  );
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function addPoints(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subPoints(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Closest point on segment ab to p, with its parameter t (0..1). */
export function closestPointOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { point: { x: a.x, y: a.y }, t: 0 };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { point: { x: a.x + dx * t, y: a.y + dy * t }, t };
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  return distance(p, closestPointOnSegment(p, a, b).point);
}

/** Minimum distance from p to an open polyline. Infinity for fewer than one point. */
export function distanceToPolyline(p: Point, points: readonly Point[]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return distance(p, points[0]!);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    best = Math.min(best, distanceToSegment(p, points[i - 1]!, points[i]!));
  }
  return best;
}

export function polylineLength(points: readonly Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += distance(points[i - 1]!, points[i]!);
  return len;
}

/** Point at fraction t (0..1) of the polyline length. */
export function pointAlongPolyline(points: readonly Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0]! };
  const total = polylineLength(points);
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = distance(a, b);
    if (target <= seg || i === points.length - 1) return seg === 0 ? { ...a } : lerpPoint(a, b, Math.min(1, target / seg));
    target -= seg;
  }
  return { ...points[points.length - 1]! };
}

/** Fraction (0..1) along the polyline of the point closest to p. */
export function projectOnPolyline(points: readonly Point[], p: Point): number {
  const total = polylineLength(points);
  if (points.length < 2 || total === 0) return 0;
  let best = Infinity;
  let bestAt = 0;
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const { point, t } = closestPointOnSegment(p, a, b);
    const d = distance(p, point);
    const seg = distance(a, b);
    if (d < best) {
      best = d;
      bestAt = walked + seg * t;
    }
    walked += seg;
  }
  return bestAt / total;
}

/** Samples a cubic Bézier curve into `steps + 1` points. */
export function sampleCubic(p0: Point, c1: Point, c2: Point, p1: Point, steps = 24): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    out.push({ x: a * p0.x + b * c1.x + c * c2.x + d * p1.x, y: a * p0.y + b * c1.y + c * c2.y + d * p1.y });
  }
  return out;
}

/** World bounds of a box after a 90° step rotation about its centre. */
export function rotatedBounds(r: Rect, rotation: Rotation | undefined): Rect {
  if (!rotation || rotation === 180) return { ...r };
  const c = rectCenter(r);
  return { x: c.x - r.h / 2, y: c.y - r.w / 2, w: r.h, h: r.w };
}

/** Next 90° rotation step (clockwise). */
export function nextRotation(rotation: Rotation | undefined): Rotation {
  const order: Rotation[] = [0, 90, 180, 270];
  const i = order.indexOf(rotation ?? 0);
  return order[(i + 1) % order.length]!;
}

/** Point on a side of a rect at fraction t (0..1, left-to-right / top-to-bottom). */
export function pointOnSide(r: Rect, side: Side, t = 0.5): Point {
  switch (side) {
    case 'top':
      return { x: r.x + r.w * t, y: r.y };
    case 'bottom':
      return { x: r.x + r.w * t, y: r.y + r.h };
    case 'left':
      return { x: r.x, y: r.y + r.h * t };
    case 'right':
      return { x: r.x + r.w, y: r.y + r.h * t };
  }
}

/** Outward unit normal of a side. */
export function sideNormal(side: Side): Point {
  switch (side) {
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
  }
}

/** Side of `r` that faces point p best (by angle relative to the box aspect). */
export function sideFacing(r: Rect, p: Point): Side {
  const c = rectCenter(r);
  const dx = (p.x - c.x) / Math.max(r.w, 1);
  const dy = (p.y - c.y) / Math.max(r.h, 1);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/** Nearest side of r to point p, with the fraction along it (for attaching connectors). */
export function nearestSide(r: Rect, p: Point): { side: Side; t: number; distance: number } {
  const candidates: Array<{ side: Side; t: number; distance: number }> = (['top', 'right', 'bottom', 'left'] as const).map((side) => {
    const a = side === 'right' ? { x: r.x + r.w, y: r.y } : side === 'bottom' ? { x: r.x, y: r.y + r.h } : { x: r.x, y: r.y };
    const b = side === 'top' ? { x: r.x + r.w, y: r.y } : side === 'left' ? { x: r.x, y: r.y + r.h } : { x: r.x + r.w, y: r.y + r.h };
    const { point, t } = closestPointOnSegment(p, a, b);
    return { side, t, distance: distance(p, point) };
  });
  candidates.sort((x, y) => x.distance - y.distance);
  return candidates[0]!;
}

export function directionVector(direction: 'up' | 'down' | 'left' | 'right'): Point {
  switch (direction) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
  }
}

export function roundTo(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function snapToGrid(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}
