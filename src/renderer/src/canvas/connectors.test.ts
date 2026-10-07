import { describe, expect, it } from 'vitest';
import type { BoardElement, ConnectorElement, MindMapNodeElement } from '@renderer/core/types';
import { attachmentAt, connectorGeometry, createBoundsResolver, elbowRoute, hitTestConnector } from './connectors';
import { cloneElements, collectForCopy, parseClipboard, serializeClipboard } from './clipboard';
import { SceneIndex } from './spatialIndex';
import { board, connector, noDefinitions, shape } from './testUtils';

const doc = board([shape('a', 0, 0, 100, 50), shape('b', 300, 0, 100, 50), connector('k', 'a', 'b')]);
const boundsOf = createBoundsResolver(doc, noDefinitions);
const k = doc.elements[2] as ConnectorElement;

describe('connectors', () => {
  it('attaches auto ends to the facing sides', () => {
    const g = connectorGeometry(k, boundsOf);
    expect(g.start.point).toEqual({ x: 100, y: 25 });
    expect(g.end.point).toEqual({ x: 300, y: 25 });
    expect(g.start.side).toBe('right');
    expect(g.end.side).toBe('left');
    expect(g.endAngle).toBeCloseTo(0);
  });

  it('honours pinned sides and positions', () => {
    const pinned: ConnectorElement = { ...k, start: { kind: 'attached', elementId: 'a', side: 'bottom', t: 0.25 } };
    expect(connectorGeometry(pinned, boundsOf).start.point).toEqual({ x: 25, y: 50 });
  });

  it('routes elbows orthogonally', () => {
    const pts = elbowRoute({ x: 100, y: 25 }, 'right', { x: 300, y: 125 }, 'left');
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
    expect(pts[0]).toEqual({ x: 100, y: 25 });
    expect(pts.at(-1)).toEqual({ x: 300, y: 125 });
  });

  it('builds curved paths and hit tests along them', () => {
    const curved: ConnectorElement = { ...k, route: 'curved' };
    const g = connectorGeometry(curved, boundsOf);
    expect(g.d.startsWith('M100 25 C')).toBe(true);
    expect(hitTestConnector(k, { x: 200, y: 27 }, 4, boundsOf)).toBe(true);
    expect(hitTestConnector(k, { x: 200, y: 60 }, 4, boundsOf)).toBe(false);
  });

  it('handles free ends', () => {
    const free: ConnectorElement = { ...k, end: { kind: 'free', x: 100, y: 300 } };
    const g = connectorGeometry(free, boundsOf);
    expect(g.end.point).toEqual({ x: 100, y: 300 });
    expect(g.start.side).toBe('bottom');
  });

  it('pins to an edge only when the pointer is near it', () => {
    const r = { x: 0, y: 0, w: 100, h: 50 };
    expect(attachmentAt('a', r, { x: 50, y: 25 }, 8)).toEqual({ kind: 'attached', elementId: 'a', side: 'auto' });
    expect(attachmentAt('a', r, { x: 98, y: 26 }, 8)).toEqual({ kind: 'attached', elementId: 'a', side: 'right', t: 0.5 });
  });
});

describe('clipboard', () => {
  const index = new SceneIndex(doc, noDefinitions);
  const elementBoundsOf = (id: string) => index.getBounds(id);

  it('copies connectors between copied elements and frees dangling ends', () => {
    const both = collectForCopy(doc, ['a', 'b'], boundsOf, elementBoundsOf)!;
    expect(both.elements.map((e) => e.id)).toEqual(['a', 'b', 'k']);
    expect(both.bounds).toMatchObject({ x: 0, y: 0, w: 400 });

    const onlyConnector = collectForCopy(doc, ['k', 'a'], boundsOf, elementBoundsOf)!;
    const c = onlyConnector.elements.find((e) => e.id === 'k') as ConnectorElement;
    expect(c.start.kind).toBe('attached');
    expect(c.end).toEqual({ kind: 'free', x: 300, y: 25 });
  });

  it('round-trips the payload and rejects foreign text', () => {
    const payload = collectForCopy(doc, ['a'], boundsOf, elementBoundsOf)!;
    expect(parseClipboard(serializeClipboard(payload))).toEqual(payload);
    expect(parseClipboard('hello')).toBeUndefined();
    expect(parseClipboard('{"format":"other"}')).toBeUndefined();
  });

  it('clones with fresh ids, remapped references and an offset', () => {
    let n = 0;
    const createId = () => `n${++n}`;
    const source: BoardElement[] = [
      shape('a', 0, 0, 100, 50, { groupId: 'g' }),
      shape('b', 300, 0, 100, 50, { groupId: 'g', containerId: 'outside' }),
      connector('k', 'a', 'b', { waypoints: [{ x: 200, y: 0 }] }),
    ];
    const out = cloneElements(source, createId, { x: 12, y: 24 });
    const [a, b, c] = out as [BoardElement & { x: number }, BoardElement & { x: number; y: number }, ConnectorElement];
    expect(out.map((e) => e.id)).toEqual(['n1', 'n2', 'n3']);
    expect(a.groupId).toBe(b.groupId);
    expect(a.groupId).not.toBe('g');
    expect(b.containerId).toBeUndefined();
    expect(b.x).toBe(312);
    expect(b.y).toBe(24);
    expect(c.start).toMatchObject({ elementId: 'n1' });
    expect(c.end).toMatchObject({ elementId: 'n2' });
    expect(c.waypoints).toEqual([{ x: 212, y: 24 }]);
    // The source is untouched.
    expect(source[0]!.id).toBe('a');
  });

  it('turns a copied mind-map subtree into a new map', () => {
    const node = (id: string, parent: string | null): MindMapNodeElement => ({
      id,
      type: 'mindmapNode',
      rootId: 'root',
      treeParentId: parent,
      order: 0,
      side: parent === 'root' ? 'right' : undefined,
      text: { blocks: [] },
      textSize: 'm',
      x: 0,
      y: 0,
      w: 10,
      h: 10,
    });
    let n = 0;
    const out = cloneElements([node('child', 'root'), node('grandchild', 'child')], () => `m${++n}`, { x: 0, y: 0 }) as MindMapNodeElement[];
    expect(out[0]).toMatchObject({ id: 'm1', treeParentId: null, rootId: 'm1' });
    expect(out[0]!.side).toBeUndefined();
    expect(out[1]).toMatchObject({ id: 'm2', treeParentId: 'm1', rootId: 'm1' });
  });
});
