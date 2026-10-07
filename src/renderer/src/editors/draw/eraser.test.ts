import { describe, expect, it } from 'vitest';
import { EraserIndex, eraserWorldRadius } from './eraser';
import { createStroke } from './strokeModel';
import type { StrokeElement } from '@renderer/core/types';

const line = (id: string, x1: number, y1: number, x2: number, y2: number, locked = false): StrokeElement => {
  const el = createStroke(
    id,
    [
      { x: x1, y: y1, pressure: 0.5 },
      { x: x2, y: y2, pressure: 0.5 },
    ],
    { tool: 'marker', size: 'thin', color: 'slate' },
  );
  return locked ? { ...el, locked: true } : el;
};

describe('EraserIndex', () => {
  const strokes = [line('h', 0, 0, 100, 0), line('v', 50, -50, 50, 50), line('far', 500, 500, 600, 500)];
  const index = new EraserIndex(strokes);

  it('hits at a point near a stroke', () => {
    expect(index.hitPoint({ x: 20, y: 6 }, 6).sort()).toEqual(['h']);
    expect(index.hitPoint({ x: 20, y: 30 }, 6)).toEqual([]);
  });

  it('does not tunnel through a stroke on a fast sweep', () => {
    expect(index.hitSegment({ x: 20, y: -40 }, { x: 20, y: 40 }, 4)).toEqual(['h']);
  });

  it('hits every stroke crossed by the sweep', () => {
    expect(index.hitSegment({ x: -10, y: 20 }, { x: 110, y: -20 }, 3).sort()).toEqual(['h', 'v']);
  });

  it('skips locked strokes', () => {
    const locked = new EraserIndex([line('l', 0, 0, 100, 0, true)]);
    expect(locked.hitPoint({ x: 10, y: 0 }, 5)).toEqual([]);
  });

  it('erases dots', () => {
    const dot = createStroke('d', [{ x: 10, y: 10, pressure: 0.5 }], { tool: 'marker', size: 'thick', color: 'slate' });
    expect(new EraserIndex([dot]).hitPoint({ x: 12, y: 12 }, 4)).toEqual(['d']);
  });
});

describe('eraserWorldRadius', () => {
  it('stays constant on screen', () => {
    expect(eraserWorldRadius(10, 2)).toBe(5);
    expect(eraserWorldRadius(10, 0.5)).toBe(20);
    expect(Number.isFinite(eraserWorldRadius(10, 0))).toBe(true);
  });
});
