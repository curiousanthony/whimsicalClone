import { describe, expect, it } from 'vitest';
import type { BoardDocument, ConnectorElement, ShapeElement } from '@renderer/core/types';
import { createEmptyBoard } from '@renderer/core/boardFormat';
import { createShape } from './shapes';
import { layoutGraph, layoutSides, layoutTargets, planLayout } from './layout';

const box = (id: string, x: number, y: number, w = 168, h = 72, extra: Partial<ShapeElement> = {}): ShapeElement =>
  createShape({ id, kind: 'rectangle', at: { x: 0, y: 0 }, rect: { x, y, w, h }, style: extra });

const link = (id: string, from: string, to: string): ConnectorElement => ({
  id,
  type: 'connector',
  start: { kind: 'attached', elementId: from, side: 'auto' },
  end: { kind: 'attached', elementId: to, side: 'auto' },
  route: 'elbow',
  color: 'slate',
  dashed: false,
  startEndpoint: 'none',
  endEndpoint: 'arrow',
  waypoints: [{ x: 1, y: 1 }],
});

const doc = (...els: BoardDocument['elements']): BoardDocument => createEmptyBoard('flowchart', els);

describe('layoutGraph', () => {
  const nodes = [
    { id: 'a', w: 168, h: 72 },
    { id: 'b', w: 168, h: 72 },
    { id: 'c', w: 168, h: 72 },
  ];
  const edges = [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
  ];

  it('TB puts children below the parent and keeps the origin', () => {
    const p = layoutGraph(nodes, edges, 'TB', { x: 100, y: 200 });
    expect(p.get('a')!.y).toBe(204); // 200 snapped to the 12 px grid
    expect(p.get('b')!.y).toBeGreaterThan(p.get('a')!.y);
    expect(p.get('b')!.y).toBe(p.get('c')!.y);
    expect(Math.min(...[...p.values()].map((v) => v.x))).toBe(96); // 100 snapped to the 12 grid
  });

  it('LR puts children to the right of the parent', () => {
    const p = layoutGraph(nodes, edges, 'LR');
    expect(p.get('b')!.x).toBeGreaterThan(p.get('a')!.x);
    expect(p.get('b')!.x).toBe(p.get('c')!.x);
    expect(p.get('b')!.y).not.toBe(p.get('c')!.y);
  });

  it('snaps to the grid and handles empty input, self loops and unknown ids', () => {
    expect(layoutGraph([], [], 'TB').size).toBe(0);
    const p = layoutGraph(nodes, [{ from: 'a', to: 'a' }, { from: 'a', to: 'zzz' }, ...edges], 'TB');
    for (const v of p.values()) {
      expect(v.x % 12).toBe(0);
      expect(v.y % 12).toBe(0);
    }
  });
});

describe('layoutTargets', () => {
  const d = doc(box('a', 0, 0), box('b', 300, 0), box('c', 600, 0), box('x', 0, 500), link('k1', 'a', 'b'), link('k2', 'b', 'c'));

  it('2+ selected objects are used as is (connectors excluded)', () => {
    expect(layoutTargets(d, ['a', 'x', 'k1']).sort()).toEqual(['a', 'x']);
  });
  it('one selected object expands to its connected component', () => {
    expect(layoutTargets(d, ['a']).sort()).toEqual(['a', 'b', 'c']);
  });
  it('no selection lays out every connected object', () => {
    expect(layoutTargets(d, []).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('planLayout', () => {
  it('returns undefined without connectors or with fewer than two boxes', () => {
    expect(planLayout(doc(box('a', 0, 0), box('b', 300, 0)), ['a', 'b'], 'TB')).toBeUndefined();
    expect(planLayout(doc(box('a', 0, 0)), ['a'], 'TB')).toBeUndefined();
  });

  it('skips locked elements', () => {
    const d = doc(box('a', 0, 0), box('b', 300, 0, 168, 72, { locked: true }), link('k', 'a', 'b'));
    expect(planLayout(d, ['a', 'b'], 'TB')).toBeUndefined();
  });

  it('stacks a chain vertically and assigns bottom/top sides', () => {
    const d = doc(box('a', 0, 0), box('b', 400, 0), box('c', 800, 0), link('k1', 'a', 'b'), link('k2', 'b', 'c'));
    const plan = planLayout(d, ['a', 'b', 'c'], 'TB')!;
    const a = plan.positions.get('a')!;
    const b = plan.positions.get('b')!;
    const c = plan.positions.get('c')!;
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
    expect(a.x).toBe(b.x);
    expect(plan.connectors.get('k1')).toEqual({ from: 'bottom', to: 'top' });
  });

  it('lays out horizontally with right/left sides', () => {
    const d = doc(box('a', 0, 0), box('b', 0, 400), link('k', 'a', 'b'));
    const plan = planLayout(d, ['a', 'b'], 'LR')!;
    expect(plan.positions.get('a')!.x).toBeLessThan(plan.positions.get('b')!.x);
    expect(plan.connectors.get('k')).toEqual(layoutSides('LR'));
  });

  it('keeps the top-left of the selection fixed', () => {
    const d = doc(box('a', 120, 240), box('b', 900, 900), link('k', 'a', 'b'));
    const plan = planLayout(d, ['a', 'b'], 'TB')!;
    expect(plan.positions.get('a')).toEqual({ x: 120, y: 240 });
  });

  it('uses the swapped box for 90 degree rotated shapes', () => {
    const d = doc(box('a', 0, 0), box('b', 0, 0, 200, 40, { rotation: 90 }), link('k', 'a', 'b'));
    const plan = planLayout(d, ['a', 'b'], 'TB')!;
    expect(plan.positions.has('b')).toBe(true);
    expect(Number.isFinite(plan.positions.get('b')!.x)).toBe(true);
  });
});
