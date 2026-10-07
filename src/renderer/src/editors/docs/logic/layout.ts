/**
 * Per-viewer page layout (research 03 section 9.1): text size Large (default) / Medium / Small,
 * width Narrow (default) / Wide. Pixel values are estimates (the real ones were not published).
 */

export type DocTextSize = 'small' | 'medium' | 'large';
export type DocTextWidth = 'narrow' | 'wide';

export const TEXT_SIZES: readonly DocTextSize[] = ['small', 'medium', 'large'];
export const TEXT_WIDTHS: readonly DocTextWidth[] = ['narrow', 'wide'];

export interface DocLayoutMetrics {
  fontSize: number;
  lineHeight: number;
  /** Max width of the text column in px. */
  columnWidth: number;
  h1: number;
  h2: number;
  h3: number;
}

const SIZE_METRICS: Record<DocTextSize, Omit<DocLayoutMetrics, 'columnWidth'>> = {
  small: { fontSize: 14, lineHeight: 1.55, h1: 26, h2: 21, h3: 17 },
  medium: { fontSize: 16, lineHeight: 1.55, h1: 30, h2: 24, h3: 19 },
  large: { fontSize: 18, lineHeight: 1.55, h1: 36, h2: 28, h3: 22 },
};

const WIDTHS: Record<DocTextWidth, number> = { narrow: 700, wide: 1020 };

export function layoutMetrics(size: DocTextSize, width: DocTextWidth): DocLayoutMetrics {
  return { ...SIZE_METRICS[size], columnWidth: WIDTHS[width] };
}

/** Next size for the ⌘= (larger) / ⌘- (smaller) shortcuts; clamps at the ends. */
export function stepTextSize(size: DocTextSize, direction: 'up' | 'down'): DocTextSize {
  const i = TEXT_SIZES.indexOf(size);
  const next = Math.min(TEXT_SIZES.length - 1, Math.max(0, i + (direction === 'up' ? 1 : -1)));
  return TEXT_SIZES[next] ?? size;
}

export function isTextSize(value: unknown): value is DocTextSize {
  return value === 'small' || value === 'medium' || value === 'large';
}

export function isTextWidth(value: unknown): value is DocTextWidth {
  return value === 'narrow' || value === 'wide';
}

/** CSS custom properties applied on the editor root. */
export function layoutCssVars(size: DocTextSize, width: DocTextWidth): Record<string, string> {
  const m = layoutMetrics(size, width);
  return {
    '--doc-font-size': `${m.fontSize}px`,
    '--doc-line-height': String(m.lineHeight),
    '--doc-column-width': `${m.columnWidth}px`,
    '--doc-h1-size': `${m.h1}px`,
    '--doc-h2-size': `${m.h2}px`,
    '--doc-h3-size': `${m.h3}px`,
  };
}
