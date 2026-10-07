/**
 * Shape catalogue and pure helpers (owner: flowchart): per-kind metadata, element factory,
 * content layout (text box + optional icon), auto-height and the document normaliser.
 */

import { produce, type Draft } from 'immer';
import { DEFAULT_COLORS } from '@renderer/core/palette';
import { emptyRichText, isRichTextEmpty } from '@renderer/core/richText';
import type {
  BoardDocument,
  BoardElement,
  ColorRef,
  FillStyle,
  Rect,
  ShapeElement,
  ShapeKind,
  Size,
  StylePreset,
  TextAlign,
  TextSize,
  VerticalAlign,
} from '@renderer/core/types';
import { measureRichText } from '@renderer/canvas';
import { newSeed, shapeGeometry } from './shapeGeometry';

export const GRID = 12;

/** Order used by the shapes menu and the toolbar flyout. */
export const SHAPE_KINDS: readonly ShapeKind[] = [
  'rectangle',
  'pill',
  'oval',
  'diamond',
  'parallelogram',
  'parallelogramFlipped',
  'trapezoid',
  'triangle',
  'hexagon',
  'cylinder',
  'actor',
  'line',
  'bracket',
  'cloud',
  'star',
  'cross',
];

export interface ShapeSpec {
  kind: ShapeKind;
  /** lucide-react icon (toolbar flyout, menus, command menu). */
  icon: string;
  defaultSize: Size;
  /** Auto-height never shrinks the shape below this height. */
  minHeight: number;
  /** Shows typed text in the normal state (line, bracket and cross are text-less). */
  hasText: boolean;
  /** Randomised outline (cloud, star). */
  seeded?: boolean;
}

export const SHAPE_SPECS: Record<ShapeKind, ShapeSpec> = {
  rectangle: { kind: 'rectangle', icon: 'Square', defaultSize: { w: 168, h: 72 }, minHeight: 72, hasText: true },
  pill: { kind: 'pill', icon: 'RectangleHorizontal', defaultSize: { w: 168, h: 72 }, minHeight: 72, hasText: true },
  oval: { kind: 'oval', icon: 'Circle', defaultSize: { w: 144, h: 96 }, minHeight: 96, hasText: true },
  diamond: { kind: 'diamond', icon: 'Diamond', defaultSize: { w: 156, h: 108 }, minHeight: 108, hasText: true },
  parallelogram: { kind: 'parallelogram', icon: 'Box', defaultSize: { w: 168, h: 72 }, minHeight: 72, hasText: true },
  parallelogramFlipped: { kind: 'parallelogramFlipped', icon: 'FlipHorizontal2', defaultSize: { w: 168, h: 72 }, minHeight: 72, hasText: true },
  trapezoid: { kind: 'trapezoid', icon: 'Pentagon', defaultSize: { w: 168, h: 72 }, minHeight: 72, hasText: true },
  triangle: { kind: 'triangle', icon: 'Triangle', defaultSize: { w: 132, h: 108 }, minHeight: 108, hasText: true },
  hexagon: { kind: 'hexagon', icon: 'Hexagon', defaultSize: { w: 156, h: 84 }, minHeight: 84, hasText: true },
  cylinder: { kind: 'cylinder', icon: 'Cylinder', defaultSize: { w: 108, h: 120 }, minHeight: 120, hasText: true },
  actor: { kind: 'actor', icon: 'PersonStanding', defaultSize: { w: 60, h: 108 }, minHeight: 108, hasText: true },
  line: { kind: 'line', icon: 'Minus', defaultSize: { w: 168, h: 12 }, minHeight: 12, hasText: false },
  bracket: { kind: 'bracket', icon: 'Brackets', defaultSize: { w: 24, h: 120 }, minHeight: 24, hasText: false },
  cloud: { kind: 'cloud', icon: 'Cloud', defaultSize: { w: 168, h: 108 }, minHeight: 108, hasText: true, seeded: true },
  star: { kind: 'star', icon: 'Star', defaultSize: { w: 120, h: 120 }, minHeight: 120, hasText: true, seeded: true },
  cross: { kind: 'cross', icon: 'X', defaultSize: { w: 84, h: 84 }, minHeight: 84, hasText: false },
};

/** Style properties tracked by default / last-used / paste style. */
export const SHAPE_STYLE_PROPS = ['color', 'fillStyle', 'textSize', 'textAlign', 'verticalAlign', 'dashed'] as const;

export const FILL_STYLES: readonly FillStyle[] = ['fill', 'border', 'dashed', 'none'];
export const TEXT_SIZES: readonly TextSize[] = ['xs', 's', 'm', 'l', 'xl', 'xxl'];

/** Style key shared with the canvas engine (styleKeyOf): "shape:<kind>". */
export const shapeStyleKey = (kind: ShapeKind): string => `shape:${kind}`;
/** Style shared by every diagram shape: new shapes follow the last one styled. */
export const SHARED_STYLE_KEY = 'shape';

export interface ShapeStyleSource {
  getStyleFor(key: string): StylePreset | undefined;
}

/** Style precedence for a new shape: per-kind default/last-used > shared last-used > defaults. */
export function resolveShapeStyle(source: ShapeStyleSource, kind: ShapeKind): Partial<ShapeElement> {
  const own = source.getStyleFor(shapeStyleKey(kind));
  const shared = source.getStyleFor(SHARED_STYLE_KEY);
  const pick = (preset: StylePreset | undefined): Partial<ShapeElement> => {
    const out: Record<string, unknown> = {};
    if (!preset) return out as Partial<ShapeElement>;
    for (const p of SHAPE_STYLE_PROPS) if (preset[p] !== undefined) out[p] = preset[p];
    return out as Partial<ShapeElement>;
  };
  // Line has no fill; never inherit a fill style from other kinds.
  const sharedStyle = pick(shared);
  if (kind === 'line' || kind === 'bracket') delete sharedStyle.fillStyle;
  return { ...sharedStyle, ...pick(own) };
}

export interface CreateShapeOptions {
  id: string;
  kind: ShapeKind;
  /** Centre of the new shape when no rect is given. */
  at: { x: number; y: number };
  rect?: Rect;
  style?: Partial<ShapeElement>;
}

export function createShape({ id, kind, at, rect, style }: CreateShapeOptions): ShapeElement {
  const spec = SHAPE_SPECS[kind];
  const w = rect ? Math.max(GRID, rect.w) : spec.defaultSize.w;
  const h = rect ? Math.max(spec.kind === 'line' ? 1 : GRID, rect.h) : spec.defaultSize.h;
  const x = rect ? rect.x : snapTo(at.x - w / 2);
  const y = rect ? rect.y : snapTo(at.y - h / 2);
  const shape: ShapeElement = {
    id,
    type: 'shape',
    kind,
    x,
    y,
    w,
    h,
    color: kind === 'line' || kind === 'bracket' ? 'slate' : DEFAULT_COLORS.shape,
    fillStyle: kind === 'line' || kind === 'bracket' ? 'border' : kind === 'actor' ? 'border' : 'fill',
    text: emptyRichText(),
    textSize: 'm',
    textAlign: 'center',
    verticalAlign: 'middle',
    autoHeight: !rect && spec.hasText,
    ...(spec.seeded ? { seed: newSeed() } : {}),
    ...style,
  };
  return shape;
}

function snapTo(v: number): number {
  return Math.round(v / GRID) * GRID;
}

/* ------------------------------------------------------------------------------------------
 * Content layout (text box + optional icon)
 * ---------------------------------------------------------------------------------------- */

export const ICON_SIZE = 24;
const ICON_GAP = 6;

export interface ContentLayout {
  text: Rect;
  icon?: Rect;
}

export function contentLayout(shape: Pick<ShapeElement, 'kind' | 'w' | 'h' | 'icon' | 'seed'>): ContentLayout {
  const g = shapeGeometry(shape.kind, shape.w, shape.h, shape.seed);
  const tb = g.textBox;
  if (!shape.icon) return { text: tb };
  switch (shape.icon.placement) {
    case 'top': {
      const used = ICON_SIZE + ICON_GAP;
      return {
        icon: { x: tb.x + (tb.w - ICON_SIZE) / 2, y: tb.y, w: ICON_SIZE, h: ICON_SIZE },
        text: { x: tb.x, y: tb.y + used, w: tb.w, h: Math.max(1, tb.h - used) },
      };
    }
    case 'left':
      return {
        icon: { x: tb.x, y: tb.y + (tb.h - ICON_SIZE) / 2, w: ICON_SIZE, h: ICON_SIZE },
        text: { x: tb.x + ICON_SIZE + ICON_GAP, y: tb.y, w: Math.max(1, tb.w - ICON_SIZE - ICON_GAP), h: tb.h },
      };
    case 'right':
      return {
        icon: { x: tb.x + tb.w - ICON_SIZE, y: tb.y + (tb.h - ICON_SIZE) / 2, w: ICON_SIZE, h: ICON_SIZE },
        text: { x: tb.x, y: tb.y, w: Math.max(1, tb.w - ICON_SIZE - ICON_GAP), h: tb.h },
      };
  }
}

/** kebab-case lucide name ("circle-user-round") to the PascalCase export name. */
export function kebabToPascal(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/* ------------------------------------------------------------------------------------------
 * Auto height: shapes grow downward to fit their text unless the user set a height.
 * ---------------------------------------------------------------------------------------- */

/** Height needed so the text (and icon) fits the shape's text box; snapped up to the grid. */
export function fittedHeight(shape: ShapeElement): number {
  const spec = SHAPE_SPECS[shape.kind];
  if (!spec.hasText) return shape.h;
  const empty = isRichTextEmpty(shape.text);
  const extraTop = shape.icon?.placement === 'top' ? ICON_SIZE + ICON_GAP : 0;
  const side = shape.icon && shape.icon.placement !== 'top' ? ICON_SIZE : 0;
  const textHeight = empty ? 0 : measureRichText(shape.text, { textSize: shape.textSize }, contentLayout(shape).text.w).h;
  const needed = Math.max(textHeight, side) + extraTop;
  let h = spec.minHeight;
  // The text box height is monotonic in h: grow until it holds the content.
  for (let i = 0; i < 12; i++) {
    const available = shapeGeometry(shape.kind, shape.w, h, shape.seed).textBox.h;
    if (available >= needed) break;
    const probe = shapeGeometry(shape.kind, shape.w, h + GRID, shape.seed).textBox.h - available;
    const slope = Math.max(probe / GRID, 0.2);
    h += Math.ceil((needed - available) / slope);
  }
  return Math.max(spec.minHeight, Math.ceil(h / GRID) * GRID);
}

/** True when a change to `next` (vs `prev`) can alter the auto height. */
function needsFit(next: ShapeElement, prev: BoardElement | undefined): boolean {
  if (!prev || prev.type !== 'shape') return true;
  return (
    prev.text !== next.text ||
    prev.textSize !== next.textSize ||
    prev.w !== next.w ||
    prev.kind !== next.kind ||
    prev.icon !== next.icon ||
    prev.autoHeight !== next.autoHeight
  );
}

/**
 * Plugin normaliser: refits auto-height shapes whose content changed. Returns `next` itself
 * when nothing changed (so the engine keeps reference equality).
 */
export function fitAutoHeights(next: BoardDocument, prev: BoardDocument): BoardDocument {
  if (next.elements === prev.elements) return next;
  let prevById: Map<string, BoardElement> | undefined;
  const updates: Array<{ id: string; h: number }> = [];
  for (const el of next.elements) {
    if (el.type !== 'shape' || !el.autoHeight) continue;
    if (!prevById) prevById = new Map(prev.elements.map((e) => [e.id, e]));
    const before = prevById.get(el.id);
    if (before === el) continue;
    if (!needsFit(el, before)) continue;
    const h = fittedHeight(el);
    if (h !== el.h) updates.push({ id: el.id, h });
  }
  if (updates.length === 0) return next;
  const byId = new Map(updates.map((u) => [u.id, u.h]));
  return produce(next, (d) => {
    for (const el of d.elements) {
      const h = byId.get(el.id);
      if (h !== undefined && el.type === 'shape') (el as Draft<ShapeElement>).h = h;
    }
  });
}

/* ------------------------------------------------------------------------------------------
 * Element normalisation (fills defaults for files written by older / hand-edited versions)
 * ---------------------------------------------------------------------------------------- */

export function normalizeShape(el: ShapeElement): ShapeElement {
  const spec = SHAPE_SPECS[el.kind] ?? SHAPE_SPECS.rectangle;
  const color: ColorRef = el.color ?? DEFAULT_COLORS.shape;
  const next: ShapeElement = {
    ...el,
    color,
    fillStyle: el.fillStyle ?? 'fill',
    text: el.text ?? emptyRichText(),
    textSize: el.textSize ?? 'm',
    textAlign: (el.textAlign ?? 'center') as TextAlign,
    verticalAlign: (el.verticalAlign ?? 'middle') as VerticalAlign,
    autoHeight: el.autoHeight ?? true,
  };
  if (spec.seeded && next.seed === undefined) next.seed = 1;
  return next;
}
