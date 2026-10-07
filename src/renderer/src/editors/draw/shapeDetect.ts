/**
 * "Detect shapes": recognises a freehand stroke as one of Whimsical's four shapes (straight
 * line, rectangle, circle / ellipse, diamond) and returns the idealised outline. Deterministic
 * geometric heuristics, no ML. Pure and unit tested. Coordinates are in whatever space the input
 * is in (the caller passes world coordinates).
 */

import type { StrokeElement } from '@renderer/core/types';
import { distPointSegment, type Pt } from './strokeGeometry';

export type DetectedShape = NonNullable<StrokeElement['detectedShape']>;

export interface DetectResult {
  shape: DetectedShape;
  /** Idealised centre line (closed shapes repeat the first point at the end). */
  points: Pt[];
}

/** Strokes smaller than this (bbox diagonal, world units) are never snapped. */
const MIN_DIAGONAL = 24;
/** A path is closed when the end is within this fraction of the path length from the start. */
const CLOSED_GAP_RATIO = 0.2;
/** Max perpendicular deviation from the chord, as a fraction of the chord, for a line. */
const LINE_DEVIATION = 0.07;
/** Max mean normalised distance from an ideal outline for a closed shape. */
const SHAPE_TOLERANCE = 0.09;
/** Lines this close to horizontal / vertical (degrees) snap to the axis. */
const AXIS_SNAP_DEG = 6;
const CIRCLE_SEGMENTS = 48;

function pathLength(pts: readonly Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return len;
}

/** Resamples to `count` points equally spaced along the path (removes sampling-density bias). */
export function resample(pts: readonly Pt[], count: number): Pt[] {
  const total = pathLength(pts);
  if (pts.length < 2 || total === 0) return [...pts];
  const step = total / (count - 1);
  const out: Pt[] = [pts[0]!];
  let acc = 0;
  let prev = pts[0]!;
  let i = 1;
  while (i < pts.length && out.length < count) {
    const cur = pts[i]!;
    const seg = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (acc + seg >= step && seg > 0) {
      const t = (step - acc) / seg;
      const p = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
      out.push(p);
      prev = p;
      acc = 0;
    } else {
      acc += seg;
      prev = cur;
      i += 1;
    }
  }
  while (out.length < count) out.push(pts[pts.length - 1]!);
  return out;
}

function bbox(pts: readonly Pt[]): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function meanDistanceToPolygon(pts: readonly Pt[], poly: readonly Pt[]): number {
  let sum = 0;
  for (const p of pts) {
    let best = Infinity;
    for (let i = 1; i < poly.length; i++) best = Math.min(best, distPointSegment(p, poly[i - 1]!, poly[i]!));
    sum += best;
  }
  return sum / pts.length;
}

function detectLine(pts: readonly Pt[], length: number): DetectResult | undefined {
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (chord < MIN_DIAGONAL) return undefined;
  if (length / chord > 1.25) return undefined;
  let maxDev = 0;
  for (const p of pts) maxDev = Math.max(maxDev, distPointSegment(p, a, b));
  if (maxDev / chord > LINE_DEVIATION) return undefined;
  let start = a;
  let end = b;
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const fromAxis = Math.min(Math.abs(angle % 90), 90 - Math.abs(angle % 90));
  if (fromAxis <= AXIS_SNAP_DEG) {
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    if (horizontal) {
      const y = (a.y + b.y) / 2;
      start = { x: a.x, y };
      end = { x: b.x, y };
    } else {
      const x = (a.x + b.x) / 2;
      start = { x, y: a.y };
      end = { x, y: b.y };
    }
  }
  return { shape: 'line', points: [start, end] };
}

export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, segments = CIRCLE_SEGMENTS): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2 - Math.PI / 2;
    out.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
  }
  out.push({ ...out[0]! });
  return out;
}

export function rectanglePoints(minX: number, minY: number, maxX: number, maxY: number): Pt[] {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: minY },
  ];
}

export function diamondPoints(minX: number, minY: number, maxX: number, maxY: number): Pt[] {
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return [
    { x: cx, y: minY },
    { x: maxX, y: cy },
    { x: cx, y: maxY },
    { x: minX, y: cy },
    { x: cx, y: minY },
  ];
}

function detectClosed(pts: readonly Pt[]): DetectResult | undefined {
  const box = bbox(pts);
  if (box.w < 12 || box.h < 12) return undefined;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const rx = box.w / 2;
  const ry = box.h / 2;
  const sample = resample(pts, 96);
  const unit = 0.25 * (box.w + box.h);

  // Ellipse: mean deviation of the normalised radius from 1.
  let ellipse = 0;
  for (const p of sample) ellipse += Math.abs(Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) - 1);
  ellipse /= sample.length;

  const rect = rectanglePoints(box.minX, box.minY, box.maxX, box.maxY);
  const diamond = diamondPoints(box.minX, box.minY, box.maxX, box.maxY);
  const rectScore = meanDistanceToPolygon(sample, rect) / unit;
  const diamondScore = meanDistanceToPolygon(sample, diamond) / unit;

  const scores: Array<[DetectedShape, number]> = [
    ['circle', ellipse],
    ['rectangle', rectScore],
    ['diamond', diamondScore],
  ];
  scores.sort((a, b) => a[1] - b[1]);
  const [shape, score] = scores[0]!;
  if (score > SHAPE_TOLERANCE) return undefined;
  switch (shape) {
    case 'circle':
      return { shape, points: ellipsePoints(cx, cy, rx, ry) };
    case 'rectangle':
      return { shape, points: rect };
    default:
      return { shape, points: diamond };
  }
}

/**
 * Detects a shape in a finished stroke. Returns undefined when the stroke is too small, not
 * clearly one of the four shapes, or a dot.
 */
export function detectShape(input: readonly Pt[]): DetectResult | undefined {
  if (input.length < 3) return undefined;
  const box = bbox(input);
  if (Math.hypot(box.w, box.h) < MIN_DIAGONAL) return undefined;
  const length = pathLength(input);
  if (length === 0) return undefined;
  const first = input[0]!;
  const last = input[input.length - 1]!;
  const gap = Math.hypot(last.x - first.x, last.y - first.y);
  const closed = gap <= CLOSED_GAP_RATIO * length && gap <= 0.4 * Math.hypot(box.w, box.h);
  return closed ? detectClosed(input) : detectLine(input, length);
}
