import { describe, expect, it } from 'vitest';
import { richTextFromPlain } from '@renderer/core/richText';
import {
  cellAtPoint,
  cellKey,
  cellPosOf,
  createTable,
  getCellText,
  gridForRect,
  insertColumn,
  insertRow,
  keyAt,
  navigateCell,
  parseTabular,
  removeColumn,
  removeRow,
  resizeTable,
  setCellText,
  tableFromGrid,
  tableSize,
} from './tableLogic';

let n = 0;
const newId = () => `id${++n}`;
const table = (columns = 3, rows = 3) => createTable({ id: 't', x: 0, y: 0, columns, rows, newId });

describe('createTable / sizes', () => {
  it('derives its box from columns and rows', () => {
    const t = table(3, 2);
    expect(t.w).toBe(3 * 144);
    expect(t.h).toBe(2 * 48);
    expect(tableSize(t)).toEqual({ w: t.w, h: t.h });
  });
  it('clamps the grid and maps a dragged rect to a grid', () => {
    expect(gridForRect({ w: 10, h: 10 })).toEqual({ columns: 1, rows: 1 });
    expect(gridForRect({ w: 432, h: 144 })).toEqual({ columns: 3, rows: 3 });
    expect(gridForRect({ w: 99999, h: 99999 })).toEqual({ columns: 12, rows: 40 });
  });
  it('splits a dragged width across the columns', () => {
    const t = createTable({ id: 't', x: 0, y: 0, columns: 4, rows: 1, width: 400, newId });
    expect(t.columns.every((c) => c.width === 100)).toBe(true);
  });
});

describe('row and column editing', () => {
  it('inserts and removes keeping the box in sync', () => {
    const t = table();
    const row = insertRow(t, 1, newId);
    expect(t.rows[1]?.id).toBe(row);
    expect(t.h).toBe(4 * 48);
    const col = insertColumn(t, 0, newId);
    expect(t.columns[0]?.id).toBe(col);
    expect(t.w).toBe(4 * 144);
    expect(removeRow(t, 1)).toBe(true);
    expect(removeColumn(t, 0)).toBe(true);
    expect(t.rows).toHaveLength(3);
    expect(t.columns).toHaveLength(3);
  });
  it('drops the cells of a removed row / column', () => {
    const t = table(2, 2);
    const [r0, r1] = t.rows;
    const [c0, c1] = t.columns;
    setCellText(t, cellKey(r0!.id, c0!.id), richTextFromPlain('a'));
    setCellText(t, cellKey(r1!.id, c1!.id), richTextFromPlain('b'));
    removeRow(t, 0);
    expect(Object.keys(t.cells)).toEqual([cellKey(r1!.id, c1!.id)]);
    removeColumn(t, 1);
    expect(Object.keys(t.cells)).toEqual([]);
  });
  it('never removes the last row or column', () => {
    const t = table(1, 1);
    expect(removeRow(t, 0)).toBe(false);
    expect(removeColumn(t, 0)).toBe(false);
  });
  it('clamps insert positions', () => {
    const t = table(1, 1);
    insertRow(t, 99, newId);
    insertRow(t, -5, newId);
    expect(t.rows).toHaveLength(3);
  });
});

describe('resizeTable', () => {
  it('scales columns and rows and respects minimums', () => {
    const t = table(2, 2);
    const prev = { x: 0, y: 0, w: t.w, h: t.h };
    resizeTable(t, { x: 10, y: 20, w: t.w * 2, h: 10 }, prev);
    expect(t.columns[0]?.width).toBe(288);
    expect(t.rows[0]?.height).toBe(24);
    expect(t).toMatchObject({ x: 10, y: 20 });
    expect(t.w).toBe(2 * 288);
  });
});

describe('cell text', () => {
  it('stores and reads text', () => {
    const t = table(1, 1);
    const key = cellKey(t.rows[0]!.id, t.columns[0]!.id);
    expect(getCellText(t, key).blocks[0]?.spans).toEqual([]);
    setCellText(t, key, richTextFromPlain('x'));
    setCellText(t, key, richTextFromPlain('y'));
    expect(getCellText(t, key).blocks[0]?.spans[0]?.text).toBe('y');
  });
});

describe('keyboard navigation', () => {
  const t = table(3, 2);
  it('Tab walks the row then the next row', () => {
    expect(navigateCell(t, { row: 0, col: 0 }, 'next')).toEqual({ type: 'move', to: { row: 0, col: 1 } });
    expect(navigateCell(t, { row: 0, col: 2 }, 'next')).toEqual({ type: 'move', to: { row: 1, col: 0 } });
  });
  it('Tab on the last cell adds a row', () => {
    expect(navigateCell(t, { row: 1, col: 2 }, 'next')).toEqual({ type: 'addRow' });
  });
  it('Shift+Tab goes backwards and exits at the start', () => {
    expect(navigateCell(t, { row: 1, col: 0 }, 'previous')).toEqual({ type: 'move', to: { row: 0, col: 2 } });
    expect(navigateCell(t, { row: 0, col: 0 }, 'previous')).toEqual({ type: 'exit' });
  });
  it('Enter / arrows move and exit at the edges', () => {
    expect(navigateCell(t, { row: 0, col: 1 }, 'down')).toEqual({ type: 'move', to: { row: 1, col: 1 } });
    expect(navigateCell(t, { row: 1, col: 1 }, 'down')).toEqual({ type: 'exit' });
    expect(navigateCell(t, { row: 0, col: 1 }, 'up')).toEqual({ type: 'exit' });
    expect(navigateCell(t, { row: 0, col: 1 }, 'left')).toEqual({ type: 'move', to: { row: 0, col: 0 } });
    expect(navigateCell(t, { row: 0, col: 2 }, 'right')).toEqual({ type: 'exit' });
  });
  it('maps keys to positions and back', () => {
    const key = keyAt(t, { row: 1, col: 2 })!;
    expect(cellPosOf(t, key)).toEqual({ row: 1, col: 2 });
    expect(cellPosOf(t, 'nope:nope')).toBeUndefined();
    expect(keyAt(t, { row: 9, col: 0 })).toBeUndefined();
  });
  it('hit-tests points', () => {
    expect(cellAtPoint(t, 1, 1)).toEqual({ row: 0, col: 0 });
    expect(cellAtPoint(t, 150, 60)).toEqual({ row: 1, col: 1 });
    expect(cellAtPoint(t, 9999, 1)).toBeUndefined();
    expect(cellAtPoint(t, -1, 1)).toBeUndefined();
  });
});

describe('paste', () => {
  it('parses TSV', () => {
    expect(parseTabular('a\tb\nc\td')).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('parses Markdown tables and pads ragged rows', () => {
    expect(parseTabular('| h1 | h2 |\n| --- | --- |\n| a | b |')).toEqual([['h1', 'h2'], ['a', 'b']]);
    expect(parseTabular('a\tb\nc')).toBeUndefined();
  });
  it('rejects plain text', () => {
    expect(parseTabular('just words')).toBeUndefined();
    expect(parseTabular('')).toBeUndefined();
  });
  it('builds a table from a grid', () => {
    const t = tableFromGrid({ id: 't', x: 0, y: 0, grid: [['a', 'b'], ['', 'd']], newId });
    expect(t.columns).toHaveLength(2);
    expect(Object.keys(t.cells)).toHaveLength(3);
    expect(getCellText(t, cellKey(t.rows[1]!.id, t.columns[1]!.id)).blocks[0]?.spans[0]?.text).toBe('d');
  });
});
