import { describe, expect, it } from 'vitest';
import {
  HIGHLIGHTER_WIDTH,
  MARKER_WIDTH,
  buildStrokeBox,
  distPointSegment,
  distSegmentSegment,
  outlineToSvgPath,
  pointCount,
  resizeStroke,
  scaleStrokePoints,
  segmentsIntersect,
  strokeContainsPoint,
  strokeOutline,
  strokeWidth,
  thinSamples,
  toTuples,
  worldPoints,
  type Sample,
} from './strokeGeometry';

const s = (x: number, y: number, pressure = 0.5): Sample => ({ x, y, pressure });

describe('strokeWidth', () => {
  it('is constant per tool and size', () => {
    expect(strokeWidth({ tool: 'marker', size: 'thin' })).toBe(MARKER_WIDTH.thin);
    expect(strokeWidth({ tool: 'marker', size: 'thick' })).toBe(MARKER_WIDTH.thick);
    expect(strokeWidth({ tool: 'highlighter', size: 'thin' })).toBe(HIGHLIGHTER_WIDTH);
  });
});

describe('buildStrokeBox', () => {
  it('pads the centre-line bounds by half the width and stores local points', () => {
    const box = buildStrokeBox([s(10, 20), s(30, 60, 0.9)], 4);
    expect(box).toMatchObject({ x: 8, y: 18, w: 24, h: 44 });
    expect(box.points).toEqual([2, 2, 0.5, 22, 42, 0.9]);
    expect(worldPoints({ x: box.x, y: box.y, points: box.points })).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 60 },
    ]);
  });

  it('gives a dot a non-empty box', () => {
    const box = buildStrokeBox([s(5, 5)], 7);
    expect(box.w).toBe(7);
    expect(box.h).toBe(7);
    expect(pointCount(box.points)).toBe(1);
  });

  it('rounds to two decimals and clamps pressure', () => {
    const box = buildStrokeBox([s(0.123456, 0.987654, 5)], 2);
    expect(
      box.points.every((n) => Math.round(n * 100) === n * 100 || Math.abs(n * 100 - Math.round(n * 100)) < 1e-9),
    ).toBe(true);
    expect(box.points[2]).toBe(1);
  });

  it('handles an empty sample list', () => {
    expect(buildStrokeBox([], 3).points).toEqual([]);
  });
});

describe('point arrays', () => {
  it('ignores a trailing partial triple', () => {
    expect(toTuples([1, 2, 3, 4, 5])).toEqual([[1, 2, 3]]);
    expect(pointCount([1, 2, 3, 4, 5])).toBe(1);
  });
});

describe('thinSamples', () => {
  it('drops close samples but keeps the first and the final position', () => {
    const out = thinSamples([s(0, 0), s(0.2, 0), s(0.4, 0), s(10, 0), s(10.1, 0)], 1);
    expect(out.map((p) => p.x)).toEqual([0, 10.1]);
  });
  it('keeps a single sample', () => {
    expect(thinSamples([s(1, 1)], 5)).toHaveLength(1);
  });
});

describe('resize', () => {
  it('scales the centre line but keeps the padding (width never scales)', () => {
    const el = {
      tool: 'marker' as const,
      size: 'thin' as const,
      x: 0,
      y: 0,
      w: 13,
      h: 13,
      points: [1.5, 1.5, 0.5, 11.5, 11.5, 0.5],
    };
    const out = resizeStroke(el, { x: 100, y: 50, w: 25, h: 13 }, { x: 0, y: 0, w: 13, h: 13 });
    expect(out).toMatchObject({ x: 100, y: 50, w: 25, h: 13 });
    expect(out.points).toEqual([1.5, 1.5, 0.5, 23.5, 11.5, 0.5]);
  });

  it('centres an axis with zero extent instead of dividing by zero', () => {
    const pts = scaleStrokePoints([2, 2, 0.5, 12, 2, 0.5], 2, { w: 14, h: 4 }, { w: 14, h: 10 });
    expect(pts[1]).toBe(5);
    expect(pts[4]).toBe(5);
    expect(pts.every(Number.isFinite)).toBe(true);
  });
});

describe('segment maths', () => {
  it('computes point to segment distance', () => {
    expect(distPointSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    expect(distPointSegment({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(distPointSegment({ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 2 })).toBeCloseTo(Math.SQRT2);
  });
  it('detects crossing segments with zero distance', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
    expect(distSegmentSegment({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(0);
    expect(distSegmentSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 4 }, { x: 10, y: 4 })).toBe(4);
  });
});

describe('hit testing', () => {
  const el = {
    id: 'a',
    type: 'stroke' as const,
    tool: 'marker' as const,
    size: 'thick' as const,
    color: 'slate' as const,
    x: 0,
    y: 0,
    w: 107,
    h: 7,
    points: [3.5, 3.5, 0.5, 103.5, 3.5, 0.5],
  };
  it('hits on the line and within the tolerance, not beyond', () => {
    expect(strokeContainsPoint(el, { x: 50, y: 3.5 }, 0)).toBe(true);
    expect(strokeContainsPoint(el, { x: 50, y: 3.5 + 3.5 + 4 }, 5)).toBe(true);
    expect(strokeContainsPoint(el, { x: 50, y: 40 }, 5)).toBe(false);
  });
  it('hits a dot', () => {
    const dot = { ...el, w: 7, h: 7, points: [3.5, 3.5, 0.5] };
    expect(strokeContainsPoint(dot, { x: 4, y: 4 }, 0)).toBe(true);
    expect(strokeContainsPoint(dot, { x: 30, y: 30 }, 2)).toBe(false);
  });
});

describe('outline', () => {
  it('produces a closed SVG path for a stroke and for a dot', () => {
    const line = strokeOutline([3, 3, 0.5, 40, 20, 0.5, 80, 3, 0.5], { tool: 'marker', size: 'thin' }, { last: true });
    expect(line.length).toBeGreaterThan(4);
    const d = outlineToSvgPath(line);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const dot = strokeOutline([3, 3, 0.5], { tool: 'marker', size: 'thick' }, { last: true });
    expect(dot.length).toBeGreaterThan(2);
    expect(outlineToSvgPath([])).toBe('');
  });
});
