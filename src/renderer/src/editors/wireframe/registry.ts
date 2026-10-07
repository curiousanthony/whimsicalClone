/**
 * Data-driven wireframe component registry (research 05 section 2). One entry per
 * `WireComponentKind`, plus launcher entries (a launcher entry may preset props, e.g. the
 * outline button). The `E` launcher, the toolbar, the "All tools" menu and the creation code all
 * read this table; renderers live in `draw.tsx` and context bars in `contextBars.tsx`.
 *
 * Pure module: no React, no DOM.
 */

import type { JsonValue, Size, TextSize, WireComponentKind, WireElement } from '@renderer/core/types';

export type WireSize = WireElement['size'];

/** Translates a key of the "wireframe" namespace written without the namespace ("defaults.button"). */
export type Translate = (key: string) => string;

/** Controls offered by the component context bar (see contextBars.tsx). */
export type WireControl =
  | 'size'
  | 'state'
  | 'color'
  | 'variant'
  | 'icon'
  | 'options'
  | 'value'
  | 'textMode'
  | 'upload'
  | 'fitFrame'
  | 'pointer'
  | 'direction'
  | 'dashed';

export interface WireEntry {
  kind: WireComponentKind;
  /** lucide-react component name used by the launcher and the toolbar. */
  icon: string;
  /** Default box per size. Components without S/M/L use the same box for all three. */
  sizes: Record<WireSize, Size>;
  /** True when the S/M/L control applies (button, input, dropdown, textarea, avatar). */
  sized: boolean;
  states: readonly string[];
  defaultState: string;
  /** i18n key (namespace "wireframe") of the default text; undefined = the component has no text. */
  defaultTextKey?: string;
  /** Width follows the label (Whimsical: auto-sized buttons). */
  autoWidth?: boolean;
  /** Default text size per S/M/L (wireframe scale). */
  textSizes: Record<WireSize, TextSize>;
  /** Default props. Text content goes through `t` so it is translated when the element is created. */
  props: (t: Translate) => Record<string, JsonValue>;
  controls: readonly WireControl[];
}

const same = (w: number, h: number): Record<WireSize, Size> => ({ S: { w, h }, M: { w, h }, L: { w, h } });
const textAll = (t: TextSize): Record<WireSize, TextSize> => ({ S: t, M: t, L: t });
const SML: Record<WireSize, TextSize> = { S: 's', M: 'm', L: 'l' };
const none: WireEntry['props'] = () => ({});

/** Row height of sized controls (button, input, dropdown): multiples of the 4 px rhythm. */
export const ROW_HEIGHT: Record<WireSize, number> = { S: 24, M: 32, L: 40 };

export const WIRE_ENTRIES: Record<WireComponentKind, WireEntry> = {
  rectangle: {
    kind: 'rectangle',
    icon: 'Square',
    sizes: same(160, 96),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: none,
    controls: ['color'],
  },
  circle: {
    kind: 'circle',
    icon: 'Circle',
    sizes: same(80, 80),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: none,
    controls: ['color'],
  },
  button: {
    kind: 'button',
    icon: 'SquareMousePointer',
    sizes: { S: { w: 80, h: 24 }, M: { w: 96, h: 32 }, L: { w: 120, h: 40 } },
    sized: true,
    states: ['default', 'disabled'],
    defaultState: 'default',
    defaultTextKey: 'defaults.button',
    autoWidth: true,
    textSizes: SML,
    props: () => ({ variant: 'solid', autoWidth: true }),
    controls: ['size', 'variant', 'state', 'color', 'icon'],
  },
  link: {
    kind: 'link',
    icon: 'Link',
    sizes: same(80, 20),
    sized: false,
    states: ['default', 'disabled'],
    defaultState: 'default',
    defaultTextKey: 'defaults.link',
    autoWidth: true,
    textSizes: textAll('m'),
    props: () => ({ autoWidth: true }),
    controls: ['state', 'color'],
  },
  divider: {
    kind: 'divider',
    icon: 'SeparatorHorizontal',
    sizes: same(240, 4),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: () => ({ direction: 'h', dashed: false }),
    controls: ['color', 'dashed', 'direction'],
  },
  line: {
    kind: 'line',
    icon: 'Minus',
    sizes: same(160, 4),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: () => ({ direction: 'h', dashed: false }),
    controls: ['color', 'dashed', 'direction'],
  },
  image: {
    kind: 'image',
    icon: 'Image',
    sizes: same(160, 120),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: none,
    controls: ['upload'],
  },
  input: {
    kind: 'input',
    icon: 'TextCursorInput',
    sizes: { S: { w: 200, h: 24 }, M: { w: 240, h: 32 }, L: { w: 280, h: 40 } },
    sized: true,
    states: ['default', 'focused', 'error', 'disabled'],
    defaultState: 'default',
    defaultTextKey: 'defaults.input',
    textSizes: SML,
    props: () => ({ placeholder: true }),
    controls: ['size', 'state', 'icon'],
  },
  textarea: {
    kind: 'textarea',
    icon: 'RectangleEllipsis',
    sizes: { S: { w: 200, h: 72 }, M: { w: 240, h: 96 }, L: { w: 280, h: 128 } },
    sized: true,
    states: ['default', 'focused', 'error', 'disabled'],
    defaultState: 'default',
    defaultTextKey: 'defaults.input',
    textSizes: SML,
    props: () => ({ placeholder: true }),
    controls: ['size', 'state'],
  },
  avatar: {
    kind: 'avatar',
    icon: 'CircleUserRound',
    sizes: { S: { w: 24, h: 24 }, M: { w: 40, h: 40 }, L: { w: 64, h: 64 } },
    sized: true,
    states: ['default'],
    defaultState: 'default',
    textSizes: SML,
    props: none,
    controls: ['size', 'icon'],
  },
  checkbox: {
    kind: 'checkbox',
    icon: 'SquareCheck',
    sizes: same(140, 20),
    sized: false,
    states: ['default', 'checked', 'disabled'],
    defaultState: 'default',
    defaultTextKey: 'defaults.checkbox',
    textSizes: textAll('m'),
    props: none,
    controls: ['state', 'color'],
  },
  radio: {
    kind: 'radio',
    icon: 'CircleDot',
    sizes: same(140, 20),
    sized: false,
    states: ['default', 'selected', 'disabled'],
    defaultState: 'default',
    defaultTextKey: 'defaults.radio',
    textSizes: textAll('m'),
    props: none,
    controls: ['state', 'color'],
  },
  dropdown: {
    kind: 'dropdown',
    icon: 'ChevronsUpDown',
    sizes: { S: { w: 160, h: 24 }, M: { w: 200, h: 32 }, L: { w: 240, h: 40 } },
    sized: true,
    states: ['default', 'open', 'disabled'],
    defaultState: 'default',
    textSizes: SML,
    props: (t) => ({ options: [t('defaults.option1'), t('defaults.option2')], selected: 0 }),
    controls: ['size', 'state', 'options'],
  },
  mobileTabs: {
    kind: 'mobileTabs',
    icon: 'PanelBottom',
    sizes: same(360, 56),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('xs'),
    props: (t) => ({
      items: [t('defaults.tabHome'), t('defaults.tabSearch'), t('defaults.tabProfile')],
      icons: ['house', 'search', 'user'],
      active: 0,
    }),
    controls: ['options', 'color'],
  },
  horizontalTabs: {
    kind: 'horizontalTabs',
    icon: 'PanelTop',
    sizes: same(300, 40),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: (t) => ({ items: [t('defaults.tabA'), t('defaults.tabB'), t('defaults.tabC')], active: 0 }),
    controls: ['options', 'color'],
  },
  verticalTabs: {
    kind: 'verticalTabs',
    icon: 'PanelLeft',
    sizes: same(120, 120),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: (t) => ({ items: [t('defaults.tab1'), t('defaults.tab2'), t('defaults.tab3')], active: 0 }),
    controls: ['options', 'color'],
  },
  loremIpsum: {
    kind: 'loremIpsum',
    icon: 'TextAlignStart',
    sizes: same(280, 88),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: none,
    controls: ['textMode'],
  },
  blockText: {
    kind: 'blockText',
    icon: 'AlignJustify',
    sizes: same(280, 88),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: none,
    controls: ['textMode'],
  },
  heading: {
    kind: 'heading',
    icon: 'Heading',
    sizes: same(240, 32),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    defaultTextKey: 'defaults.heading',
    textSizes: textAll('l'),
    props: none,
    controls: [],
  },
  slider: {
    kind: 'slider',
    icon: 'SlidersHorizontal',
    sizes: same(200, 20),
    sized: false,
    states: ['default', 'disabled'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: () => ({ value: 0.4 }),
    controls: ['value', 'color'],
  },
  progressBar: {
    kind: 'progressBar',
    icon: 'Loader',
    sizes: same(200, 12),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: () => ({ value: 0.6 }),
    controls: ['value', 'color'],
  },
  overlay: {
    kind: 'overlay',
    icon: 'Layers',
    sizes: same(360, 400),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: none,
    controls: ['color', 'fitFrame'],
  },
  table: {
    kind: 'table',
    icon: 'Table',
    sizes: same(300, 96),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('s'),
    props: () => ({ cols: 3, rows: 3, cells: [] }),
    controls: ['options'],
  },
  toggle: {
    kind: 'toggle',
    icon: 'ToggleRight',
    sizes: same(40, 24),
    sized: false,
    states: ['on', 'off', 'disabled'],
    defaultState: 'on',
    textSizes: textAll('m'),
    props: none,
    controls: ['state', 'color'],
  },
  tooltip: {
    kind: 'tooltip',
    icon: 'MessageSquare',
    sizes: same(112, 44),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    defaultTextKey: 'defaults.tooltip',
    textSizes: textAll('s'),
    props: () => ({ pointer: 'bottom' }),
    controls: ['color', 'pointer'],
  },
  stars: {
    kind: 'stars',
    icon: 'Star',
    sizes: same(120, 24),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: () => ({ value: 4 }),
    controls: ['value', 'color'],
  },
  video: {
    kind: 'video',
    icon: 'CirclePlay',
    sizes: same(320, 180),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: none,
    controls: [],
  },
  map: {
    kind: 'map',
    icon: 'Map',
    sizes: same(320, 200),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    textSizes: textAll('m'),
    props: none,
    controls: [],
  },
  tag: {
    kind: 'tag',
    icon: 'Tag',
    sizes: same(48, 24),
    sized: false,
    states: ['default'],
    defaultState: 'default',
    defaultTextKey: 'defaults.tag',
    autoWidth: true,
    textSizes: textAll('xs'),
    props: () => ({ autoWidth: true }),
    controls: ['color'],
  },
};

export const WIRE_KINDS = Object.keys(WIRE_ENTRIES) as WireComponentKind[];

export function entryOf(kind: WireComponentKind): WireEntry {
  return WIRE_ENTRIES[kind];
}

/* ------------------------------------------------------------------------------------------
 * Launcher entries (the `E` menu): fixed order, one row per kind plus presets.
 * ---------------------------------------------------------------------------------------- */

export interface LauncherEntry {
  /** Stable id; equals the kind except for presets. */
  id: string;
  kind: WireComponentKind;
  /** Label key in namespace "wireframe". */
  labelKey: string;
  keywordsKey: string;
  icon: string;
  /** Props merged over the component defaults. */
  props?: Record<string, JsonValue>;
}

/** Whimsical kit order (research 05 section 2.1), then the extras. */
const LAUNCHER_ORDER: readonly WireComponentKind[] = [
  'rectangle',
  'button',
  'link',
  'divider',
  'image',
  'input',
  'avatar',
  'circle',
  'checkbox',
  'radio',
  'dropdown',
  'mobileTabs',
  'horizontalTabs',
  'verticalTabs',
  'textarea',
  'loremIpsum',
  'blockText',
  'heading',
  'slider',
  'progressBar',
  'overlay',
  'table',
  'toggle',
  'tooltip',
  'stars',
  'video',
  'map',
  'tag',
  'line',
];

export const LAUNCHER_ENTRIES: readonly LauncherEntry[] = LAUNCHER_ORDER.flatMap<LauncherEntry>((kind) => {
  const base: LauncherEntry = {
    id: kind,
    kind,
    labelKey: `wireframe:components.${kind}`,
    keywordsKey: `wireframe:keywords.${kind}`,
    icon: WIRE_ENTRIES[kind].icon,
  };
  if (kind !== 'button') return [base];
  const outline: LauncherEntry = {
    id: 'outlineButton',
    kind: 'button',
    labelKey: 'wireframe:components.outlineButton',
    keywordsKey: 'wireframe:keywords.outlineButton',
    icon: 'RectangleHorizontal',
    props: { variant: 'outline' },
  };
  return [base, outline];
});

export function launcherEntry(id: string): LauncherEntry | undefined {
  return LAUNCHER_ENTRIES.find((e) => e.id === id);
}

/* ------------------------------------------------------------------------------------------
 * Pure helpers on elements
 * ---------------------------------------------------------------------------------------- */

/** Props of a new element: component defaults, then the launcher preset, then overrides. */
export function buildProps(
  kind: WireComponentKind,
  t: Translate,
  preset?: Record<string, JsonValue>,
  overrides?: Record<string, JsonValue>,
): Record<string, JsonValue> {
  return { ...WIRE_ENTRIES[kind].props(t), ...(preset ?? {}), ...(overrides ?? {}) };
}

/** Marker returned by the translator used when normalising: defaults containing it are skipped. */
const UNTRANSLATED = '\u0000';
const containsMarker = (v: JsonValue): boolean => v === UNTRANSLATED || (Array.isArray(v) && v.some(containsMarker));

/**
 * Fills missing props of a loaded element with the component defaults (forward compatible).
 * Translatable defaults (tab labels...) are never injected into existing content.
 */
export function normalizeWire(el: WireElement): WireElement {
  const entry = (WIRE_ENTRIES as Record<string, WireEntry | undefined>)[el.component];
  if (!entry) return el;
  const defaults = entry.props(() => UNTRANSLATED);
  const props = el.props ?? {};
  let changed = !el.props;
  const merged: Record<string, JsonValue> = { ...props };
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in merged) && !containsMarker(v)) {
      merged[k] = v;
      changed = true;
    }
  }
  const state = el.state ?? entry.defaultState;
  const size = el.size ?? 'M';
  if (!changed && state === el.state && size === el.size) return el;
  return { ...el, state, size, props: merged };
}

export function stringArrayProp(
  props: Record<string, JsonValue>,
  key: string,
  fallback: readonly string[] = [],
): string[] {
  const v = props[key];
  return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : String(x ?? ''))) : [...fallback];
}

export function numberProp(props: Record<string, JsonValue>, key: string, fallback: number): number {
  const v = props[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function stringProp(props: Record<string, JsonValue>, key: string, fallback: string): string {
  const v = props[key];
  return typeof v === 'string' ? v : fallback;
}

/** Height of a dropdown: the input row, plus the option rows when open. */
export function dropdownHeight(size: WireSize, state: string, optionCount: number): number {
  const row = ROW_HEIGHT[size];
  return state === 'open' ? row * (1 + Math.max(1, optionCount)) : row;
}

/** Patch applied when the S/M/L control changes (box, text size). Width of auto-width kinds is recomputed by the caller. */
export function sizePatch(el: WireElement, size: WireSize): Pick<WireElement, 'size' | 'w' | 'h' | 'textSize'> {
  const entry = WIRE_ENTRIES[el.component];
  const box = entry.sizes[size];
  let h = box.h;
  if (el.component === 'dropdown') h = dropdownHeight(size, el.state, stringArrayProp(el.props, 'options').length);
  const circular = el.component === 'avatar';
  return { size, w: circular ? box.w : entry.autoWidth ? el.w : box.w, h, textSize: entry.textSizes[size] };
}

/** Patch applied when the state control changes. */
export function statePatch(el: WireElement, state: string): Partial<Pick<WireElement, 'state' | 'h'>> {
  if (el.component === 'dropdown') {
    return { state, h: dropdownHeight(el.size, state, stringArrayProp(el.props, 'options').length) };
  }
  return { state };
}

/** Horizontal padding of auto-width labels (button, link, tag). */
export function labelPadding(kind: WireComponentKind, size: WireSize): number {
  if (kind === 'link') return 0;
  if (kind === 'tag') return 8;
  return size === 'S' ? 12 : size === 'L' ? 20 : 16;
}

/** Width of an auto-width component for a measured label width. */
export function autoWidthFor(kind: WireComponentKind, size: WireSize, labelWidth: number, hasIcon: boolean): number {
  const iconW = hasIcon ? (size === 'S' ? 16 : 20) + 6 : 0;
  const minW = kind === 'tag' ? 32 : kind === 'link' ? 24 : WIRE_ENTRIES.button.sizes[size].w * 0.5;
  const raw = Math.ceil(labelWidth) + iconW + labelPadding(kind, size) * 2;
  // Keep the 4 px rhythm of the kit.
  return Math.max(minW, Math.ceil(raw / 4) * 4);
}
