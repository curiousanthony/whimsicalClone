import { describe, expect, it } from 'vitest';
import {
  applyClick,
  expandGroups,
  marqueeSelect,
  nearestInDirection,
  normalizeSelection,
  selectAll,
  selectNextInReadingOrder,
} from './selection';
import { collectMoveSet, findContainerFor } from './scene';
import { SceneIndex } from './spatialIndex';
import { board, connector, noDefinitions, shape } from './testUtils';
import type { ElementDefinition, SectionElement } from '@renderer/core/types';

const doc = board([
  shape('a', 0, 0),
  shape('b', 200, 0, 100, 50, { groupId: 'g1' }),
  shape('c', 400, 0, 100, 50, { groupId: 'g1' }),
  shape('d', 0, 200, 100, 50, { locked: true }),
  shape('e', 200, 200),
  connector('k', 'a', 'e'),
]);
const index = new SceneIndex(doc, noDefinitions);
const boundsOf = (id: string) => index.getBounds(id);

describe('selection model', () => {
  it('normalises to existing ids in z-order', () => {
    expect(normalizeSelection(doc, ['e', 'zz', 'a'])).toEqual(['a', 'e']);
  });

  it('expands groups on click unless deep-selecting', () => {
    expect(applyClick(doc, [], 'b')).toEqual(['b', 'c']);
    expect(applyClick(doc, [], 'b', { deep: true })).toEqual(['b']);
    expect(expandGroups(doc, ['c'])).toEqual(['b', 'c']);
  });

  it('toggles with shift and clears on empty click', () => {
    expect(applyClick(doc, ['a'], 'b', { shift: true })).toEqual(['a', 'b', 'c']);
    expect(applyClick(doc, ['a', 'b', 'c'], 'c', { shift: true })).toEqual(['a']);
    expect(applyClick(doc, ['a'], undefined)).toEqual([]);
    expect(applyClick(doc, ['a'], undefined, { shift: true })).toEqual(['a']);
  });

  it('keeps a multi-selection when clicking one of its members', () => {
    expect(applyClick(doc, ['a', 'e'], 'e')).toEqual(['a', 'e']);
  });

  it('select all skips locked elements unless asked', () => {
    expect(selectAll(doc)).not.toContain('d');
    expect(selectAll(doc, { includeLocked: true })).toContain('d');
  });

  it('marquee selects intersecting, unlocked elements and expands groups', () => {
    expect(marqueeSelect(doc, { x: 190, y: -10, w: 50, h: 30 }, boundsOf, noDefinitions)).toEqual(['b', 'c']);
    expect(marqueeSelect(doc, { x: -10, y: 190, w: 50, h: 30 }, boundsOf, noDefinitions)).toEqual([]);
  });

  it('marquee requires containers to be fully enclosed', () => {
    const section: SectionElement = { id: 's', type: 'section', x: -50, y: -50, w: 600, h: 400, name: '', color: 'gray', fill: 'outline', clip: false };
    const withSection = board([section, shape('a', 0, 0)]);
    const lookup = (type: string) => (type === 'section' ? ({ container: true } as unknown as ElementDefinition) : undefined);
    const idx = new SceneIndex(withSection, () => undefined);
    expect(marqueeSelect(withSection, { x: -10, y: -10, w: 50, h: 50 }, (id) => idx.getBounds(id), lookup)).toEqual(['a']);
    expect(marqueeSelect(withSection, { x: -60, y: -60, w: 700, h: 500 }, (id) => idx.getBounds(id), lookup)).toEqual(['s', 'a']);
  });

  it('walks reading order with Tab', () => {
    expect(selectNextInReadingOrder(doc, [], boundsOf, 1)).toBe('a');
    expect(selectNextInReadingOrder(doc, ['a'], boundsOf, 1)).toBe('b');
    expect(selectNextInReadingOrder(doc, ['c'], boundsOf, 1)).toBe('e');
    expect(selectNextInReadingOrder(doc, ['e'], boundsOf, 1)).toBe('a');
    expect(selectNextInReadingOrder(doc, ['a'], boundsOf, -1)).toBe('e');
  });

  it('finds the nearest element in a direction', () => {
    const a = boundsOf('a')!;
    expect(nearestInDirection(doc, a, 'right', boundsOf)).toBe('b');
    expect(nearestInDirection(doc, a, 'down', boundsOf)).toBe('e'); // d (straight below) is locked
    expect(nearestInDirection(doc, boundsOf('e')!, 'up', boundsOf)).toBe('b');
    expect(nearestInDirection(doc, a, 'left', boundsOf)).toBeUndefined();
  });

  it('hit tests top-down and skips locked elements', () => {
    const overlapping = board([shape('under', 0, 0), shape('over', 50, 0), shape('locked', 60, 0, 10, 10, { locked: true })]);
    const idx = new SceneIndex(overlapping, noDefinitions);
    expect(idx.hitTest({ x: 65, y: 5 })).toBe('over');
    expect(idx.hitTest({ x: 10, y: 10 })).toBe('under');
    expect(idx.hitTest({ x: 500, y: 500 })).toBeUndefined();
    expect(idx.hitTestAll({ x: 65, y: 5 }, { skipLocked: false })).toEqual(['locked', 'over', 'under']);
  });

  it('computes move sets with groups, containers and connectors', () => {
    expect([...collectMoveSet(doc, ['b'])].sort()).toEqual(['b', 'c']);
    expect([...collectMoveSet(doc, ['a', 'e'])].sort()).toEqual(['a', 'e', 'k']);
    expect([...collectMoveSet(doc, ['d'])]).toEqual([]);
    const contained = board([
      { id: 's', type: 'section', x: 0, y: 0, w: 500, h: 500, name: '', color: 'gray', fill: 'outline', clip: false },
      shape('in', 10, 10, 100, 50, { containerId: 's' }),
    ]);
    expect([...collectMoveSet(contained, ['s'])].sort()).toEqual(['in', 's']);
  });

  it('finds the innermost container for dropped content', () => {
    const lookup = (type: string) =>
      type === 'section'
        ? ({ container: true, getBounds: (e: SectionElement) => ({ x: e.x, y: e.y, w: e.w, h: e.h }) } as unknown as ElementDefinition)
        : undefined;
    const nested = board([
      { id: 'outer', type: 'section', x: 0, y: 0, w: 1000, h: 1000, name: '', color: 'gray', fill: 'outline', clip: false },
      { id: 'inner', type: 'section', x: 100, y: 100, w: 300, h: 300, name: '', color: 'gray', fill: 'outline', clip: false },
    ]);
    expect(findContainerFor(nested, { x: 150, y: 150, w: 10, h: 10 }, lookup, new Set())).toBe('inner');
    expect(findContainerFor(nested, { x: 600, y: 600, w: 10, h: 10 }, lookup, new Set())).toBe('outer');
    expect(findContainerFor(nested, { x: 2000, y: 0, w: 10, h: 10 }, lookup, new Set())).toBeUndefined();
  });
});
