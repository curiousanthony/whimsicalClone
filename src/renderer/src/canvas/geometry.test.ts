import { describe, expect, it } from 'vitest';
import {
  closestPointOnSegment,
  distanceToPolyline,
  nearestSide,
  nextRotation,
  pointAlongPolyline,
  projectOnPolyline,
  rectContainsRect,
  rectFromPoints,
  rectsIntersect,
  rotatedBounds,
  sideFacing,
  unionRects,
} from './geometry';
import {
  clampZoom,
  fitRect,
  panBy,
  screenToWorld,
  stepZoom,
  viewportFromWheel,
  worldToScreen,
  zoomAt,
} from './viewport';
import { handlesFor, resizeRect, scaleRectWithin } from './transform';
import { alignOffsets, bringForward, bringToFront, distributeOffsets, sendBackward, sendToBack } from './arrange';
import { snapMovingRect, snapModeFromModifiers } from './snapping';

describe('geometry', () => {
  it('builds normalised rects and unions', () => {
    expect(rectFromPoints({ x: 10, y: 20 }, { x: 0, y: 5 })).toEqual({ x: 0, y: 5, w: 10, h: 15 });
    expect(unionRects([])).toBeUndefined();
    expect(unionRects([{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: -5, w: 5, h: 5 }])).toEqual({ x: 0, y: -5, w: 25, h: 15 });
  });

  it('tests intersection and containment', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(rectsIntersect(a, { x: 10, y: 10, w: 5, h: 5 })).toBe(true);
    expect(rectsIntersect(a, { x: 11, y: 0, w: 5, h: 5 })).toBe(false);
    expect(rectContainsRect(a, { x: 2, y: 2, w: 3, h: 3 })).toBe(true);
    expect(rectContainsRect(a, { x: 8, y: 2, w: 3, h: 3 })).toBe(false);
  });

  it('measures distance to segments and polylines', () => {
    expect(closestPointOnSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ point: { x: 5, y: 0 }, t: 0.5 });
    expect(distanceToPolyline({ x: 12, y: 3 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBeCloseTo(2);
    expect(distanceToPolyline({ x: 0, y: 0 }, [])).toBe(Infinity);
  });

  it('walks along polylines', () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(pointAlongPolyline(line, 0.5)).toEqual({ x: 10, y: 0 });
    expect(pointAlongPolyline(line, 0.75)).toEqual({ x: 10, y: 5 });
    expect(projectOnPolyline(line, { x: 11, y: 5 })).toBeCloseTo(0.75);
  });

  it('rotates bounds in 90 degree steps', () => {
    const r = { x: 0, y: 0, w: 100, h: 50 };
    expect(rotatedBounds(r, 90)).toEqual({ x: 25, y: -25, w: 50, h: 100 });
    expect(rotatedBounds(r, 180)).toEqual(r);
    expect(nextRotation(270)).toBe(0);
    expect(nextRotation(undefined)).toBe(90);
  });

  it('finds facing and nearest sides', () => {
    const r = { x: 0, y: 0, w: 100, h: 50 };
    expect(sideFacing(r, { x: 300, y: 30 })).toBe('right');
    expect(sideFacing(r, { x: 50, y: -200 })).toBe('top');
    expect(nearestSide(r, { x: 25, y: 52 })).toMatchObject({ side: 'bottom', t: 0.25 });
  });
});

describe('viewport', () => {
  it('converts between screen and world', () => {
    const v = { x: 100, y: 50, zoom: 2 };
    expect(screenToWorld(v, { x: 20, y: 10 })).toEqual({ x: 110, y: 55 });
    expect(worldToScreen(v, { x: 110, y: 55 })).toEqual({ x: 20, y: 10 });
  });

  it('zooms around an anchor keeping the world point fixed', () => {
    const v = { x: 0, y: 0, zoom: 1 };
    const anchor = { x: 200, y: 100 };
    const before = screenToWorld(v, anchor);
    const next = zoomAt(v, 2, anchor);
    expect(next.zoom).toBe(2);
    expect(screenToWorld(next, anchor)).toEqual(before);
  });

  it('clamps and steps zoom', () => {
    expect(clampZoom(100)).toBe(4);
    expect(clampZoom(0)).toBe(0.1);
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.9);
    expect(stepZoom(4, 1)).toBe(4);
  });

  it('fits a rect, never above 100%', () => {
    const v = fitRect({ x: 0, y: 0, w: 100, h: 100 }, { w: 1000, h: 800 }, { padding: 0 });
    expect(v.zoom).toBe(1);
    expect(worldToScreen(v, { x: 50, y: 50 })).toEqual({ x: 500, y: 400 });
    const big = fitRect({ x: 0, y: 0, w: 4000, h: 1000 }, { w: 1000, h: 800 }, { padding: 0 });
    expect(big.zoom).toBe(0.25);
  });

  it('pans and handles wheel / pinch', () => {
    expect(panBy({ x: 0, y: 0, zoom: 2 }, 20, -10)).toEqual({ x: -10, y: 5, zoom: 2 });
    const wheel = { deltaX: 10, deltaY: 20, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false };
    expect(viewportFromWheel({ x: 0, y: 0, zoom: 1 }, wheel, { x: 0, y: 0 })).toEqual({ x: 10, y: 20, zoom: 1 });
    const pinch = viewportFromWheel({ x: 0, y: 0, zoom: 1 }, { ...wheel, deltaY: -10, ctrlKey: true }, { x: 0, y: 0 });
    expect(pinch.zoom).toBeGreaterThan(1);
    const shift = viewportFromWheel({ x: 0, y: 0, zoom: 1 }, { ...wheel, deltaX: 0, shiftKey: true }, { x: 0, y: 0 });
    expect(shift).toEqual({ x: 20, y: 0, zoom: 1 });
  });
});

describe('transform', () => {
  const start = { x: 0, y: 0, w: 100, h: 50 };

  it('resizes from each handle without flipping', () => {
    expect(resizeRect(start, 'se', { x: 20, y: 10 })).toEqual({ x: 0, y: 0, w: 120, h: 60 });
    expect(resizeRect(start, 'nw', { x: 20, y: 10 })).toEqual({ x: 20, y: 10, w: 80, h: 40 });
    expect(resizeRect(start, 'e', { x: -500, y: 0 })).toMatchObject({ x: 0, w: 8 });
    expect(resizeRect(start, 'n', { x: 99, y: -10 })).toEqual({ x: 0, y: -10, w: 100, h: 60 });
  });

  it('keeps aspect ratio with shift', () => {
    const r = resizeRect(start, 'se', { x: 100, y: 0 }, { keepAspect: true });
    expect(r.w / r.h).toBeCloseTo(2);
    expect(r.w).toBe(200);
    const edge = resizeRect(start, 'e', { x: 100, y: 0 }, { keepAspect: true });
    expect(edge).toEqual({ x: 0, y: -25, w: 200, h: 100 });
  });

  it('resizes from the centre with alt', () => {
    expect(resizeRect(start, 'e', { x: 10, y: 0 }, { fromCenter: true })).toEqual({ x: -10, y: 0, w: 120, h: 50 });
  });

  it('snaps moving edges to the grid', () => {
    expect(resizeRect(start, 'se', { x: 7, y: 3 }, { grid: 12 })).toEqual({ x: 0, y: 0, w: 108, h: 48 });
  });

  it('scales children inside a resized selection', () => {
    expect(scaleRectWithin({ x: 50, y: 0, w: 50, h: 50 }, { x: 0, y: 0, w: 100, h: 50 }, { x: 0, y: 0, w: 200, h: 100 })).toEqual({
      x: 100,
      y: 0,
      w: 100,
      h: 100,
    });
  });

  it('offers handles per resize mode', () => {
    expect(handlesFor('none')).toEqual([]);
    expect(handlesFor('width')).toEqual(['e', 'w']);
    expect(handlesFor('aspect')).toHaveLength(4);
    expect(handlesFor('free')).toHaveLength(8);
  });
});

describe('arrange', () => {
  const els = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const ids = (list: Array<{ id: string }>) => list.map((e) => e.id).join('');

  it('changes z-order', () => {
    expect(ids(bringToFront(els, new Set(['a', 'c'])))).toBe('bdac');
    expect(ids(sendToBack(els, new Set(['b', 'd'])))).toBe('bdac');
    expect(ids(bringForward(els, new Set(['a'])))).toBe('bacd');
    expect(ids(bringForward(els, new Set(['d'])))).toBe('abcd');
    expect(ids(bringForward(els, new Set(['a', 'b'])))).toBe('cabd');
    expect(ids(sendBackward(els, new Set(['c'])))).toBe('acbd');
    expect(ids(sendBackward(els, new Set(['a'])))).toBe('abcd');
  });

  it('aligns and distributes', () => {
    const items = [
      { id: 'a', rect: { x: 0, y: 0, w: 10, h: 10 } },
      { id: 'b', rect: { x: 30, y: 20, w: 20, h: 10 } },
    ];
    expect(alignOffsets(items, 'left').get('b')).toEqual({ x: -30, y: 0 });
    expect(alignOffsets(items, 'right').get('a')).toEqual({ x: 40, y: 0 });
    expect(alignOffsets(items, 'centerV').get('a')).toEqual({ x: 0, y: 10 });
    expect(alignOffsets(items.slice(0, 1), 'left').size).toBe(0);

    const three = [
      { id: 'a', rect: { x: 0, y: 0, w: 10, h: 10 } },
      { id: 'b', rect: { x: 15, y: 0, w: 10, h: 10 } },
      { id: 'c', rect: { x: 90, y: 0, w: 10, h: 10 } },
    ];
    expect(distributeOffsets(three, 'h').get('b')).toEqual({ x: 30, y: 0 });
    expect(distributeOffsets(three.slice(0, 2), 'h').size).toBe(0);
  });
});

describe('snapping', () => {
  it('snaps to edges and centres of other items before the grid', () => {
    const other = { x: 100, y: 100, w: 100, h: 100 };
    const moving = { x: 103, y: 250, w: 50, h: 50 };
    const r = snapMovingRect(moving, [other], { grid: 12, zoom: 1, mode: 'all' });
    expect(r.dx).toBe(-3);
    expect(r.guides.some((g) => g.axis === 'x' && g.at === 100)).toBe(true);
    // y has no guide match: falls back to the grid (250 -> 252).
    expect(r.dy).toBe(2);
  });

  it('uses the grid only with Cmd and nothing with backtick', () => {
    const other = { x: 100, y: 100, w: 100, h: 100 };
    const moving = { x: 103, y: 250, w: 50, h: 50 };
    const grid = snapMovingRect(moving, [other], { grid: 12, zoom: 1, mode: snapModeFromModifiers({ metaKey: true }) });
    expect(grid).toEqual({ dx: 5, dy: 2, guides: [] });
    expect(snapMovingRect(moving, [other], { grid: 12, zoom: 1, mode: snapModeFromModifiers({ backtick: true }) })).toEqual({
      dx: 0,
      dy: 0,
      guides: [],
    });
  });

  it('scales the threshold with zoom', () => {
    const other = { x: 100, y: 0, w: 10, h: 10 };
    const moving = { x: 120, y: 40, w: 10, h: 10 };
    // 10 world px away: within threshold at zoom 0.5 (6 / 0.5 = 12), not at zoom 1.
    expect(snapMovingRect(moving, [other], { grid: 1, zoom: 0.5, mode: 'all' }).dx).not.toBe(0);
    expect(snapMovingRect(moving, [other], { grid: 1, zoom: 1, mode: 'all' }).dx).toBe(0);
  });
});
