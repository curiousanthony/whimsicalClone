/**
 * Local search helpers: plain-text extraction from documents (board JSON or Markdown) and
 * case-insensitive matching with snippets. Pure, unit tested.
 */

export interface TextChunk {
  text: string;
  /** Board element id the text belongs to (undefined for Markdown). */
  elementId?: string;
}

const TEXT_FIELDS = ['name', 'title', 'url', 'code', 'caption'] as const;

function richTextToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const blocks = (value as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b) => {
      const spans = (b as { spans?: unknown }).spans;
      return Array.isArray(spans)
        ? spans
            .map((s) => (typeof (s as { text?: unknown }).text === 'string' ? (s as { text: string }).text : ''))
            .join('')
        : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** Extracts searchable text from a board element (text, labels, names, table cells...). */
function elementText(element: Record<string, unknown>): string {
  const parts: string[] = [];
  if ('text' in element) parts.push(richTextToString(element.text));
  const label = element.label as { text?: unknown } | undefined;
  if (label && typeof label === 'object') parts.push(richTextToString(label.text));
  for (const field of TEXT_FIELDS) {
    const v = element[field];
    if (typeof v === 'string') parts.push(v);
  }
  const cells = element.cells;
  if (cells && typeof cells === 'object') {
    for (const cell of Object.values(cells as Record<string, unknown>)) {
      if (cell && typeof cell === 'object') parts.push(richTextToString((cell as { text?: unknown }).text));
    }
  }
  return parts.filter((p) => p.trim() !== '').join('\n');
}

/** Text chunks of a file given its raw content. */
export function extractText(path: string, content: string): TextChunk[] {
  if (/\.(md|markdown)$/i.test(path)) {
    return content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((text) => ({ text }));
  }
  try {
    const doc = JSON.parse(content) as { elements?: unknown };
    if (!Array.isArray(doc.elements)) return [];
    const chunks: TextChunk[] = [];
    for (const raw of doc.elements) {
      if (!raw || typeof raw !== 'object') continue;
      const element = raw as Record<string, unknown>;
      const text = elementText(element);
      if (text) chunks.push(typeof element.id === 'string' ? { text, elementId: element.id } : { text });
    }
    return chunks;
  } catch {
    return [];
  }
}

export interface TextMatch {
  snippet: string;
  /** Offset of the match inside the snippet (for highlighting). */
  start: number;
  length: number;
  elementId?: string;
}

/** Finds case-insensitive matches of `query` in the chunks with ~60 chars of context. */
export function findMatches(chunks: readonly TextChunk[], query: string, limit = 20): TextMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: TextMatch[] = [];
  for (const chunk of chunks) {
    const flat = chunk.text.replace(/\s+/g, ' ');
    const lower = flat.toLowerCase();
    let from = 0;
    while (out.length < limit) {
      const at = lower.indexOf(q, from);
      if (at < 0) break;
      const begin = Math.max(0, at - 30);
      const end = Math.min(flat.length, at + q.length + 30);
      const prefix = begin > 0 ? '…' : '';
      const snippet = `${prefix}${flat.slice(begin, end)}${end < flat.length ? '…' : ''}`;
      const match: TextMatch = { snippet, start: prefix.length + (at - begin), length: q.length };
      if (chunk.elementId) match.elementId = chunk.elementId;
      out.push(match);
      from = at + q.length;
    }
    if (out.length >= limit) break;
  }
  return out;
}
