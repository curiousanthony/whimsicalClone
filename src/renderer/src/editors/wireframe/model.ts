/**
 * Pure model helpers of the wireframe module: element factories, resize constraints,
 * auto-width, line geometry, annotation numbering. No React, no DOM; everything that needs
 * i18n takes a translator so it can be unit tested.
 */

import { emptyRichText, plainText, richTextFromPlain } from '@renderer/core/richText';
import type {
  AnnotationElement,
  BoardDocument,
  BoardElement,
  ColorRef,
  FrameElement,
  Point,
  Rect,
  StylePreset,
  TextSize,
  WireComponentKind,
  WireElement,
} from '@renderer/core/types';
import { adoptableIds, containerFor, defaultFrameSize, frameAtPoint, overlayRectFor, specOf } from './frames';
import {
  autoWidthFor,
  buildProps,
  dropdownHeight,
  entryOf,
  launcherEntry,
  numberProp,
  stringArrayProp,
  type Translate,
  type WireSize,
} from './registry';

/** Wireframe elements are 1 px snapped, but default boxes keep whole numbers. */
const round = Math.round;

export const MIN_SIZE = 8;
/** Thickness of lines and dividers (Whimsical avoids 1 px lines). */
export const LINE_THICKNESS = 4;
export const DEFAULT_LINE_LENGTH = 160;

export function isSize(v: unknown): v is WireSize {
  return v === 'S' || v === 'M' || v === 'L';
}

/* ------------------------------------------------------------------------------------------
 * Wire components
 * ---------------------------------------------------------------------------------------- */

export interface CreateWireOptions {
  id: string;
  /** Launcher entry id (equals a component kind except for presets such as "outlineButton"). */
  entryId: string;
  /** Click point (centre of the new element) or the start of a drag. */
  at: Point;
  /** Dragged rectangle; sized controls take its width and keep their row height. */
  rect?: Rect;
  t: Translate;
  /** Remembered / default style of this component (see styleKeyOf: "wire:button"). */
  style?: StylePreset;
  doc?: BoardDocument;
}

/** Box of a new component for a click or a drag. */
export function wireBox(
  kind: WireComponentKind,
  size: WireSize,
  state: string,
  props: Record<string, unknown>,
  at: Point,
  rect?: Rect,
): Rect {
  const entry = entryOf(kind);
  const base = entry.sizes[size];
  let h = base.h;
  if (kind === 'dropdown') h = dropdownHeight(size, state, stringArrayProp(props as never, 'options').length);
  if (rect && rect.w >= MIN_SIZE) {
    if (fixedHeightFor(kind, size, h, props)) return { x: round(rect.x), y: round(rect.y), w: round(rect.w), h };
    return { x: round(rect.x), y: round(rect.y), w: round(rect.w), h: Math.max(MIN_SIZE, round(rect.h)) };
  }
  let w = base.w;
  let height = h;
  if (props['direction'] === 'v') {
    w = h;
    height = base.w;
  }
  return { x: round(at.x - w / 2), y: round(at.y - height / 2), w, h: height };
}

export function createWire(opts: CreateWireOptions): { element: WireElement; containerId?: string } {
  const launcher = launcherEntry(opts.entryId);
  const kind: WireComponentKind = launcher?.kind ?? (opts.entryId as WireComponentKind);
  const entry = entryOf(kind);
  const style = opts.style ?? {};
  const size: WireSize = isSize(style['size']) ? style['size'] : 'M';
  const props = buildProps(kind, opts.t, launcher?.props);
  const state = entry.defaultState;
  let box = wireBox(kind, size, state, props, opts.at, opts.rect);
  if (opts.rect && opts.rect.w >= MIN_SIZE && entry.autoWidth) props['autoWidth'] = false;

  // Overlays fit the screen of the frame they are dropped on.
  if (kind === 'overlay' && opts.doc) {
    const frame = frameAtPoint(opts.doc, opts.at.x, opts.at.y);
    if (frame) box = overlayRectFor(frame);
  }

  const textSize: TextSize = (style['textSize'] as TextSize | undefined) ?? entry.textSizes[size];
  const color = typeof style['color'] === 'string' ? (style['color'] as ColorRef) : undefined;
  const element: WireElement = {
    id: opts.id,
    type: 'wire',
    component: kind,
    ...box,
    size,
    state,
    ...(color ? { color } : {}),
    text: entry.defaultTextKey ? richTextFromPlain(opts.t(entry.defaultTextKey)) : emptyRichText(),
    textSize,
    props,
  };
  const containerId = opts.doc ? containerFor(opts.doc, box) : undefined;
  if (containerId) element.containerId = containerId;
  return { element, containerId };
}

/* ------------------------------------------------------------------------------------------
 * Resizing constraints
 * ---------------------------------------------------------------------------------------- */

/** Components whose height follows their size / kind (the S/M/L control, not the drag). */
const FIXED_HEIGHT: ReadonlySet<WireComponentKind> = new Set<WireComponentKind>([
  'button',
  'link',
  'input',
  'dropdown',
  'checkbox',
  'radio',
  'toggle',
  'slider',
  'progressBar',
  'stars',
  'heading',
  'tag',
  'mobileTabs',
  'horizontalTabs',
]);

function fixedHeightFor(kind: WireComponentKind, _size: WireSize, _h: number, props: Record<string, unknown>): boolean {
  if (kind === 'divider' || kind === 'line') return props['direction'] !== 'v';
  return FIXED_HEIGHT.has(kind);
}

/** Natural height of a fixed-height component. */
export function naturalHeight(el: Pick<WireElement, 'component' | 'size' | 'state' | 'props'>): number {
  const entry = entryOf(el.component);
  if (el.component === 'dropdown')
    return dropdownHeight(el.size, el.state, stringArrayProp(el.props, 'options').length);
  if (el.component === 'divider' || el.component === 'line') return LINE_THICKNESS;
  return entry.sizes[el.size].h;
}

/**
 * Applies the resize rules of a component to a requested box: fixed-height controls keep
 * their row height, lines keep their thickness, avatars stay square.
 */
export function constrainResize(
  el: Pick<WireElement, 'component' | 'size' | 'state' | 'props'>,
  next: Rect,
  prev: Rect,
): Rect {
  const kind = el.component;
  const out: Rect = { x: next.x, y: next.y, w: Math.max(MIN_SIZE, next.w), h: Math.max(MIN_SIZE, next.h) };
  if (kind === 'avatar' || kind === 'circle') {
    if (kind === 'avatar') {
      const s = Math.max(MIN_SIZE, Math.max(next.w, next.h));
      return { x: next.x, y: next.y, w: s, h: s };
    }
    return out;
  }
  if ((kind === 'divider' || kind === 'line') && el.props['direction'] === 'v') {
    return { x: prev.x + (prev.w - LINE_THICKNESS) / 2, y: next.y, w: LINE_THICKNESS, h: out.h };
  }
  if (fixedHeightFor(kind, el.size, 0, el.props)) {
    const h = naturalHeight(el);
    return { x: next.x, y: round(prev.y + (prev.h - h) / 2), w: out.w, h };
  }
  return out;
}

/* ------------------------------------------------------------------------------------------
 * Auto width (buttons, links, tags)
 * ---------------------------------------------------------------------------------------- */

export function hasIcon(el: Pick<WireElement, 'props'>): boolean {
  return typeof el.props['icon'] === 'string' && el.props['icon'] !== '';
}

function sameLabel(a: WireElement, b: WireElement): boolean {
  return (
    a.text === b.text &&
    a.size === b.size &&
    a.textSize === b.textSize &&
    a.props['icon'] === b.props['icon'] &&
    a.props['autoWidth'] === b.props['autoWidth'] &&
    a.component === b.component
  );
}

/**
 * Widths to apply after a change: auto-width components whose label, size or icon changed
 * (or that are new). `measure` returns the label width in px.
 */
export function autoWidthTargets(
  next: BoardDocument,
  previous: BoardDocument,
  measure: (el: WireElement) => number,
): Map<string, number> {
  const prevById = new Map<string, BoardElement>();
  for (const el of previous.elements) prevById.set(el.id, el);
  const out = new Map<string, number>();
  for (const el of next.elements) {
    if (el.type !== 'wire') continue;
    const entry = entryOf(el.component);
    if (!entry?.autoWidth || el.props['autoWidth'] === false) continue;
    const before = prevById.get(el.id);
    if (before === el) continue;
    if (before && before.type === 'wire' && sameLabel(before, el)) continue;
    const w = autoWidthFor(el.component, el.size, measure(el), hasIcon(el));
    if (Math.abs(w - el.w) > 0.5) out.set(el.id, w);
  }
  return out;
}

/* ------------------------------------------------------------------------------------------
 * Lines (L / D)
 * ---------------------------------------------------------------------------------------- */

export interface LineDragOptions {
  start: Point;
  end: Point;
  /** Shift held: flips the direction (Whimsical: hold Shift to change line direction). */
  flip: boolean;
  /** Cmd held: full width / height of the frame screen (or of `view`). */
  full: boolean;
  /** Area spanned by a full-size line: the frame screen under the start point. */
  span?: Rect;
}

export type LineDirection = 'h' | 'v';

/** Box and direction of a line created by a click or a drag. */
export function lineBox(opts: LineDragOptions): { rect: Rect; direction: LineDirection } {
  const { start, end } = opts;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dragged = Math.hypot(dx, dy) >= 4;
  let direction: LineDirection = !dragged || Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
  if (opts.flip) direction = direction === 'h' ? 'v' : 'h';
  const half = LINE_THICKNESS / 2;
  if (opts.full && opts.span) {
    const s = opts.span;
    return direction === 'h'
      ? { direction, rect: { x: s.x, y: round(start.y - half), w: s.w, h: LINE_THICKNESS } }
      : { direction, rect: { x: round(start.x - half), y: s.y, w: LINE_THICKNESS, h: s.h } };
  }
  if (!dragged) {
    return direction === 'h'
      ? {
          direction,
          rect: {
            x: round(start.x - DEFAULT_LINE_LENGTH / 2),
            y: round(start.y - half),
            w: DEFAULT_LINE_LENGTH,
            h: LINE_THICKNESS,
          },
        }
      : {
          direction,
          rect: {
            x: round(start.x - half),
            y: round(start.y - DEFAULT_LINE_LENGTH / 2),
            w: LINE_THICKNESS,
            h: DEFAULT_LINE_LENGTH,
          },
        };
  }
  // The length is the larger travel on either axis, so Shift on a horizontal drag yields a
  // vertical line as long as the drag, extending the way the pointer moved.
  const dominant = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  const len = round(Math.max(MIN_SIZE, Math.abs(dominant)));
  const forward = dominant >= 0;
  if (direction === 'h') {
    const x0 = forward ? start.x : start.x - len;
    return { direction, rect: { x: round(x0), y: round(start.y - half), w: len, h: LINE_THICKNESS } };
  }
  const y0 = forward ? start.y : start.y - len;
  return { direction, rect: { x: round(start.x - half), y: round(y0), w: LINE_THICKNESS, h: len } };
}

/** Swaps a line / divider between horizontal and vertical around its centre. */
export function flipLine(el: Pick<WireElement, 'x' | 'y' | 'w' | 'h' | 'props'>): {
  x: number;
  y: number;
  w: number;
  h: number;
  direction: LineDirection;
} {
  const direction: LineDirection = el.props['direction'] === 'v' ? 'h' : 'v';
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const w = el.h;
  const h = el.w;
  return { x: round(cx - w / 2), y: round(cy - h / 2), w, h, direction };
}

/* ------------------------------------------------------------------------------------------
 * Frames
 * ---------------------------------------------------------------------------------------- */

export interface CreateFrameOptions {
  id: string;
  device: FrameElement['device'];
  at: Point;
  rect?: Rect;
  t: Translate;
}

export function createFrame(opts: CreateFrameOptions): FrameElement {
  const spec = specOf(opts.device);
  const size = defaultFrameSize(opts.device);
  const dragged = opts.rect && opts.rect.w >= 40 && opts.rect.h >= 40;
  const box: Rect = dragged
    ? { x: round(opts.rect!.x), y: round(opts.rect!.y), w: round(opts.rect!.w), h: round(opts.rect!.h) }
    : { x: round(opts.at.x - size.w / 2), y: round(opts.at.y - size.h / 2), w: size.w, h: size.h };
  return {
    id: opts.id,
    type: 'frame',
    ...box,
    device: opts.device,
    name: opts.t(`frames.${opts.device}`),
    statusBar: spec.statusBar > 0,
    keyboard: false,
    orientation: 'portrait',
  };
}

export function framePlainName(frame: FrameElement): string {
  return frame.name;
}

export function frameText(frame: FrameElement) {
  return richTextFromPlain(frame.name);
}

export function frameNameFromText(text: Parameters<typeof plainText>[0]): string {
  return plainText(text).replace(/\s+/g, ' ').trim();
}

/** Adds a frame behind everything else and adopts the elements it fully contains. */
export function insertFrame(doc: BoardDocument, frame: FrameElement, index: number): void {
  const adopt = adoptableIds(doc, frame, new Set([frame.id]));
  doc.elements.splice(index, 0, frame as never);
  const set = new Set(adopt);
  for (const el of doc.elements) if (set.has(el.id)) el.containerId = frame.id;
}

/* ------------------------------------------------------------------------------------------
 * Annotations
 * ---------------------------------------------------------------------------------------- */

export const ANNOTATION_SIZE = { w: 168, h: 48 } as const;

export interface CreateAnnotationOptions {
  id: string;
  at: Point;
  rect?: Rect;
  t: Translate;
  number: number;
  style?: StylePreset;
}

export function createAnnotation(opts: CreateAnnotationOptions): AnnotationElement {
  const dragged = opts.rect && opts.rect.w >= 40 && opts.rect.h >= 24;
  const box: Rect = dragged
    ? { x: round(opts.rect!.x), y: round(opts.rect!.y), w: round(opts.rect!.w), h: round(opts.rect!.h) }
    : { x: round(opts.at.x - ANNOTATION_SIZE.w / 2), y: round(opts.at.y - ANNOTATION_SIZE.h / 2), ...ANNOTATION_SIZE };
  const color = typeof opts.style?.['color'] === 'string' ? (opts.style['color'] as ColorRef) : 'purple';
  return {
    id: opts.id,
    type: 'annotation',
    ...box,
    color,
    text: richTextFromPlain(opts.t('defaults.annotation')),
    autoNumber: opts.style?.['autoNumber'] !== false,
    number: opts.number,
    outline: opts.style?.['outline'] === true,
  };
}

/** Renumbers auto-numbered annotations 1..n in z-order and updates the board counter. */
export function renumberAnnotations(doc: BoardDocument): void {
  let n = 1;
  for (const el of doc.elements) {
    if (el.type === 'annotation' && el.autoNumber) el.number = n++;
  }
  doc.settings.nextAnnotationNumber = n;
}

/* ------------------------------------------------------------------------------------------
 * Misc
 * ---------------------------------------------------------------------------------------- */

/** Default content of a table component (rows x cols of text). */
export function tableCells(props: Record<string, unknown>): string[][] {
  const cols = Math.max(1, numberProp(props as never, 'cols', 3));
  const rows = Math.max(1, numberProp(props as never, 'rows', 3));
  const raw = props['cells'];
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = Array.isArray(raw) && Array.isArray(raw[r]) ? (raw[r] as unknown[])[c] : '';
      row.push(typeof cell === 'string' ? cell : '');
    }
    grid.push(row);
  }
  return grid;
}

/** Table box height follows the row count (24 px rows). */
export const TABLE_ROW_HEIGHT = 32;
