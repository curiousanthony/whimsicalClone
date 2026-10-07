import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  addChildNode,
  addParentNode,
  addSiblingNode,
  buildTreeIndex,
  childIds,
  collapseTargets,
  deleteNodes,
  descendantsOf,
  duplicateSubtree,
  indentNode,
  isHidden,
  linkOf,
  moveNode,
  rebalanceSides,
  outdentNode,
  reorderNode,
  selectionAfterDelete,
  setBranchColor,
  setCollapsed,
  setLink,
  setMapOptions,
  toggleMark,
  wouldCycle,
} from './model';
import { richTextFromPlain } from '@renderer/core/richText';
import { mapOf, nodeOf } from './testkit';

const base = () =>
  mapOf({
    id: 'r',
    children: [
      { id: 'a', side: 'right', children: [{ id: 'a1' }, { id: 'a2' }] },
      { id: 'b', side: 'right' },
      { id: 'c', side: 'left' },
    ],
  });

const kids = (doc: ReturnType<typeof base>, id: string) => childIds(buildTreeIndex(doc.elements), id);

describe('tree model', () => {
  it('adds children as the last child with an increasing order and inherits the branch colour', () => {
    const doc = produce(base(), (d) => {
      addChildNode(d, 'a', 'a3');
      addChildNode(d, 'a1', 'a11');
    });
    expect(kids(doc, 'a')).toEqual(['a1', 'a2', 'a3']);
    expect(nodeOf(doc, 'a11').treeParentId).toBe('a1');
    expect(nodeOf(doc, 'a11').rootId).toBe('r');
    expect(nodeOf(doc, 'a11').side).toBeUndefined();
    expect(nodeOf(doc, 'a11').color).toBe(nodeOf(doc, 'a1').color);
  });

  it('puts a root child on the side with fewer branches and gives it the least used colour', () => {
    const doc = produce(base(), (d) => {
      addChildNode(d, 'r', 'n1');
    });
    // Right has 2 branches, left 1: the new one goes left.
    expect(nodeOf(doc, 'n1').side).toBe('left');
  });

  it('expands a collapsed parent when a child is added', () => {
    const doc = produce(base(), (d) => {
      setCollapsed(d, ['a'], true);
      addChildNode(d, 'a', 'a3');
    });
    expect(nodeOf(doc, 'a').collapsed).toBeUndefined();
  });

  it('adds siblings after or before, and a child when asked on the root', () => {
    const doc = produce(base(), (d) => {
      addSiblingNode(d, 'a1', 'x', 'after');
      addSiblingNode(d, 'a1', 'y', 'before');
      addSiblingNode(d, 'r', 'z');
    });
    expect(kids(doc, 'a')).toEqual(['y', 'a1', 'x', 'a2']);
    expect(nodeOf(doc, 'z').treeParentId).toBe('r');
  });

  it('inserts a parent between a node and its parent', () => {
    const doc = produce(base(), (d) => {
      addParentNode(d, 'a1', 'p');
    });
    expect(kids(doc, 'a')).toEqual(['p', 'a2']);
    expect(kids(doc, 'p')).toEqual(['a1']);
    expect(addParentNode({ elements: doc.elements.map((e) => ({ ...e })) }, 'r', 'q')).toBeUndefined();
  });

  it('deletes a node with its subtree and picks the next selection', () => {
    const doc = base();
    const index = buildTreeIndex(doc.elements);
    expect(selectionAfterDelete(index, ['a1'])).toBe('a2');
    expect(selectionAfterDelete(index, ['a2'])).toBe('a1');
    expect(selectionAfterDelete(index, ['b'])).toBe('a');
    expect(selectionAfterDelete(index, ['a'])).toBe('b');
    const next = produce(doc, (d) => {
      deleteNodes(d, ['a']);
    });
    expect(next.elements.map((e) => e.id)).toEqual(['r', 'b', 'c']);
  });

  it('duplicates a subtree right after the original with fresh ids', () => {
    let n = 0;
    const doc = produce(base(), (d) => {
      duplicateSubtree(d, 'a', () => `dup${n++}`);
    });
    const index = buildTreeIndex(doc.elements);
    const rootKids = childIds(index, 'r');
    expect(rootKids).toHaveLength(4);
    const copy = rootKids[rootKids.indexOf('a') + 1]!;
    expect(copy).toBe('dup0');
    expect(childIds(index, copy)).toHaveLength(2);
    expect(descendantsOf(index, copy, true)).toHaveLength(3);
  });

  it('moves a branch under another parent at an index, refusing cycles', () => {
    const doc = produce(base(), (d) => {
      moveNode(d, 'b', { parentId: 'a', index: 1 });
    });
    expect(kids(doc, 'a')).toEqual(['a1', 'b', 'a2']);
    expect(nodeOf(doc, 'b').side).toBeUndefined();
    expect(kids(doc, 'r')).toEqual(['a', 'c']);
    const index = buildTreeIndex(doc.elements);
    expect(wouldCycle(index, 'a', 'a1')).toBe(true);
    const cyc = produce(doc, (d) => {
      expect(moveNode(d, 'a', { parentId: 'a2' })).toBe(false);
    });
    expect(cyc).toBe(doc);
  });

  it('turns a deep node into a first-level branch on a chosen side', () => {
    const doc = produce(base(), (d) => {
      moveNode(d, 'a1', { parentId: 'r', side: 'left', index: 0 });
    });
    expect(nodeOf(doc, 'a1').side).toBe('left');
    expect(kids(doc, 'r')[0]).toBe('a1');
  });

  it('reorders, indents and outdents', () => {
    let doc = produce(base(), (d) => {
      reorderNode(d, 'a2', -1);
    });
    expect(kids(doc, 'a')).toEqual(['a2', 'a1']);
    doc = produce(doc, (d) => {
      indentNode(d, 'a1');
    });
    expect(kids(doc, 'a2')).toEqual(['a1']);
    doc = produce(doc, (d) => {
      outdentNode(d, 'a1');
    });
    expect(kids(doc, 'a')).toEqual(['a2', 'a1']);
    // A first-level node cannot be outdented, the first child cannot be indented.
    const same = produce(doc, (d) => {
      expect(outdentNode(d, 'a')).toBe(false);
      expect(indentNode(d, 'a2')).toBe(false);
    });
    expect(same).toBe(doc);
  });

  it('collapses only nodes with children and reports the hidden state', () => {
    const doc = produce(base(), (d) => {
      setCollapsed(d, ['a', 'b'], true);
    });
    expect(nodeOf(doc, 'a').collapsed).toBe(true);
    expect(nodeOf(doc, 'b').collapsed).toBeUndefined();
    const index = buildTreeIndex(doc.elements);
    expect(isHidden(index, 'a1')).toBe(true);
    expect(isHidden(index, 'a')).toBe(false);
  });

  it('resolves modifier-click scopes for collapse', () => {
    const index = buildTreeIndex(base().elements);
    expect(collapseTargets(index, 'a', 'self')).toEqual(['a']);
    expect(collapseTargets(index, 'a', 'descendants').sort()).toEqual(['a', 'a1', 'a2']);
    expect(collapseTargets(index, 'a', 'siblings')).toEqual(['a', 'b', 'c']);
    expect(collapseTargets(index, 'a1', 'level').sort()).toEqual(['a1', 'a2']);
  });

  it('recolours a whole branch but only the root itself', () => {
    const doc = produce(base(), (d) => {
      setBranchColor(d, 'a', 'red');
      setBranchColor(d, 'r', 'green');
    });
    expect(['a', 'a1', 'a2'].map((id) => nodeOf(doc, id).color)).toEqual(['red', 'red', 'red']);
    expect(nodeOf(doc, 'b').color).not.toBe('red');
    expect(nodeOf(doc, 'r').color).toBe('green');
  });

  it('rebalances sides when the orientation changes', () => {
    const doc = produce(base(), (d) => {
      setMapOptions(d, 'r', { orientation: 'vertical' });
    });
    expect(['a', 'b', 'c'].map((id) => nodeOf(doc, id).side)).toEqual(['bottom', 'bottom', 'bottom']);
    const back = produce(doc, (d) => {
      setMapOptions(d, 'r', { orientation: 'horizontal' });
    });
    expect(new Set(['a', 'b', 'c'].map((id) => nodeOf(back, id).side))).toEqual(new Set(['right', 'left']));
  });

  it('puts every branch on one side, or balances them over both', () => {
    const one = produce(base(), (d) => {
      rebalanceSides(d, 'r', 'left');
    });
    expect(['a', 'b', 'c'].map((id) => nodeOf(one, id).side)).toEqual(['left', 'left', 'left']);
    const both = produce(one, (d) => {
      rebalanceSides(d, 'r', 'both');
    });
    const sides = ['a', 'b', 'c'].map((id) => nodeOf(both, id).side);
    // a is the heaviest (3 nodes): alone on one side, b and c share the other.
    expect(sides[0]).not.toBe(sides[1]);
    expect(sides[1]).toBe(sides[2]);
  });

  it('toggles marks and links on node text', () => {
    const text = richTextFromPlain('hello');
    const bold = toggleMark(text, 'bold');
    expect(bold.blocks[0]!.spans[0]!.marks).toEqual(['bold']);
    expect(toggleMark(bold, 'bold').blocks[0]!.spans[0]!.marks).toBeUndefined();
    const linked = setLink(text, 'https://example.com');
    expect(linkOf(linked)).toBe('https://example.com');
    expect(linkOf(setLink(linked, undefined))).toBeUndefined();
  });
});
