import type { RichText, TextBlock } from './types';

export function emptyRichText(): RichText {
  return { blocks: [{ type: 'p', spans: [] }] };
}

/** Plain string to rich text: one paragraph per line ("\n" separated). */
export function richTextFromPlain(text: string): RichText {
  const lines = text.split(/\r?\n/);
  return {
    blocks: lines.map<TextBlock>((line) => ({ type: 'p', spans: line ? [{ text: line }] : [] })),
  };
}

/** Rich text to plain string: blocks joined with "\n". */
export function plainText(rich: RichText | undefined): string {
  if (!rich) return '';
  return rich.blocks.map((b) => b.spans.map((s) => s.text).join('')).join('\n');
}

export function isRichTextEmpty(rich: RichText | undefined): boolean {
  return plainText(rich).trim() === '';
}
