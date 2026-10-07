import { describe, expect, it } from 'vitest';
import { applyDrags, findDraggedNodes, normalizeMindMaps } from './afterChange';
import { computeDropTarget } from './drop';
import { buildTreeIndex, childIds } from './model';
import { produce } from 'immer';
import { fixedSize, laidOut, nodeOf } from './testkit';
import type { BoardDocument } from '@renderer/core/types';

const tree = () =>
  laidOut({
    id: 'r',
    children: [
      { id: 'a', side: 'right', children: [{ id: 'a1' }, { id: 'a2' }] },
      { id: 'b', side: 'right', children: [{ id: 'b1' }] },
      { id: 'c', side: 'left' },
    ],
  });

const rectOf = (doc: BoardDocument) => (id: string) => {
  const n = nodeOf(doc, id);
  return { x: n.x, y: n.y, w: n.w, h: n.h };
};
const centre = (doc: BoardDocument, id: string) => {
  const n = nodeOf(doc, id);
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
};

describe('drop target', () => {
  it('drops onto a node as its child', () => {
    const doc = tree();
    const target = computeDropTarget(buildTreeIndex(doc.elements), 'b1', centre(doc, 'a1'), rectOf(doc));
    expect(target).toMatchObject({ kind: 'child', parentId: 'a1' });
  });

  it('drops between siblings into a slot (before / after)', () => {
    const doc = tree();
    const a2 = nodeOf(doc, 'a2');
    const index = buildTreeIndex(doc.elements);
    const above = computeDropTarget(index, 'b1', { x: a2.x + 20, y: a2.y - 6 }, rectOf(doc));
    // Just above a2 is the slot between a1 and a2 (either neighbour may be the reference).
    expect(above).toMatchObject({ kind: 'sibling', parentId: 'a', index: 1 });
    const below = computeDropTarget(index, 'b1', { x: a2.x + 20, y: a2.y + a2.h + 6 }, rectOf(doc));
    expect(below).toMatchObject({ kind: 'sibling', parentId: 'a', where: 'after', index: 2 });
  });

  it('drops beyond the outer edge of a node as its child', () => {
    const doc = tree();
    const a2 = nodeOf(doc, 'a2');
    const target = computeDropTarget(buildTreeIndex(doc.elements), 'b1', { x: a2.x + a2.w + 30, y: a2.y + a2.h / 2 }, rectOf(doc));
    expect(target).toMatchObject({ kind: 'child', parentId: 'a2' });
  });

  it('drops near the root as a first-level branch on the side of the pointer', () => {
    const doc = tree();
    const r = nodeOf(doc, 'r');
    const target = computeDropTarget(buildTreeIndex(doc.elements), 'a1', { x: r.x - 20, y: r.y + r.h / 2 }, rectOf(doc));
    expect(target).toMatchObject({ kind: 'rootChild', parentId: 'r', side: 'left' });
  });

  it('never targets the dragged subtree and ignores far-away drops', () => {
    const doc = tree();
    const index = buildTreeIndex(doc.elements);
    const own = computeDropTarget(index, 'a', centre(doc, 'a1'), rectOf(doc));
    expect(own?.refId).not.toBe('a1');
    expect(own?.refId).not.toBe('a');
    expect(computeDropTarget(index, 'a1', { x: 5000, y: 5000 }, rectOf(doc))).toBeUndefined();
  });
});

describe('drag re-parenting through afterChange', () => {
  /** Simulates the canvas move: translates a node in a new document. */
  const dragged = (doc: BoardDocument, id: string, to: { x: number; y: number }) =>
    produce(doc, (d) => {
      const n = d.elements.find((e) => e.id === id)!;
      if (n.type === 'mindmapNode') {
        n.x = to.x - n.w / 2;
        n.y = to.y - n.h / 2;
      }
    });

  it('detects nodes moved without a tree change', () => {
    const doc = tree();
    const next = dragged(doc, 'b1', { x: 0, y: 300 });
    expect(findDraggedNodes(next, doc).map((d) => d.node.id)).toEqual(['b1']);
    expect(findDraggedNodes(doc, doc)).toEqual([]);
  });

  it('re-parents the dragged node and relayouts', () => {
    const doc = tree();
    const a1 = centre(doc, 'a1');
    const next = dragged(doc, 'b1', { x: a1.x + 5, y: a1.y });
    const done = normalizeMindMaps(next, doc, fixedSize);
    const index = buildTreeIndex(done.elements);
    expect(nodeOf(done, 'b1').treeParentId).toBe('a1');
    expect(childIds(index, 'b')).toEqual([]);
    // The node lands where the layout puts it, right of its new parent.
    expect(nodeOf(done, 'b1').x).toBeGreaterThan(nodeOf(done, 'a1').x + nodeOf(done, 'a1').w);
  });

  it('puts the node back when it is released away from every target', () => {
    const doc = tree();
    const next = dragged(doc, 'b1', { x: 9000, y: 9000 });
    const done = normalizeMindMaps(next, doc, fixedSize);
    expect(nodeOf(done, 'b1').treeParentId).toBe('b');
    expect(nodeOf(done, 'b1').x).toBe(nodeOf(doc, 'b1').x);
    expect(nodeOf(done, 'b1').y).toBe(nodeOf(doc, 'b1').y);
  });

  it('treats a tiny movement as a click (no re-parenting)', () => {
    const doc = tree();
    const b1 = centre(doc, 'b1');
    const next = dragged(doc, 'b1', { x: b1.x + 3, y: b1.y + 2 });
    expect(nodeOf(applyDrags(next, doc), 'b1').treeParentId).toBe('b');
  });

  it('moves the whole map with the root and relayouts the descendants', () => {
    const doc = tree();
    const next = produce(doc, (d) => {
      const r = d.elements.find((e) => e.id === 'r');
      if (r && r.type === 'mindmapNode') {
        r.x += 300;
        r.y += 100;
      }
    });
    const done = normalizeMindMaps(next, doc, fixedSize);
    expect(nodeOf(done, 'a').x).toBe(nodeOf(doc, 'a').x + 300);
    expect(nodeOf(done, 'a1').y).toBe(nodeOf(doc, 'a1').y + 100);
  });

  it('leaves documents without mind-map changes untouched (same reference)', () => {
    const doc = tree();
    const next = { ...doc, settings: { ...doc.settings } };
    expect(normalizeMindMaps(next, doc, fixedSize)).toBe(next);
  });
});
