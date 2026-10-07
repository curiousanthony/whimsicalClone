import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HIGHLIGHTER_COLOR,
  HIGHLIGHTER_STYLE_KEY,
  MARKER_STYLE_KEY,
  clampColorForTool,
  createStroke,
  normalizeStroke,
  penStyleFrom,
  restyleFields,
  shapeFields,
  strokePaint,
} from './strokeModel';
import { strokeWidth } from './strokeGeometry';
import type { StrokeElement } from '@renderer/core/types';

const base: StrokeElement = {
  id: 's1',
  type: 'stroke',
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  tool: 'marker',
  size: 'thin',
  color: 'slate',
  points: [2, 2, 0.5, 18, 18, 0.5],
};

describe('penStyleFrom', () => {
  it('uses remembered colours per pen family', () => {
    const remember = (key: string) =>
      key === MARKER_STYLE_KEY ? { color: 'red' } : key === HIGHLIGHTER_STYLE_KEY ? { color: 'green' } : undefined;
    expect(penStyleFrom('marker', 'thick', remember)).toEqual({ tool: 'marker', size: 'thick', color: 'red' });
    expect(penStyleFrom('highlighter', 'thin', remember)).toEqual({
      tool: 'highlighter',
      size: 'thick',
      color: 'green',
    });
  });
  it('falls back to defaults and ignores garbage', () => {
    expect(penStyleFrom('highlighter', 'thick', () => ({ color: 42 })).color).toBe(DEFAULT_HIGHLIGHTER_COLOR);
    expect(penStyleFrom('marker', 'thin', () => undefined).tool).toBe('marker');
  });
  it('replaces non highlighter colours when switching to the highlighter', () => {
    expect(clampColorForTool('highlighter', 'white')).toBe(DEFAULT_HIGHLIGHTER_COLOR);
    expect(clampColorForTool('marker', 'white')).toBe('white');
  });
});

describe('createStroke', () => {
  it('builds an element from world samples and flags pen input', () => {
    const el = createStroke(
      'x',
      [
        { x: 100, y: 100, pressure: 0.3 },
        { x: 140, y: 120, pressure: 0.8 },
      ],
      { tool: 'marker', size: 'thin', color: 'blue' },
      { isPen: true },
    );
    expect(el).toMatchObject({ id: 'x', type: 'stroke', tool: 'marker', size: 'thin', color: 'blue', isPen: true });
    expect(el.points).toHaveLength(6);
    expect(el.x).toBeLessThan(100);
  });
  it('does not set isPen for mouse input', () => {
    const el = createStroke('x', [{ x: 0, y: 0, pressure: 0.5 }], { tool: 'marker', size: 'thin', color: 'blue' });
    expect('isPen' in el).toBe(false);
  });
});

describe('restyleFields', () => {
  it('re-boxes around the same centre line when the width changes', () => {
    const out = restyleFields(base, { size: 'thick' });
    expect(out.size).toBe('thick');
    const w = strokeWidth({ tool: 'marker', size: 'thick' });
    expect(out.x + out.points[0]!).toBeCloseTo(base.x + base.points[0]!);
    expect(out.w).toBeCloseTo(16 + w);
  });
  it('forces thick for the highlighter and clamps its colour', () => {
    const out = restyleFields({ ...base, color: 'white' }, { tool: 'highlighter' });
    expect(out.tool).toBe('highlighter');
    expect(out.size).toBe('thick');
    expect(out.color).toBe(DEFAULT_HIGHLIGHTER_COLOR);
  });
});

describe('shapeFields', () => {
  it('replaces the centre line with the detected outline', () => {
    const out = shapeFields(base, {
      shape: 'rectangle',
      points: [
        { x: 10, y: 10 },
        { x: 60, y: 10 },
        { x: 60, y: 40 },
        { x: 10, y: 40 },
        { x: 10, y: 10 },
      ],
    });
    expect(out.detectedShape).toBe('rectangle');
    expect(out.points).toHaveLength(15);
    expect(out.w).toBeCloseTo(50 + 3);
  });
});

describe('normalizeStroke', () => {
  it('returns the same object when valid', () => {
    expect(normalizeStroke(base)).toBe(base);
  });
  it('repairs bad tool, size, colour and truncated or non-finite points', () => {
    const bad = {
      ...base,
      tool: 'chalk',
      size: 'huge',
      color: 'nope',
      points: [1, 2, 0.5, NaN, 4, 0.5, 7, 8],
    } as unknown as StrokeElement;
    const out = normalizeStroke(bad);
    expect(out.tool).toBe('marker');
    expect(out.size).toBe('thin');
    expect(out.points.length % 3).toBe(0);
    expect(out.points.every(Number.isFinite)).toBe(true);
  });
});

describe('serialization', () => {
  it('survives a JSON round trip unchanged', () => {
    const el = createStroke(
      'z',
      [
        { x: 1.234, y: 2.345, pressure: 0.5 },
        { x: 50, y: 60, pressure: 0.7 },
      ],
      { tool: 'highlighter', size: 'thick', color: 'yellow' },
    );
    expect(normalizeStroke(JSON.parse(JSON.stringify(el)) as StrokeElement)).toEqual(el);
  });
});

describe('strokePaint', () => {
  it('swaps slate ink on dark canvases', () => {
    expect(strokePaint('slate', 'dark')).not.toBe(strokePaint('slate', 'light'));
  });
});
