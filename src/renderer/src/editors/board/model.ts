/**
 * Board objects: constants, element factories and small pure helpers (no React, no DOM).
 * Everything user-visible (default names) is passed in by the caller so this file stays
 * translation-free and unit-testable.
 */

import { emptyRichText } from '@renderer/core/richText';
import type {
  CodeElement,
  ColorRef,
  IconElement,
  ImageElement,
  LinkElement,
  Rect,
  RichText,
  SectionElement,
  StickyElement,
  StylePreset,
  TableElement,
  TextAlign,
  TextElement,
  TextSize,
} from '@renderer/core/types';

/* ------------------------------------------------------------------------------------------
 * Constants
 * ---------------------------------------------------------------------------------------- */

/** Default sticky note side: 14 cells of the 12 px grid. */
export const STICKY_SIZE = 168;
export const STICKY_PADDING = 16;
/** Auto-size grows a sticky note in steps of two grid cells up to this side. */
export const STICKY_STEP = 24;
export const STICKY_MAX = 600;

export const TEXT_PADDING = 4;
export const TEXT_MIN_WIDTH = 24;
/** Auto-width text wraps once it is wider than this. */
export const TEXT_AUTO_MAX_WIDTH = 480;
export const TEXT_DEFAULT_WIDTH = 120;

export const SECTION_DEFAULT_SIZE = { w: 480, h: 336 } as const;
export const SECTION_HEADER_HEIGHT = 36;

export const TABLE_COLUMN_WIDTH = 144;
export const TABLE_ROW_HEIGHT = 48;
export const TABLE_MAX_COLUMNS = 12;
export const TABLE_MAX_ROWS = 40;
export const TABLE_MIN_COLUMN_WIDTH = 48;
export const TABLE_MIN_ROW_HEIGHT = 24;

export const CODE_DEFAULT_SIZE = { w: 480, h: 192 } as const;
export const ICON_DEFAULT_SIZE = 48;
export const LINK_CARD_SIZE = { w: 264, h: 72 } as const;
export const LINK_COMPACT_SIZE = { w: 192, h: 36 } as const;

export const TEXT_SIZES: readonly TextSize[] = ['xs', 's', 'm', 'l', 'xl', 'xxl'];
export const TEXT_ALIGNS: readonly TextAlign[] = ['left', 'center', 'right'];

export const DEFAULT_STICKY_COLOR: ColorRef = 'purple';
export const DEFAULT_TEXT_COLOR: ColorRef = 'slate';

/** Style keys used for default / last-used styles (SPEC 3.1). */
export const STYLE_KEYS = {
  sticky: 'sticky',
  text: 'text',
  section: 'section',
  icon: 'icon',
  table: 'table',
  link: 'link',
} as const;

/* ------------------------------------------------------------------------------------------
 * Factories
 * ---------------------------------------------------------------------------------------- */

function styleOf<T extends object>(style: StylePreset | undefined): Partial<T> {
  return (style ?? {}) as Partial<T>;
}

export interface StickyOptions {
  id: string;
  x: number;
  y: number;
  /** Explicit box (drag-to-create); makes the note manually sized (no auto-size). */
  rect?: Rect;
  text?: RichText;
  style?: StylePreset;
}

/**
 * New sticky note: purple, 168 x 168, auto-sizing. `style` is the default / last-used style
 * (api.getStyleFor("sticky")) so new notes follow the last colour that was picked.
 */
export function createStickyElement(options: StickyOptions): StickyElement {
  const { id, x, y, rect, text, style } = options;
  const base: StickyElement = {
    id,
    type: 'sticky',
    x: rect ? rect.x : x,
    y: rect ? rect.y : y,
    w: rect ? rect.w : STICKY_SIZE,
    h: rect ? rect.h : STICKY_SIZE,
    color: DEFAULT_STICKY_COLOR,
    text: text ?? emptyRichText(),
    textSize: 'm',
    textAlign: 'left',
    autoSize: !rect,
  };
  return { ...base, ...styleOf<StickyElement>(style), id, type: 'sticky', x: base.x, y: base.y, w: base.w, h: base.h, autoSize: base.autoSize };
}

export interface TextOptions {
  id: string;
  x: number;
  y: number;
  rect?: Rect;
  text?: RichText;
  style?: StylePreset;
}

export function createTextElement(options: TextOptions): TextElement {
  const { id, x, y, rect, text, style } = options;
  const base: TextElement = {
    id,
    type: 'text',
    x: rect ? rect.x : x,
    y: rect ? rect.y : y,
    w: rect ? rect.w : TEXT_DEFAULT_WIDTH,
    h: rect ? rect.h : 28,
    text: text ?? emptyRichText(),
    textSize: 'm',
    textAlign: 'left',
    color: DEFAULT_TEXT_COLOR,
    autoWidth: !rect,
  };
  return { ...base, ...styleOf<TextElement>(style), id, type: 'text', x: base.x, y: base.y, w: base.w, h: base.h, autoWidth: base.autoWidth };
}

export function createSectionElement(options: { id: string; x: number; y: number; rect?: Rect; name: string; style?: StylePreset }): SectionElement {
  const { id, x, y, rect, name, style } = options;
  const r = rect ?? { x, y, ...SECTION_DEFAULT_SIZE };
  const base: SectionElement = { id, type: 'section', ...r, name, color: 'gray', fill: 'outline', clip: false };
  // geometry and identity always win over a remembered style
  return { ...base, ...styleOf<SectionElement>(style), id, type: 'section', x: r.x, y: r.y, w: r.w, h: r.h, name };
}

export function createIconElement(options: { id: string; x: number; y: number; icon: string; style?: StylePreset }): IconElement {
  const { id, x, y, icon, style } = options;
  const base: IconElement = {
    id,
    type: 'icon',
    x: x - ICON_DEFAULT_SIZE / 2,
    y: y - ICON_DEFAULT_SIZE / 2,
    w: ICON_DEFAULT_SIZE,
    h: ICON_DEFAULT_SIZE,
    icon,
    color: 'slate',
  };
  return { ...base, ...styleOf<IconElement>(style), id, type: 'icon', x: base.x, y: base.y, w: base.w, h: base.h, icon };
}

export function createLinkElement(options: { id: string; x: number; y: number; url?: string; display?: LinkElement['display'] }): LinkElement {
  const display = options.display ?? 'card';
  const size = display === 'card' ? LINK_CARD_SIZE : LINK_COMPACT_SIZE;
  return { id: options.id, type: 'link', x: options.x, y: options.y, w: size.w, h: size.h, url: options.url ?? '', display };
}

export function createImageElement(options: { id: string; centre: { x: number; y: number }; url: string; width: number; height: number; maxWidth?: number }): ImageElement {
  const { id, centre, url, width, height } = options;
  const maxW = options.maxWidth ?? 480;
  const scale = width > maxW ? maxW / width : 1;
  const w = Math.max(24, Math.round(width * scale) || 240);
  const h = Math.max(24, Math.round(height * scale) || 180);
  return {
    id,
    type: 'image',
    x: Math.round(centre.x - w / 2),
    y: Math.round(centre.y - h / 2),
    w,
    h,
    src: url,
    naturalWidth: width,
    naturalHeight: height,
  };
}

export function createCodeElement(options: { id: string; x: number; y: number; rect?: Rect }): CodeElement {
  const r = options.rect ?? { x: options.x, y: options.y, ...CODE_DEFAULT_SIZE };
  return { id: options.id, type: 'code', ...r, language: 'auto', code: '' };
}

export type { TableElement };

/* ------------------------------------------------------------------------------------------
 * Links
 * ---------------------------------------------------------------------------------------- */

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const FILE_LINK = 'wc://file/';

/** Normalises what the user typed into a link: adds https:// to bare hosts. */
export function normalizeLinkUrl(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (/^localhost(:\d+)?(\/|$)/.test(value)) return `https://${value}`;
  if (SCHEME.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/|$|\?|#)/.test(value)) return `https://${value}`;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return `mailto:${value}`;
  return value;
}

export type LinkTarget = { kind: 'file'; path: string } | { kind: 'external'; url: string } | { kind: 'invalid' };

/** Where a link leads: another workspace file ("wc://file/<relPath>") or an external URL. */
export function linkTarget(url: string): LinkTarget {
  const value = url.trim();
  if (value.startsWith(FILE_LINK)) {
    const rest = value.slice(FILE_LINK.length).split('#')[0] ?? '';
    try {
      return { kind: 'file', path: decodeURI(rest) };
    } catch {
      return { kind: 'file', path: rest };
    }
  }
  if (/^(https?:|mailto:)/i.test(value)) return { kind: 'external', url: value };
  return { kind: 'invalid' };
}

/** Display title of a link: explicit title, else host, else file name. */
export function linkDisplayTitle(link: Pick<LinkElement, 'url' | 'title'>, fallback: string): string {
  if (link.title && link.title.trim()) return link.title.trim();
  const target = linkTarget(link.url);
  if (target.kind === 'file') {
    const name = target.path.split('/').pop() ?? target.path;
    return name.replace(/\.[^.]+$/, '') || name;
  }
  if (target.kind === 'external') {
    if (target.url.toLowerCase().startsWith('mailto:')) return target.url.slice(7);
    try {
      return new URL(target.url).host.replace(/^www\./, '');
    } catch {
      return target.url;
    }
  }
  return link.url.trim() || fallback;
}

/** Secondary line of a link card (full URL without scheme). */
export function linkSubtitle(url: string): string {
  const target = linkTarget(url);
  if (target.kind === 'file') return target.path;
  if (target.kind === 'external') return target.url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  return url;
}

/* ------------------------------------------------------------------------------------------
 * Icons: lucide kebab name <-> component name
 * ---------------------------------------------------------------------------------------- */

/** "circle-user-round" -> "CircleUserRound". */
export function kebabToPascal(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** "CircleUserRound" -> "circle-user-round" (digit runs get their own segment). */
export function pascalToKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/(?<!\d)([A-Za-z])(\d)/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/* ------------------------------------------------------------------------------------------
 * Element normalisation (fill defaults for hand-edited or older files). Pure.
 * ---------------------------------------------------------------------------------------- */

export function normalizeSticky(el: StickyElement): StickyElement {
  if (el.color && el.text && el.textSize && el.textAlign && typeof el.autoSize === 'boolean') return el;
  return {
    ...el,
    color: el.color ?? DEFAULT_STICKY_COLOR,
    text: el.text ?? emptyRichText(),
    textSize: el.textSize ?? 'm',
    textAlign: el.textAlign ?? 'left',
    autoSize: typeof el.autoSize === 'boolean' ? el.autoSize : true,
  };
}

export function normalizeText(el: TextElement): TextElement {
  if (el.color && el.text && el.textSize && el.textAlign && typeof el.autoWidth === 'boolean') return el;
  return {
    ...el,
    color: el.color ?? DEFAULT_TEXT_COLOR,
    text: el.text ?? emptyRichText(),
    textSize: el.textSize ?? 'm',
    textAlign: el.textAlign ?? 'left',
    autoWidth: typeof el.autoWidth === 'boolean' ? el.autoWidth : true,
  };
}

export function normalizeSection(el: SectionElement): SectionElement {
  if (typeof el.name === 'string' && el.color && el.fill && typeof el.clip === 'boolean') return el;
  return { ...el, name: el.name ?? '', color: el.color ?? 'gray', fill: el.fill ?? 'outline', clip: !!el.clip };
}

export function normalizeLink(el: LinkElement): LinkElement {
  if (typeof el.url === 'string' && el.display) return el;
  return { ...el, url: el.url ?? '', display: el.display ?? 'card' };
}

export function normalizeIcon(el: IconElement): IconElement {
  if (el.icon && el.color) return el;
  return { ...el, icon: el.icon || 'star', color: el.color ?? 'slate' };
}

export function normalizeCode(el: CodeElement): CodeElement {
  if (typeof el.code === 'string' && el.language) return el;
  return { ...el, code: el.code ?? '', language: el.language || 'auto' };
}

export function normalizeTable(el: TableElement): TableElement {
  if (el.columns && el.rows && el.cells && typeof el.headerRow === 'boolean' && el.tableStyle && el.textSize) return el;
  return {
    ...el,
    columns: el.columns ?? [],
    rows: el.rows ?? [],
    cells: el.cells ?? {},
    headerRow: el.headerRow ?? true,
    tableStyle: el.tableStyle ?? 'plain',
    textSize: el.textSize ?? 'm',
  };
}
