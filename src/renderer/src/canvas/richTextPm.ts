/**
 * Conversion between the stored RichText model (core/types.ts) and TipTap / ProseMirror JSON
 * used by the canvas RichTextEditor. Pure; round-trips every RichText the editor can produce.
 */

import type { InlineMark, RichText, TextBlock, TextBlockType, TextSpan } from '@renderer/core/types';

export interface PmMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface PmNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  text?: string;
  marks?: PmMark[];
}

const MARK_TO_PM: Record<InlineMark, string> = {
  bold: 'bold',
  italic: 'italic',
  strike: 'strike',
  code: 'code',
  highlight: 'highlight',
};

const PM_TO_MARK: Record<string, InlineMark> = {
  bold: 'bold',
  italic: 'italic',
  strike: 'strike',
  code: 'code',
  highlight: 'highlight',
};

const LIST_TYPES: Partial<Record<TextBlockType, { list: string; item: string }>> = {
  ul: { list: 'bulletList', item: 'listItem' },
  ol: { list: 'orderedList', item: 'listItem' },
  check: { list: 'taskList', item: 'taskItem' },
};

/* ----------------------------------------------------------------------------------------- */
/* RichText -> ProseMirror                                                                     */
/* ----------------------------------------------------------------------------------------- */

function spansToInline(spans: readonly TextSpan[]): PmNode[] {
  const out: PmNode[] = [];
  for (const span of spans) {
    const marks: PmMark[] = (span.marks ?? []).map((m) => ({ type: MARK_TO_PM[m] }));
    if (span.href) marks.push({ type: 'link', attrs: { href: span.href } });
    const parts = span.text.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) out.push({ type: 'hardBreak' });
      if (part) out.push(marks.length > 0 ? { type: 'text', text: part, marks } : { type: 'text', text: part });
    });
  }
  return out;
}

function paragraph(spans: readonly TextSpan[]): PmNode {
  const content = spansToInline(spans);
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function blockToPm(block: TextBlock): PmNode {
  switch (block.type) {
    case 'h1':
    case 'h2':
    case 'h3': {
      const content = spansToInline(block.spans);
      const node: PmNode = { type: 'heading', attrs: { level: Number(block.type.slice(1)) } };
      if (content.length > 0) node.content = content;
      return node;
    }
    case 'code': {
      const text = block.spans.map((s) => s.text).join('');
      const node: PmNode = { type: 'codeBlock', attrs: { language: block.language ?? null } };
      if (text) node.content = [{ type: 'text', text }];
      return node;
    }
    default:
      return paragraph(block.spans);
  }
}

/** Builds a (possibly nested) list starting at `start`; returns the node and the next index. */
function buildList(blocks: readonly TextBlock[], start: number, indent: number): { node: PmNode; next: number } {
  const first = blocks[start]!;
  const kind = LIST_TYPES[first.type]!;
  const items: PmNode[] = [];
  let i = start;
  while (i < blocks.length) {
    const b = blocks[i]!;
    const bIndent = b.indent ?? 0;
    if (!LIST_TYPES[b.type] || bIndent < indent) break;
    if (bIndent === indent) {
      if (b.type !== first.type) break;
      const item: PmNode = { type: kind.item, content: [paragraph(b.spans)] };
      if (b.type === 'check') item.attrs = { checked: !!b.checked };
      items.push(item);
      i += 1;
    } else {
      // Deeper item: nest into the previous item (or a fresh item when there is none).
      const nested = buildList(blocks, i, bIndent);
      let host = items[items.length - 1];
      if (!host) {
        host = { type: kind.item, content: [paragraph([])] };
        if (first.type === 'check') host.attrs = { checked: false };
        items.push(host);
      }
      host.content = [...(host.content ?? []), nested.node];
      i = nested.next;
    }
  }
  return { node: { type: kind.list, content: items }, next: i };
}

export function richTextToPm(rich: RichText | undefined): PmNode {
  const blocks = rich?.blocks ?? [];
  const content: PmNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    if (LIST_TYPES[b.type]) {
      const { node, next } = buildList(blocks, i, b.indent ?? 0);
      content.push(node);
      i = next;
    } else if (b.type === 'quote') {
      const paras: PmNode[] = [];
      while (i < blocks.length && blocks[i]!.type === 'quote') {
        paras.push(paragraph(blocks[i]!.spans));
        i += 1;
      }
      content.push({ type: 'blockquote', content: paras });
    } else {
      content.push(blockToPm(b));
      i += 1;
    }
  }
  if (content.length === 0) content.push({ type: 'paragraph' });
  return { type: 'doc', content };
}

/* ----------------------------------------------------------------------------------------- */
/* ProseMirror -> RichText                                                                     */
/* ----------------------------------------------------------------------------------------- */

function sameMarks(a: TextSpan, b: TextSpan): boolean {
  const am = [...(a.marks ?? [])].sort().join(',');
  const bm = [...(b.marks ?? [])].sort().join(',');
  return am === bm && a.href === b.href;
}

function inlineToSpans(nodes: readonly PmNode[] | undefined): TextSpan[] {
  const spans: TextSpan[] = [];
  const push = (span: TextSpan) => {
    const last = spans[spans.length - 1];
    if (last && sameMarks(last, span)) last.text += span.text;
    else spans.push(span);
  };
  for (const node of nodes ?? []) {
    if (node.type === 'hardBreak') {
      const last = spans[spans.length - 1];
      if (last) last.text += '\n';
      else spans.push({ text: '\n' });
      continue;
    }
    if (node.type !== 'text' || !node.text) continue;
    const marks: InlineMark[] = [];
    let href: string | undefined;
    for (const m of node.marks ?? []) {
      const mapped = PM_TO_MARK[m.type];
      if (mapped) marks.push(mapped);
      if (m.type === 'link' && typeof m.attrs?.href === 'string') href = m.attrs.href;
    }
    const span: TextSpan = { text: node.text };
    if (marks.length > 0) span.marks = marks;
    if (href) span.href = href;
    push(span);
  }
  return spans;
}

function withIndent(block: TextBlock, indent: number): TextBlock {
  if (indent > 0) block.indent = indent;
  return block;
}

function listToBlocks(list: PmNode, indent: number, out: TextBlock[]): void {
  const type: TextBlockType = list.type === 'orderedList' ? 'ol' : list.type === 'taskList' ? 'check' : 'ul';
  for (const item of list.content ?? []) {
    let emitted = false;
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
        if (!emitted) {
          out.push(withIndent(type === 'check' ? { type, checked: !!item.attrs?.checked, spans: [] } : { type, spans: [] }, indent));
          emitted = true;
        }
        listToBlocks(child, indent + 1, out);
      } else if (!emitted) {
        const block: TextBlock = { type, spans: inlineToSpans(child.content) };
        if (type === 'check') block.checked = !!item.attrs?.checked;
        out.push(withIndent(block, indent));
        emitted = true;
      } else {
        // Extra paragraphs inside an item: keep them as soft breaks of the item text.
        const last = out[out.length - 1];
        if (last) last.spans.push({ text: '\n' }, ...inlineToSpans(child.content));
      }
    }
    if (!emitted) out.push(withIndent(type === 'check' ? { type, checked: !!item.attrs?.checked, spans: [] } : { type, spans: [] }, indent));
  }
}

export function pmToRichText(doc: PmNode): RichText {
  const blocks: TextBlock[] = [];
  for (const node of doc.content ?? []) {
    switch (node.type) {
      case 'heading': {
        const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
        blocks.push({ type: `h${level}` as TextBlockType, spans: inlineToSpans(node.content) });
        break;
      }
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        listToBlocks(node, 0, blocks);
        break;
      case 'blockquote':
        for (const child of node.content ?? []) blocks.push({ type: 'quote', spans: inlineToSpans(child.content) });
        break;
      case 'codeBlock': {
        const text = (node.content ?? []).map((c) => c.text ?? '').join('');
        const block: TextBlock = { type: 'code', spans: text ? [{ text }] : [] };
        if (typeof node.attrs?.language === 'string' && node.attrs.language) block.language = node.attrs.language;
        blocks.push(block);
        break;
      }
      default:
        blocks.push({ type: 'p', spans: inlineToSpans(node.content) });
    }
  }
  if (blocks.length === 0) blocks.push({ type: 'p', spans: [] });
  return { blocks };
}

/** Plain paragraphs only (mind-map nodes): flattens every block to "p". */
export function toParagraphsOnly(rich: RichText): RichText {
  return { blocks: rich.blocks.map((b) => ({ type: 'p', spans: b.spans.map((s) => ({ ...s })) })) };
}
