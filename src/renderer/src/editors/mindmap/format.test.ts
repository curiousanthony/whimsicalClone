import { describe, expect, it } from 'vitest';
import { parseBoard, serializeBoard } from '@renderer/core/boardFormat';
import { relayoutDocument } from './layout';
import { fixedSize, laidOut, nodeOf } from './testkit';
import { seedMindmapElements } from './index';
import { createEmptyBoard } from '@renderer/core/boardFormat';

describe('.wmind files', () => {
  it('round-trips a laid out mind map through the board format unchanged', () => {
    const doc = laidOut({ id: 'r', children: [{ id: 'a', children: [{ id: 'a1' }] }, { id: 'b', collapsed: true, children: [{ id: 'b1' }] }] }, { orientation: 'vertical', lineStyle: 'elbow' });
    const text = serializeBoard(doc);
    const parsed = parseBoard(text, 'mindmap');
    expect(parsed).toEqual(doc);
    expect(serializeBoard(parsed)).toBe(text);
    // Reopening a saved file needs no relayout.
    expect(relayoutDocument(parsed, fixedSize)).toBe(parsed);
    expect(nodeOf(parsed, 'r').map).toEqual({ orientation: 'vertical', lineStyle: 'elbow' });
  });

  it('seeds a new file with one measured root node', () => {
    const [root] = seedMindmapElements();
    expect(root).toMatchObject({ type: 'mindmapNode', treeParentId: null });
    expect(root!.type === 'mindmapNode' && root!.w).toBeGreaterThan(0);
    expect(root!.type === 'mindmapNode' && root!.h).toBeGreaterThan(0);
    const doc = createEmptyBoard('mindmap', seedMindmapElements());
    expect(parseBoard(serializeBoard(doc), 'mindmap').elements).toHaveLength(1);
  });
});
