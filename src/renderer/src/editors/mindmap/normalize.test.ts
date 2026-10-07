import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { normalizeTrees } from './normalize';
import { buildTreeIndex, childIds } from './model';
import { mapOf, nodeOf } from './testkit';
import type { ConnectorElement } from '@renderer/core/types';

const base = () => mapOf({ id: 'r', children: [{ id: 'a', children: [{ id: 'a1', children: [{ id: 'a11' }] }, { id: 'a2' }] }, { id: 'b' }] });

describe('normalizeTrees', () => {
  it('returns the same reference for a healthy tree', () => {
    const doc = base();
    expect(normalizeTrees(doc, doc)).toBe(doc);
  });

  it('removes the subtree when the engine deleted only the parent', () => {
    const prev = base();
    const next = { ...prev, elements: prev.elements.filter((e) => e.id !== 'a') };
    const done = normalizeTrees(next, prev);
    expect(done.elements.map((e) => e.id)).toEqual(['r', 'b']);
  });

  it('also drops connectors attached to removed descendants', () => {
    const prev = base();
    const connector: ConnectorElement = {
      id: 'k',
      type: 'connector',
      start: { kind: 'attached', elementId: 'a11', side: 'auto' },
      end: { kind: 'free', x: 0, y: 0 },
      route: 'straight',
      color: 'slate',
      dashed: false,
      startEndpoint: 'none',
      endEndpoint: 'arrow',
    };
    const withConnector = { ...prev, elements: [...prev.elements, connector] };
    const next = { ...withConnector, elements: withConnector.elements.filter((e) => e.id !== 'a') };
    expect(normalizeTrees(next, withConnector).elements.map((e) => e.id)).toEqual(['r', 'b']);
  });

  it('promotes a node whose parent never existed to a root', () => {
    const prev = base();
    const next = produce(prev, (d) => {
      const n = d.elements.find((e) => e.id === 'b');
      if (n && n.type === 'mindmapNode') n.treeParentId = 'ghost';
    });
    const done = normalizeTrees(next, prev);
    expect(nodeOf(done, 'b').treeParentId).toBeNull();
    expect(nodeOf(done, 'b').rootId).toBe('b');
  });

  it('repairs rootId and renumbers fractional sibling orders', () => {
    const prev = base();
    const next = produce(prev, (d) => {
      for (const e of d.elements) {
        if (e.type !== 'mindmapNode') continue;
        if (e.id === 'a11') e.rootId = 'wrong';
        if (e.id === 'a1') e.order = 0.25;
        if (e.id === 'a2') e.order = 7;
      }
    });
    const done = normalizeTrees(next, prev);
    expect(nodeOf(done, 'a11').rootId).toBe('r');
    expect(nodeOf(done, 'a1').order).toBe(0);
    expect(nodeOf(done, 'a2').order).toBe(1);
    expect(childIds(buildTreeIndex(done.elements), 'a')).toEqual(['a1', 'a2']);
  });
});
