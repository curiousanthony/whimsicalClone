import { describe, expect, it } from 'vitest';
import { createEmptyBoard } from '@renderer/core/boardFormat';
import { richTextFromPlain } from '@renderer/core/richText';
import type { RichText, TextStyle } from '@renderer/core/types';
import { fitStickySide, fitText, normalizeBoardObjects, type Measure } from './autoSize';
import { createStickyElement, createTextElement, STICKY_SIZE } from './model';

/** Deterministic monospace measurer: 8 px per character, 20 px per line, wraps at maxWidth. */
const measure: Measure = (text: RichText, _style: TextStyle, maxWidth?: number) => {
  let w = 0;
  let h = 0;
  for (const block of text.blocks) {
    const chars = block.spans.map((s) => s.text).join('').length;
    const natural = chars * 8;
    if (maxWidth && natural > maxWidth) {
      const perLine = Math.max(1, Math.floor(maxWidth / 8));
      h += Math.ceil(chars / perLine) * 20;
      w = Math.max(w, maxWidth);
    } else {
      h += 20;
      w = Math.max(w, natural);
    }
  }
  return { w, h };
};

const words = (n: number) => richTextFromPlain('word '.repeat(n).trim());

describe('fitStickySide', () => {
  it('keeps the default size for short and empty text', () => {
    expect(fitStickySide(richTextFromPlain(''), 'm', measure)).toBe(STICKY_SIZE);
    expect(fitStickySide(richTextFromPlain('hello'), 'm', measure)).toBe(STICKY_SIZE);
  });
  it('grows in 24 px steps until the text fits', () => {
    const side = fitStickySide(words(60), 'm', measure);
    expect(side).toBeGreaterThan(STICKY_SIZE);
    expect((side - STICKY_SIZE) % 24).toBe(0);
    const inner = side - 32;
    expect(measure(words(60), { textSize: 'm' }, inner).h).toBeLessThanOrEqual(inner);
  });
  it('is capped', () => {
    expect(fitStickySide(words(5000), 'm', measure)).toBe(600);
  });
});

describe('fitText', () => {
  it('hugs short text and wraps long auto-width text at 480', () => {
    const short = createTextElement({ id: 't', x: 0, y: 0, text: richTextFromPlain('abc') });
    expect(fitText(short, measure).w).toBe(3 * 8 + 8 + 2);
    const long = createTextElement({ id: 't', x: 0, y: 0, text: richTextFromPlain('x'.repeat(200)) });
    const fit = fitText(long, measure);
    expect(fit.w).toBe(480);
    expect(fit.h).toBeGreaterThan(30);
  });
  it('keeps a manual width', () => {
    const fixed = createTextElement({ id: 't', x: 0, y: 0, rect: { x: 0, y: 0, w: 200, h: 28 }, text: richTextFromPlain('abc') });
    expect(fitText(fixed, measure).w).toBe(200);
  });
});

describe('normalizeBoardObjects', () => {
  const doc = (...els: Parameters<typeof createEmptyBoard>[1] & object) => createEmptyBoard('board', els);

  it('returns the same document when nothing relevant changed', () => {
    const prev = doc(createStickyElement({ id: 's', x: 0, y: 0 }));
    expect(normalizeBoardObjects(prev, prev, measure)).toBe(prev);
  });
  it('grows an auto-size sticky when its text grows and shrinks back', () => {
    const empty = createStickyElement({ id: 's', x: 0, y: 0 });
    const prev = doc(empty);
    const grown = doc({ ...empty, text: words(60) });
    const out = normalizeBoardObjects(grown, prev, measure);
    const s = out.elements[0]!;
    expect(s.type === 'sticky' && s.w).toBeGreaterThan(STICKY_SIZE);
    const back = normalizeBoardObjects(doc({ ...empty, w: s.type === 'sticky' ? s.w : 0, h: s.type === 'sticky' ? s.h : 0, text: richTextFromPlain('hi') }), out, measure);
    expect(back.elements[0]).toMatchObject({ w: STICKY_SIZE, h: STICKY_SIZE });
  });
  it('leaves manually sized stickies alone', () => {
    const manual = createStickyElement({ id: 's', x: 0, y: 0, rect: { x: 0, y: 0, w: 200, h: 200 } });
    const prev = doc(manual);
    const next = doc({ ...manual, text: words(200) });
    expect(normalizeBoardObjects(next, prev, measure).elements[0]).toMatchObject({ w: 200, h: 200 });
  });
  it('a new oversized note keeps its size', () => {
    const big = { ...createStickyElement({ id: 's', x: 0, y: 0 }), w: 240, h: 240 };
    const out = normalizeBoardObjects(doc(big), doc(), measure);
    expect(out.elements[0]).toMatchObject({ w: 240, h: 240 });
  });
  it('re-measures text height after edits', () => {
    const t = createTextElement({ id: 't', x: 0, y: 0 });
    const prev = doc(t);
    const next = doc({ ...t, text: richTextFromPlain('x'.repeat(100)) });
    const out = normalizeBoardObjects(next, prev, measure).elements[0]!;
    expect(out.type === 'text' && out.w).toBe(480 > 100 * 8 + 10 ? 100 * 8 + 10 : 480);
  });
});
