/**
 * Whimsical default colour theme ("bg-theme-<hue>-<shade>" tokens read from the app CSS,
 * research 07 section 6.3). Missing shades are interpolated (marked "derived").
 *
 * Roles:
 *   fill      saturated fill (flowchart shapes with fillStyle "fill")
 *   soft      toned-down fill (sticky notes, sections, wireframe accents, "border" style fill)
 *   stroke    outline / connector / stroke colour
 *   text      text drawn on `soft` or on the canvas
 *   onFill    text drawn on `fill`
 */

import type { ColorRef, PaletteColor, ThemeMode } from './types';

export interface HueShades {
  strong: string;
  base: string;
  subtle: string;
  subtler: string;
  subtlest: string;
}

export const PALETTE: Record<PaletteColor, HueShades> = {
  purple: { strong: '#8013d9', base: '#9952ec', subtle: '#c9aef8', subtler: '#e3d7fc', subtlest: '#f1ebfd' },
  blue: { strong: '#0066ae', base: '#2484d4', subtle: '#98c2ed', subtler: '#cbe1f7', subtlest: '#e6f0fa' },
  green: { strong: '#017369', base: '#26aea0', subtle: '#bee8e1', subtler: '#def4f0', subtlest: '#eff9f7' },
  violet: { strong: '#5539e8', base: '#665bf3', subtle: '#8d92f9', subtler: '#d7dbfe', subtlest: '#ebedfe' },
  pink: { strong: '#9c00b0', base: '#be36d3', subtle: '#e2a4eb', subtler: '#f1d2f5', subtlest: '#f8e9fa' },
  orange: { strong: '#b76a34', base: '#e58138', subtle: '#faa872', subtler: '#fdeadf', subtlest: '#fef4ef' },
  yellow: { strong: '#c0991f', base: '#e6b725', subtle: '#f8db93', subtler: '#fceec9', subtlest: '#fdf6e4' },
  red: { strong: '#b1223f', base: '#d5475b', subtle: '#ff9ea4', subtler: '#fad3d4', subtlest: '#fce9ea' },
  crimson: { strong: '#8a5051', base: '#aa6d6d', subtle: '#ecaaa9', subtler: '#fbd3d2', subtlest: '#fde9e8' },
  darkGreen: { strong: '#00544c', base: '#017369', subtle: '#30b5a6', subtler: '#bee8e1', subtlest: '#def4f0' },
  brown: { strong: '#706147', base: '#8e7e63', subtle: '#ac9c80', subtler: '#eddcbe', subtlest: '#f6eedf' },
  gray: { strong: '#475767', base: '#738291', subtle: '#c4cfda', subtler: '#d7dfe7', subtlest: '#f7f9fa' },
  smoke: { strong: '#8291a0', base: '#c4cfda', subtle: '#b3bfcc', subtler: '#ebeff3', subtlest: '#f7f9fa' },
  slate: { strong: '#19232c', base: '#2e3c4a', subtle: '#738291', subtler: '#c4cfda', subtlest: '#ebeff3' },
  white: { strong: '#ffffff', base: '#ffffff', subtle: '#ffffff', subtler: '#ffffff', subtlest: '#ffffff' },
};

/** Order shown in colour pickers (Whimsical groups neutrals first). */
export const PALETTE_ORDER: readonly PaletteColor[] = [
  'white',
  'smoke',
  'gray',
  'slate',
  'purple',
  'violet',
  'blue',
  'green',
  'darkGreen',
  'yellow',
  'orange',
  'red',
  'crimson',
  'pink',
  'brown',
];

/** Highlighter excludes the lightest colours (white, smoke, gray). */
export const HIGHLIGHTER_COLORS: readonly PaletteColor[] = PALETTE_ORDER.filter(
  (c) => c !== 'white' && c !== 'smoke' && c !== 'gray',
);

export const DEFAULT_COLORS = {
  shape: 'purple',
  sticky: 'purple',
  connector: 'slate',
  text: 'slate',
  section: 'gray',
  stroke: 'slate',
  annotation: 'purple',
  mindmapRoot: 'slate',
} as const satisfies Record<string, PaletteColor>;

/** Default branch colours assigned to first-level mind-map branches, cycling. */
export const MINDMAP_BRANCH_COLORS: readonly PaletteColor[] = [
  'blue',
  'green',
  'orange',
  'pink',
  'red',
  'yellow',
  'violet',
  'darkGreen',
];

export type ColorRole = 'fill' | 'soft' | 'stroke' | 'text' | 'onFill';

export function isPaletteColor(ref: ColorRef): ref is PaletteColor {
  return ref in PALETTE;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mixes `a` towards `b` by `amount` (0..1). */
export function mixHex(a: string, b: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * amount);
  return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Relative luminance (0 dark .. 1 light). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const DARK_CANVAS = '#0f171f';
const INK = '#293744';

/** Resolves a colour reference to a concrete CSS colour for a role and theme. */
export function resolveColor(ref: ColorRef, role: ColorRole, theme: ThemeMode = 'light'): string {
  const shades: HueShades = isPaletteColor(ref)
    ? PALETTE[ref]
    : { strong: mixHex(ref, '#000000', 0.25), base: ref, subtle: mixHex(ref, '#ffffff', 0.45), subtler: mixHex(ref, '#ffffff', 0.75), subtlest: mixHex(ref, '#ffffff', 0.88) };
  let color: string;
  switch (role) {
    case 'fill':
      color = shades.base;
      break;
    case 'soft':
      color = theme === 'dark' ? mixHex(shades.base, DARK_CANVAS, 0.6) : shades.subtler;
      break;
    case 'stroke':
      color = shades.base;
      break;
    case 'text':
      color = theme === 'dark' ? '#ffffff' : INK;
      break;
    case 'onFill':
      color = luminance(shades.base) > 0.55 ? INK : '#ffffff';
      break;
  }
  if (theme === 'dark' && ref === 'white' && role !== 'text') return mixHex('#ffffff', DARK_CANVAS, 0.85);
  return color;
}

/** Board text sizes in px (bundle: xs 13, s 15, m 18, l0 21, l1 27, l2 36). */
export const TEXT_SIZE_PX = { xs: 13, s: 15, m: 18, l: 21, xl: 27, xxl: 36 } as const;
/** Wireframe text sizes in px (smaller, low-fi scale). */
export const WIREFRAME_TEXT_SIZE_PX = { xs: 10, s: 12, m: 14, l: 18, xl: 24, xxl: 32 } as const;

/** Grid spacing per mode (Whimsical: 12 px boards, 1 px wireframes). */
export const GRID_SIZE = { diagram: 12, wireframe: 1 } as const;
