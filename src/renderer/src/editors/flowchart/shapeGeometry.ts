/**
 * Pure geometry of the diagram shapes (owner: flowchart). Everything is expressed in the
 * shape's LOCAL coordinates (0..w, 0..h); rotation is applied by the engine wrapper.
 *
 *   shapeGeometry(kind, w, h, seed)  -> SVG outline path, detail strokes, text box, hit shape
 *   pointInShape(...)                -> precise hit test used by the element definition
 *
 * Cloud and star outlines are randomised from `seed` (Whimsical: "a splash of randomness",
 * regenerated on resize); the same seed always produces the same outline.
 */

import type { Point, Rect, ShapeKind } from '@renderer/core/types';

export type HitShape =
  | { type: 'rect' }
  | { type: 'ellipse' }
  | { type: 'polygon'; points: Point[] }
  | { type: 'segment'; a: Point; b: Point };

export interface ShapeGeometry {
  /** Closed (or open, for line / bracket) outline path. */
  d: string;
  /** Extra stroke-only strokes (cylinder rim, actor body). */
  details: string[];
  /** Area text may occupy, local coordinates. */
  textBox: Rect;
  /** The outline encloses an area (false for line, bracket and the actor stick figure). */
  closed: boolean;
  hit: HitShape;
}

const f = (n: number): string => String(Math.round(n * 100) / 100);

/** Deterministic PRNG (mulberry32) so seeded outlines are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function polygon(points: Point[]): string {
  return `M${points.map((p) => `${f(p.x)},${f(p.y)}`).join(' L')} Z`;
}

function polygonGeometry(points: Point[], textBox: Rect): ShapeGeometry {
  return { d: polygon(points), details: [], textBox, closed: true, hit: { type: 'polygon', points } };
}

/** Height of the figure part of the actor (the label sits below it). */
export function actorFigureHeight(h: number): number {
  return Math.min(72, h * 0.7);
}

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w: Math.max(1, w), h: Math.max(1, h) });

export function shapeGeometry(kind: ShapeKind, w: number, h: number, seed = 1): ShapeGeometry {
  switch (kind) {
    case 'rectangle': {
      const r = Math.min(8, w / 2, h / 2);
      const d = `M${f(r)},0 H${f(w - r)} Q${f(w)},0 ${f(w)},${f(r)} V${f(h - r)} Q${f(w)},${f(h)} ${f(w - r)},${f(h)} H${f(r)} Q0,${f(h)} 0,${f(h - r)} V${f(r)} Q0,0 ${f(r)},0 Z`;
      return { d, details: [], textBox: rect(12, 8, w - 24, h - 16), closed: true, hit: { type: 'rect' } };
    }
    case 'pill': {
      const r = Math.min(w, h) / 2;
      const d = `M${f(r)},0 H${f(w - r)} A${f(r)},${f(r)} 0 0 1 ${f(w - r)},${f(h)} H${f(r)} A${f(r)},${f(r)} 0 0 1 ${f(r)},0 Z`;
      return { d, details: [], textBox: rect(r * 0.7, 8, w - r * 1.4, h - 16), closed: true, hit: { type: 'rect' } };
    }
    case 'oval': {
      const rx = w / 2;
      const ry = h / 2;
      const d = `M0,${f(ry)} A${f(rx)},${f(ry)} 0 1 1 ${f(w)},${f(ry)} A${f(rx)},${f(ry)} 0 1 1 0,${f(ry)} Z`;
      return { d, details: [], textBox: rect(w * 0.15, h * 0.15, w * 0.7, h * 0.7), closed: true, hit: { type: 'ellipse' } };
    }
    case 'diamond':
      return polygonGeometry(
        [
          { x: w / 2, y: 0 },
          { x: w, y: h / 2 },
          { x: w / 2, y: h },
          { x: 0, y: h / 2 },
        ],
        rect(w * 0.25, h * 0.25, w * 0.5, h * 0.5),
      );
    case 'parallelogram': {
      const s = Math.min(w * 0.25, h * 0.4);
      return polygonGeometry(
        [
          { x: s, y: 0 },
          { x: w, y: 0 },
          { x: w - s, y: h },
          { x: 0, y: h },
        ],
        rect(s, 8, w - 2 * s, h - 16),
      );
    }
    case 'parallelogramFlipped': {
      const s = Math.min(w * 0.25, h * 0.4);
      return polygonGeometry(
        [
          { x: 0, y: 0 },
          { x: w - s, y: 0 },
          { x: w, y: h },
          { x: s, y: h },
        ],
        rect(s, 8, w - 2 * s, h - 16),
      );
    }
    case 'trapezoid': {
      const s = Math.min(w * 0.18, h * 0.4);
      return polygonGeometry(
        [
          { x: s, y: 0 },
          { x: w - s, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
        rect(s + 4, 8, w - 2 * s - 8, h - 16),
      );
    }
    case 'triangle':
      return polygonGeometry(
        [
          { x: w / 2, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
        rect(w * 0.25, h * 0.4, w * 0.5, h * 0.52),
      );
    case 'hexagon': {
      const s = Math.min(w * 0.25, h * 0.5);
      return polygonGeometry(
        [
          { x: s, y: 0 },
          { x: w - s, y: 0 },
          { x: w, y: h / 2 },
          { x: w - s, y: h },
          { x: s, y: h },
          { x: 0, y: h / 2 },
        ],
        rect(s * 0.8, 6, w - s * 1.6, h - 12),
      );
    }
    case 'cylinder': {
      const ry = Math.min(h * 0.14, 18);
      const rx = w / 2;
      const d = `M0,${f(ry)} A${f(rx)},${f(ry)} 0 0 1 ${f(w)},${f(ry)} L${f(w)},${f(h - ry)} A${f(rx)},${f(ry)} 0 0 1 0,${f(h - ry)} Z`;
      const rim = `M0,${f(ry)} A${f(rx)},${f(ry)} 0 0 0 ${f(w)},${f(ry)}`;
      return { d, details: [rim], textBox: rect(8, ry * 2 + 4, w - 16, h - ry * 3 - 8), closed: true, hit: { type: 'rect' } };
    }
    case 'actor': {
      const fh = actorFigureHeight(h);
      const cx = w / 2;
      const head = fh * 0.17;
      const neck = head * 2;
      const hip = fh * 0.62;
      const arm = fh * 0.3;
      const legX = fh * 0.24;
      const d = `M${f(cx - head)},${f(head)} A${f(head)},${f(head)} 0 1 1 ${f(cx + head)},${f(head)} A${f(head)},${f(head)} 0 1 1 ${f(cx - head)},${f(head)} Z`;
      const body = `M${f(cx)},${f(neck)} L${f(cx)},${f(hip)}`;
      const arms = `M${f(cx - arm)},${f(fh * 0.4)} L${f(cx + arm)},${f(fh * 0.4)}`;
      const legs = `M${f(cx - legX)},${f(fh)} L${f(cx)},${f(hip)} L${f(cx + legX)},${f(fh)}`;
      return { d, details: [body, arms, legs], textBox: rect(0, fh + 4, w, h - fh - 4), closed: false, hit: { type: 'rect' } };
    }
    case 'line': {
      const y = h / 2;
      return { d: `M0,${f(y)} L${f(w)},${f(y)}`, details: [], textBox: rect(8, 0, w - 16, h), closed: false, hit: { type: 'segment', a: { x: 0, y }, b: { x: w, y } } };
    }
    case 'bracket': {
      const r = Math.min(8, w, h / 2);
      const d = `M${f(w)},0 H${f(r)} Q0,0 0,${f(r)} V${f(h - r)} Q0,${f(h)} ${f(r)},${f(h)} H${f(w)}`;
      return { d, details: [], textBox: rect(4, 4, w - 8, h - 8), closed: false, hit: { type: 'rect' } };
    }
    case 'cloud':
      return cloudGeometry(w, h, seed);
    case 'star':
      return starGeometry(w, h, seed);
    case 'cross': {
      const dx = w * 0.2;
      const dy = h * 0.2;
      return polygonGeometry(
        [
          { x: dx, y: 0 },
          { x: w / 2, y: h / 2 - dy },
          { x: w - dx, y: 0 },
          { x: w, y: dy },
          { x: w / 2 + dx, y: h / 2 },
          { x: w, y: h - dy },
          { x: w - dx, y: h },
          { x: w / 2, y: h / 2 + dy },
          { x: dx, y: h },
          { x: 0, y: h - dy },
          { x: w / 2 - dx, y: h / 2 },
          { x: 0, y: dy },
        ],
        rect(w * 0.3, h * 0.3, w * 0.4, h * 0.4),
      );
    }
  }
}

function cloudGeometry(w: number, h: number, seed: number): ShapeGeometry {
  const rand = seededRandom(seed);
  const n = 9;
  const inset = Math.min(w, h) * 0.12;
  const rx = Math.max(1, w / 2 - inset);
  const ry = Math.max(1, h / 2 - inset);
  const cx = w / 2;
  const cy = h / 2;
  const start = rand() * Math.PI * 2;
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.18;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  let d = `M${f(pts[0]!.x)},${f(pts[0]!.y)}`;
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n]!;
    const prev = pts[i - 1]!;
    const chord = Math.hypot(p.x - prev.x, p.y - prev.y);
    const r = Math.max(chord / 2, chord * (0.6 + rand() * 0.14));
    d += ` A${f(r)},${f(r)} 0 0 1 ${f(p.x)},${f(p.y)}`;
  }
  d += ' Z';
  return { d, details: [], textBox: rect(w * 0.16, h * 0.2, w * 0.68, h * 0.6), closed: true, hit: { type: 'ellipse' } };
}

function starGeometry(w: number, h: number, seed: number): ShapeGeometry {
  const rand = seededRandom(seed);
  const pts: Point[] = [];
  const cx = w / 2;
  const cy = h * 0.53;
  for (let i = 0; i < 10; i++) {
    const outer = i % 2 === 0;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const jitter = 1 + (rand() - 0.5) * 0.12;
    const k = (outer ? 1 : 0.46) * jitter;
    const x = cx + Math.cos(a) * (w / 2) * Math.min(1, k);
    const y = cy + Math.sin(a) * (h * 0.53) * Math.min(1, k);
    pts.push({ x: Math.max(0, Math.min(w, x)), y: Math.max(0, Math.min(h, y)) });
  }
  return polygonGeometry(pts, rect(w * 0.3, h * 0.38, w * 0.4, h * 0.38));
}

/** Point-in-polygon (even-odd). */
export function pointInPolygon(p: Point, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Precise hit test of a LOCAL point against a shape geometry (tolerance in local units). */
export function pointInShape(geometry: ShapeGeometry, w: number, h: number, p: Point, tolerance = 0): boolean {
  const hit = geometry.hit;
  switch (hit.type) {
    case 'rect':
      return p.x >= -tolerance && p.y >= -tolerance && p.x <= w + tolerance && p.y <= h + tolerance;
    case 'ellipse': {
      const rx = w / 2 + tolerance;
      const ry = h / 2 + tolerance;
      const dx = (p.x - w / 2) / rx;
      const dy = (p.y - h / 2) / ry;
      return dx * dx + dy * dy <= 1;
    }
    case 'polygon': {
      if (pointInPolygon(p, hit.points)) return true;
      if (tolerance <= 0) return false;
      for (let i = 0; i < hit.points.length; i++) {
        if (distanceToSegment(p, hit.points[i]!, hit.points[(i + 1) % hit.points.length]!) <= tolerance) return true;
      }
      return false;
    }
    case 'segment':
      return distanceToSegment(p, hit.a, hit.b) <= Math.max(tolerance, 4);
  }
}
