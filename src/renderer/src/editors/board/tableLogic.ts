/**
 * Table helpers (pure). Mutators work on plain objects and Immer drafts alike (they only
 * assign to the table passed in), so commands call them inside `api.update`.
 */

import { emptyRichText, richTextFromPlain } from '@renderer/core/richText';
import type { Rect, RichText, TableCell, TableElement } from '@renderer/core/types';
import {
  TABLE_COLUMN_WIDTH,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  TABLE_MIN_COLUMN_WIDTH,
  TABLE_MIN_ROW_HEIGHT,
  TABLE_ROW_HEIGHT,
} from './model';

export type IdFactory = () => string;

export function cellKey(rowId: string, colId: string): string {
  return `${rowId}:${colId}`;
}

export function rowHeight(table: Pick<TableElement, 'rows'>, index: number): number {
  return table.rows[index]?.height ?? TABLE_ROW_HEIGHT;
}

/** Content size of a table: sum of its column widths and row heights. */
export function tableSize(table: Pick<TableElement, 'columns' | 'rows'>): { w: number; h: number } {
  return {
    w: table.columns.reduce((s, c) => s + c.width, 0),
    h: table.rows.reduce((s, r) => s + (r.height ?? TABLE_ROW_HEIGHT), 0),
  };
}

function syncSize(table: TableElement): void {
  const size = tableSize(table);
  table.w = size.w;
  table.h = size.h;
}

/** Columns / rows that fit a dragged rectangle (drag-to-size creation). */
export function gridForRect(rect: Pick<Rect, 'w' | 'h'>): { columns: number; rows: number } {
  const columns = Math.min(TABLE_MAX_COLUMNS, Math.max(1, Math.round(rect.w / TABLE_COLUMN_WIDTH)));
  const rows = Math.min(TABLE_MAX_ROWS, Math.max(1, Math.round(rect.h / TABLE_ROW_HEIGHT)));
  return { columns, rows };
}

export function createTable(options: { id: string; x: number; y: number; columns?: number; rows?: number; newId: IdFactory; width?: number }): TableElement {
  const columns = Math.min(TABLE_MAX_COLUMNS, Math.max(1, options.columns ?? 3));
  const rows = Math.min(TABLE_MAX_ROWS, Math.max(1, options.rows ?? 3));
  const colWidth = options.width ? Math.max(TABLE_MIN_COLUMN_WIDTH, Math.round(options.width / columns)) : TABLE_COLUMN_WIDTH;
  const table: TableElement = {
    id: options.id,
    type: 'table',
    x: options.x,
    y: options.y,
    w: 0,
    h: 0,
    columns: Array.from({ length: columns }, () => ({ id: options.newId(), width: colWidth })),
    rows: Array.from({ length: rows }, () => ({ id: options.newId() })),
    cells: {},
    headerRow: true,
    tableStyle: 'plain',
    textSize: 'm',
  };
  syncSize(table);
  return table;
}

/** Inserts an empty row at `index` (0..rows.length). Returns the new row id. */
export function insertRow(table: TableElement, index: number, newId: IdFactory): string {
  const id = newId();
  const at = Math.min(table.rows.length, Math.max(0, index));
  table.rows.splice(at, 0, { id });
  syncSize(table);
  return id;
}

export function insertColumn(table: TableElement, index: number, newId: IdFactory, width = TABLE_COLUMN_WIDTH): string {
  const id = newId();
  const at = Math.min(table.columns.length, Math.max(0, index));
  table.columns.splice(at, 0, { id, width });
  syncSize(table);
  return id;
}

/** Removes a row and its cells. The last remaining row cannot be removed. */
export function removeRow(table: TableElement, index: number): boolean {
  const row = table.rows[index];
  if (!row || table.rows.length <= 1) return false;
  table.rows.splice(index, 1);
  for (const key of Object.keys(table.cells)) if (key.startsWith(`${row.id}:`)) delete table.cells[key];
  syncSize(table);
  return true;
}

export function removeColumn(table: TableElement, index: number): boolean {
  const col = table.columns[index];
  if (!col || table.columns.length <= 1) return false;
  table.columns.splice(index, 1);
  for (const key of Object.keys(table.cells)) if (key.endsWith(`:${col.id}`)) delete table.cells[key];
  syncSize(table);
  return true;
}

/** Resize handler: scales column widths and row heights to the new box (min sizes enforced). */
export function resizeTable(table: TableElement, next: Rect, previous: Rect): void {
  const sx = previous.w > 0 ? next.w / previous.w : 1;
  const sy = previous.h > 0 ? next.h / previous.h : 1;
  for (const c of table.columns) c.width = Math.max(TABLE_MIN_COLUMN_WIDTH, Math.round(c.width * sx));
  for (const r of table.rows) r.height = Math.max(TABLE_MIN_ROW_HEIGHT, Math.round((r.height ?? TABLE_ROW_HEIGHT) * sy));
  table.x = next.x;
  table.y = next.y;
  syncSize(table);
}

export function setCellText(table: TableElement, key: string, text: RichText): void {
  const existing = table.cells[key];
  if (existing) existing.text = text;
  else table.cells[key] = { text };
}

export function getCellText(table: Pick<TableElement, 'cells'>, key: string): RichText {
  return table.cells[key]?.text ?? emptyRichText();
}

/* ------------------------------------------------------------------------------------------
 * Keyboard navigation reducer
 * ---------------------------------------------------------------------------------------- */

export interface CellPos {
  row: number;
  col: number;
}

export type CellMove = 'next' | 'previous' | 'down' | 'up' | 'left' | 'right';

export type CellNavigation =
  | { type: 'move'; to: CellPos }
  /** Tab on the last cell: append a row and move to its first cell. */
  | { type: 'addRow' }
  /** Moving past the edge: stop editing. */
  | { type: 'exit' };

/**
 * Where the caret goes after Tab / Shift+Tab / Enter / arrows inside a table cell.
 * Tab walks row by row and appends a row after the last cell; Enter goes down and exits after
 * the last row.
 */
export function navigateCell(table: Pick<TableElement, 'rows' | 'columns'>, from: CellPos, move: CellMove): CellNavigation {
  const rows = table.rows.length;
  const cols = table.columns.length;
  switch (move) {
    case 'next': {
      if (from.col + 1 < cols) return { type: 'move', to: { row: from.row, col: from.col + 1 } };
      if (from.row + 1 < rows) return { type: 'move', to: { row: from.row + 1, col: 0 } };
      return { type: 'addRow' };
    }
    case 'previous': {
      if (from.col > 0) return { type: 'move', to: { row: from.row, col: from.col - 1 } };
      if (from.row > 0) return { type: 'move', to: { row: from.row - 1, col: cols - 1 } };
      return { type: 'exit' };
    }
    case 'down':
      return from.row + 1 < rows ? { type: 'move', to: { row: from.row + 1, col: from.col } } : { type: 'exit' };
    case 'up':
      return from.row > 0 ? { type: 'move', to: { row: from.row - 1, col: from.col } } : { type: 'exit' };
    case 'left':
      return from.col > 0 ? { type: 'move', to: { row: from.row, col: from.col - 1 } } : { type: 'exit' };
    case 'right':
      return from.col + 1 < cols ? { type: 'move', to: { row: from.row, col: from.col + 1 } } : { type: 'exit' };
  }
}

export function cellPosOf(table: Pick<TableElement, 'rows' | 'columns'>, key: string): CellPos | undefined {
  const [rowId, colId] = key.split(':');
  const row = table.rows.findIndex((r) => r.id === rowId);
  const col = table.columns.findIndex((c) => c.id === colId);
  return row >= 0 && col >= 0 ? { row, col } : undefined;
}

export function keyAt(table: Pick<TableElement, 'rows' | 'columns'>, pos: CellPos): string | undefined {
  const row = table.rows[pos.row];
  const col = table.columns[pos.col];
  return row && col ? cellKey(row.id, col.id) : undefined;
}

/** Hit-tests a point (local to the table, in table px) against the grid. */
export function cellAtPoint(table: Pick<TableElement, 'rows' | 'columns'>, x: number, y: number): CellPos | undefined {
  if (x < 0 || y < 0) return undefined;
  let acc = 0;
  let col = -1;
  for (let i = 0; i < table.columns.length; i++) {
    acc += table.columns[i]!.width;
    if (x < acc) {
      col = i;
      break;
    }
  }
  acc = 0;
  let row = -1;
  for (let i = 0; i < table.rows.length; i++) {
    acc += table.rows[i]!.height ?? TABLE_ROW_HEIGHT;
    if (y < acc) {
      row = i;
      break;
    }
  }
  return row >= 0 && col >= 0 ? { row, col } : undefined;
}

/* ------------------------------------------------------------------------------------------
 * Paste: tab separated values and Markdown tables
 * ---------------------------------------------------------------------------------------- */

/** Parses TSV (Sheets, Numbers, Excel) or a GFM Markdown table into a rectangular grid. */
export function parseTabular(text: string): string[][] | undefined {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return undefined;
  let grid: string[][];
  if (lines.every((l) => l.includes('\t'))) {
    grid = lines.map((l) => l.split('\t').map((c) => c.trim()));
  } else if (lines.length >= 2 && lines.every((l) => l.trim().startsWith('|')) && /^\s*\|?\s*:?-{2,}/.test(lines[1] ?? '')) {
    grid = lines
      .filter((_, i) => i !== 1)
      .map((l) =>
        l
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim()),
      );
  } else {
    return undefined;
  }
  const width = Math.max(...grid.map((r) => r.length));
  if (width < 2 && grid.length < 2) return undefined;
  return grid.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));
}

export function tableFromGrid(options: { id: string; x: number; y: number; grid: string[][]; newId: IdFactory }): TableElement {
  const { grid } = options;
  const table = createTable({
    id: options.id,
    x: options.x,
    y: options.y,
    columns: grid[0]?.length ?? 1,
    rows: grid.length,
    newId: options.newId,
  });
  grid.forEach((row, r) =>
    row.forEach((value, c) => {
      const rowId = table.rows[r]?.id;
      const colId = table.columns[c]?.id;
      if (rowId && colId && value) table.cells[cellKey(rowId, colId)] = { text: richTextFromPlain(value) } satisfies TableCell;
    }),
  );
  return table;
}
