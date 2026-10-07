/**
 * Selection model (pure). Selections are arrays of element ids in document z-order.
 *
 * Rules (Whimsical):
 *   - Clicking a grouped element selects the whole group; Cmd+click deep-selects one member.
 *   - Shift+click toggles (the whole group) in / out of the selection.
 *   - Locked elements are not click- or marquee-selectable; Cmd+A skips them, Cmd+A+A includes them.
 *   - Marquee selects elements intersecting the rectangle, except containers (sections, frames)
 *     which must be fully enclosed so that dragging inside a section selects its contents.
 */

import type { BoardDocument, Direction, Point, Rect } from '@renderer/core/types';
import { rectCenter, rectContainsRect, rectsIntersect } from './geometry';
import { elementMap, isConnector, type DefinitionLookup } from './scene';

/** Removes ids that no longer exist and orders the rest by z-order. */
export function normalizeSelection(doc: BoardDocument, ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  return doc.elements.filter((e) => wanted.has(e.id)).map((e) => e.id);
}

export function selectionsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** Adds every member of the groups of `ids`. */
export function expandGroups(doc: BoardDocument, ids: readonly string[]): string[] {
  const byId = elementMap(doc);
  const groups = new Set(ids.map((id) => byId.get(id)?.groupId).filter((g): g is string => !!g));
  if (groups.size === 0) return normalizeSelection(doc, ids);
  const set = new Set(ids);
  for (const el of doc.elements) if (el.groupId && groups.has(el.groupId)) set.add(el.id);
  return normalizeSelection(doc, [...set]);
}

/** Ids selected by clicking `hitId` (group expansion unless deep). */
export function clickTarget(doc: BoardDocument, hitId: string, options: { deep?: boolean } = {}): string[] {
  return options.deep ? [hitId] : expandGroups(doc, [hitId]);
}

/**
 * Selection after a click on `hitId` (or on empty canvas when undefined).
 * - shift: toggle the target in/out of the current selection
 * - deep:  select only the clicked member of a group
 */
export function applyClick(
  doc: BoardDocument,
  current: readonly string[],
  hitId: string | undefined,
  modifiers: { shift?: boolean; deep?: boolean } = {},
): string[] {
  if (!hitId) return modifiers.shift ? [...current] : [];
  const target = clickTarget(doc, hitId, { deep: modifiers.deep });
  if (modifiers.shift) {
    const cur = new Set(current);
    const allIn = target.every((id) => cur.has(id));
    if (allIn) target.forEach((id) => cur.delete(id));
    else target.forEach((id) => cur.add(id));
    return normalizeSelection(doc, [...cur]);
  }
  // Clicking an already selected element keeps a multi-selection (so it can be dragged).
  if (target.every((id) => current.includes(id))) return [...current];
  return target;
}

/** Cmd+A: every element except locked ones (unless includeLocked, Cmd+A+A). */
export function selectAll(doc: BoardDocument, options: { includeLocked?: boolean } = {}): string[] {
  return doc.elements.filter((e) => options.includeLocked || !e.locked).map((e) => e.id);
}

/** Elements selected by a marquee rectangle. */
export function marqueeSelect(
  doc: BoardDocument,
  marquee: Rect,
  boundsOf: (id: string) => Rect | undefined,
  lookup: DefinitionLookup,
  candidates?: readonly string[],
): string[] {
  const pool = candidates ? new Set(candidates) : undefined;
  const hits: string[] = [];
  for (const el of doc.elements) {
    if (pool && !pool.has(el.id)) continue;
    if (el.locked) continue;
    const b = boundsOf(el.id);
    if (!b) continue;
    const container = lookup(el.type)?.container === true;
    if (container ? rectContainsRect(marquee, b) : rectsIntersect(marquee, b)) hits.push(el.id);
  }
  return expandGroups(doc, hits);
}

/** Navigable elements for Tab / Alt+Shift+Arrow: unlocked, not connectors. */
function navigable(doc: BoardDocument, boundsOf: (id: string) => Rect | undefined): Array<{ id: string; rect: Rect }> {
  const out: Array<{ id: string; rect: Rect }> = [];
  for (const el of doc.elements) {
    if (el.locked || isConnector(el)) continue;
    const rect = boundsOf(el.id);
    if (rect) out.push({ id: el.id, rect });
  }
  return out;
}

/**
 * Tab / Shift+Tab (clone extension): next element in reading order (rows top to bottom,
 * then left to right). Rows are formed by vertical centre within `rowTolerance`.
 */
export function selectNextInReadingOrder(
  doc: BoardDocument,
  current: readonly string[],
  boundsOf: (id: string) => Rect | undefined,
  dir: 1 | -1,
  rowTolerance = 24,
): string | undefined {
  const items = navigable(doc, boundsOf)
    .map((i) => ({ ...i, c: rectCenter(i.rect) }))
    .sort((a, b) => (Math.abs(a.c.y - b.c.y) <= rowTolerance ? a.c.x - b.c.x : a.c.y - b.c.y));
  if (items.length === 0) return undefined;
  const last = current[current.length - 1];
  const index = last ? items.findIndex((i) => i.id === last) : -1;
  if (index < 0) return (dir > 0 ? items[0] : items[items.length - 1])?.id;
  return items[(index + dir + items.length) % items.length]?.id;
}

/**
 * Alt+Shift+Arrow (clone extension): nearest element whose centre lies in the direction
 * (within a 45° cone on each side), scored by distance with a penalty for lateral offset.
 */
export function nearestInDirection(
  doc: BoardDocument,
  from: Rect,
  direction: Direction,
  boundsOf: (id: string) => Rect | undefined,
  exclude: ReadonlySet<string> = new Set(),
): string | undefined {
  const origin: Point = rectCenter(from);
  let best: { id: string; score: number } | undefined;
  for (const item of navigable(doc, boundsOf)) {
    if (exclude.has(item.id)) continue;
    const c = rectCenter(item.rect);
    const dx = c.x - origin.x;
    const dy = c.y - origin.y;
    let primary: number;
    let lateral: number;
    switch (direction) {
      case 'up':
        primary = -dy;
        lateral = Math.abs(dx);
        break;
      case 'down':
        primary = dy;
        lateral = Math.abs(dx);
        break;
      case 'left':
        primary = -dx;
        lateral = Math.abs(dy);
        break;
      case 'right':
        primary = dx;
        lateral = Math.abs(dy);
        break;
    }
    if (primary <= 0.5 || lateral > primary) continue;
    const score = primary + lateral * 2;
    if (!best || score < best.score) best = { id: item.id, score };
  }
  return best?.id;
}
