import { describe, expect, it } from 'vitest';
import type { RichText } from '@renderer/core/types';
import { pmToRichText, richTextToPm } from './richTextPm';
import { measureRichText } from './measureText';

const roundTrip = (rich: RichText) => pmToRichText(richTextToPm(rich));

describe('RichText <-> ProseMirror', () => {
  it('round-trips paragraphs, headings, marks, links and soft breaks', () => {
    const rich: RichText = {
      blocks: [
        { type: 'h1', spans: [{ text: 'Title' }] },
        {
          type: 'p',
          spans: [
            { text: 'Hello ' },
            { text: 'bold', marks: ['bold'] },
            { text: ' and\nnext ' },
            { text: 'link', href: 'https://example.com', marks: ['italic'] },
          ],
        },
        { type: 'p', spans: [] },
      ],
    };
    expect(roundTrip(rich)).toEqual(rich);
  });

  it('round-trips nested lists, checklists, quotes and code', () => {
    const rich: RichText = {
      blocks: [
        { type: 'ul', spans: [{ text: 'one' }] },
        { type: 'ul', indent: 1, spans: [{ text: 'one.a' }] },
        { type: 'ul', spans: [{ text: 'two' }] },
        { type: 'ol', spans: [{ text: 'first' }] },
        { type: 'check', checked: true, spans: [{ text: 'done' }] },
        { type: 'check', checked: false, spans: [{ text: 'todo' }] },
        { type: 'quote', spans: [{ text: 'q1' }] },
        { type: 'quote', spans: [{ text: 'q2' }] },
        { type: 'code', language: 'ts', spans: [{ text: 'const a = 1;\nconst b = 2;' }] },
      ],
    };
    expect(roundTrip(rich)).toEqual(rich);
  });

  it('produces valid TipTap structure', () => {
    const pm = richTextToPm({ blocks: [{ type: 'check', checked: true, spans: [{ text: 'x' }] }] });
    expect(pm).toEqual({
      type: 'doc',
      content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] }] }],
    });
    expect(richTextToPm({ blocks: [] })).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(pmToRichText({ type: 'doc' })).toEqual({ blocks: [{ type: 'p', spans: [] }] });
  });

  it('merges adjacent text with identical marks', () => {
    const rich = pmToRichText({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }, { type: 'hardBreak' }, { type: 'text', text: 'c' }] }],
    });
    expect(rich.blocks[0]!.spans).toEqual([{ text: 'ab\nc' }]);
  });
});

describe('measureRichText (heuristic in jsdom)', () => {
  it('grows with lines and wraps to a max width', () => {
    const one = measureRichText({ blocks: [{ type: 'p', spans: [{ text: 'hello' }] }] }, { textSize: 'm' });
    const two = measureRichText({ blocks: [{ type: 'p', spans: [{ text: 'hello\nworld' }] }] }, { textSize: 'm' });
    expect(two.h).toBeGreaterThan(one.h);
    const wrapped = measureRichText({ blocks: [{ type: 'p', spans: [{ text: 'word '.repeat(40) }] }] }, { textSize: 'm' }, 150);
    expect(wrapped.w).toBeLessThanOrEqual(150);
    expect(wrapped.h).toBeGreaterThan(one.h * 3);
  });
});
