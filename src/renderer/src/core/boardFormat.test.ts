import { describe, expect, it } from 'vitest';
import { BoardFormatError, createEmptyBoard, parseBoard, serializeBoard } from './boardFormat';
import { SnapshotHistory } from './history';
import { emptyRichText } from './richText';
import type { BoardDocument, StrokeElement } from './types';

describe('board format', () => {
  it('serialises deterministically and round-trips', () => {
    const stroke: StrokeElement = {
      id: 's1',
      type: 'stroke',
      x: 10,
      y: 20,
      w: 30,
      h: 40,
      tool: 'marker',
      size: 'thin',
      color: 'slate',
      points: [0, 0, 0.5, 10.25, 20, 0.5],
    };
    const doc: BoardDocument = createEmptyBoard('draw', [stroke]);
    const text = serializeBoard(doc);
    expect(text.startsWith('{\n  "format": "whimsical-clone/board",\n  "version": 1,\n  "kind": "draw"')).toBe(true);
    expect(text).toContain('"points": [0, 0, 0.5, 10.25, 20, 0.5]');
    expect(parseBoard(text, 'board')).toEqual(doc);
  });

  it('preserves unknown keys and rejects newer versions', () => {
    const raw = { ...createEmptyBoard('board'), futureThing: { a: 1 } };
    const parsed = parseBoard(JSON.stringify(raw), 'board');
    expect(parsed.extra).toEqual({ futureThing: { a: 1 } });
    expect(() => parseBoard(JSON.stringify({ ...raw, version: 99 }), 'board')).toThrow(BoardFormatError);
  });

  it('treats an empty file as a new board of the expected kind', () => {
    expect(parseBoard('', 'wireframe').settings.mode).toBe('wireframe');
  });
});

describe('snapshot history', () => {
  it('coalesces changes with the same key inside the window', () => {
    let now = 0;
    const h = new SnapshotHistory<string>({ now: () => now });
    h.record('a', 'ab', { coalesceKey: 'type' });
    now = 500;
    h.record('ab', 'abc', { coalesceKey: 'type' });
    now = 5000;
    h.record('abc', 'abcd', { coalesceKey: 'type' });
    expect(h.undo()?.before).toBe('abc');
    expect(h.undo()?.before).toBe('a');
    expect(h.canUndo()).toBe(false);
    expect(h.redo()?.after).toBe('abc');
  });

  it('does not record skipped changes', () => {
    const h = new SnapshotHistory<number>();
    h.record(1, 2, { history: 'skip' });
    expect(h.canUndo()).toBe(false);
    expect(emptyRichText().blocks).toHaveLength(1);
  });
});
