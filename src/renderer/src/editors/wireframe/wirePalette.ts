/**
 * Colours of wireframe components (research 05 section 5). Wireframes are grey and white;
 * colour only marks actionable items (accent) and meaning (positive / danger). Everything is
 * "toned down" compared with flowchart shapes. Pure module.
 */

import { mixHex, resolveColor } from '@renderer/core/palette';
import type { ColorRef, ThemeMode } from '@renderer/core/types';

export interface WirePalette {
  ink: string;
  muted: string;
  line: string;
  fill: string;
  surface: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  positive: string;
  danger: string;
  chrome: string;
}

/** Default accent when a component has no colour (Whimsical's wireframe purple). */
export const DEFAULT_ACCENT: ColorRef = 'violet';

export function wirePalette(theme: ThemeMode, color?: ColorRef): WirePalette {
  const dark = theme === 'dark';
  const accentRef = color ?? DEFAULT_ACCENT;
  return {
    ink: dark ? '#ffffff' : '#293744',
    muted: dark ? '#8291a0' : '#738291',
    line: dark ? '#475767' : '#c4cfda',
    fill: dark ? '#2e3c4a' : '#e2e8ee',
    surface: dark ? '#19232c' : '#ffffff',
    accent: resolveColor(accentRef, 'fill', theme),
    onAccent: resolveColor(accentRef, 'onFill', theme),
    accentSoft: resolveColor(accentRef, 'soft', theme),
    positive: resolveColor('green', 'fill', theme),
    danger: resolveColor('red', 'fill', theme),
    chrome: dark ? '#475767' : '#9bafbb',
  };
}

/** "#rrggbb" + alpha 0..1 -> "rgb(r g b / a)". */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.padEnd(6, '0');
  const n = parseInt(full.slice(0, 6), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`;
}

/** Disabled controls are drawn washed out towards the surface. */
export function disabled(hex: string, surface: string): string {
  return mixHex(hex, surface, 0.55);
}
