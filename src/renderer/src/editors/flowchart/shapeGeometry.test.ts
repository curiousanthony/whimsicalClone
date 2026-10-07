import { describe, expect, it } from 'vitest';
import type { ShapeKind } from '@renderer/core/types';
import { pointInPolygon, pointInShape, seededRandom, shapeGeometry } from './shapeGeometry';
import { SHAPE_KINDS, SHAPE_SPECS } from './shapes';

describe('shapeGeometry', () => {
  it('produces an outline and a positive text box for every kind', () => {
    for (const kind of SHAPE_KINDS) {
      const { defaultSize } = SHAPE_SPECS[kind];
      const g = shapeGeometry(kind, defaultSize.w, defaultSize.h, 42);
      expect(g.d.startsWith('M'), kind).toBe(true);
      expect(g.d).not.toContain('NaN');
      expect(g.textBox.w, kind).toBeGreaterThan(0);
      expect(g.textBox.h, kind).toBeGreaterThan(0);
    }
  });

  it('is deterministic for a seed and changes with the seed (cloud, star)', () => {
    for (const kind of ['cloud', 'star'] as ShapeKind[]) {
      const a = shapeGeometry(kind, 168, 108, 1);
      expect(shapeGeometry(kind, 168, 108, 1).d).toBe(a.d);
      expect(shapeGeometry(kind, 168, 108, 99).d).not.toBe(a.d);
    }
  });

  it('keeps the text box inside the shape bounds', () => {
    for (const kind of SHAPE_KINDS) {
      const g = shapeGeometry(kind, 200, 140, 3);
      expect(g.textBox.x, kind).toBeGreaterThanOrEqual(0);
      expect(g.textBox.y, kind).toBeGreaterThanOrEqual(0);
      expect(g.textBox.x + g.textBox.w, kind).toBeLessThanOrEqual(200.001);
      expect(g.textBox.y + g.textBox.h, kind).toBeLessThanOrEqual(140.001);
    }
  });

  it('marks line, bracket and actor as not enclosing an area', () => {
    expect(shapeGeometry('line', 100, 12).closed).toBe(false);
    expect(shapeGeometry('bracket', 24, 100).closed).toBe(false);
    expect(shapeGeometry('actor', 60, 108).closed).toBe(false);
    expect(shapeGeometry('rectangle', 100, 50).closed).toBe(true);
  });

  it('seededRandom is reproducible and within [0, 1)', () => {
    const a = seededRandom(5);
    const b = seededRandom(5);
    for (let i = 0; i < 20; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hit testing', () => {
  it('diamond: centre hits, corner misses', () => {
    const g = shapeGeometry('diamond', 100, 100);
    expect(pointInShape(g, 100, 100, { x: 50, y: 50 })).toBe(true);
    expect(pointInShape(g, 100, 100, { x: 2, y: 2 })).toBe(false);
    expect(pointInShape(g, 100, 100, { x: 2, y: 2 }, 80)).toBe(true);
  });

  it('oval: bounding-box corner misses, centre hits', () => {
    const g = shapeGeometry('oval', 100, 60);
    expect(pointInShape(g, 100, 60, { x: 50, y: 30 })).toBe(true);
    expect(pointInShape(g, 100, 60, { x: 2, y: 2 })).toBe(false);
  });

  it('triangle: apex area is narrow', () => {
    const g = shapeGeometry('triangle', 100, 100);
    expect(pointInShape(g, 100, 100, { x: 50, y: 60 })).toBe(true);
    expect(pointInShape(g, 100, 100, { x: 5, y: 10 })).toBe(false);
  });

  it('line: only points near the segment hit', () => {
    const g = shapeGeometry('line', 100, 12);
    expect(pointInShape(g, 100, 12, { x: 50, y: 6 })).toBe(true);
    expect(pointInShape(g, 100, 12, { x: 50, y: 40 })).toBe(false);
  });

  it('pointInPolygon uses the even-odd rule', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });
});
