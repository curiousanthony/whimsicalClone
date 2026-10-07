import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { buildTreeIndex, setCollapsed } from './model';
import { navigate } from './navigation';
import { laidOut, nodeOf } from './testkit';
import type { BoardDocument, Direction } from '@renderer/core/types';

const tree = () =>
  laidOut({
    id: 'r',
    children: [
      { id: 'a', side: 'right', children: [{ id: 'a1', children: [{ id: 'a11' }] }, { id: 'a2' }] },
      { id: 'b', side: 'right', children: [{ id: 'b1' }] },
      { id: 'c', side: 'left', children: [{ id: 'c1' }] },
    ],
  });

function go(doc: BoardDocument, from: string, dir: Direction) {
  const index = buildTreeIndex(doc.elements);
  return navigate(index, from, dir, (id) => {
    const n = nodeOf(doc, id);
    return { x: n.x, y: n.y, w: n.w, h: n.h };
  });
}

describe('arrow navigation (horizontal map)', () => {
  it('goes outwards to the first child, back to the parent, across to siblings', () => {
    const doc = tree();
    expect(go(doc, 'a', 'right')?.select).toBe('a1');
    expect(go(doc, 'a1', 'right')?.select).toBe('a11');
    expect(go(doc, 'a11', 'left')?.select).toBe('a1');
    expect(go(doc, 'a', 'left')?.select).toBe('r');
    expect(go(doc, 'a', 'down')?.select).toBe('b');
    expect(go(doc, 'b', 'up')?.select).toBe('a');
    expect(go(doc, 'a1', 'down')?.select).toBe('a2');
  });

  it('mirrors the keys on the left side', () => {
    const doc = tree();
    expect(go(doc, 'c', 'left')?.select).toBe('c1');
    expect(go(doc, 'c1', 'right')?.select).toBe('c');
    expect(go(doc, 'c', 'right')?.select).toBe('r');
  });

  it('selects the first branch of the pressed side from the root', () => {
    const doc = tree();
    expect(go(doc, 'r', 'right')?.select).toBe('a');
    expect(go(doc, 'r', 'left')?.select).toBe('c');
  });

  it('jumps to the closest cousin when there is no sibling in that direction', () => {
    const doc = tree();
    // a2 is the last child of a; below it the nearest same-depth node is b1.
    expect(go(doc, 'a2', 'down')?.select).toBe('b1');
    expect(go(doc, 'b1', 'up')?.select).toBe('a2');
  });

  it('does nothing without a target', () => {
    const doc = tree();
    expect(go(doc, 'r', 'up')).toBeUndefined();
    expect(go(doc, 'a11', 'right')).toBeUndefined();
  });

  it('expands a collapsed node when entering its children', () => {
    const doc = produce(tree(), (d) => {
      setCollapsed(d, ['a'], true);
    });
    expect(go(doc, 'a', 'right')).toEqual({ select: 'a1', expand: 'a' });
  });
});

describe('arrow navigation (vertical map)', () => {
  it('uses Down for children and Left/Right for siblings', () => {
    const doc = laidOut({ id: 'r', children: [{ id: 'a', children: [{ id: 'a1' }] }, { id: 'b' }] }, { orientation: 'vertical' });
    expect(go(doc, 'r', 'down')?.select).toBe('a');
    expect(go(doc, 'a', 'down')?.select).toBe('a1');
    expect(go(doc, 'a1', 'up')?.select).toBe('a');
    expect(go(doc, 'a', 'right')?.select).toBe('b');
    expect(go(doc, 'b', 'left')?.select).toBe('a');
    expect(go(doc, 'a', 'up')?.select).toBe('r');
  });
});
