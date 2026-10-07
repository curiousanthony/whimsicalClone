/**
 * Markdown -> document JSON (ProseMirror / TipTap shape). Pure: no DOM, no React.
 *
 * Built on marked's lexer (GFM) plus the clone's extensions (SPEC 3.2):
 *   ==highlight==, > [!callout color=.. icon=..], <details><summary>, ::embed[..]{..}, ::board[..]{..}.
 * Anything that is not modelled (HTML blocks, front matter, link definitions) is kept verbatim in
 * `rawMarkdown` nodes so that no content is ever dropped.
 */

import { Lexer, Marked } from 'marked';
import {
  CALLOUT_COLORS,
  DEFAULT_CALLOUT_COLOR,
  DEFAULT_CALLOUT_ICON,
  EMBED_DEFAULT_HEIGHT,
  isCalloutColor,
  type DocMark,
  type DocNode,
  type EmbedFit,
  type RawKind,
} from './constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tok = { type: string; raw: string; [key: string]: any };

const highlightExtension = {
  name: 'highlight',
  level: 'inline' as const,
  start(src: string): number | undefined {
    const i = src.indexOf('==');
    return i < 0 ? undefined : i;
  },
  tokenizer(this: any, src: string): any {
    const match = /^==(?!=)(?=\S)([\s\S]*?\S)==(?!=)/.exec(src);
    if (!match) return undefined;
    return {
      type: 'highlight',
      raw: match[0],
      text: match[1],
      tokens: this.lexer.inlineTokens(match[1] ?? ''),
    };
  },
};

const marked = new Marked({ gfm: true, breaks: false, extensions: [highlightExtension as any] });

function lex(src: string): Tok[] {
  return marked.lexer(src) as unknown as Tok[];
}

/** Inline tokens through the instance options, so the custom ==highlight== tokenizer applies. */
function lexInline(src: string): Tok[] {
  return new Lexer(marked.defaults).inlineTokens(src) as unknown as Tok[];
}

/* ------------------------------------------------------------------------------------------
 * Entities
 * ---------------------------------------------------------------------------------------- */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return whole;
        }
      }
      return whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/* ------------------------------------------------------------------------------------------
 * Inline
 * ---------------------------------------------------------------------------------------- */

function sameMarks(a: DocMark[] | undefined, b: DocMark[] | undefined): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

/** Merges adjacent text nodes carrying identical marks (what ProseMirror does on load). */
function mergeText(nodes: DocNode[]): DocNode[] {
  const out: DocNode[] = [];
  for (const node of nodes) {
    const prev = out[out.length - 1];
    if (prev && prev.type === 'text' && node.type === 'text' && sameMarks(prev.marks, node.marks)) {
      prev.text = (prev.text ?? '') + (node.text ?? '');
    } else {
      out.push({ ...node });
    }
  }
  return out.filter((n) => n.type !== 'text' || (n.text ?? '') !== '');
}

const MARK_RANK = ['link', 'bold', 'italic', 'strike', 'highlight', 'code'];
const rank = (m: DocMark): number => {
  const i = MARK_RANK.indexOf(m.type);
  return i < 0 ? MARK_RANK.length : i;
};

function textNode(text: string, marks: DocMark[]): DocNode {
  const node: DocNode = { type: 'text', text };
  // Stable canonical mark order (matches the schema order, which ProseMirror enforces).
  if (marks.length > 0) node.marks = marks.map((m) => ({ ...m })).sort((a, b) => rank(a) - rank(b));
  return node;
}

const HARD_BREAK_HTML = /^<br\s*\/?>$/i;

function inlineNodes(tokens: Tok[] | undefined, marks: DocMark[] = []): DocNode[] {
  const out: DocNode[] = [];
  for (const tok of tokens ?? []) {
    switch (tok.type) {
      case 'text':
        if (tok.tokens && tok.tokens.length > 0) out.push(...inlineNodes(tok.tokens, marks));
        else out.push(textNode(decodeEntities(String(tok.text ?? '')), marks));
        break;
      case 'escape':
        out.push(textNode(String(tok.text ?? ''), marks));
        break;
      case 'strong':
        out.push(...inlineNodes(tok.tokens, [...marks, { type: 'bold' }]));
        break;
      case 'em':
        out.push(...inlineNodes(tok.tokens, [...marks, { type: 'italic' }]));
        break;
      case 'del':
        out.push(...inlineNodes(tok.tokens, [...marks, { type: 'strike' }]));
        break;
      case 'highlight':
        out.push(...inlineNodes(tok.tokens, [...marks, { type: 'highlight' }]));
        break;
      case 'codespan':
        out.push(textNode(String(tok.text ?? ''), [...marks, { type: 'code' }]));
        break;
      case 'br':
        out.push({ type: 'hardBreak' });
        break;
      case 'link': {
        const href = String(tok.href ?? '');
        const raw = String(tok.raw ?? '');
        const isReferenceWithoutTarget = href === '' && !raw.includes('](');
        if (isReferenceWithoutTarget) {
          out.push(textNode(raw, marks));
          break;
        }
        const attrs: Record<string, unknown> = { href, title: tok.title ?? null };
        out.push(...inlineNodes(tok.tokens, [...marks.filter((m) => m.type !== 'link'), { type: 'link', attrs }]));
        break;
      }
      case 'image':
        out.push({
          type: 'image',
          attrs: { src: String(tok.href ?? ''), alt: decodeEntities(String(tok.text ?? '')), title: tok.title ?? null },
          ...(marks.length > 0 ? { marks: marks.map((m) => ({ ...m })) } : {}),
        });
        break;
      case 'html': {
        const raw = String(tok.raw ?? tok.text ?? '');
        if (HARD_BREAK_HTML.test(raw.trim())) out.push({ type: 'hardBreak' });
        else out.push(textNode(raw, marks));
        break;
      }
      default:
        if (typeof tok.raw === 'string') out.push(textNode(tok.raw, marks));
    }
  }
  return mergeText(out);
}

function paragraphFromInline(tokens: Tok[] | undefined): DocNode {
  const content = inlineNodes(tokens);
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function paragraphFromText(text: string): DocNode {
  return paragraphFromInline(lexInline(text));
}

/* ------------------------------------------------------------------------------------------
 * Blocks
 * ---------------------------------------------------------------------------------------- */

const CALLOUT_MARKER = /^\[!callout((?:[ \t]+[\w-]+=[^\s\]]*)*)[ \t]*\]/;
const DIRECTIVE = /^::(embed|board)\[(.*)\](?:\{([^}]*)\})?$/;
const DETAILS_OPEN = /^\s*<details((?:\s[^>]*)?)>\s*(?:<summary>([\s\S]*?)<\/summary>)?\s*([\s\S]*)$/i;
const DETAILS_CLOSE = /^\s*<\/details>\s*([\s\S]*)$/i;
const FRONT_MATTER = /^---[ \t]*\n(?:[\s\S]*?\n)?(?:---|\.\.\.)[ \t]*(?:\n|$)/;

function parseAttrList(source: string | undefined): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!source) return attrs;
  for (const match of source.matchAll(/([\w-]+)=("[^"]*"|[^\s"]*)/g)) {
    const key = match[1];
    if (key === undefined) continue;
    let value = match[2] ?? '';
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);
    attrs[key] = value;
  }
  return attrs;
}

function rawNode(source: string, kind: RawKind): DocNode {
  const text = source.replace(/\n+$/, '');
  return text === ''
    ? { type: 'rawMarkdown', attrs: { kind } }
    : { type: 'rawMarkdown', attrs: { kind }, content: [{ type: 'text', text }] };
}

function directiveNode(match: RegExpExecArray): DocNode {
  const kind = match[1];
  const target = (match[2] ?? '').replace(/%5B/g, '[').replace(/%5D/g, ']');
  const attrs = parseAttrList(match[3]);
  const heightNumber = Number(attrs.height);
  const height = Number.isFinite(heightNumber) && heightNumber > 0 ? Math.round(heightNumber) : EMBED_DEFAULT_HEIGHT;
  if (kind === 'board') return { type: 'boardEmbed', attrs: { path: target, height } };
  const fit: EmbedFit = attrs.fit === 'page' ? 'page' : 'text';
  return { type: 'embed', attrs: { url: target, height, fit } };
}

function ensureFirstParagraph(children: DocNode[]): DocNode[] {
  if (children.length === 0) return [{ type: 'paragraph' }];
  if (children[0]?.type !== 'paragraph') return [{ type: 'paragraph' }, ...children];
  return children;
}

function ensureBlocks(children: DocNode[]): DocNode[] {
  return children.length === 0 ? [{ type: 'paragraph' }] : children;
}

function convertCallout(tokens: Tok[], match: RegExpExecArray, first: Tok): DocNode {
  const attrs = parseAttrList(match[1]);
  const color = attrs.color && isCalloutColor(attrs.color) ? attrs.color : DEFAULT_CALLOUT_COLOR;
  const icon = attrs.icon && /^[a-z0-9-]+$/.test(attrs.icon) ? attrs.icon : DEFAULT_CALLOUT_ICON;
  const rest = String(first.text ?? '').slice(match[0].length).replace(/^[ \t]*\n?/, '');
  const restTokens = rest.trim() === '' ? [] : lex(rest);
  const children = convertBlocks([...restTokens, ...tokens.slice(1)]);
  return { type: 'callout', attrs: { color, icon }, content: ensureBlocks(children) };
}

interface DetailsFrame {
  summary: DocNode[];
  children: DocNode[];
}

function buildDetails(frame: DetailsFrame): DocNode {
  const summary: DocNode = frame.summary.length > 0 ? { type: 'detailsSummary', content: frame.summary } : { type: 'detailsSummary' };
  return {
    type: 'details',
    content: [summary, { type: 'detailsContent', content: ensureBlocks(frame.children) }],
  };
}

/** Summary text may carry marks but no hard breaks (the schema allows text only). */
function summaryNodes(source: string | undefined): DocNode[] {
  if (!source) return [];
  return inlineNodes(lexInline(source.trim())).filter((n) => n.type === 'text');
}

export function convertBlocks(input: Tok[]): DocNode[] {
  const tokens = [...input];
  const root: DocNode[] = [];
  const stack: DetailsFrame[] = [];
  const sink = (): DocNode[] => (stack.length > 0 ? (stack[stack.length - 1] as DetailsFrame).children : root);
  const push = (...nodes: DocNode[]): void => {
    sink().push(...nodes);
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] as Tok;
    switch (tok.type) {
      case 'space':
      case 'checkbox':
        break;
      case 'heading':
        push({
          type: 'heading',
          attrs: { level: Math.min(6, Math.max(1, Number(tok.depth) || 1)) },
          ...(inlineNodes(tok.tokens).length > 0 ? { content: inlineNodes(tok.tokens).filter((n) => n.type !== 'hardBreak') } : {}),
        });
        break;
      case 'paragraph': {
        const text = String(tok.text ?? '').trim();
        const directive = DIRECTIVE.exec(text);
        // "&nbsp;" alone is how the serializer writes an intentional empty paragraph.
        if (text === '&nbsp;') push({ type: 'paragraph' });
        else if (directive && !text.includes('\n')) push(directiveNode(directive));
        else push(paragraphFromInline(tok.tokens));
        break;
      }
      case 'text':
        push(paragraphFromInline(tok.tokens ?? lexInline(String(tok.text ?? ''))));
        break;
      case 'code': {
        const lang = typeof tok.lang === 'string' && tok.lang.trim() !== '' ? tok.lang.trim() : null;
        const code = String(tok.text ?? '');
        push({
          type: 'codeBlock',
          attrs: { language: lang },
          ...(code !== '' ? { content: [{ type: 'text', text: code }] } : {}),
        });
        break;
      }
      case 'hr':
        push({ type: 'horizontalRule', attrs: { variant: /^\s*\*/.test(String(tok.raw ?? '')) ? 'section' : 'line' } });
        break;
      case 'blockquote': {
        const children = (tok.tokens ?? []) as Tok[];
        const first = children[0];
        const match = first && first.type === 'paragraph' ? CALLOUT_MARKER.exec(String(first.text ?? '')) : null;
        if (first && match) push(convertCallout(children, match, first));
        else push({ type: 'blockquote', content: ensureBlocks(convertBlocks(children)) });
        break;
      }
      case 'list':
        push(...convertList(tok));
        break;
      case 'table':
        push(convertTable(tok));
        break;
      case 'def':
        push(rawNode(String(tok.raw ?? ''), 'definition'));
        break;
      case 'html': {
        const raw = String(tok.raw ?? '');
        const open = DETAILS_OPEN.exec(raw);
        if (open) {
          const rest = open[3] ?? '';
          stack.push({ summary: summaryNodes(open[2]), children: [] });
          if (rest.trim() !== '') tokens.splice(i + 1, 0, ...lex(rest));
          break;
        }
        const close = DETAILS_CLOSE.exec(raw);
        if (close && stack.length > 0) {
          const frame = stack.pop() as DetailsFrame;
          push(buildDetails(frame));
          const rest = close[1] ?? '';
          if (rest.trim() !== '') tokens.splice(i + 1, 0, ...lex(rest));
          break;
        }
        push(rawNode(raw, 'html'));
        break;
      }
      default:
        if (typeof tok.raw === 'string' && tok.raw.trim() !== '') push(rawNode(tok.raw, 'html'));
    }
  }

  while (stack.length > 0) {
    const frame = stack.pop() as DetailsFrame;
    (stack.length > 0 ? (stack[stack.length - 1] as DetailsFrame).children : root).push(buildDetails(frame));
  }
  return root;
}

function convertList(tok: Tok): DocNode[] {
  const groups: Array<{ task: boolean; items: DocNode[] }> = [];
  for (const item of (tok.items ?? []) as Tok[]) {
    const task = Boolean(item.task);
    const children = ensureFirstParagraph(convertBlocks((item.tokens ?? []) as Tok[]));
    const node: DocNode = task
      ? { type: 'taskItem', attrs: { checked: Boolean(item.checked) }, content: children }
      : { type: 'listItem', content: children };
    const last = groups[groups.length - 1];
    if (last && last.task === task) last.items.push(node);
    else groups.push({ task, items: [node] });
  }
  return groups.map((group) => {
    if (group.task) return { type: 'taskList', content: group.items };
    if (tok.ordered) {
      const start = typeof tok.start === 'number' && Number.isFinite(tok.start) ? tok.start : 1;
      return { type: 'orderedList', attrs: { start }, content: group.items };
    }
    return { type: 'bulletList', content: group.items };
  });
}

function convertCell(cell: Tok, header: boolean): DocNode {
  const align = cell.align === 'left' || cell.align === 'center' || cell.align === 'right' ? cell.align : null;
  return {
    type: header ? 'tableHeader' : 'tableCell',
    attrs: { align },
    content: [paragraphFromInline(cell.tokens)],
  };
}

function convertTable(tok: Tok): DocNode {
  const header = (tok.header ?? []) as Tok[];
  const rows = (tok.rows ?? []) as Tok[][];
  const out: DocNode[] = [{ type: 'tableRow', content: header.map((c) => convertCell(c, true)) }];
  for (const row of rows) {
    // Short rows are padded so every row has the header's column count.
    const cells = row.map((c) => convertCell(c, false));
    while (cells.length < header.length) cells.push({ type: 'tableCell', attrs: { align: null }, content: [{ type: 'paragraph' }] });
    out.push({ type: 'tableRow', content: cells.slice(0, Math.max(header.length, 1)) });
  }
  return { type: 'table', content: out };
}

/* ------------------------------------------------------------------------------------------
 * Entry point
 * ---------------------------------------------------------------------------------------- */

export function markdownToDoc(markdown: string): DocNode {
  const text = markdown.replace(/\r\n?/g, '\n');
  const blocks: DocNode[] = [];
  let body = text;
  const frontMatter = FRONT_MATTER.exec(text);
  if (frontMatter) {
    blocks.push(rawNode(frontMatter[0], 'frontmatter'));
    body = text.slice(frontMatter[0].length);
  }
  blocks.push(...convertBlocks(lex(body)));
  return { type: 'doc', content: blocks.length > 0 ? blocks : [{ type: 'paragraph' }] };
}

export { CALLOUT_COLORS };
