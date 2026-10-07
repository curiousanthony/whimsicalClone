/**
 * Document JSON -> Markdown. Pure: no DOM, no React.
 *
 * Canonical output (SPEC 3.2): **bold**, _italic_, ~~strike~~, ==highlight==, `code`, GFM task
 * lists and tables, fenced code, `---` line divider, `***` section divider, `>` quotes,
 * `> [!callout ...]`, `<details><summary>`, `::embed[..]{..}`, `::board[..]{..}`.
 * Text is escaped so that re-parsing yields the same document (idempotent round trip).
 */

import { EMBED_DEFAULT_HEIGHT, type DocMark, type DocNode } from './constants';

/* ------------------------------------------------------------------------------------------
 * Escaping
 * ---------------------------------------------------------------------------------------- */

const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

interface EscapeOptions {
  /** The text starts a line of the output (block constructs must be neutralised). */
  lineStart: boolean;
  /** Inside a GFM table cell: pipes are escaped. */
  table?: boolean;
}

function escapeLine(line: string, lineStart: boolean, table: boolean): string {
  let out = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    const prev = line.charAt(i - 1) || undefined;
    const next = line.charAt(i + 1) || undefined;
    switch (ch) {
      case '\\':
      case '`':
      case '*':
      case '[':
      case ']':
      case '~':
        out += `\\${ch}`;
        break;
      case '_':
        out += isWordChar(prev) && isWordChar(next) ? '_' : '\\_';
        break;
      case '<':
        out += next !== undefined && /[A-Za-z/!?]/.test(next) ? '\\<' : '<';
        break;
      case '=':
        out += prev === '=' || next === '=' ? '\\=' : '=';
        break;
      case '&':
        out += /^&#?\w+;/.test(line.slice(i)) ? '\\&' : '&';
        break;
      case '|':
        out += table ? '\\|' : '|';
        break;
      default:
        out += ch;
    }
  }
  if (lineStart && !table) {
    if (/^ {4,}/.test(out)) out = out.replace(/^ +/, (spaces) => ' '.repeat(spaces.length));
    if (/^#{1,6}(\s|$)/.test(out)) out = `\\${out}`;
    else if (/^>/.test(out)) out = `\\${out}`;
    else if (/^[-+](\s|$)/.test(out)) out = `\\${out}`;
    else if (/^(=+|-+)\s*$/.test(out)) out = `\\${out}`;
    else if (/^\d{1,9}[.)](\s|$)/.test(out)) out = out.replace(/^(\d+)([.)])/, '$1\\$2');
    else if (/^::/.test(out)) out = `\\${out}`;
  }
  return out;
}

/** Escapes plain text for Markdown. `\n` inside text is a soft line break. */
export function escapeText(text: string, options: EscapeOptions): string {
  return text
    .split('\n')
    .map((line, index) => escapeLine(line, index === 0 ? options.lineStart : true, options.table === true))
    .join('\n');
}

/* ------------------------------------------------------------------------------------------
 * Inline
 * ---------------------------------------------------------------------------------------- */

type InlineItem =
  | { kind: 'text'; text: string; marks: DocMark[]; lineStart: boolean }
  | { kind: 'break'; marks: DocMark[] }
  | { kind: 'image'; node: DocNode; marks: DocMark[] };

const MARK_ORDER = ['link', 'bold', 'italic', 'strike', 'highlight', 'code'] as const;

function findMark(item: InlineItem, type: string): DocMark | undefined {
  return item.marks.find((m) => m.type === type);
}

function sameMark(a: DocMark | undefined, b: DocMark | undefined): boolean {
  if (!a || !b) return false;
  if (a.type !== b.type) return false;
  if (a.type !== 'link') return true;
  return (a.attrs?.href ?? '') === (b.attrs?.href ?? '') && (a.attrs?.title ?? null) === (b.attrs?.title ?? null);
}

function stripMark(item: InlineItem, type: string): InlineItem {
  return { ...item, marks: item.marks.filter((m) => m.type !== type) };
}

function flattenInline(nodes: DocNode[] | undefined, inTable: boolean): InlineItem[] {
  const items: InlineItem[] = [];
  let lineStart = true;
  for (const node of nodes ?? []) {
    const marks = (node.marks ?? []).filter((m) => (MARK_ORDER as readonly string[]).includes(m.type));
    if (node.type === 'text') {
      const text = node.text ?? '';
      if (text === '') continue;
      items.push({ kind: 'text', text: inTable ? text.replace(/\n/g, ' ') : text, marks, lineStart });
      lineStart = text.endsWith('\n');
    } else if (node.type === 'hardBreak') {
      items.push({ kind: 'break', marks });
      lineStart = true;
    } else if (node.type === 'image') {
      items.push({ kind: 'image', node, marks });
      lineStart = false;
    } else if (node.content) {
      items.push(...flattenInline(node.content, inTable));
    }
  }
  while (items.length > 0 && items[items.length - 1]?.kind === 'break') items.pop();
  while (items.length > 0 && items[0]?.kind === 'break') items.shift();
  return items;
}

function codeSpan(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') || (text.startsWith(' ') && text.endsWith(' ') && text.trim() !== '') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

function formatDestination(href: string): string {
  if (href === '' || /[\s()<>]/.test(href)) return `<${href.replace(/</g, '%3C').replace(/>/g, '%3E')}>`;
  return href;
}

function formatTitle(title: unknown): string {
  return typeof title === 'string' && title !== '' ? ` "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : '';
}

const BARE_URL = /^https?:\/\/[A-Za-z0-9\-._~:/?#@!$&'+,;=%]*[A-Za-z0-9/]$/;

interface InlineContext {
  table: boolean;
}

function leafText(item: InlineItem, ctx: InlineContext): string {
  if (item.kind === 'break') return ctx.table ? '<br>' : '\\\n';
  if (item.kind === 'image') {
    const attrs = item.node.attrs ?? {};
    const alt = String(attrs.alt ?? '').replace(/[\\[\]]/g, (c) => `\\${c}`);
    return `![${alt}](${formatDestination(String(attrs.src ?? ''))}${formatTitle(attrs.title)})`;
  }
  return escapeText(item.text, { lineStart: item.lineStart, table: ctx.table });
}

function plainText(items: InlineItem[]): string | null {
  let out = '';
  for (const item of items) {
    if (item.kind !== 'text') return null;
    out += item.text;
  }
  return out;
}

function wrapMark(type: string, mark: DocMark, run: InlineItem[], order: readonly string[], ctx: InlineContext, before: string, after: string): string {
  if (type === 'code') {
    const raw = plainText(run);
    if (raw !== null) return codeSpan(raw.replace(/\n/g, ' '));
    return serializeItems(run.map((i) => stripMark(i, 'code')), order, ctx);
  }
  const inner = serializeItems(run.map((i) => stripMark(i, type)), order, ctx);
  if (type === 'link') {
    const href = String(mark.attrs?.href ?? '');
    const text = plainText(run.map((i) => stripMark(i, 'link')));
    if (text !== null && text === href && !mark.attrs?.title && BARE_URL.test(href)) {
      return after === '' || /^[\s,.;:!?)\]}]/.test(after) ? escapeUrlLiteral(href) : `<${href}>`;
    }
    if (text !== null && text === href && !mark.attrs?.title && /^[a-z][a-z0-9+.-]*:[^\s<>]*$/i.test(href)) return `<${href}>`;
    return `[${inner}](${formatDestination(href)}${formatTitle(mark.attrs?.title)})`;
  }
  const lead = /^\s*/.exec(inner)?.[0] ?? '';
  const trail = /\s*$/.exec(inner.slice(lead.length))?.[0] ?? '';
  const core = inner.trim();
  if (core === '') return inner;
  let delimiter: string;
  switch (type) {
    case 'bold':
      delimiter = '**';
      break;
    case 'italic':
      delimiter = isWordChar(before.slice(-1)) || isWordChar(after.charAt(0)) ? '*' : '_';
      break;
    case 'strike':
      delimiter = '~~';
      break;
    default:
      delimiter = '==';
  }
  return `${lead}${delimiter}${core}${delimiter}${trail}`;
}

function escapeUrlLiteral(url: string): string {
  return url;
}

function firstChar(items: InlineItem[], from: number): string {
  const item = items[from];
  if (!item) return '';
  if (item.kind === 'text') return item.text.charAt(0);
  if (item.kind === 'break') return '\\';
  return '!';
}

function serializeItems(items: InlineItem[], order: readonly string[], ctx: InlineContext): string {
  const [type, ...rest] = order;
  if (type === undefined) return items.map((item) => leafText(item, ctx)).join('');
  let out = '';
  let i = 0;
  while (i < items.length) {
    const item = items[i] as InlineItem;
    const mark = findMark(item, type);
    let j = i + 1;
    if (!mark) {
      while (j < items.length && !findMark(items[j] as InlineItem, type)) j++;
      out += serializeItems(items.slice(i, j), rest, ctx);
    } else {
      while (j < items.length && sameMark(findMark(items[j] as InlineItem, type), mark)) j++;
      out += wrapMark(type, mark, items.slice(i, j), rest, ctx, out, firstChar(items, j));
    }
    i = j;
  }
  return out;
}

/** Serializes inline content (text with marks, hard breaks, images) of a text block. */
export function serializeInline(nodes: DocNode[] | undefined, ctx: InlineContext = { table: false }): string {
  const items = flattenInline(nodes, ctx.table);
  const out = serializeItems(items, MARK_ORDER, ctx);
  // Trailing spaces before a soft break would turn into a hard break; trailing spaces at the end are noise.
  return out.replace(/[ \t]+(?=\n)/g, '').replace(/[ \t]+$/, '');
}

function textOf(node: DocNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  return (node.content ?? []).map(textOf).join('');
}

/* ------------------------------------------------------------------------------------------
 * Blocks
 * ---------------------------------------------------------------------------------------- */

type Container = 'doc' | 'listItem' | 'quote';
const LISTS = new Set(['bulletList', 'orderedList', 'taskList']);

function indent(text: string, first: string, rest: string): string {
  return text
    .split('\n')
    .map((line, i) => {
      const prefix = i === 0 ? first : rest;
      return line === '' ? prefix.trimEnd() : prefix + line;
    })
    .join('\n');
}

function fenceFor(code: string): string {
  const runs = code.match(/`{3,}/g) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 2);
  return '`'.repeat(longest + 1);
}

function serializeTable(node: DocNode): string {
  const rows = node.content ?? [];
  if (rows.length === 0) return '';
  const cellText = (cell: DocNode): string => {
    const parts: string[] = [];
    for (const child of cell.content ?? []) {
      if (child.type === 'paragraph') parts.push(serializeInline(child.content, { table: true }));
      else {
        const text = textOf(child).trim();
        if (text !== '') parts.push(escapeText(text, { lineStart: false, table: true }));
      }
    }
    return parts.join('<br>');
  };
  const render = (row: DocNode): string => `| ${(row.content ?? []).map(cellText).join(' | ')} |`;
  const first = rows[0] as DocNode;
  const columns = (first.content ?? []).length;
  const aligns = (first.content ?? []).map((cell) => String(cell.attrs?.align ?? ''));
  const delimiter = `| ${Array.from({ length: columns }, (_, c) => {
    switch (aligns[c]) {
      case 'left':
        return ':---';
      case 'center':
        return ':---:';
      case 'right':
        return '---:';
      default:
        return '---';
    }
  }).join(' | ')} |`;
  return [render(first), delimiter, ...rows.slice(1).map(render)].join('\n');
}

function serializeListItem(item: DocNode, first: string, width: number): string {
  const body = serializeBlocks(item.content ?? [], 'listItem');
  const lines = body === '' ? [''] : body.split('\n');
  return lines
    .map((line, i) => {
      if (i === 0) return line === '' ? first.trimEnd() : `${first} ${line}`;
      return line === '' ? '' : ' '.repeat(width) + line;
    })
    .join('\n');
}

function serializeList(node: DocNode, alternate: boolean): string {
  const items = node.content ?? [];
  if (node.type === 'orderedList') {
    const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1;
    const delimiter = alternate ? ')' : '.';
    return items
      .map((item, i) => {
        const marker = `${start + i}${delimiter}`;
        return serializeListItem(item, marker, marker.length + 1);
      })
      .join('\n');
  }
  const bullet = alternate ? '*' : '-';
  if (node.type === 'taskList') {
    return items
      .map((item) => serializeListItem(item, `${bullet} [${item.attrs?.checked ? 'x' : ' '}]`, 2))
      .join('\n');
  }
  return items.map((item) => serializeListItem(item, bullet, 2)).join('\n');
}

function serializeBlock(node: DocNode, alternate: boolean): string {
  switch (node.type) {
    case 'paragraph': {
      const text = (node.content ?? []).map(textOf).join('');
      if (text === ' ' && (node.content ?? []).length === 1) return '&nbsp;';
      return serializeInline(node.content);
    }
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      const text = serializeInline((node.content ?? []).filter((n) => n.type !== 'hardBreak')).replace(/\n/g, ' ');
      return text === '' ? '#'.repeat(level) : `${'#'.repeat(level)} ${text}`;
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return serializeList(node, alternate);
    case 'blockquote': {
      const body = serializeBlocks(node.content ?? [], 'quote');
      return indent(body === '' ? '' : body, '> ', '> ');
    }
    case 'callout': {
      const color = String(node.attrs?.color ?? 'blue');
      const icon = String(node.attrs?.icon ?? 'info');
      const children = (node.content ?? []).filter((c, i, all) => !(c.type === 'paragraph' && (c.content ?? []).length === 0 && i === all.length - 1 && all.length > 1));
      const body = serializeBlocks(children, 'quote');
      const marker = `[!callout color=${color} icon=${icon}]`;
      const firstIsParagraph = children[0]?.type === 'paragraph' && (children[0].content ?? []).length > 0;
      const text = body === '' ? marker : firstIsParagraph ? `${marker}\n${body}` : `${marker}\n\n${body}`;
      return indent(text, '> ', '> ');
    }
    case 'codeBlock': {
      const code = (node.content ?? []).map((n) => n.text ?? '').join('');
      const fence = fenceFor(code);
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      return `${fence}${language}\n${code}${code === '' || code.endsWith('\n') ? '' : '\n'}${fence}`;
    }
    case 'horizontalRule':
      return node.attrs?.variant === 'section' ? '***' : '---';
    case 'table':
      return serializeTable(node);
    case 'details': {
      const summary = node.content?.find((c) => c.type === 'detailsSummary');
      const content = node.content?.find((c) => c.type === 'detailsContent');
      const title = serializeInline(summary?.content).replace(/\n/g, ' ');
      const body = serializeBlocks(content?.content ?? [], 'doc');
      return `<details>\n<summary>${title}</summary>\n\n${body === '' ? '' : `${body}\n\n`}</details>`;
    }
    case 'embed': {
      const url = String(node.attrs?.url ?? '').replace(/\[/g, '%5B').replace(/\]/g, '%5D');
      const height = Number(node.attrs?.height) || EMBED_DEFAULT_HEIGHT;
      const fit = node.attrs?.fit === 'page' ? 'page' : 'text';
      return `::embed[${url}]{height=${height} fit=${fit}}`;
    }
    case 'boardEmbed': {
      const path = String(node.attrs?.path ?? '').replace(/\[/g, '%5B').replace(/\]/g, '%5D');
      const height = Number(node.attrs?.height) || EMBED_DEFAULT_HEIGHT;
      return `::board[${path}]{height=${height}}`;
    }
    case 'rawMarkdown':
      return (node.content ?? []).map((n) => n.text ?? '').join('');
    case 'image':
      return serializeInline([node]);
    default:
      // Unknown block: keep its text so nothing is lost silently.
      return node.content ? serializeBlocks(node.content, 'doc') : serializeInline([node]);
  }
}

/** Serializes sibling blocks separated by blank lines (lists stay tight). */
export function serializeBlocks(nodes: DocNode[], container: Container = 'doc'): string {
  let out = '';
  let prev: DocNode | undefined;
  let prevAlternate = false;
  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1;
    const isEmptyParagraph = node.type === 'paragraph' && (node.content ?? []).length === 0;
    if (isEmptyParagraph) {
      // Empty paragraphs only matter as vertical spacing between blocks of the document body.
      if (isLast || container === 'listItem') return;
    }
    const isBulletish = node.type === 'bulletList' || node.type === 'taskList';
    const prevBulletish = prev?.type === 'bulletList' || prev?.type === 'taskList';
    const prevOrdered = prev?.type === 'orderedList';
    const alternate =
      (isBulletish && prevBulletish && !prevAlternate) || (node.type === 'orderedList' && prevOrdered && !prevAlternate);
    const text = isEmptyParagraph ? '&nbsp;' : serializeBlock(node, alternate);
    if (text === '' && !isEmptyParagraph && node.type === 'paragraph') return;
    if (prev !== undefined) {
      const tight = container === 'listItem' && prev.type === 'paragraph' && LISTS.has(node.type);
      out += tight ? '\n' : '\n\n';
    }
    out += text;
    prev = node;
    prevAlternate = alternate;
  });
  return out;
}

/** Serializes a whole document to canonical Markdown (ends with a newline unless empty). */
export function docToMarkdown(doc: DocNode): string {
  const body = serializeBlocks(doc.content ?? [], 'doc');
  return body === '' ? '' : `${body}\n`;
}

/** Serializes a fragment (e.g. the selection) given as a list of blocks. */
export function blocksToMarkdown(blocks: DocNode[]): string {
  const body = serializeBlocks(blocks, 'doc');
  return body === '' ? '' : `${body}\n`;
}
