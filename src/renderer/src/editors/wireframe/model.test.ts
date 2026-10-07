import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createEmptyBoard } from '@renderer/core/boardFormat';
import { plainText } from '@renderer/core/richText';
import type { BoardElement, FrameElement, WireElement } from '@renderer/core/types';
import { defaultFrameSize, frameInsertIndex } from './frames';
import {
  LINE_THICKNESS,
  autoWidthTargets,
  constrainResize,
  createAnnotation,
  createFrame,
  createWire,
  flipLine,
  frameNameFromText,
  insertFrame,
  lineBox,
  renumberAnnotations,
  tableCells,
} from './model';
import { entryOf } from './registry';

const t = (key: string) => `~${key}`;

function make(
  entryId: string,
  at = { x: 200, y: 100 },
  rect?: { x: number; y: number; w: number; h: number },
  doc = createEmptyBoard('wireframe'),
) {
  return createWire({ id: `id-${entryId}`, entryId, at, rect, t, doc });
}

describe('createWire', () => {
  it('centres a default-size component on the click', () => {
    const { element } = make('rectangle');
    expect(element).toMatchObject({
      type: 'wire',
      component: 'rectangle',
      x: 120,
      y: 52,
      w: 160,
      h: 96,
      size: 'M',
      state: 'default',
    });
  });

  it('translates default text and props at creation', () => {
    const { element } = make('button');
    expect(plainText(element.text)).toBe('~defaults.button');
    expect(element.props).toMatchObject({ variant: 'solid', autoWidth: true });
    expect(plainText(make('dropdown').element.text)).toBe('');
    expect(make('dropdown').element.props.options).toEqual(['~defaults.option1', '~defaults.option2']);
  });

  it('applies the outline preset of the launcher entry', () => {
    expect(make('outlineButton').element.props.variant).toBe('outline');
    expect(make('outlineButton').element.component).toBe('button');
  });

  it('dragging sizes the width of controls but keeps their row height', () => {
    const input = make('input', { x: 0, y: 0 }, { x: 10, y: 20, w: 300, h: 120 }).element;
    expect(input).toMatchObject({ x: 10, y: 20, w: 300, h: 32 });
    const button = make('button', { x: 0, y: 0 }, { x: 10, y: 20, w: 200, h: 90 }).element;
    expect(button.h).toBe(32);
    expect(button.props.autoWidth).toBe(false);
    const rect = make('rectangle', { x: 0, y: 0 }, { x: 10, y: 20, w: 200, h: 90 }).element;
    expect(rect).toMatchObject({ w: 200, h: 90 });
  });

  it('remembers colour and text size from the last used style', () => {
    const { element } = createWire({
      id: 'x',
      entryId: 'tag',
      at: { x: 0, y: 0 },
      t,
      style: { color: 'green', textSize: 's' },
    });
    expect(element).toMatchObject({ color: 'green', textSize: 's' });
  });

  it('puts the component in the innermost frame containing it', () => {
    const size = defaultFrameSize('iphone-14');
    const frame: FrameElement = {
      id: 'f',
      type: 'frame',
      x: 0,
      y: 0,
      ...size,
      device: 'iphone-14',
      name: 'f',
      statusBar: true,
      keyboard: false,
      orientation: 'portrait',
    };
    const doc = createEmptyBoard('wireframe', [frame]);
    expect(make('button', { x: 200, y: 300 }, undefined, doc).element.containerId).toBe('f');
    expect(make('button', { x: 2000, y: 3000 }, undefined, doc).element.containerId).toBeUndefined();
  });

  it('fits overlays to the screen of the frame they are dropped on', () => {
    const size = defaultFrameSize('iphone-x');
    const frame: FrameElement = {
      id: 'f',
      type: 'frame',
      x: 100,
      y: 100,
      ...size,
      device: 'iphone-x',
      name: 'f',
      statusBar: true,
      keyboard: false,
      orientation: 'portrait',
    };
    const doc = createEmptyBoard('wireframe', [frame]);
    const inside = make('overlay', { x: 300, y: 300 }, undefined, doc).element;
    expect(inside).toMatchObject({ x: 112, y: 112, w: 375, h: 812, containerId: 'f' });
    const outside = make('overlay', { x: 5000, y: 5000 }, undefined, doc).element;
    expect(outside).toMatchObject({ w: 360, h: 400 });
  });

  it('creates vertical lines with swapped box', () => {
    expect(make('divider').element).toMatchObject({ w: 240, h: 4 });
  });
});

describe('lineBox (L / D)', () => {
  const start = { x: 100, y: 100 };
  it('click creates a 160 px horizontal line centred on the point; Shift makes it vertical', () => {
    expect(lineBox({ start, end: start, flip: false, full: false })).toEqual({
      direction: 'h',
      rect: { x: 20, y: 98, w: 160, h: LINE_THICKNESS },
    });
    expect(lineBox({ start, end: start, flip: true, full: false })).toEqual({
      direction: 'v',
      rect: { x: 98, y: 20, w: LINE_THICKNESS, h: 160 },
    });
  });

  it('follows the dominant drag axis', () => {
    expect(lineBox({ start, end: { x: 300, y: 110 }, flip: false, full: false })).toEqual({
      direction: 'h',
      rect: { x: 100, y: 98, w: 200, h: 4 },
    });
    expect(lineBox({ start, end: { x: 40, y: 105 }, flip: false, full: false }).rect).toEqual({
      x: 40,
      y: 98,
      w: 60,
      h: 4,
    });
    expect(lineBox({ start, end: { x: 110, y: 250 }, flip: false, full: false })).toEqual({
      direction: 'v',
      rect: { x: 98, y: 100, w: 4, h: 150 },
    });
    expect(lineBox({ start, end: { x: 105, y: 10 }, flip: false, full: false }).rect).toEqual({
      x: 98,
      y: 10,
      w: 4,
      h: 90,
    });
  });

  it('Shift flips the direction of a drag', () => {
    expect(lineBox({ start, end: { x: 300, y: 110 }, flip: true, full: false })).toEqual({
      direction: 'v',
      rect: { x: 98, y: 100, w: 4, h: 200 },
    });
  });

  it('Cmd spans the whole span (frame screen or view)', () => {
    const span = { x: 0, y: 0, w: 390, h: 844 };
    expect(lineBox({ start, end: { x: 150, y: 100 }, flip: false, full: true, span })).toEqual({
      direction: 'h',
      rect: { x: 0, y: 98, w: 390, h: 4 },
    });
    expect(lineBox({ start, end: { x: 100, y: 200 }, flip: false, full: true, span })).toEqual({
      direction: 'v',
      rect: { x: 98, y: 0, w: 4, h: 844 },
    });
    // Without a span, Cmd is ignored.
    expect(lineBox({ start, end: { x: 150, y: 100 }, flip: false, full: true }).rect.w).toBe(50);
  });

  it('flips an existing line around its centre', () => {
    const el = { x: 0, y: 98, w: 200, h: 4, props: {} } as Pick<WireElement, 'x' | 'y' | 'w' | 'h' | 'props'>;
    expect(flipLine(el)).toEqual({ x: 98, y: 0, w: 4, h: 200, direction: 'v' });
    expect(flipLine({ ...el, props: { direction: 'v' } }).direction).toBe('h');
  });
});

describe('constrainResize', () => {
  const prev = { x: 0, y: 0, w: 96, h: 32 };
  const base = (component: WireElement['component'], extra: Partial<WireElement> = {}) => {
    const entry = entryOf(component);
    return { component, size: 'M' as const, state: 'default', props: entry.props(t), ...extra };
  };

  it('keeps the row height of buttons and inputs', () => {
    expect(constrainResize(base('button'), { x: 0, y: 0, w: 200, h: 90 }, prev)).toEqual({ x: 0, y: 0, w: 200, h: 32 });
    expect(constrainResize(base('input', { size: 'L' }), { x: 0, y: 0, w: 200, h: 10 }, { ...prev, h: 40 }).h).toBe(40);
  });

  it('keeps open dropdowns tall', () => {
    expect(constrainResize(base('dropdown', { state: 'open' }), { x: 0, y: 0, w: 220, h: 50 }, prev).h).toBe(96);
  });

  it('keeps avatars square and lines thin', () => {
    expect(constrainResize(base('avatar'), { x: 0, y: 0, w: 60, h: 40 }, prev)).toMatchObject({ w: 60, h: 60 });
    expect(constrainResize(base('line'), { x: 0, y: 0, w: 300, h: 40 }, { x: 0, y: 0, w: 160, h: 4 })).toMatchObject({
      w: 300,
      h: 4,
    });
    expect(
      constrainResize(
        base('divider', { props: { direction: 'v' } }),
        { x: 0, y: 0, w: 40, h: 300 },
        { x: 0, y: 0, w: 4, h: 100 },
      ),
    ).toMatchObject({ w: 4, h: 300 });
  });

  it('lets free components resize freely but never below the minimum', () => {
    expect(constrainResize(base('rectangle'), { x: 5, y: 6, w: 1, h: 2 }, prev)).toEqual({ x: 5, y: 6, w: 8, h: 8 });
    expect(constrainResize(base('image'), { x: 0, y: 0, w: 300, h: 200 }, prev)).toEqual({
      x: 0,
      y: 0,
      w: 300,
      h: 200,
    });
  });
});

describe('autoWidthTargets', () => {
  const button = (over: Partial<WireElement> = {}): WireElement => ({
    id: 'b',
    type: 'wire',
    component: 'button',
    x: 0,
    y: 0,
    w: 96,
    h: 32,
    size: 'M',
    state: 'default',
    text: { blocks: [{ type: 'p', spans: [{ text: 'Go' }] }] },
    textSize: 'm',
    props: { variant: 'solid', autoWidth: true },
    ...over,
  });
  const measure = (el: WireElement) => plainText(el.text).length * 8;

  it('recomputes the width when the label changes and for new elements', () => {
    const before = createEmptyBoard('wireframe', [button()]);
    const edited = produce(before, (d) => {
      (d.elements[0] as WireElement).text = { blocks: [{ type: 'p', spans: [{ text: 'Press me please' }] }] };
    });
    const targets = autoWidthTargets(edited, before, measure);
    expect(targets.get('b')).toBe(Math.ceil((15 * 8 + 32) / 4) * 4);
    // A new element is measured too.
    expect(autoWidthTargets(before, createEmptyBoard('wireframe'), measure).has('b')).toBe(true);
  });

  it('ignores moves, manual widths and untouched elements', () => {
    const before = createEmptyBoard('wireframe', [button({ w: 50 })]);
    const moved = produce(before, (d) => {
      (d.elements[0] as WireElement).x = 40;
    });
    expect(autoWidthTargets(moved, before, measure).size).toBe(0);
    const manual = createEmptyBoard('wireframe', [button({ props: { autoWidth: false } })]);
    expect(autoWidthTargets(manual, createEmptyBoard('wireframe'), measure).size).toBe(0);
    expect(autoWidthTargets(before, before, measure).size).toBe(0);
  });

  it('reacts to size and icon changes', () => {
    const before = createEmptyBoard('wireframe', [button({ w: 56 })]);
    const larger = produce(before, (d) => {
      (d.elements[0] as WireElement).size = 'L';
    });
    expect(autoWidthTargets(larger, before, measure).has('b')).toBe(true);
    const icon = produce(before, (d) => {
      (d.elements[0] as WireElement).props['icon'] = 'star';
    });
    expect(autoWidthTargets(icon, before, measure).has('b')).toBe(true);
  });
});

describe('frames and annotations', () => {
  it('creates a frame of the device size centred on the click, or of the dragged size', () => {
    const f = createFrame({ id: 'f', device: 'iphone-14', at: { x: 500, y: 500 }, t });
    expect(f).toMatchObject({
      w: 414,
      h: 868,
      x: 293,
      y: 66,
      statusBar: true,
      keyboard: false,
      name: '~frames.iphone-14',
    });
    const dragged = createFrame({
      id: 'g',
      device: 'plain',
      at: { x: 0, y: 0 },
      rect: { x: 10, y: 10, w: 300, h: 200 },
      t,
    });
    expect(dragged).toMatchObject({ x: 10, y: 10, w: 300, h: 200, statusBar: false });
    expect(createFrame({ id: 'h', device: 'desktop', at: { x: 0, y: 0 }, t }).statusBar).toBe(false);
  });

  it('inserts a frame behind loose elements and adopts those it contains', () => {
    const loose: BoardElement = make('rectangle', { x: 200, y: 150 }).element;
    const far: BoardElement = { ...make('circle', { x: 5000, y: 5000 }).element, id: 'far' };
    const doc = createEmptyBoard('wireframe', [loose, far]);
    const frame = createFrame({
      id: 'f',
      device: 'plain',
      at: { x: 100, y: 100 },
      rect: { x: 0, y: 0, w: 400, h: 300 },
      t,
    });
    const next = produce(doc, (d) => insertFrame(d, frame, frameInsertIndex(d)));
    expect(next.elements.map((e) => e.id)).toEqual(['f', loose.id, 'far']);
    expect(next.elements[1]!.containerId).toBe('f');
    expect(next.elements[2]!.containerId).toBeUndefined();
  });

  it('names frames from edited rich text', () => {
    expect(frameNameFromText({ blocks: [{ type: 'p', spans: [{ text: '  Login   screen ' }] }] })).toBe('Login screen');
  });

  it('creates numbered annotations and renumbers on demand', () => {
    const a = createAnnotation({ id: 'a1', at: { x: 100, y: 100 }, t, number: 3 });
    expect(a).toMatchObject({ number: 3, autoNumber: true, outline: false, color: 'purple', w: 168, h: 48 });
    expect(plainText(a.text)).toBe('~defaults.annotation');
    expect(
      createAnnotation({
        id: 'a2',
        at: { x: 0, y: 0 },
        t,
        number: 1,
        style: { color: 'green', outline: true, autoNumber: false },
      }),
    ).toMatchObject({ color: 'green', outline: true, autoNumber: false });

    const doc = createEmptyBoard('wireframe', [
      { ...a, id: 'x', number: 9 },
      { ...a, id: 'y', autoNumber: false, number: undefined },
      { ...a, id: 'z', number: 4 },
    ]);
    const next = produce(doc, (d) => renumberAnnotations(d));
    expect(next.elements.map((e) => (e.type === 'annotation' ? e.number : null))).toEqual([1, undefined, 2]);
    expect(next.settings.nextAnnotationNumber).toBe(3);
  });

  it('pads table cells to rows x columns', () => {
    expect(tableCells({ rows: 2, cols: 3, cells: [['a'], ['b', 'c', 'd', 'e']] })).toEqual([
      ['a', '', ''],
      ['b', 'c', 'd'],
    ]);
    expect(tableCells({})).toHaveLength(3);
  });
});
