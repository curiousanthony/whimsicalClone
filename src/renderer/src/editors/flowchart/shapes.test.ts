import { describe, expect, it } from 'vitest';
import { emptyRichText } from '@renderer/core/richText';
import type { BoardDocument, RichText, ShapeElement, StylePreset } from '@renderer/core/types';
import { createEmptyBoard } from '@renderer/core/boardFormat';
import { shapeDefinition, toLocal, applyShapeResize } from './definition';
import { SHAPE_KINDS, SHAPE_SPECS, contentLayout, createShape, fitAutoHeights, fittedHeight, kebabToPascal, normalizeShape, resolveShapeStyle } from './shapes';
import { flowchartShortcuts } from './shortcuts';
import { shapeTools } from './tools';

const text = (s: string): RichText => ({ blocks: [{ type: 'p', spans: [{ text: s }] }] });
const make = (over: Partial<ShapeElement> = {}) => createShape({ id: 's1', kind: 'rectangle', at: { x: 0, y: 0 }, style: over });

describe('createShape', () => {
  it('centres a default-sized shape on the click point, snapped to the grid', () => {
    const s = createShape({ id: 'a', kind: 'rectangle', at: { x: 500, y: 300 } });
    expect([s.w, s.h]).toEqual([168, 72]);
    expect(s.x % 12).toBe(0);
    expect(s.y % 12).toBe(0);
    expect(Math.abs(s.x + s.w / 2 - 500)).toBeLessThanOrEqual(6);
    expect(s.autoHeight).toBe(true);
    expect(s.fillStyle).toBe('fill');
  });

  it('dragging a rect sizes the shape and turns auto-height off', () => {
    const s = createShape({ id: 'a', kind: 'oval', at: { x: 0, y: 0 }, rect: { x: 10, y: 20, w: 200, h: 100 } });
    expect([s.x, s.y, s.w, s.h]).toEqual([10, 20, 200, 100]);
    expect(s.autoHeight).toBe(false);
  });

  it('seeds cloud and star only; lines get a slate border style and no auto-height', () => {
    expect(createShape({ id: 'a', kind: 'cloud', at: { x: 0, y: 0 } }).seed).toBeTypeOf('number');
    expect(createShape({ id: 'a', kind: 'star', at: { x: 0, y: 0 } }).seed).toBeTypeOf('number');
    expect(createShape({ id: 'a', kind: 'rectangle', at: { x: 0, y: 0 } }).seed).toBeUndefined();
    const line = createShape({ id: 'a', kind: 'line', at: { x: 0, y: 0 } });
    expect(line.color).toBe('slate');
    expect(line.autoHeight).toBe(false);
  });

  it('applies a style override', () => {
    expect(make({ color: 'red', fillStyle: 'dashed' })).toMatchObject({ color: 'red', fillStyle: 'dashed' });
  });
});

describe('resolveShapeStyle', () => {
  const presets: Record<string, StylePreset> = {
    shape: { color: 'blue', fillStyle: 'border', textSize: 'l' },
    'shape:diamond': { color: 'orange' },
  };
  const source = { getStyleFor: (k: string) => presets[k] };

  it('per-kind style overrides the shared last-used style', () => {
    expect(resolveShapeStyle(source, 'diamond')).toMatchObject({ color: 'orange', fillStyle: 'border', textSize: 'l' });
    expect(resolveShapeStyle(source, 'rectangle')).toMatchObject({ color: 'blue', fillStyle: 'border' });
  });

  it('lines and brackets never inherit a fill style', () => {
    expect(resolveShapeStyle(source, 'line').fillStyle).toBeUndefined();
    expect(resolveShapeStyle(source, 'bracket').fillStyle).toBeUndefined();
  });

  it('is empty without presets', () => {
    expect(resolveShapeStyle({ getStyleFor: () => undefined }, 'rectangle')).toEqual({});
  });
});

describe('auto height', () => {
  it('empty text keeps the minimum height', () => {
    expect(fittedHeight(make())).toBe(SHAPE_SPECS.rectangle.minHeight);
  });

  it('long text grows the shape downward in grid steps', () => {
    const h = fittedHeight(make({ text: text('word '.repeat(80)), w: 168 }));
    expect(h).toBeGreaterThan(72);
    expect(h % 12).toBe(0);
  });

  it('text-less kinds keep their height', () => {
    const line = createShape({ id: 'l', kind: 'line', at: { x: 0, y: 0 } });
    expect(fittedHeight(line)).toBe(line.h);
  });

  it('fitAutoHeights grows only changed auto-height shapes and keeps identity otherwise', () => {
    const a = make({ id: 'a', text: text('word '.repeat(80)) });
    const fixed = make({ id: 'b', text: text('word '.repeat(80)), autoHeight: false });
    const prev: BoardDocument = createEmptyBoard('flowchart', [{ ...a, text: emptyRichText(), h: 72 }, fixed]);
    const next: BoardDocument = { ...prev, elements: [a, fixed] };
    const out = fitAutoHeights(next, prev);
    expect((out.elements[0] as ShapeElement).h).toBeGreaterThan(72);
    expect((out.elements[1] as ShapeElement).h).toBe(fixed.h);
    expect(fitAutoHeights(out, out)).toBe(out);
  });
});

describe('content layout', () => {
  it('without icon the text box is the geometry text box', () => {
    const l = contentLayout({ kind: 'rectangle', w: 168, h: 72, icon: undefined, seed: undefined });
    expect(l.icon).toBeUndefined();
    expect(l.text.w).toBeGreaterThan(0);
  });

  it('icon placements reserve space next to or above the text', () => {
    const base = { kind: 'rectangle' as const, w: 168, h: 96, seed: undefined };
    const plain = contentLayout(base).text;
    const left = contentLayout({ ...base, icon: { name: 'user', placement: 'left' } });
    const right = contentLayout({ ...base, icon: { name: 'user', placement: 'right' } });
    const top = contentLayout({ ...base, icon: { name: 'user', placement: 'top' } });
    expect(left.text.w).toBeLessThan(plain.w);
    expect(left.icon!.x).toBeLessThan(left.text.x);
    expect(right.icon!.x).toBeGreaterThan(right.text.x);
    expect(top.text.h).toBeLessThan(plain.h);
    expect(top.icon!.y).toBeLessThan(top.text.y);
  });

  it('kebabToPascal maps lucide names', () => {
    expect(kebabToPascal('circle-user-round')).toBe('CircleUserRound');
    expect(kebabToPascal('user')).toBe('User');
  });
});

describe('normalizeShape', () => {
  it('fills defaults for sparse hand-edited elements and keeps unknown props', () => {
    const sparse = { id: 'x', type: 'shape', kind: 'cloud', x: 0, y: 0, w: 100, h: 60, custom: 1 } as unknown as ShapeElement;
    const n = normalizeShape(sparse) as ShapeElement & { custom?: number };
    expect(n).toMatchObject({ fillStyle: 'fill', textSize: 'm', textAlign: 'center', verticalAlign: 'middle', autoHeight: true, custom: 1 });
    expect(n.seed).toBeDefined();
    expect(n.text.blocks.length).toBeGreaterThan(0);
  });

  it('unknown kinds fall back without throwing', () => {
    const odd = { id: 'x', type: 'shape', kind: 'nope', x: 0, y: 0, w: 10, h: 10 } as unknown as ShapeElement;
    expect(() => normalizeShape(odd)).not.toThrow();
  });
});

describe('element definition', () => {
  it('toLocal inverts 90 degree rotations about the centre', () => {
    const el = { x: 0, y: 0, w: 100, h: 40 };
    expect(toLocal({ ...el, rotation: 0 }, { x: 10, y: 5 })).toEqual({ x: 10, y: 5 });
    expect(toLocal({ ...el, rotation: 180 }, { x: 10, y: 5 })).toEqual({ x: 90, y: 35 });
    // The centre is a fixed point of every rotation.
    expect(toLocal({ ...el, rotation: 90 }, { x: 50, y: 20 })).toEqual({ x: 50, y: 20 });
  });

  it('hit tests through the shape geometry (diamond corner misses)', () => {
    const d = createShape({ id: 'd', kind: 'diamond', at: { x: 0, y: 0 }, rect: { x: 0, y: 0, w: 100, h: 100 } });
    expect(shapeDefinition.hitTest!(d, { x: 50, y: 50 }, 0, createEmptyBoard('flowchart'))).toBe(true);
    expect(shapeDefinition.hitTest!(d, { x: 3, y: 3 }, 0, createEmptyBoard('flowchart'))).toBe(false);
  });

  it('manual height resize disables auto height; seeded shapes regenerate their outline', () => {
    const cloud = { ...createShape({ id: 'c', kind: 'cloud', at: { x: 0, y: 0 } }), seed: 5 };
    const draft = { ...cloud };
    applyShapeResize(draft, { x: 0, y: 0, w: 200, h: 150 }, { x: 0, y: 0, w: cloud.w, h: cloud.h });
    expect(draft.autoHeight).toBe(false);
    expect(draft.seed).not.toBe(5);
    const rect = { ...make() };
    applyShapeResize(rect, { x: 0, y: 0, w: 300, h: rect.h }, { x: 0, y: 0, w: rect.w, h: rect.h });
    expect(rect.autoHeight).toBe(true);
    expect(rect.seed).toBeUndefined();
  });

  it('declares quick add with connect', () => {
    expect(shapeDefinition.quickAdd).toEqual({ connect: true });
  });
});

describe('tools and shortcut table', () => {
  const ids = new Set(flowchartShortcuts.map((s) => s.id));

  it('has exactly one tool per shape kind, each bound to a shortcut row', () => {
    expect(shapeTools.map((t) => t.id).sort()).toEqual(SHAPE_KINDS.map((k) => `flowchart.${k}`).sort());
    for (const tool of shapeTools) {
      expect(ids.has(tool.shortcutId!), tool.id).toBe(true);
      expect(tool.modes).toEqual(['diagram']);
    }
  });

  it('uses the Whimsical shape keys (with documented collision decisions)', () => {
    const key = (id: string) => flowchartShortcuts.find((s) => s.id === id)?.keys[0];
    expect(key('flowchart.rectangle')).toBe('R');
    expect(key('flowchart.pill')).toBe('U');
    expect(key('flowchart.oval')).toBe('O');
    expect(key('flowchart.diamond')).toBe('D');
    expect(key('flowchart.hexagon')).toBe('F');
    expect(key('flowchart.triangle')).toBe('G');
    expect(key('flowchart.cylinder')).toBe('Y');
    expect(key('flowchart.line')).toBe('L');
    expect(key('flowchart.bracket')).toBe('B');
    expect(key('flowchart.star')).toBe('V');
    expect(key('flowchart.cloud')).toBe('J');
    expect(key('flowchart.shapesMenu')).toBe('S');
    expect(key('flowchart.trapezoid')).toBeUndefined();
  });

  it('only text-capable shapes start editing right after creation', () => {
    const byId = Object.fromEntries(shapeTools.map((t) => [t.id, t.editAfterCreate]));
    expect(byId['flowchart.rectangle']).toBe(true);
    expect(byId['flowchart.line']).toBe(false);
    expect(byId['flowchart.cross']).toBe(false);
  });
});
