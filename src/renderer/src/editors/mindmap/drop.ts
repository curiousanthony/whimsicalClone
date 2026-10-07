/**
 * Drag-and-drop re-parenting (pure). Given the point where a dragged node is released and the
 * resting rectangles of the other nodes, decides where the node lands:
 *
 *   child      onto a node or beyond its outer edge: last/positioned child of that node
 *   sibling    above/below (or beside, in vertical maps) a node: a slot among its siblings
 *   rootChild  near the root: a first-level branch on the side the point is on
 *
 * Whimsical bundle state names: drop-target kinds `child | sibling | root-child`.
 */

import type { Point, Rect, Side } from '@renderer/core/types';
import {
  branchSide,
  childIds,
  isInSubtree,
  isHidden,
  orientationOf,
  rootOf,
  validSides,
  type TreeIndex,
} from './model';
import { sideSign } from './layout';

export interface DropTarget {
  kind: 'child' | 'sibling' | 'rootChild';
  /** Node the pointer is closest to (highlighted by the placeholder). */
  refId: string;
  /** New parent. */
  parentId: string;
  /** Position among the new parent's children, the dragged node excluded. */
  index: number;
  /** First-level target only. */
  side?: Side;
  /** Sibling slot: the new node goes before or after `refId`. */
  where?: 'before' | 'after';
}

export const DROP_DISTANCE = 140;

function distanceToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** Computes the drop target for `draggedId` released at `point`, or undefined when out of range. */
export function computeDropTarget(
  index: TreeIndex,
  draggedId: string,
  point: Point,
  rectOf: (id: string) => Rect | undefined,
  maxDistance = DROP_DISTANCE,
): DropTarget | undefined {
  if (!index.nodes.has(draggedId)) return undefined;
  let best: { id: string; dist: number; area: number } | undefined;
  for (const node of index.nodes.values()) {
    if (isInSubtree(index, draggedId, node.id) || isHidden(index, node.id)) continue;
    const rect = rectOf(node.id);
    if (!rect || (rect.w === 0 && rect.h === 0)) continue;
    const dist = distanceToRect(point, rect);
    const area = rect.w * rect.h;
    if (!best || dist < best.dist - 0.5 || (Math.abs(dist - best.dist) <= 0.5 && area < best.area)) best = { id: node.id, dist, area };
  }
  if (!best || best.dist > maxDistance) return undefined;
  const ref = index.nodes.get(best.id)!;
  const rect = rectOf(ref.id)!;
  const root = rootOf(index, ref.id);
  const vertical = orientationOf(root) === 'vertical';
  // Axes: `depth` grows away from the root, `breadth` stacks siblings.
  const dOf = (p: Point) => (vertical ? p.y : p.x);
  const bOf = (p: Point) => (vertical ? p.x : p.y);
  const centre: Point = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  const kidsExcluding = (parentId: string) => childIds(index, parentId).filter((c) => c !== draggedId);
  const centreOfId = (id: string): Point => {
    const r = rectOf(id);
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : centre;
  };

  if (ref.treeParentId === null) {
    // Near the root: a first-level branch on the side of the point.
    const [positive, negative] = validSides(orientationOf(ref));
    const side: Side = dOf(point) >= dOf(centre) ? positive : negative;
    const all = kidsExcluding(ref.id);
    const onSide = all.filter((c) => branchSide(index, c) === side);
    let slot = onSide.filter((c) => bOf(centreOfId(c)) < bOf(point)).length;
    slot = Math.min(slot, onSide.length);
    const global = slot < onSide.length ? all.indexOf(onSide[slot]!) : onSide.length > 0 ? all.indexOf(onSide[onSide.length - 1]!) + 1 : all.length;
    return { kind: 'rootChild', refId: ref.id, parentId: ref.id, index: global, side };
  }

  const side = branchSide(index, ref.id) ?? validSides(orientationOf(root))[0];
  const dir = sideSign(side);
  const beyondOuterEdge = (dOf(point) - dOf(centre)) * dir > (vertical ? rect.h : rect.w) / 2;
  const breadthHalf = (vertical ? rect.w : rect.h) / 2;
  const insideBreadth = Math.abs(bOf(point) - bOf(centre)) <= breadthHalf + 6;
  const inside = distanceToRect(point, rect) === 0;

  if (inside || (beyondOuterEdge && insideBreadth)) {
    const kids = kidsExcluding(ref.id);
    const slot = ref.collapsed ? kids.length : kids.filter((c) => bOf(centreOfId(c)) < bOf(point)).length;
    return { kind: 'child', refId: ref.id, parentId: ref.id, index: inside ? kids.length : slot };
  }

  // Sibling slot next to `ref`.
  const parentId = ref.treeParentId;
  const where: 'before' | 'after' = bOf(point) < bOf(centre) ? 'before' : 'after';
  const siblings = kidsExcluding(parentId).filter((c) => parentId !== ref.rootId || branchSide(index, c) === side);
  const at = siblings.indexOf(ref.id);
  const slotInSiblings = where === 'before' ? at : at + 1;
  const all = kidsExcluding(parentId);
  const global = slotInSiblings < siblings.length ? all.indexOf(siblings[slotInSiblings]!) : all.indexOf(siblings[siblings.length - 1]!) + 1;
  if (parentId === ref.rootId) return { kind: 'rootChild', refId: ref.id, parentId, index: global, side, where };
  return { kind: 'sibling', refId: ref.id, parentId, index: global, where };
}
