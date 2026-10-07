import { describe, expect, it } from 'vitest';
import { GAPS, layoutDocument, relayoutDocument } from './layout';
import { centreOf, fixedSize, laidOut, mapOf, nodeOf } from './testkit';

describe('mind-map layout', () => {
  it('puts first-level branches on their sides, children further out, parents centred on children', () => {
    const doc = laidOut({
      id: 'r',
      children: [
        { id: 'a', children: [{ id: 'a1' }, { id: 'a2' }] }, // right
        { id: 'b' }, // left
      ],
    });
    const r = nodeOf(doc, 'r');
    const a = nodeOf(doc, 'a');
    const b = nodeOf(doc, 'b');
    const a1 = nodeOf(doc, 'a1');
    const a2 = nodeOf(doc, 'a2');
    expect(a.x).toBe(r.x + r.w + GAPS.rootDepth);
    expect(b.x + b.w).toBe(r.x - GAPS.rootDepth);
    expect(a1.x).toBe(a.x + a.w + GAPS.levelDepth);
    expect(a2.x).toBe(a1.x);
    // Siblings stacked with the constant gap, parent centred on them.
    expect(a2.y - (a1.y + a1.h)).toBe(GAPS.siblingH);
    expect(centreOf(a).y).toBeCloseTo((centreOf(a1).y + centreOf(a2).y) / 2, 0);
    // Root centred between its two sides.
    expect(centreOf(a).y).toBeCloseTo(centreOf(r).y, 0);
    expect(centreOf(b).y).toBeCloseTo(centreOf(r).y, 0);
  });

  it('grows left branches outwards to the left at any depth', () => {
    const doc = laidOut({ id: 'r', children: [{ id: 'a', side: 'left', children: [{ id: 'a1', children: [{ id: 'a11' }] }] }] });
    const a = nodeOf(doc, 'a');
    const a1 = nodeOf(doc, 'a1');
    const a11 = nodeOf(doc, 'a11');
    expect(a1.x + a1.w).toBe(a.x - GAPS.levelDepth);
    expect(a11.x + a11.w).toBe(a1.x - GAPS.levelDepth);
  });

  it('gives a tall subtree room so neighbours never overlap', () => {
    const doc = laidOut({
      id: 'r',
      children: [
        { id: 'a', side: 'right', children: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }, { id: 'a4' }] },
        { id: 'b', side: 'right', children: [{ id: 'b1' }] },
      ],
    });
    const lastOfA = nodeOf(doc, 'a4');
    const firstOfB = nodeOf(doc, 'b1');
    expect(firstOfB.y).toBeGreaterThanOrEqual(lastOfA.y + lastOfA.h);
  });

  it('lays vertical maps top-down with siblings side by side', () => {
    const doc = laidOut({ id: 'r', children: [{ id: 'a', children: [{ id: 'a1' }] }, { id: 'b' }] }, { orientation: 'vertical' });
    const r = nodeOf(doc, 'r');
    const a = nodeOf(doc, 'a');
    const b = nodeOf(doc, 'b');
    const a1 = nodeOf(doc, 'a1');
    expect(a.y).toBe(r.y + r.h + GAPS.rootDepth);
    expect(b.y).toBe(a.y);
    expect(b.x).toBeGreaterThan(a.x + a.w);
    expect(a1.y).toBe(a.y + a.h + GAPS.levelDepth);
    // The root sits centred above its branches.
    expect(centreOf(r).x).toBeCloseTo((centreOf(a).x + centreOf(b).x) / 2, 0);
  });

  it('supports branches above the root in vertical maps', () => {
    const doc = laidOut({ id: 'r', children: [{ id: 'a', side: 'top' }] }, { orientation: 'vertical' });
    const r = nodeOf(doc, 'r');
    const a = nodeOf(doc, 'a');
    expect(a.y + a.h).toBe(r.y - GAPS.rootDepth);
  });

  it('parks the descendants of a collapsed node on it with zero size', () => {
    const doc = laidOut({ id: 'r', children: [{ id: 'a', collapsed: true, children: [{ id: 'a1', children: [{ id: 'a11' }] }] }] });
    const a = nodeOf(doc, 'a');
    for (const id of ['a1', 'a11']) {
      const n = nodeOf(doc, id);
      expect([n.w, n.h]).toEqual([0, 0]);
      expect(n.x).toBe(Math.round(a.x + a.w / 2));
    }
    // The collapsed node itself keeps its size and the layout ignores the hidden subtree.
    expect(a.w).toBeGreaterThan(0);
    const placements = layoutDocument(doc, fixedSize);
    expect(placements.get('a1')?.hidden).toBe(true);
  });

  it('keeps the root centre when its size changes', () => {
    const doc = relayoutDocument(mapOf({ id: 'r' }, { x: 100, y: 200 }), fixedSize);
    const r = nodeOf(doc, 'r');
    expect(r).toMatchObject({ x: 100, y: 200, w: 100, h: 40 });
    const bigger = relayoutDocument(doc, (n, level) => (level === 'root' ? { w: 160, h: 40 } : { w: 80, h: 30 }));
    expect(nodeOf(bigger, 'r')).toMatchObject({ x: 70, w: 160 });
  });

  it('is idempotent and returns the same reference when nothing changes', () => {
    const doc = laidOut({ id: 'r', children: [{ id: 'a' }, { id: 'b' }] });
    expect(relayoutDocument(doc, fixedSize)).toBe(doc);
  });

  it('lays out several maps independently', () => {
    const one = laidOut({ id: 'r1', children: [{ id: 'a' }] });
    const two = mapOf({ id: 'r2', children: [{ id: 'b' }] }, { x: 1000, y: 1000 });
    const doc = relayoutDocument({ ...one, elements: [...one.elements, ...two.elements] }, fixedSize);
    expect(nodeOf(doc, 'b').x).toBeGreaterThan(1000);
    expect(nodeOf(doc, 'a').x).toBeLessThan(500);
  });
});
