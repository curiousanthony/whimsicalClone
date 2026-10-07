/**
 * Tree normaliser: structural repairs applied to every committed document, before the layout.
 *
 *   - A node whose parent was deleted in this very change (generic Delete / Cut of a parent by
 *     the canvas engine, which knows nothing about subtrees) is deleted with it.
 *   - A node whose parent never existed becomes the root of its own map.
 *   - `rootId` always points at the real root.
 *   - Sibling `order` values are renumbered 0..n-1 (fractional keys from inserts are folded).
 *
 * Idempotent: returns the same document reference when there is nothing to repair.
 */

import { produce } from 'immer';
import type { BoardDocument, BoardElement, MindMapNodeElement } from '@renderer/core/types';
import { isMindNode } from './model';

function trueRoots(nodes: ReadonlyMap<string, MindMapNodeElement>): Map<string, string> {
  const result = new Map<string, string>();
  for (const node of nodes.values()) {
    let cur = node;
    const seen = new Set<string>();
    while (cur.treeParentId !== null && !seen.has(cur.id)) {
      seen.add(cur.id);
      const parent = nodes.get(cur.treeParentId);
      if (!parent) break;
      cur = parent;
    }
    result.set(node.id, cur.id);
  }
  return result;
}

export function normalizeTrees(next: BoardDocument, prev: BoardDocument): BoardDocument {
  const nodes = new Map<string, MindMapNodeElement>();
  for (const el of next.elements) if (isMindNode(el)) nodes.set(el.id, el);
  if (nodes.size === 0) return next;

  // 1. Orphans.
  const prevIds = new Set(prev.elements.map((e) => e.id));
  const doomed = new Set<string>();
  const promote = new Set<string>();
  for (const node of nodes.values()) {
    if (node.treeParentId !== null && !nodes.has(node.treeParentId)) {
      if (prevIds.has(node.treeParentId)) doomed.add(node.id);
      else promote.add(node.id);
    }
  }
  if (doomed.size > 0) {
    // Grow the doomed set downwards.
    let grew = true;
    while (grew) {
      grew = false;
      for (const node of nodes.values()) {
        if (!doomed.has(node.id) && node.treeParentId !== null && doomed.has(node.treeParentId)) {
          doomed.add(node.id);
          grew = true;
        }
      }
    }
  }

  // 2. Root ids and sibling orders (on the surviving nodes).
  const alive = new Map([...nodes].filter(([id]) => !doomed.has(id)));
  for (const id of promote) {
    const n = alive.get(id);
    if (n) alive.set(id, { ...n, treeParentId: null });
  }
  const roots = trueRoots(alive);
  const badRoot = [...alive.values()].filter((n) => n.rootId !== roots.get(n.id));
  const byParent = new Map<string, MindMapNodeElement[]>();
  for (const n of alive.values()) {
    if (n.treeParentId === null) continue;
    const list = byParent.get(n.treeParentId);
    if (list) list.push(n);
    else byParent.set(n.treeParentId, [n]);
  }
  const position = new Map(next.elements.map((e, i) => [e.id, i]));
  const reorder = new Map<string, number>();
  for (const list of byParent.values()) {
    list.sort((a, b) => a.order - b.order || position.get(a.id)! - position.get(b.id)!);
    list.forEach((n, i) => {
      if (n.order !== i) reorder.set(n.id, i);
    });
  }

  if (doomed.size === 0 && promote.size === 0 && badRoot.length === 0 && reorder.size === 0) return next;

  return produce(next, (d) => {
    d.elements = d.elements.filter((el: BoardElement) => {
      if (doomed.has(el.id)) return false;
      if (el.type === 'connector') {
        const s = el.start.kind === 'attached' && doomed.has(el.start.elementId);
        const e = el.end.kind === 'attached' && doomed.has(el.end.elementId);
        if (s || e) return false;
      }
      return true;
    });
    for (const el of d.elements) {
      if (el.type !== 'mindmapNode') continue;
      if (promote.has(el.id)) {
        el.treeParentId = null;
        delete el.side;
      }
      const root = roots.get(el.id);
      if (root && el.rootId !== root) el.rootId = root;
      const order = reorder.get(el.id);
      if (order !== undefined) el.order = order;
    }
  });
}
