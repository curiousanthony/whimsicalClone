/**
 * Pure stroke geometry (no DOM, no React). A stroke element stores its centre line as a flat
 * array [x0, y0, p0, x1, y1, p1, ...] in coordinates LOCAL to the element box (x, y), rounded
 * to two decimals. The box is the bounding box of the centre line padded by half the stroke
 * width, so dots and perfectly straight lines still have a non-empty selectable box.
 *
 * Width is constant (user decision: no pressure sensitivity). Pressure is stored per point
 * for fidelity; `outlineOptions` can opt into it through `thinning`.
 */

import { getStroke } from 'perfect-freehand';
import type { Rect, StrokeElement } from '@renderer/core/types';

/* ------------------------------------------------------------------------------------------
 * Tool metrics
 * ---------------------------------------------------------------------------------------- */

/** Marker widths in world units (research 04 section 4). */
export const MARKER_WIDTH = { thin: 3, thick: 7 } as const;
export const HIGHLIGHTER_WIDTH = 22;
export const HIGHLIGHTER_OPACITY = 0.35;
/** Eraser radius in SCREEN pixels: constant on screen whatever the zoom. */
export const ERASER_RADIUS_PX = 10;

export type StrokeStyle = Pick<StrokeElement, 'tool' | 'size'>;

export function strokeWidth(style: StrokeStyle): number {
  return style.tool === 'highlighter' ? HIGHLIGHTER_WIDTH : MARKER_WIDTH[style.size];
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------------------------------
 * Point arrays
 * ---------------------------------------------------------------------------------------- */

export interface Sample {
  x: number;
  y: number;
  pressure: number;
}

export type Tuple = [number, number, number];

/** Flat [x,y,p,...] -> tuples. A trailing partial triple is ignored. */
export function toTuples(flat: readonly number[]): Tuple[] {
  const out: Tuple[] = [];
  for (let i = 0; i + 2 < flat.length; i += 3) {
    out.push([flat[i]!, flat[i + 1]!, flat[i + 2]!]);
  }
  return out;
}

/** Number of points of a stroke. */
export function pointCount(flat: readonly number[]): number {
  return Math.floor(flat.length / 3);
}

/** Centre line of a stroke element in WORLD coordinates. */
export function worldPoints(el: Pick<StrokeElement, 'x' | 'y' | 'points'>): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 2 < el.points.length; i += 3) out.push({ x: el.x + el.points[i]!, y: el.y + el.points[i + 1]! });
  return out;
}

/** Drops samples closer than `minDistance` to the previous kept one (keeps the last sample). */
export function thinSamples(samples: readonly Sample[], minDistance: number): Sample[] {
  if (samples.length <= 1) return [...samples];
  const out: Sample[] = [samples[0]!];
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i]!;
    const prev = out[out.length - 1]!;
    const isLast = i === samples.length - 1;
    const far = Math.hypot(s.x - prev.x, s.y - prev.y) >= minDistance;
    if (far) out.push(s);
    else if (isLast && out.length > 1) out[out.length - 1] = { ...s };
  }
  return out;
}

/* ------------------------------------------------------------------------------------------
 * Element box construction
 * ---------------------------------------------------------------------------------------- */

export interface StrokeBox {
  x: number;
  y: number;
  w: number;
  h: number;
  points: number[];
}

/**
 * Builds the element box and local points from world-space samples. The box is the centre-line
 * bounding box padded by half the stroke width.
 */
export function buildStrokeBox(samples: readonly Sample[], width: number): StrokeBox {
  if (samples.length === 0) return { x: 0, y: 0, w: width, h: width, points: [] };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of samples) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x);
    maxY = Math.max(maxY, s.y);
  }
  const pad = width / 2;
  const x = round2(minX - pad);
  const y = round2(minY - pad);
  const w = round2(maxX - minX + width);
  const h = round2(maxY - minY + width);
  const points: number[] = [];
  for (const s of samples) {
    points.push(round2(s.x - x), round2(s.y - y), round2(clamp01(s.pressure)));
  }
  return { x, y, w, h, points };
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
}

/** World-space bounds of a stroke element. */
export function strokeBounds(el: Pick<StrokeElement, 'x' | 'y' | 'w' | 'h'>): Rect {
  return { x: el.x, y: el.y, w: el.w, h: el.h };
}

/* ------------------------------------------------------------------------------------------
 * Resize and restyle (the width never scales)
 * ---------------------------------------------------------------------------------------- */

/**
 * Rescales local points when the box goes from `prev` to `next`. The padding (half the stroke
 * width) stays constant, so only the centre-line extent scales. An axis whose centre-line
 * extent is zero (dot, perfectly horizontal / vertical line) is centred instead of scaled.
 */
export function scaleStrokePoints(
  points: readonly number[],
  pad: number,
  prev: { w: number; h: number },
  next: { w: number; h: number },
): number[] {
  const prevW = prev.w - 2 * pad;
  const prevH = prev.h - 2 * pad;
  const nextW = Math.max(0, next.w - 2 * pad);
  const nextH = Math.max(0, next.h - 2 * pad);
  const kx = prevW > 1e-6 ? nextW / prevW : undefined;
  const ky = prevH > 1e-6 ? nextH / prevH : undefined;
  const out: number[] = [];
  for (let i = 0; i + 2 < points.length; i += 3) {
    const x = kx === undefined ? pad + nextW / 2 : pad + (points[i]! - pad) * kx;
    const y = ky === undefined ? pad + nextH / 2 : pad + (points[i + 1]! - pad) * ky;
    out.push(round2(x), round2(y), points[i + 2]!);
  }
  return out;
}

export interface BoxFields {
  x: number;
  y: number;
  w: number;
  h: number;
  points: number[];
}

/** Resize result for a stroke: new box and rescaled points, same width. */
export function resizeStroke(
  el: Pick<StrokeElement, 'tool' | 'size' | 'points' | 'x' | 'y' | 'w' | 'h'>,
  next: Rect,
  prev: Rect,
): BoxFields {
  const pad = strokeWidth(el) / 2;
  return {
    x: round2(next.x),
    y: round2(next.y),
    w: round2(next.w),
    h: round2(next.h),
    points: scaleStrokePoints(el.points, pad, { w: prev.w, h: prev.h }, { w: next.w, h: next.h }),
  };
}

/**
 * Recomputes the box after a style change (the half-width padding changes) keeping the centre
 * line where it is.
 */
export function reboxForStyle(el: Pick<StrokeElement, 'x' | 'y' | 'points'>, style: StrokeStyle): BoxFields {
  const samples: Sample[] = [];
  for (let i = 0; i + 2 < el.points.length; i += 3) {
    samples.push({ x: el.x + el.points[i]!, y: el.y + el.points[i + 1]!, pressure: el.points[i + 2]! });
  }
  return buildStrokeBox(samples, strokeWidth(style));
}

/* ------------------------------------------------------------------------------------------
 * Outline and SVG path
 * ---------------------------------------------------------------------------------------- */

export interface OutlineOptions {
  /** 0 = constant width (default, user decision). Non-zero would vary width with pressure. */
  thinning?: number;
  /** Final render of a finished stroke (uses the real last point). */
  last?: boolean;
}

/** Variable-width polygon around the centre line (perfect-freehand), local coordinates. */
export function strokeOutline(points: readonly number[], style: StrokeStyle, options: OutlineOptions = {}): number[][] {
  const tuples = toTuples(points);
  if (tuples.length === 0) return [];
  const size = strokeWidth(style);
  const highlighter = style.tool === 'highlighter';
  return getStroke(tuples, {
    size,
    thinning: options.thinning ?? 0,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: false,
    last: options.last ?? true,
    start: { cap: !highlighter },
    end: { cap: !highlighter },
  });
}

const average = (a: number, b: number): number => (a + b) / 2;

/** Quadratic-curve SVG path of a closed outline polygon (perfect-freehand README). */
export function outlineToSvgPath(outline: readonly number[][]): string {
  const len = outline.length;
  if (len < 4) return '';
  let a = outline[0]!;
  let b = outline[1]!;
  const c = outline[2]!;
  let d = `M${a[0]!.toFixed(2)},${a[1]!.toFixed(2)} Q${b[0]!.toFixed(2)},${b[1]!.toFixed(2)} ${average(b[0]!, c[0]!).toFixed(2)},${average(b[1]!, c[1]!).toFixed(2)} T`;
  for (let i = 2, max = len - 1; i < max; i++) {
    a = outline[i]!;
    b = outline[i + 1]!;
    d += `${average(a[0]!, b[0]!).toFixed(2)},${average(a[1]!, b[1]!).toFixed(2)} `;
  }
  return `${d}Z`;
}

/** Straight-segment path of the centre line (detected shapes are stroked, not filled). */
export function polylinePath(points: readonly number[]): string {
  const t = toTuples(points);
  if (t.length === 0) return '';
  return t.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
}

/** Cache: one path string per (immutable) element object. */
const pathCache = new WeakMap<object, string>();

export type StrokeRender = { kind: 'fill'; d: string } | { kind: 'line'; d: string };

/** How a stroke element is drawn: filled outline (freehand) or stroked polyline (detected shape). */
export function strokeRender(el: StrokeElement): StrokeRender {
  if (el.detectedShape) {
    return { kind: 'line', d: polylinePath(el.points) };
  }
  let d = pathCache.get(el);
  if (d === undefined) {
    d = outlineToSvgPath(strokeOutline(el.points, el, { last: true }));
    pathCache.set(el, d);
  }
  return { kind: 'fill', d };
}

/** Path of a live (still being drawn) point buffer in WORLD coordinates. */
export function livePath(samples: readonly Sample[], style: StrokeStyle): string {
  if (samples.length === 0) return '';
  const tuples: Tuple[] = samples.map((s) => [s.x, s.y, s.pressure]);
  const flat: number[] = [];
  for (const t of tuples) flat.push(t[0], t[1], t[2]);
  return outlineToSvgPath(strokeOutline(flat, style, { last: false }));
}

/* ------------------------------------------------------------------------------------------
 * Distances (hit testing and eraser)
 * ---------------------------------------------------------------------------------------- */

export interface Pt {
  x: number;
  y: number;
}

export function distPointSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Minimum distance between two segments (0 when they cross). */
export function distSegmentSegment(a: Pt, b: Pt, c: Pt, d: Pt): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distPointSegment(a, c, d),
    distPointSegment(b, c, d),
    distPointSegment(c, a, b),
    distPointSegment(d, a, b),
  );
}

/** Minimum distance from a point to a polyline (a single point is a dot). */
export function distPointPolyline(p: Pt, line: readonly Pt[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return Math.hypot(p.x - line[0]!.x, p.y - line[0]!.y);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, distPointSegment(p, line[i - 1]!, line[i]!));
  return best;
}

/** Minimum distance from segment ab to a polyline (tunnelling-safe eraser test). */
export function distSegmentPolyline(a: Pt, b: Pt, line: readonly Pt[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return distPointSegment(line[0]!, a, b);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    best = Math.min(best, distSegmentSegment(a, b, line[i - 1]!, line[i]!));
    if (best === 0) break;
  }
  return best;
}

/** True when a world point is within `tolerance` of the painted stroke (half width included). */
export function strokeContainsPoint(el: StrokeElement, world: Pt, tolerance: number): boolean {
  const reach = tolerance + strokeWidth(el) / 2;
  const local = worldPoints(el);
  return distPointPolyline(world, local) <= reach;
}

/** Axis-aligned bbox of a segment expanded by `margin` (eraser broad phase). */
export function segmentBounds(
  a: Pt,
  b: Pt,
  margin: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: Math.min(a.x, b.x) - margin,
    minY: Math.min(a.y, b.y) - margin,
    maxX: Math.max(a.x, b.x) + margin,
    maxY: Math.max(a.y, b.y) + margin,
  };
}
