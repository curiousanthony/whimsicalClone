import { describe, expect, it } from 'vitest';
import { createStickyElement, createSectionElement, createTextElement } from './model';
import { centredTopLeft, rowLayout, squareRect, wrappedByNewSection } from './placement';

describe('centredTopLeft', () => {
  it('centres and snaps to the grid', () => {
    expect(centredTopLeft({ x: 0, y: 0 }, 168, 168, 12)).toEqual({ x: -84, y: -84 });
    expect(centredTopLeft({ x: 100, y: 100 }, 168, 168, 12)).toEqual({ x: 12, y: 12 });
  });
});

describe('squareRect', () => {
  it('uses the longer side', () => {
    expect(squareRect({ x: 1, y: 2, w: 100, h: 300 })).toEqual({ x: 1, y: 2, w: 300, h: 300 });
  });
});

describe('rowLayout', () => {
  it('lays sizes in a centred row', () => {
    const spots = rowLayout([{ w: 100, h: 50 }, { w: 100, h: 100 }], { x: 0, y: 0 }, 20);
    expect(spots).toEqual([
      { x: -110, y: -25 },
      { x: 10, y: -50 },
    ]);
  });
  it('is empty for no sizes', () => {
    expect(rowLayout([], { x: 0, y: 0 })).toEqual([]);
  });
});

describe('wrappedByNewSection', () => {
  const inside = createStickyElement({ id: 'in', x: 20, y: 20 });
  const outside = createStickyElement({ id: 'out', x: 600, y: 20 });
  const partial = createTextElement({ id: 'half', x: 300, y: 20, rect: { x: 300, y: 20, w: 200, h: 28 } });
  const nested = { ...createStickyElement({ id: 'nested', x: 30, y: 30 }), containerId: 'other' };
  const other = createSectionElement({ id: 'other', x: 10, y: 10, rect: { x: 10, y: 10, w: 10, h: 10 }, name: '' });
  const boundsOf = (el: { x?: number; y?: number; w?: number; h?: number }) => ({ x: el.x ?? 0, y: el.y ?? 0, w: el.w ?? 0, h: el.h ?? 0 });
  it('wraps only fully contained, uncontained, non-container boxes', () => {
    const ids = wrappedByNewSection(
      [inside, outside, partial, nested, other],
      { x: 0, y: 0, w: 400, h: 400 },
      (el) => boundsOf(el as never),
      (el) => el.type === 'section',
    );
    expect(ids).toEqual(['in']);
  });
});
