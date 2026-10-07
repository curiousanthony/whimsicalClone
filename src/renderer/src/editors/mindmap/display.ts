/**
 * Live display state while a gesture previews a document that has not been normalised yet.
 *
 * During a canvas drag only the grabbed elements move. Two cases matter for mind maps:
 *   - the ROOT is dragged: every other node must follow it live (offset = the root's shift);
 *   - a NODE is dragged: it follows the pointer alone and the drop placeholder shows where
 *     it will land.
 * Both are derived by comparing stored positions with the layout the document WILL get: the
 * most common shift among the non-root nodes of a map is the root's; nodes with another shift
 * are being dragged. Pure; used by the node renderer, the branch layer and the placeholder.
 */

import type { BoardDocument, Point, Rect } from '@renderer/core/types';
import { layoutDocument, type Placement, type SizeFn } from './layout';
import { buildTreeIndex, isMindNode, type TreeIndex } from './model';

export interface MapDisplay {
  index: TreeIndex;
  /** Where each node will rest once the document is normalised. */
  expected: ReadonlyMap<string, Placement>;
  /** Visual shift of nodes that follow a dragged root (id -> offset), empty when still. */
  follow: ReadonlyMap<string, Point>;
  /** Nodes currently dragged away from their resting place (id -> its resting rect). */
  dragged: ReadonlyMap<string, Rect>;
}

const EMPTY = new Map<never, never>();
const cache = new WeakMap<object, MapDisplay>();

/** Cached per document element array. */
export function getMapDisplay(doc: Pick<BoardDocument, 'elements'>, sizeOf: SizeFn): MapDisplay {
  const hit = cache.get(doc.elements);
  if (hit) return hit;
  const value = computeMapDisplay(doc, sizeOf);
  cache.set(doc.elements, value);
  return value;
}

export function computeMapDisplay(doc: Pick<BoardDocument, 'elements'>, sizeOf: SizeFn): MapDisplay {
  const index = buildTreeIndex(doc.elements);
  if (index.nodes.size === 0) return { index, expected: EMPTY, follow: EMPTY, dragged: EMPTY };
  const expected = layoutDocument(doc, sizeOf);
  const follow = new Map<string, Point>();
  const dragged = new Map<string, Rect>();
  const byRoot = new Map<string, string[]>();
  for (const el of doc.elements) {
    if (!isMindNode(el) || el.treeParentId === null) continue;
    const list = byRoot.get(el.rootId);
    if (list) list.push(el.id);
    else byRoot.set(el.rootId, [el.id]);
  }
  for (const ids of byRoot.values()) {
    const shifts = new Map<string, { count: number; dx: number; dy: number }>();
    const shiftOf = new Map<string, { dx: number; dy: number }>();
    for (const id of ids) {
      const node = index.nodes.get(id)!;
      const exp = expected.get(id);
      if (!exp || exp.hidden || (node.w === 0 && node.h === 0)) continue;
      const dx = exp.x - node.x;
      const dy = exp.y - node.y;
      shiftOf.set(id, { dx, dy });
      const key = `${dx}|${dy}`;
      const entry = shifts.get(key);
      if (entry) entry.count += 1;
      else shifts.set(key, { count: 1, dx, dy });
    }
    if (shifts.size === 0) continue;
    let mode = { count: 0, dx: 0, dy: 0 };
    for (const s of shifts.values()) if (s.count > mode.count) mode = s;
    for (const [id, s] of shiftOf) {
      if (s.dx === mode.dx && s.dy === mode.dy) {
        if (mode.dx !== 0 || mode.dy !== 0) follow.set(id, { x: mode.dx, y: mode.dy });
      } else if (Math.hypot(s.dx - mode.dx, s.dy - mode.dy) > 1) {
        const exp = expected.get(id)!;
        dragged.set(id, { x: exp.x - mode.dx, y: exp.y - mode.dy, w: exp.w, h: exp.h });
      }
    }
  }
  return { index, expected, follow, dragged };
}
