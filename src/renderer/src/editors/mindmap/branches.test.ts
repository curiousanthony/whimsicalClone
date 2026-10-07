import { describe, expect, it } from 'vitest';
import { attachmentPoints, branchPath, computeBranches } from './branches';
import { buildTreeIndex } from './model';
import { laidOut } from './testkit';

describe('branch geometry', () => {
  it('leaves the parent edge facing the child and enters the child near edge', () => {
    const parent = { x: 0, y: 0, w: 100, h: 40 };
    const child = { x: 160, y: 60, w: 80, h: 30 };
    expect(attachmentPoints(parent, child, 'right')).toEqual({ from: { x: 100, y: 20 }, to: { x: 160, y: 75 } });
    const left = { x: -180, y: 60, w: 80, h: 30 };
    expect(attachmentPoints(parent, left, 'left')).toEqual({ from: { x: 0, y: 20 }, to: { x: -100, y: 75 } });
    expect(attachmentPoints(parent, { x: 10, y: 120, w: 80, h: 30 }, 'bottom').from).toEqual({ x: 50, y: 40 });
  });

  it('draws curves with tangents along the growth axis', () => {
    expect(branchPath({ x: 0, y: 0 }, { x: 100, y: 50 }, 'right', 'curved')).toBe('M0,0 C50,0 50,50 100,50');
    expect(branchPath({ x: 0, y: 0 }, { x: 50, y: 100 }, 'bottom', 'curved')).toBe('M0,0 C0,50 50,50 50,100');
  });

  it('draws elbows as polylines and degenerates to a straight run when aligned', () => {
    const elbow = branchPath({ x: 0, y: 0 }, { x: 100, y: 50 }, 'right', 'elbow');
    expect(elbow.startsWith('M0,0 L40,0 Q50,0 50,10')).toBe(true);
    expect(elbow.endsWith('L100,50')).toBe(true);
    expect(branchPath({ x: 0, y: 0 }, { x: 100, y: 0 }, 'right', 'elbow')).toBe('M0,0 L50,0 L50,0 L100,0');
  });

  it('computes one branch per visible node, coloured by the node', () => {
    const doc = laidOut({ id: 'r', children: [{ id: 'a', collapsed: true, children: [{ id: 'a1' }] }, { id: 'b' }] });
    const branches = computeBranches(buildTreeIndex(doc.elements), (n) => n.color);
    expect(branches.map((b) => b.id).sort()).toEqual(['a', 'b']);
    expect(branches.find((b) => b.id === 'a')?.level).toBe('first');
    expect(branches[0]?.color).toBe('blue');
  });

  it('applies live offsets (dragged root) to both ends', () => {
    const doc = laidOut({ id: 'r', children: [{ id: 'a', side: 'right' }] });
    const index = buildTreeIndex(doc.elements);
    const still = computeBranches(index, () => undefined)[0]!.d;
    const moved = computeBranches(index, () => undefined, () => ({ x: 10, y: 0 }))[0]!.d;
    expect(moved).not.toBe(still);
    expect(moved.startsWith('M')).toBe(true);
  });
});
