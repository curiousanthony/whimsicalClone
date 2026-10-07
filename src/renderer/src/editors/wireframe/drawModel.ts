/** Pure helpers of the component renderers (kept out of draw.tsx so they can be unit tested). */

import type { WireComponentKind } from '@renderer/core/types';

/** Components whose label is edited in place (Enter / double-click). */
export const TEXTUAL: ReadonlySet<WireComponentKind> = new Set<WireComponentKind>([
  'rectangle',
  'circle',
  'button',
  'link',
  'input',
  'textarea',
  'checkbox',
  'radio',
  'heading',
  'tag',
  'tooltip',
]);

/** Latin placeholder paragraph shown by the Lorem ipsum component (content, not UI text). */
export const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

const BRICKS = [1, 0.96, 0.9, 0.98, 0.93, 0.85, 0.97];

/** Relative widths of the "bricks" of the block text component; the last line is shorter. */
export function blockLineWidths(lines: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines; i++) out.push(BRICKS[i % BRICKS.length]!);
  if (lines > 1) out[lines - 1] = 0.6;
  return out;
}

/** Fill of star `index` (0-based) for a rating value: 1 full, 0.5 half, 0 empty. */
export function starFill(value: number, index: number): 0 | 0.5 | 1 {
  if (value >= index + 1) return 1;
  if (value >= index + 0.5) return 0.5;
  return 0;
}

/** Components whose label is a single line: Enter finishes editing instead of adding a paragraph. */
export const SINGLE_LINE: ReadonlySet<WireComponentKind> = new Set<WireComponentKind>([
  'button',
  'link',
  'input',
  'checkbox',
  'radio',
  'heading',
  'tag',
]);
