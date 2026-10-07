import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { countItems, insertList, looksLikeList, parseList, subtreeToList } from './listFormat';
import { buildTreeIndex, childIds } from './model';
import { mapOf, nodeOf } from './testkit';

describe('list import', () => {
  it('parses bullets, numbers and indentation into a tree', () => {
    const items = parseList(['- Fruit', '  - Apple', '  - Pear', '    * Conference', '- Veg', '1. Carrot'].join('\n'));
    expect(items.map((i) => i.text)).toEqual(['Fruit', 'Veg', 'Carrot']);
    expect(items[0]!.children.map((c) => c.text)).toEqual(['Apple', 'Pear']);
    expect(items[0]!.children[1]!.children[0]!.text).toBe('Conference');
    expect(countItems(items)).toBe(6);
  });

  it('handles tabs, blank lines and plain lines', () => {
    const items = parseList('Root\n\tChild\n\n\t\tGrandchild\nOther');
    expect(items).toHaveLength(2);
    expect(items[0]!.children[0]!.children[0]!.text).toBe('Grandchild');
    expect(parseList('   \n')).toEqual([]);
    expect(looksLikeList('single')).toBe(false);
    expect(looksLikeList('one\ntwo')).toBe(true);
  });

  it('inserts items as descendants of a node, expanding it', () => {
    let n = 0;
    const doc = produce(mapOf({ id: 'r', children: [{ id: 'a', collapsed: true, children: [{ id: 'a1' }] }] }), (d) => {
      insertList(d, 'a', parseList('- x\n  - y\n- z'), () => `n${n++}`);
    });
    const index = buildTreeIndex(doc.elements);
    expect(nodeOf(doc, 'a').collapsed).toBeUndefined();
    expect(childIds(index, 'a')).toEqual(['a1', 'n0', 'n2']);
    expect(childIds(index, 'n0')).toEqual(['n1']);
    expect(nodeOf(doc, 'n1').rootId).toBe('r');
  });
});

describe('list export', () => {
  it('serialises a subtree as an indented bullet list', () => {
    const doc = mapOf({ id: 'r', text: 'Root', children: [{ id: 'a', text: 'A', children: [{ id: 'a1', text: 'A1' }] }, { id: 'b', text: 'B' }] });
    const index = buildTreeIndex(doc.elements);
    expect(subtreeToList(index.nodes, index.children, 'r')).toBe('- Root\n  - A\n    - A1\n  - B');
    expect(subtreeToList(index.nodes, index.children, 'a')).toBe('- A\n  - A1');
  });
});
