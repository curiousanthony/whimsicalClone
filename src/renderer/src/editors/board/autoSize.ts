/**
 * Auto-size normaliser for sticky notes and free text (plugin `afterChange`). Pure: the text
 * measurer is injected so the logic is testable without a DOM.
 *
 *   sticky  square note; while `autoSize` is on the side grows (and shrinks back) in 24 px steps
 *           to fit its text, never below the default 168 px. New notes only grow.
 *   text    `autoWidth` text follows its content up to 480 px then wraps; the height always
 *           follows the text at the current width.
 *
 * Only elements whose text, size or width reference changed against `prev` are re-measured,
 * and `next` is returned by reference when nothing changes (no history churn).
 */

import type { BoardDocument, BoardElement, RichText, Size, StickyElement, TextElement, TextStyle } from '@renderer/core/types';
import { isRichTextEmpty } from '@renderer/core/richText';
import { STICKY_MAX, STICKY_PADDING, STICKY_SIZE, STICKY_STEP, TEXT_AUTO_MAX_WIDTH, TEXT_MIN_WIDTH, TEXT_PADDING } from './model';

export type Measure = (text: RichText, style: TextStyle, maxWidth?: number) => Size;

/** Smallest sticky side (multiple of 24 above the default) whose inner square holds the text. */
export function fitStickySide(text: RichText, textSize: StickyElement['textSize'], measure: Measure, minSide = STICKY_SIZE): number {
  if (isRichTextEmpty(text)) return minSide;
  for (let side = minSide; side < STICKY_MAX; side += STICKY_STEP) {
    const inner = side - STICKY_PADDING * 2;
    if (measure(text, { textSize }, inner).h <= inner) return side;
  }
  return STICKY_MAX;
}

export interface TextFit {
  w: number;
  h: number;
}

/** Box of a free text object for its content. */
export function fitText(el: Pick<TextElement, 'text' | 'textSize' | 'autoWidth' | 'w'>, measure: Measure): TextFit {
  const style: TextStyle = { textSize: el.textSize };
  const lineHeight = measure({ blocks: [{ type: 'p', spans: [{ text: 'M' }] }] }, style).h;
  let w = el.w;
  // Empty text keeps its starting width so the caret has room; typed text hugs its content.
  if (el.autoWidth && !isRichTextEmpty(el.text)) {
    const natural = measure(el.text, style).w + TEXT_PADDING * 2 + 2;
    w = Math.min(TEXT_AUTO_MAX_WIDTH, Math.max(TEXT_MIN_WIDTH, natural));
  }
  const measured = isRichTextEmpty(el.text) ? lineHeight : measure(el.text, style, Math.max(1, w - TEXT_PADDING * 2)).h;
  return { w, h: Math.max(lineHeight, measured) + TEXT_PADDING * 2 };
}

function isSticky(el: BoardElement): el is StickyElement {
  return el.type === 'sticky';
}

function isText(el: BoardElement): el is TextElement {
  return el.type === 'text';
}

export function normalizeBoardObjects(next: BoardDocument, prev: BoardDocument, measure: Measure): BoardDocument {
  if (next === prev) return next;
  const before = new Map<string, BoardElement>();
  for (const el of prev.elements) before.set(el.id, el);

  let changed = false;
  const elements = next.elements.map((el): BoardElement => {
    const old = before.get(el.id);
    if (isSticky(el) && el.autoSize) {
      const o = old && isSticky(old) ? old : undefined;
      if (o && o.text === el.text && o.textSize === el.textSize && o.autoSize === el.autoSize) return el;
      const fit = fitStickySide(el.text, el.textSize, measure);
      // A new (or newly auto-sized) note keeps a bigger side it already has; typing re-fits both ways.
      const side = o ? fit : Math.max(fit, el.w, el.h);
      if (side === el.w && side === el.h) return el;
      changed = true;
      return { ...el, w: side, h: side };
    }
    if (isText(el)) {
      const o = old && isText(old) ? old : undefined;
      if (o && o.text === el.text && o.textSize === el.textSize && o.autoWidth === el.autoWidth && o.w === el.w) return el;
      const fit = fitText(el, measure);
      if (fit.w === el.w && fit.h === el.h) return el;
      changed = true;
      return { ...el, w: fit.w, h: fit.h };
    }
    return el;
  });
  return changed ? { ...next, elements } : next;
}
