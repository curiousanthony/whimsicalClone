/**
 * Mind-map auto layout (pure).
 *
 * Tidy-tree layout per side of the root:
 *   - Horizontal maps grow along x: first-level branches on the `right` and `left` of the root.
 *   - Vertical maps grow along y: branches `bottom` (default) and/or `top` (org-chart style).
 *   - Every subtree gets a block of the "breadth" axis (the axis nodes are stacked on), its
 *     parent is centred on the block of its visible children, siblings keep a constant gap.
 *   - Collapsed branches are laid out as hidden nodes (w = h = 0) sitting on their collapsed
 *     ancestor, so collapsing animates children into the parent.
 *
 * Sizes come from an injected `SizeFn` (text measurement lives in nodeSize.ts) so this file
 * has no DOM dependency and is unit tested with fixed sizes.
 */

import { produce } from 'immer';
import type { BoardDocument, MindMapNodeElement, Rect, Side, Size } from '@renderer/core/types';
import {
  branchSide,
  buildTreeIndex,
  childIds,
  isMindNode,
  levelOf,
  orientationOf,
  type NodeLevel,
  type TreeIndex,
  validSides,
  visibleChildren,
} from './model';

/** Distances of the layout in world pixels. */
export const GAPS = {
  /** Between the root and its first-level branches (depth axis). */
  rootDepth: 64,
  /** Between deeper levels (depth axis). */
  levelDepth: 36,
  /** Between stacked siblings (breadth axis), horizontal maps. */
  siblingH: 10,
  /** Between stacked first-level siblings, horizontal maps. */
  firstSiblingH: 16,
  /** Between side-by-side siblings, vertical maps (nodes are wide, give them air). */
  siblingV: 20,
  firstSiblingV: 28,
} as const;

export type SizeFn = (node: MindMapNodeElement, level: NodeLevel) => Size;

export interface Placement extends Rect {
  /** Inside a collapsed branch: not displayed. */
  hidden: boolean;
}

/** Growth direction along the depth axis for a first-level side. */
export function sideSign(side: Side): 1 | -1 {
  return side === 'right' || side === 'bottom' ? 1 : -1;
}

/** Lays out one map. The root keeps its centre when its size changes. */
export function layoutMap(index: TreeIndex, rootId: string, sizeOf: SizeFn): Map<string, Placement> {
  const root = index.nodes.get(rootId);
  const out = new Map<string, Placement>();
  if (!root) return out;
  const vertical = orientationOf(root) === 'vertical';

  const sizes = new Map<string, Size>();
  const size = (id: string): Size => {
    let s = sizes.get(id);
    if (!s) {
      const node = index.nodes.get(id)!;
      s = sizeOf(node, levelOf(node));
      sizes.set(id, s);
    }
    return s;
  };
  const breadth = (s: Size) => (vertical ? s.w : s.h);
  const depth = (s: Size) => (vertical ? s.h : s.w);
  const siblingGap = (parentIsRoot: boolean) =>
    vertical ? (parentIsRoot ? GAPS.firstSiblingV : GAPS.siblingV) : parentIsRoot ? GAPS.firstSiblingH : GAPS.siblingH;

  const extents = new Map<string, number>();
  const extent = (id: string): number => {
    const cached = extents.get(id);
    if (cached !== undefined) return cached;
    const own = breadth(size(id));
    const kids = visibleChildren(index, id);
    let value = own;
    if (kids.length > 0) value = Math.max(own, block(kids, false));
    extents.set(id, value);
    return value;
  };
  const block = (list: readonly string[], underRoot: boolean): number => {
    let total = 0;
    for (const k of list) total += extent(k);
    return list.length === 0 ? 0 : total + siblingGap(underRoot) * (list.length - 1);
  };

  const put = (id: string, bc: number, dPos: number): void => {
    const s = size(id);
    out.set(id, {
      x: Math.round(vertical ? bc - s.w / 2 : dPos),
      y: Math.round(vertical ? dPos : bc - s.h / 2),
      w: s.w,
      h: s.h,
      hidden: false,
    });
  };

  const place = (id: string, dStart: number, bStart: number, dir: 1 | -1): void => {
    const s = size(id);
    const ext = extent(id);
    const bc = bStart + ext / 2;
    const ds = depth(s);
    const dPos = dir > 0 ? dStart : dStart - ds;
    put(id, bc, dPos);
    const kids = visibleChildren(index, id);
    if (kids.length === 0) return;
    const gapD = GAPS.levelDepth;
    const childD = dir > 0 ? dPos + ds + gapD : dPos - gapD;
    let b = bc - block(kids, false) / 2;
    for (const k of kids) {
      place(k, childD, b, dir);
      b += extent(k) + siblingGap(false);
    }
  };

  // Root: keep its centre when the size changes (the user grows the text, the node grows both ways).
  const rs = size(rootId);
  const oldW = root.w;
  const oldH = root.h;
  const rx = oldW > 0 && oldH > 0 ? root.x + (oldW - rs.w) / 2 : root.x;
  const ry = oldW > 0 && oldH > 0 ? root.y + (oldH - rs.h) / 2 : root.y;
  out.set(rootId, { x: Math.round(rx), y: Math.round(ry), w: rs.w, h: rs.h, hidden: false });
  const centerB = vertical ? rx + rs.w / 2 : ry + rs.h / 2;
  const rootD0 = vertical ? ry : rx;
  const rootD1 = rootD0 + depth(rs);

  const kids = visibleChildren(index, rootId);
  for (const side of validSides(orientationOf(root))) {
    const group = kids.filter((k) => branchSide(index, k) === side);
    if (group.length === 0) continue;
    const dir = sideSign(side);
    let b = centerB - block(group, true) / 2;
    for (const k of group) {
      place(k, dir > 0 ? rootD1 + GAPS.rootDepth : rootD0 - GAPS.rootDepth, b, dir);
      b += extent(k) + siblingGap(true);
    }
  }

  // Hidden nodes: parked on the centre of their closest visible ancestor.
  const park = (id: string, at: { x: number; y: number }): void => {
    for (const c of childIds(index, id)) {
      out.set(c, { x: at.x, y: at.y, w: 0, h: 0, hidden: true });
      park(c, at);
    }
  };
  for (const [id, p] of [...out]) {
    if (p.hidden) continue;
    const node = index.nodes.get(id);
    if (node?.collapsed) park(id, { x: Math.round(p.x + p.w / 2), y: Math.round(p.y + p.h / 2) });
  }
  return out;
}

/** Lays out every map of a document. */
export function layoutDocument(doc: Pick<BoardDocument, 'elements'>, sizeOf: SizeFn): Map<string, Placement> {
  const index = buildTreeIndex(doc.elements);
  const out = new Map<string, Placement>();
  for (const rootId of index.roots) {
    for (const [id, p] of layoutMap(index, rootId, sizeOf)) out.set(id, p);
  }
  return out;
}

/** True when the placement differs from what the node stores. */
export function differs(node: MindMapNodeElement, p: Placement): boolean {
  return node.x !== p.x || node.y !== p.y || node.w !== p.w || node.h !== p.h;
}

/**
 * Applies the layout to a document. Returns the same reference when nothing changes (so the
 * normaliser is idempotent and never creates history noise).
 */
export function relayoutDocument(doc: BoardDocument, sizeOf: SizeFn): BoardDocument {
  if (!doc.elements.some(isMindNode)) return doc;
  const placements = layoutDocument(doc, sizeOf);
  let changed = false;
  for (const el of doc.elements) {
    if (!isMindNode(el)) continue;
    const p = placements.get(el.id);
    if (p && differs(el, p)) {
      changed = true;
      break;
    }
  }
  if (!changed) return doc;
  return produce(doc, (d) => {
    for (const el of d.elements) {
      if (el.type !== 'mindmapNode') continue;
      const p = placements.get(el.id);
      if (!p) continue;
      el.x = p.x;
      el.y = p.y;
      el.w = p.w;
      el.h = p.h;
    }
  });
}
