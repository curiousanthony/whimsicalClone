import { describe, expect, it } from 'vitest';
import { detectShape, ellipsePoints, rectanglePoints, resample } from './shapeDetect';
import type { Pt } from './strokeGeometry';

function jitter(pts: Pt[], amount: number): Pt[] {
  // Deterministic pseudo noise.
  return pts.map((p, i) => ({ x: p.x + Math.sin(i * 12.9898) * amount, y: p.y + Math.cos(i * 78.233) * amount }));
}

function densify(pts: Pt[], perSegment: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment;
      out.push({ x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * t, y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * t });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

describe('detectShape', () => {
  it('recognises a rough straight line', () => {
    const pts = jitter(
      densify(
        [
          { x: 0, y: 0 },
          { x: 200, y: 20 },
        ],
        30,
      ),
      1.2,
    );
    expect(detectShape(pts)?.shape).toBe('line');
  });

  it('snaps near-horizontal lines to the axis', () => {
    const res = detectShape(
      densify(
        [
          { x: 0, y: 0 },
          { x: 200, y: 4 },
        ],
        30,
      ),
    );
    expect(res?.shape).toBe('line');
    expect(res?.points[0]!.y).toBeCloseTo(res!.points[res!.points.length - 1]!.y);
  });

  it('recognises a rough circle', () => {
    const circle = ellipsePoints(100, 100, 60, 60, 80);
    expect(detectShape(jitter(circle, 2))?.shape).toBe('circle');
  });

  it('recognises a rectangle drawn with a small gap', () => {
    const rect = densify(
      [
        { x: 0, y: 0 },
        { x: 160, y: 0 },
        { x: 160, y: 90 },
        { x: 0, y: 90 },
        { x: 4, y: 6 },
      ],
      20,
    );
    expect(detectShape(jitter(rect, 1.5))?.shape).toBe('rectangle');
  });

  it('recognises a diamond', () => {
    const d = densify(
      [
        { x: 80, y: 0 },
        { x: 160, y: 60 },
        { x: 80, y: 120 },
        { x: 0, y: 60 },
        { x: 80, y: 0 },
      ],
      20,
    );
    expect(detectShape(jitter(d, 1.5))?.shape).toBe('diamond');
  });

  it('refuses dots, tiny strokes and scribbles', () => {
    expect(detectShape([{ x: 0, y: 0 }])).toBeUndefined();
    expect(
      detectShape(
        densify(
          [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
          ],
          5,
        ),
      ),
    ).toBeUndefined();
    const scribble = densify(
      [
        { x: 0, y: 0 },
        { x: 100, y: 80 },
        { x: 10, y: 90 },
        { x: 120, y: 5 },
        { x: 40, y: 150 },
        { x: 150, y: 60 },
      ],
      15,
    );
    expect(detectShape(scribble)).toBeUndefined();
  });
});

describe('helpers', () => {
  it('resamples to an exact number of points', () => {
    const out = resample(
      densify(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        7,
      ),
      11,
    );
    expect(out).toHaveLength(11);
    expect(out[5]!.x).toBeCloseTo(50);
  });
  it('builds closed outlines', () => {
    const r = rectanglePoints(0, 0, 10, 20);
    expect(r[0]).toEqual(r[r.length - 1]);
    const e = ellipsePoints(0, 0, 5, 5);
    expect(e[0]!.x).toBeCloseTo(e[e.length - 1]!.x);
  });
});
