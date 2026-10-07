/**
 * Branch lines between a node and its parent (pure geometry).
 *
 * The line leaves the parent at the middle of the edge facing the child and enters the child
 * at the middle of its near edge (Whimsical: "draw connector from parent edge to child's near
 * edge"). Curved lines are cubic Beziers with tangents along the growth axis; elbow lines are
 * orthogonal polylines with rounded corners.
 */

import type { MindMapLineStyle, Point, Rect, Side } from '@renderer/core/types';
import { branchSide, isHidden, levelOf, lineStyleOf, rootOf, type TreeIndex } from './model';

export interface Branch {
  id: string;
  d: string;
  /** Child node colour (the line takes the branch colour). */
  color: string | undefined;
  level: 'first' | 'deep';
}

const CORNER = 10;

function r(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Attachment points: parent edge facing the child, child's near edge. */
export function attachmentPoints(parent: Rect, child: Rect, side: Side): { from: Point; to: Point } {
  const pc = { x: parent.x + parent.w / 2, y: parent.y + parent.h / 2 };
  const cc = { x: child.x + child.w / 2, y: child.y + child.h / 2 };
  switch (side) {
    case 'right':
      return { from: { x: parent.x + parent.w, y: pc.y }, to: { x: child.x, y: cc.y } };
    case 'left':
      return { from: { x: parent.x, y: pc.y }, to: { x: child.x + child.w, y: cc.y } };
    case 'bottom':
      return { from: { x: pc.x, y: parent.y + parent.h }, to: { x: cc.x, y: child.y } };
    case 'top':
      return { from: { x: pc.x, y: parent.y }, to: { x: cc.x, y: child.y + child.h } };
  }
}

/** SVG path of one branch. */
export function branchPath(from: Point, to: Point, side: Side, style: MindMapLineStyle): string {
  const horizontal = side === 'left' || side === 'right';
  if (style === 'curved') {
    if (horizontal) {
      const mx = (from.x + to.x) / 2;
      return `M${r(from.x)},${r(from.y)} C${r(mx)},${r(from.y)} ${r(mx)},${r(to.y)} ${r(to.x)},${r(to.y)}`;
    }
    const my = (from.y + to.y) / 2;
    return `M${r(from.x)},${r(from.y)} C${r(from.x)},${r(my)} ${r(to.x)},${r(my)} ${r(to.x)},${r(to.y)}`;
  }
  // Elbow: out along the growth axis to the middle, across, then into the child.
  if (horizontal) {
    const dy = to.y - from.y;
    const dir = to.x >= from.x ? 1 : -1;
    const mx = (from.x + to.x) / 2;
    const rad = Math.min(CORNER, Math.abs(dy) / 2, Math.abs(to.x - from.x) / 4);
    if (Math.abs(dy) < 0.5 || rad < 1) return `M${r(from.x)},${r(from.y)} L${r(mx)},${r(from.y)} L${r(mx)},${r(to.y)} L${r(to.x)},${r(to.y)}`;
    const sy = dy > 0 ? 1 : -1;
    return (
      `M${r(from.x)},${r(from.y)} L${r(mx - dir * rad)},${r(from.y)} Q${r(mx)},${r(from.y)} ${r(mx)},${r(from.y + sy * rad)} ` +
      `L${r(mx)},${r(to.y - sy * rad)} Q${r(mx)},${r(to.y)} ${r(mx + dir * rad)},${r(to.y)} L${r(to.x)},${r(to.y)}`
    );
  }
  const dx = to.x - from.x;
  const dir = to.y >= from.y ? 1 : -1;
  const my = (from.y + to.y) / 2;
  const rad = Math.min(CORNER, Math.abs(dx) / 2, Math.abs(to.y - from.y) / 4);
  if (Math.abs(dx) < 0.5 || rad < 1) return `M${r(from.x)},${r(from.y)} L${r(from.x)},${r(my)} L${r(to.x)},${r(my)} L${r(to.x)},${r(to.y)}`;
  const sx = dx > 0 ? 1 : -1;
  return (
    `M${r(from.x)},${r(from.y)} L${r(from.x)},${r(my - dir * rad)} Q${r(from.x)},${r(my)} ${r(from.x + sx * rad)},${r(my)} ` +
    `L${r(to.x - sx * rad)},${r(my)} Q${r(to.x)},${r(my)} ${r(to.x)},${r(my + dir * rad)} L${r(to.x)},${r(to.y)}`
  );
}

/**
 * Branches of every visible node. `offsetOf` shifts a node (live follow of a dragged root), so
 * lines stay attached while the document preview is not normalised yet.
 */
export function computeBranches(
  index: TreeIndex,
  resolveColor: (node: { color?: string }) => string | undefined,
  offsetOf: (id: string) => Point | undefined = () => undefined,
): Branch[] {
  const out: Branch[] = [];
  for (const node of index.nodes.values()) {
    if (node.treeParentId === null || (node.w === 0 && node.h === 0)) continue;
    const parent = index.nodes.get(node.treeParentId);
    if (!parent || isHidden(index, node.id)) continue;
    const side = branchSide(index, node.id);
    if (!side) continue;
    const root = rootOf(index, node.id);
    const po = offsetOf(parent.id) ?? { x: 0, y: 0 };
    const co = offsetOf(node.id) ?? { x: 0, y: 0 };
    const { from, to } = attachmentPoints(
      { x: parent.x + po.x, y: parent.y + po.y, w: parent.w, h: parent.h },
      { x: node.x + co.x, y: node.y + co.y, w: node.w, h: node.h },
      side,
    );
    out.push({
      id: node.id,
      d: branchPath(from, to, side, lineStyleOf(root)),
      color: resolveColor(node),
      level: levelOf(node) === 'first' ? 'first' : 'deep',
    });
  }
  return out;
}
