/**
 * Arrange operations (pure): z-order, grouping, locking, alignment and distribution.
 * Z-order functions return a new element array (document order = z-order, back to front).
 */

import type { BoardElement, Point, Rect } from '@renderer/core/types';

/** `]`: moves the ids to the top, keeping their relative order. */
export function bringToFront<T extends { id: string }>(elements: readonly T[], ids: ReadonlySet<string>): T[] {
  return [...elements.filter((e) => !ids.has(e.id)), ...elements.filter((e) => ids.has(e.id))];
}

/** `[`: moves the ids to the bottom, keeping their relative order. */
export function sendToBack<T extends { id: string }>(elements: readonly T[], ids: ReadonlySet<string>): T[] {
  return [...elements.filter((e) => ids.has(e.id)), ...elements.filter((e) => !ids.has(e.id))];
}

/**
 * `Cmd+]`: each selected element swaps with the next unselected element above it.
 * `overlaps` (optional) restricts the swap to the next element that visually overlaps, so a
 * step is always visible (falls back to the immediate neighbour).
 */
export function bringForward<T extends { id: string }>(
  elements: readonly T[],
  ids: ReadonlySet<string>,
  overlaps?: (a: T, b: T) => boolean,
): T[] {
  const out = [...elements];
  for (let i = out.length - 2; i >= 0; i--) {
    const el = out[i]!;
    if (!ids.has(el.id)) continue;
    let j = i + 1;
    if (overlaps) {
      let k = j;
      while (k < out.length && (ids.has(out[k]!.id) || !overlaps(el, out[k]!))) k++;
      if (k < out.length) j = k;
    }
    if (ids.has(out[j]?.id ?? '')) continue;
    // Move el just above out[j].
    out.splice(i, 1);
    out.splice(j, 0, el);
  }
  return out;
}

/** `Cmd+[`: mirror of bringForward. */
export function sendBackward<T extends { id: string }>(
  elements: readonly T[],
  ids: ReadonlySet<string>,
  overlaps?: (a: T, b: T) => boolean,
): T[] {
  return bringForward([...elements].reverse(), ids, overlaps).reverse();
}

/** Assigns a shared group id (Cmd+G). Needs two or more elements. */
export function groupElements(elements: BoardElement[], ids: ReadonlySet<string>, groupId: string): boolean {
  if (ids.size < 2) return false;
  for (const el of elements) if (ids.has(el.id)) el.groupId = groupId;
  return true;
}

/** Removes the group of every element in `ids` (Cmd+Shift+G). Returns true if anything changed. */
export function ungroupElements(elements: BoardElement[], ids: ReadonlySet<string>): boolean {
  const groups = new Set(elements.filter((e) => ids.has(e.id) && e.groupId).map((e) => e.groupId!));
  if (groups.size === 0) return false;
  for (const el of elements) if (el.groupId && groups.has(el.groupId)) delete el.groupId;
  return true;
}

/** Cmd+Shift+L: locks all when any is unlocked, otherwise unlocks all. */
export function toggleLock(elements: BoardElement[], ids: ReadonlySet<string>): void {
  const targets = elements.filter((e) => ids.has(e.id));
  const lock = targets.some((e) => !e.locked);
  for (const el of targets) {
    if (lock) el.locked = true;
    else delete el.locked;
  }
}

export type AlignKind = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom';

/**
 * Alignment offsets for each item (2+ items). Edges align to the outermost edge; centres
 * align to the centre of the union.
 */
export function alignOffsets(items: ReadonlyArray<{ id: string; rect: Rect }>, kind: AlignKind): Map<string, Point> {
  const out = new Map<string, Point>();
  if (items.length < 2) return out;
  const minX = Math.min(...items.map((i) => i.rect.x));
  const maxX = Math.max(...items.map((i) => i.rect.x + i.rect.w));
  const minY = Math.min(...items.map((i) => i.rect.y));
  const maxY = Math.max(...items.map((i) => i.rect.y + i.rect.h));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (const { id, rect: r } of items) {
    let dx = 0;
    let dy = 0;
    switch (kind) {
      case 'left':
        dx = minX - r.x;
        break;
      case 'right':
        dx = maxX - (r.x + r.w);
        break;
      case 'centerH':
        dx = cx - (r.x + r.w / 2);
        break;
      case 'top':
        dy = minY - r.y;
        break;
      case 'bottom':
        dy = maxY - (r.y + r.h);
        break;
      case 'centerV':
        dy = cy - (r.y + r.h / 2);
        break;
    }
    if (dx !== 0 || dy !== 0) out.set(id, { x: dx, y: dy });
  }
  return out;
}

/**
 * Distribution offsets (3+ items): equal gaps between consecutive items along the axis, the
 * first and last items stay in place.
 */
export function distributeOffsets(items: ReadonlyArray<{ id: string; rect: Rect }>, axis: 'h' | 'v'): Map<string, Point> {
  const out = new Map<string, Point>();
  if (items.length < 3) return out;
  const start = (r: Rect) => (axis === 'h' ? r.x : r.y);
  const size = (r: Rect) => (axis === 'h' ? r.w : r.h);
  const sorted = [...items].sort((a, b) => start(a.rect) - start(b.rect));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const span = start(last.rect) + size(last.rect) - start(first.rect);
  const total = sorted.reduce((sum, i) => sum + size(i.rect), 0);
  const gap = (span - total) / (sorted.length - 1);
  let cursor = start(first.rect) + size(first.rect) + gap;
  for (let i = 1; i < sorted.length - 1; i++) {
    const item = sorted[i]!;
    const d = cursor - start(item.rect);
    if (Math.abs(d) > 1e-9) out.set(item.id, axis === 'h' ? { x: d, y: 0 } : { x: 0, y: d });
    cursor += size(item.rect) + gap;
  }
  return out;
}
