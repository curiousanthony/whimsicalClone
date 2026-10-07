import { describe, expect, it } from 'vitest';
import { distributeGrid, gridAround, gridColumns, GRID_GAP, readingOrder, splitPasteLines } from './stickyLayout';

const item = (id: string, x: number, y: number, w = 168, h = 168) => ({ id, rect: { x, y, w, h } });

describe('readingOrder', () => {
  it('orders rows top to bottom, then left to right', () => {
    const ordered = readingOrder([item('d', 200, 210), item('b', 200, 5), item('a', 0, 0), item('c', 0, 200)]);
    expect(ordered.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('handles empty input', () => {
    expect(readingOrder([])).toEqual([]);
  });
});

describe('gridColumns', () => {
  it('is as square as possible', () => {
    expect([1, 2, 4, 5, 9, 10].map(gridColumns)).toEqual([1, 2, 2, 3, 3, 4]);
  });
});

describe('distributeGrid', () => {
  it('lays notes in a grid anchored at the top-left', () => {
    const items = [item('a', 100, 100), item('b', 700, 90), item('c', 130, 800), item('d', 90, 1200)];
    const out = distributeGrid(items);
    expect(out.get('a')).toEqual({ x: 90, y: 90 });
    expect(out.get('b')).toEqual({ x: 90 + 168 + GRID_GAP, y: 90 });
    expect(out.get('c')).toEqual({ x: 90, y: 90 + 168 + GRID_GAP });
    expect(out.get('d')).toEqual({ x: 90 + 168 + GRID_GAP, y: 90 + 168 + GRID_GAP });
  });
  it('honours a column count', () => {
    const items = ['a', 'b', 'c'].map((id, i) => item(id, i * 300, 0));
    const out = distributeGrid(items, 24, 3);
    expect(out.get('c')?.y).toBe(0);
    expect(out.get('c')?.x).toBe(2 * (168 + 24));
  });
  it('returns an empty map for no items', () => {
    expect(distributeGrid([]).size).toBe(0);
  });
});

describe('splitPasteLines', () => {
  it('splits per line and strips list markers', () => {
    expect(splitPasteLines('- one\n* two\n1. three\n2) four\n[ ] five\n- [x] six\n\n  seven  ')).toEqual(['one', 'two', 'three', 'four', 'five', 'six', 'seven']);
  });
  it('handles CRLF and empty text', () => {
    expect(splitPasteLines('a\r\nb')).toEqual(['a', 'b']);
    expect(splitPasteLines('  \n \n')).toEqual([]);
  });
});

describe('gridAround', () => {
  it('centres the grid on the point', () => {
    const spots = gridAround({ x: 0, y: 0 }, 4, 100, 20);
    expect(spots).toEqual([
      { x: -110, y: -110 },
      { x: 10, y: -110 },
      { x: -110, y: 10 },
      { x: 10, y: 10 },
    ]);
  });
  it('single note is centred', () => {
    expect(gridAround({ x: 50, y: 50 }, 1, 100)).toEqual([{ x: 0, y: 0 }]);
  });
  it('count zero gives nothing', () => {
    expect(gridAround({ x: 0, y: 0 }, 0)).toEqual([]);
  });
});
