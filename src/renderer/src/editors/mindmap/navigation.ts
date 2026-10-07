/**
 * Arrow-key navigation between mind-map nodes (pure).
 *
 * Whimsical (research 02 section 2.3), per node and arrow direction:
 *   - along the growth axis, away from the root:  first child (a collapsed node is expanded)
 *   - along the growth axis, towards the root:    parent
 *   - across the growth axis (Up/Down in horizontal maps, Left/Right in vertical ones):
 *                                                 previous / next sibling
 *   - nothing there:                              closest node in that direction (cousins)
 * The root has no growth axis of its own: an arrow towards a side selects the first branch
 * on that side.
 */

import type { Direction, Point, Rect, Side } from '@renderer/core/types';
import { branchSide, childIds, isHidden, orientationOf, rootOf, siblingsOnSameSide, depthOf, type TreeIndex } from './model';

export interface NavResult {
  /** Node to select. */
  select: string;
  /** Collapsed node to expand first (its first child is selected). */
  expand?: string;
}

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** Direction in which a first-level side grows. */
export function growthDirection(side: Side): Direction {
  switch (side) {
    case 'right':
      return 'right';
    case 'left':
      return 'left';
    case 'bottom':
      return 'down';
    case 'top':
      return 'up';
  }
}

/** Side of the root that an arrow direction points at (undefined when it does not fit the map). */
export function sideForDirection(direction: Direction, vertical: boolean): Side | undefined {
  if (vertical) return direction === 'down' ? 'bottom' : direction === 'up' ? 'top' : undefined;
  return direction === 'right' ? 'right' : direction === 'left' ? 'left' : undefined;
}

function centre(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * Closest visible node whose centre lies in the cone of `direction`, preferring nodes at the
 * same depth (cousins) and the same map.
 */
export function closestInDirection(
  index: TreeIndex,
  id: string,
  direction: Direction,
  rectOf: (id: string) => Rect | undefined,
): string | undefined {
  const from = rectOf(id);
  if (!from) return undefined;
  const c = centre(from);
  const depth = depthOf(index, id);
  const root = rootOf(index, id);
  let best: { id: string; score: number } | undefined;
  for (const node of index.nodes.values()) {
    if (node.id === id || isHidden(index, node.id)) continue;
    const r = rectOf(node.id);
    if (!r || (r.w === 0 && r.h === 0)) continue;
    const p = centre(r);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const along = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1 || across > along * 1.5 + 40) continue;
    let score = Math.hypot(along, across * 1.6);
    if (depthOf(index, node.id) === depth) score *= 0.5;
    if (rootOf(index, node.id)?.id !== root?.id) score *= 4;
    if (!best || score < best.score) best = { id: node.id, score };
  }
  return best?.id;
}

export function navigate(
  index: TreeIndex,
  id: string,
  direction: Direction,
  rectOf: (id: string) => Rect | undefined,
): NavResult | undefined {
  const node = index.nodes.get(id);
  if (!node) return undefined;
  const root = rootOf(index, id);
  const vertical = orientationOf(root) === 'vertical';

  if (node.treeParentId === null) {
    // Root: arrow towards a side selects the first branch on that side.
    const side = sideForDirection(direction, vertical);
    if (side) {
      const first = childIds(index, id).find((c) => branchSide(index, c) === side);
      if (first) return node.collapsed ? { select: first, expand: id } : { select: first };
    }
    const near = closestInDirection(index, id, direction, rectOf);
    return near ? { select: near } : undefined;
  }

  const side = branchSide(index, id);
  if (!side) return undefined;
  const growth = growthDirection(side);
  if (direction === growth) {
    const first = childIds(index, id)[0];
    if (first) return node.collapsed ? { select: first, expand: id } : { select: first };
    const near = closestInDirection(index, id, direction, rectOf);
    return near ? { select: near } : undefined;
  }
  if (direction === OPPOSITE[growth]) return { select: node.treeParentId };
  // Across the growth axis: previous / next sibling, else the closest cousin.
  const siblings = siblingsOnSameSide(index, id);
  const at = siblings.indexOf(id);
  const forward = direction === 'down' || direction === 'right';
  const sibling = siblings[at + (forward ? 1 : -1)];
  if (sibling) return { select: sibling };
  const near = closestInDirection(index, id, direction, rectOf);
  return near ? { select: near } : undefined;
}
