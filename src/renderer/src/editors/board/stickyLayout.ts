/**
 * Sticky-note batch operations (pure): distribute as grid, paste-as-sticky-notes splitting and
 * placement. Geometry only; commands.ts applies the results to the document.
 */

import type { Point, Rect } from '@renderer/core/types';
import { STICKY_SIZE } from './model';

export const GRID_GAP = 24;

export interface LayoutItem {
  id: string;
  rect: Rect;
}

/** Items in reading order: rows of similar y (within half the average height), left to right. */
export function readingOrder(items: readonly LayoutItem[]): LayoutItem[] {
  if (items.length === 0) return [];
  const avgH = items.reduce((s, i) => s + i.rect.h, 0) / items.length;
  const byY = [...items].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  const rows: LayoutItem[][] = [];
  let rowTop = -Infinity;
  for (const item of byY) {
    if (rows.length === 0 || item.rect.y - rowTop > avgH / 2) {
      rows.push([item]);
      rowTop = item.rect.y;
    } else {
      rows[rows.length - 1]!.push(item);
    }
  }
  return rows.flatMap((row) => row.sort((a, b) => a.rect.x - b.rect.x));
}

/** Number of columns for `count` items: as square as possible, wider than tall. */
export function gridColumns(count: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(count)));
}

/**
 * "Distribute grid" for sticky notes: evenly spaced grid anchored at the top-left of the
 * selection, reading order preserved. Returns the new top-left of each item.
 */
export function distributeGrid(items: readonly LayoutItem[], gap = GRID_GAP, columns?: number): Map<string, Point> {
  const result = new Map<string, Point>();
  if (items.length === 0) return result;
  const ordered = readingOrder(items);
  const cols = Math.min(columns ?? gridColumns(ordered.length), ordered.length);
  const originX = Math.min(...ordered.map((i) => i.rect.x));
  const originY = Math.min(...ordered.map((i) => i.rect.y));
  const cellW = Math.max(...ordered.map((i) => i.rect.w));
  const cellH = Math.max(...ordered.map((i) => i.rect.h));
  ordered.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    result.set(item.id, { x: originX + col * (cellW + gap), y: originY + row * (cellH + gap) });
  });
  return result;
}

const BULLET = /^\s*(?:[-*+•–]|\d+[.)])\s+/;
const CHECKBOX = /^\s*(?:[-*+]\s+)?\[[ xX]?\]\s+/;

/**
 * Splits pasted text into one entry per sticky note: one per non-empty line, list markers
 * (bullets, numbers, checkboxes) removed.
 */
export function splitPasteLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(CHECKBOX, '').replace(BULLET, '').trim())
    .filter((line) => line.length > 0);
}

/** Top-left positions for `count` new sticky notes in a grid centred on `centre`. */
export function gridAround(centre: Point, count: number, size = STICKY_SIZE, gap = GRID_GAP, columns?: number): Point[] {
  if (count <= 0) return [];
  const cols = Math.min(columns ?? gridColumns(count), count);
  const rows = Math.ceil(count / cols);
  const totalW = cols * size + (cols - 1) * gap;
  const totalH = rows * size + (rows - 1) * gap;
  const originX = centre.x - totalW / 2;
  const originY = centre.y - totalH / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: originX + (i % cols) * (size + gap),
    y: originY + Math.floor(i / cols) * (size + gap),
  }));
}
