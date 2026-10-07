/** Paste heuristics: plain-text Markdown detection and tab-separated tables (Sheets/Excel). */

const BLOCK_MARKDOWN = [
  /^#{1,6}\s+\S/m,
  /^\s*[-*+]\s+\S/m,
  /^\s*\d{1,9}[.)]\s+\S/m,
  /^\s*[-*+]\s+\[[ xX]\]\s/m,
  /^>\s?\S/m,
  /^```/m,
  /^\|.+\|\s*\n\|?\s*:?-{2,}/m,
  /^(?:---|\*\*\*)\s*$/m,
  /^::(?:embed|board)\[/m,
  /^<details[\s>]/m,
];

const INLINE_MARKDOWN = [/\*\*[^*\n]+\*\*/, /(?:^|\s)_[^_\n]+_(?:\s|$)/, /`[^`\n]+`/, /\[[^\]\n]+\]\([^)\n]+\)/, /~~[^~\n]+~~/, /==[^=\n]+==/];

/** True when plain text pasted without HTML should be interpreted as Markdown. */
export function looksLikeMarkdown(text: string): boolean {
  if (text.trim() === '') return false;
  if (BLOCK_MARKDOWN.some((re) => re.test(text))) return true;
  return INLINE_MARKDOWN.some((re) => re.test(text));
}

/** Parses tab-separated text with at least two columns and two rows; otherwise null. */
export function parseTsvTable(text: string): string[][] | null {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  if (lines.length < 2) return null;
  const rows = lines.map((l) => l.split('\t'));
  const width = rows[0]?.length ?? 0;
  if (width < 2) return null;
  if (!rows.every((r) => r.length === width)) return null;
  return rows.map((r) => r.map((c) => c.trim()));
}

/** Document JSON of a table from rows of plain cell text; the first row is the header. */
export function tableJson(rows: string[][]): Record<string, unknown> {
  const cell = (text: string, header: boolean): Record<string, unknown> => ({
    type: header ? 'tableHeader' : 'tableCell',
    attrs: { align: null },
    content: [text === '' ? { type: 'paragraph' } : { type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  return {
    type: 'table',
    content: rows.map((r, i) => ({ type: 'tableRow', content: r.map((c) => cell(c, i === 0)) })),
  };
}
