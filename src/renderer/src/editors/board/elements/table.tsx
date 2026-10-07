/**
 * Table (E): grid of rich-text cells. Enter / double-click edits a cell (double-click picks the
 * cell under the pointer); Tab / Shift+Tab walk the cells, Tab on the last cell appends a row,
 * Enter moves down and leaves after the last row, Esc stops editing.
 *
 * The engine does not forward pointer events into elements, so the cell under a double-click
 * is found geometrically from a window-level capture listener (only while the table is selected).
 */

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import { CanvasText, Divider, IconButton } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { CanvasApi, ContextBarProps, ElementDefinition, ElementRenderProps, RichText, TableElement } from '@renderer/core/types';
import { newId } from '@renderer/core/ids';
import { TextSizeControl } from '../controls';
import { normalizeTable, TABLE_COLUMN_WIDTH, TABLE_ROW_HEIGHT } from '../model';
import { cellAtPoint, cellKey, cellPosOf, insertColumn, insertRow, keyAt, navigateCell, removeColumn, removeRow, resizeTable, setCellText, type CellMove, type CellPos } from '../tableLogic';

/* --- active cell (per table) ---------------------------------------------------------- */

interface CursorState {
  active: Record<string, string>;
  setActive(tableId: string, key: string): void;
}

export const useTableCursor = create<CursorState>((set) => ({
  active: {},
  setActive: (tableId, key) => set((s) => ({ active: { ...s.active, [tableId]: key } })),
}));

function firstKey(table: TableElement): string {
  return cellKey(table.rows[0]?.id ?? '', table.columns[0]?.id ?? '');
}

function currentKey(table: TableElement, active: string | undefined): string {
  return active && cellPosOf(table, active) ? active : firstKey(table);
}

/* --- editing helpers ------------------------------------------------------------------- */

function moveTo(api: CanvasApi, table: TableElement, pos: CellPos): void {
  const key = keyAt(table, pos);
  if (!key) return;
  useTableCursor.getState().setActive(table.id, key);
  // Blur of the old cell editor may end editing; restart on the next tick so the new cell opens.
  setTimeout(() => api.startTextEditing(table.id), 0);
}

function navigate(api: CanvasApi, table: TableElement, key: string, move: CellMove): boolean {
  const from = cellPosOf(table, key);
  if (!from) return false;
  const result = navigateCell(table, from, move);
  if (result.type === 'exit') {
    api.stopTextEditing();
    return true;
  }
  if (result.type === 'move') {
    moveTo(api, table, result.to);
    return true;
  }
  // Tab on the last cell: append a row, then edit its first cell.
  let rowId = '';
  api.update((d) => {
    const t = d.elements.find((e) => e.id === table.id);
    if (t && t.type === 'table') rowId = insertRow(t as TableElement, t.rows.length, newId);
  });
  if (rowId) {
    useTableCursor.getState().setActive(table.id, cellKey(rowId, table.columns[0]!.id));
    setTimeout(() => api.startTextEditing(table.id), 0);
  }
  return true;
}

/* --- element --------------------------------------------------------------------------- */

function TableRender({ element, editing, api, theme, selected, zoom }: ElementRenderProps<TableElement>): JSX.Element {
  const { t } = useTranslation('board');
  const root = useRef<HTMLDivElement>(null);
  const active = useTableCursor((s) => s.active[element.id]);
  const activeKey = currentKey(element, active);
  const tableRef = useRef(element);
  tableRef.current = element;

  // Double-click on a selected table edits the cell under the pointer.
  useEffect(() => {
    if (!selected || editing) return;
    const onDblClick = (e: MouseEvent) => {
      const el = root.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) return;
      const pos = cellAtPoint(tableRef.current, (e.clientX - box.left) / zoom, (e.clientY - box.top) / zoom);
      const key = pos && keyAt(tableRef.current, pos);
      if (!key) return;
      e.stopPropagation();
      e.preventDefault();
      useTableCursor.getState().setActive(tableRef.current.id, key);
      api.startTextEditing(tableRef.current.id);
    };
    window.addEventListener('dblclick', onDblClick, true);
    return () => window.removeEventListener('dblclick', onDblClick, true);
  }, [selected, editing, zoom, api]);

  const border = resolveColor('gray', 'stroke', theme);
  const headerBg = resolveColor('gray', 'soft', theme);
  const stripeBg = theme === 'dark' ? 'rgb(255 255 255 / 4%)' : 'rgb(41 55 68 / 3%)';
  const ink = resolveColor('slate', 'text', theme);

  return (
    <div
      ref={root}
      className="wc-board-table"
      style={{
        gridTemplateColumns: element.columns.map((c) => `${c.width}px`).join(' '),
        gridTemplateRows: element.rows.map((r) => `${r.height ?? TABLE_ROW_HEIGHT}px`).join(' '),
        borderColor: border,
      }}
    >
      {element.rows.map((row, ri) =>
        element.columns.map((col) => {
          const key = cellKey(row.id, col.id);
          const cell = element.cells[key];
          const isHeader = element.headerRow && ri === 0;
          const striped = element.tableStyle === 'striped' && !isHeader && (ri - (element.headerRow ? 1 : 0)) % 2 === 1;
          const cellBg = cell?.background ? resolveColor(cell.background, 'soft', theme) : isHeader ? headerBg : striped ? stripeBg : 'transparent';
          const isEditingCell = editing && key === activeKey;
          return (
            <div
              key={key}
              className={`wc-board-table__cell${isEditingCell ? ' is-active' : ''}`}
              style={{ background: cellBg, borderColor: border }}
            >
              <CanvasText
                element={element}
                text={cell?.text}
                editing={isEditingCell}
                api={api}
                textSize={element.textSize}
                align={cell?.align ?? 'left'}
                verticalAlign="middle"
                bold={isHeader}
                padding={8}
                color={ink}
                placeholder={t('text.placeholder')}
                onCommit={(text: RichText) =>
                  api.update(
                    (d) => {
                      const target = d.elements.find((e) => e.id === element.id);
                      if (target && target.type === 'table') setCellText(target as TableElement, key, text);
                    },
                    { coalesceKey: `text:${element.id}:${key}` },
                  )
                }
                onTab={(shift) => navigate(api, tableRef.current, key, shift ? 'previous' : 'next')}
                onEnter={() => navigate(api, tableRef.current, key, 'down')}
              />
            </div>
          );
        }),
      )}
    </div>
  );
}

function TableContextBar({ elements, api }: ContextBarProps<TableElement>): JSX.Element {
  const { t } = useTranslation('board');
  const first = elements[0]!;
  const ids = new Set(elements.map((e) => e.id));
  const edit = (recipe: (table: TableElement) => void) =>
    api.update((d) => {
      for (const el of d.elements) if (ids.has(el.id) && el.type === 'table') recipe(el as TableElement);
    });
  return (
    <>
      <TextSizeControl elements={elements} api={api} />
      <Divider vertical />
      <IconButton icon="Heading" label={t('table.headerRow')} active={first.headerRow} size="sm" tooltipSide="top" onClick={() => edit((tb) => void (tb.headerRow = !first.headerRow))} />
      <IconButton
        icon="Rows3"
        label={t('table.striped')}
        active={first.tableStyle === 'striped'}
        size="sm"
        tooltipSide="top"
        onClick={() => edit((tb) => void (tb.tableStyle = first.tableStyle === 'striped' ? 'plain' : 'striped'))}
      />
      <Divider vertical />
      <IconButton icon="BetweenHorizontalStart" label={t('table.addRow')} size="sm" tooltipSide="top" onClick={() => edit((tb) => void insertRow(tb, tb.rows.length, newId))} />
      <IconButton icon="BetweenVerticalStart" label={t('table.addColumn')} size="sm" tooltipSide="top" onClick={() => edit((tb) => void insertColumn(tb, tb.columns.length, newId, TABLE_COLUMN_WIDTH))} />
      <IconButton icon="Rows2" label={t('table.removeRow')} size="sm" tooltipSide="top" disabled={first.rows.length <= 1} onClick={() => edit((tb) => void removeRow(tb, tb.rows.length - 1))} />
      <IconButton icon="Columns2" label={t('table.removeColumn')} size="sm" tooltipSide="top" disabled={first.columns.length <= 1} onClick={() => edit((tb) => void removeColumn(tb, tb.columns.length - 1))} />
    </>
  );
}

export const tableDefinition: ElementDefinition<TableElement> = {
  type: 'table',
  module: 'board',
  layer: 'box',
  Render: TableRender,
  getBounds: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
  resize: 'free',
  rotatable: false,
  connectable: true,
  textEditable: true,
  styleProps: ['headerRow', 'tableStyle', 'textSize'],
  applyResize: (d, next, previous) => resizeTable(d as TableElement, next, previous),
  ContextBar: TableContextBar,
  normalize: normalizeTable,
};
