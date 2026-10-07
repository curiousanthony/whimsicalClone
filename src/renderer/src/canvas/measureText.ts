/**
 * Text measurement for auto-sizing (sticky notes, shape auto-height, mind-map nodes).
 * Uses a shared 2D canvas context; falls back to a width heuristic where canvas is not
 * available (jsdom tests). Line height and block spacing match canvas/text.css.
 */

import { TEXT_SIZE_PX, WIREFRAME_TEXT_SIZE_PX } from '@renderer/core/palette';
import type { RichText, Size, TextStyle } from '@renderer/core/types';

export const LINE_HEIGHT = 1.4;
/** Extra vertical space after headings / between blocks (fraction of font size). */
const BLOCK_GAP = 0.25;
const HEADING_SCALE = { h1: 1.6, h2: 1.35, h3: 1.15 } as const;
/** Indentation of list items, in px at scale 1. */
const LIST_INDENT = 22;

let ctx: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
    ctx = !isJsdom && typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

export function fontSizeFor(style: TextStyle): number {
  const table = style.scale === 'wireframe' ? WIREFRAME_TEXT_SIZE_PX : TEXT_SIZE_PX;
  return table[style.textSize];
}

function fontFamily(): string {
  if (typeof document === 'undefined') return 'sans-serif';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--wc-font-sans').trim();
  return v || 'sans-serif';
}

function measureWidth(text: string, fontSize: number, bold: boolean): number {
  const c = context();
  if (!c) return text.length * fontSize * 0.55;
  c.font = `${bold ? 700 : 400} ${fontSize}px ${fontFamily()}`;
  return c.measureText(text).width;
}

/** Number of wrapped lines and widest line for one paragraph. */
function wrap(text: string, fontSize: number, bold: boolean, maxWidth: number | undefined): { lines: number; width: number } {
  const hardLines = text.split('\n');
  let lines = 0;
  let width = 0;
  for (const hard of hardLines) {
    if (maxWidth === undefined) {
      lines += 1;
      width = Math.max(width, measureWidth(hard, fontSize, bold));
      continue;
    }
    const words = hard.split(/(\s+)/);
    let line = '';
    let lineCount = 1;
    for (const word of words) {
      const candidate = line + word;
      if (line && measureWidth(candidate, fontSize, bold) > maxWidth && word.trim()) {
        width = Math.max(width, measureWidth(line, fontSize, bold));
        line = word.trimStart();
        lineCount += 1;
        // Break very long words.
        while (measureWidth(line, fontSize, bold) > maxWidth && line.length > 1) {
          const chars = Math.max(1, Math.floor((line.length * maxWidth) / measureWidth(line, fontSize, bold)));
          line = line.slice(chars);
          lineCount += 1;
          width = maxWidth;
        }
      } else {
        line = candidate;
      }
    }
    width = Math.max(width, Math.min(maxWidth, measureWidth(line, fontSize, bold)));
    lines += lineCount;
  }
  return { lines, width };
}

/** Measures rich text laid out at `style`, wrapped to `maxWidth` when given. */
export function measureRichText(text: RichText, style: TextStyle, maxWidth?: number): Size {
  const base = fontSizeFor(style);
  let height = 0;
  let width = 0;
  text.blocks.forEach((block, i) => {
    const scale = block.type === 'h1' || block.type === 'h2' || block.type === 'h3' ? HEADING_SCALE[block.type] : 1;
    const size = base * scale;
    const isList = block.type === 'ul' || block.type === 'ol' || block.type === 'check';
    const indent = ((block.indent ?? 0) + (isList ? 1 : 0)) * LIST_INDENT * (base / 18);
    const bold = !!style.bold || scale > 1;
    const plain = block.spans.map((s) => s.text).join('');
    const avail = maxWidth !== undefined ? Math.max(1, maxWidth - indent) : undefined;
    const { lines, width: w } = wrap(plain, size, bold, avail);
    height += lines * size * LINE_HEIGHT + (i > 0 ? base * BLOCK_GAP : 0);
    width = Math.max(width, w + indent);
  });
  return { w: Math.ceil(width), h: Math.ceil(height) };
}
