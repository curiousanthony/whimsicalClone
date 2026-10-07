/**
 * Mind-map normalisation pipeline, run by the canvas after every committed change
 * (CanvasPlugin.afterChange):
 *
 *   1. structural repairs (orphans, rootId, sibling order)           normalize.ts
 *   2. drag-to-reparent: a non-root node whose x/y changed without a tree/text change was
 *      dragged by the canvas; its drop point decides the new parent  drop.ts
 *   3. layout of every map (positions and sizes of all nodes)        layout.ts
 *
 * Every step returns the input reference when it changes nothing, so a commit that does not
 * touch a mind map costs a reference scan and produces no extra document version.
 */

import { produce } from 'immer';
import type { BoardDocument, MindMapNodeElement, Rect } from '@renderer/core/types';
import { computeDropTarget } from './drop';
import { relayoutDocument, type SizeFn } from './layout';
import { buildTreeIndex, isInSubtree, isMindNode, moveNode } from './model';
import { normalizeTrees } from './normalize';

/** Pointer travel below this many world pixels is a click, not a re-parenting drag. */
export const DRAG_SLOP = 14;

function hasMindNodes(doc: BoardDocument): boolean {
  return doc.elements.some(isMindNode);
}

/** True when every mind-map node is the very same object in both documents. */
function sameMindNodes(next: BoardDocument, prev: BoardDocument): boolean {
  let nextCount = 0;
  const prevNodes = new Map<string, unknown>();
  for (const el of prev.elements) if (isMindNode(el)) prevNodes.set(el.id, el);
  for (const el of next.elements) {
    if (!isMindNode(el)) continue;
    nextCount += 1;
    if (prevNodes.get(el.id) !== el) return false;
  }
  return nextCount === prevNodes.size;
}

export interface DraggedNode {
  node: MindMapNodeElement;
  /** Resting rectangle before the drag. */
  from: Rect;
}

/** Non-root nodes moved by someone else than the layout (canvas drag, nudge, align...). */
export function findDraggedNodes(next: BoardDocument, prev: BoardDocument): DraggedNode[] {
  const before = new Map<string, MindMapNodeElement>();
  for (const el of prev.elements) if (isMindNode(el)) before.set(el.id, el);
  const out: DraggedNode[] = [];
  for (const el of next.elements) {
    if (!isMindNode(el) || el.treeParentId === null) continue;
    const old = before.get(el.id);
    if (!old || old === el) continue;
    if (old.treeParentId !== el.treeParentId || old.text !== el.text || old.w !== el.w || old.h !== el.h) continue;
    if (old.w === 0 && old.h === 0) continue;
    if (old.x === el.x && old.y === el.y) continue;
    out.push({ node: el, from: { x: old.x, y: old.y, w: old.w, h: old.h } });
  }
  return out;
}

/** Applies the re-parenting implied by dragged nodes. */
export function applyDrags(next: BoardDocument, prev: BoardDocument): BoardDocument {
  const dragged = findDraggedNodes(next, prev);
  if (dragged.length === 0) return next;
  const resting = buildTreeIndex(prev.elements);
  const rectOf = (id: string): Rect | undefined => {
    const n = resting.nodes.get(id);
    return n ? { x: n.x, y: n.y, w: n.w, h: n.h } : undefined;
  };
  const moves: Array<{ id: string; parentId: string; index: number; side?: MindMapNodeElement['side'] }> = [];
  const draggedIds = new Set(dragged.map((d) => d.node.id));
  for (const { node, from } of dragged) {
    // Subtree members move with their root of the drag: only the topmost dragged node decides.
    let covered = false;
    for (const other of draggedIds) if (other !== node.id && isInSubtree(resting, other, node.id)) covered = true;
    if (covered) continue;
    const dx = node.x - from.x;
    const dy = node.y - from.y;
    if (Math.hypot(dx, dy) < DRAG_SLOP) continue;
    const point = { x: node.x + node.w / 2, y: node.y + node.h / 2 };
    const target = computeDropTarget(resting, node.id, point, rectOf);
    if (!target) continue;
    moves.push({ id: node.id, parentId: target.parentId, index: target.index, side: target.side });
  }
  // Dragged nodes always return to their resting spot; only the tree changes.
  return produce(next, (d) => {
    for (const el of d.elements) {
      if (el.type !== 'mindmapNode') continue;
      const old = draggedIds.has(el.id) ? dragged.find((x) => x.node.id === el.id) : undefined;
      if (old) {
        el.x = old.from.x;
        el.y = old.from.y;
      }
    }
    for (const m of moves) moveNode(d, m.id, { parentId: m.parentId, index: m.index, side: m.side });
  });
}

/** CanvasPlugin.afterChange implementation. */
export function normalizeMindMaps(next: BoardDocument, prev: BoardDocument, sizeOf: SizeFn): BoardDocument {
  if (!hasMindNodes(next)) return next;
  if (sameMindNodes(next, prev)) return next;
  let doc = normalizeTrees(next, prev);
  doc = applyDrags(doc, prev);
  return relayoutDocument(doc, sizeOf);
}
