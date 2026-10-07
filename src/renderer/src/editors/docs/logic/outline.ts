/** Table of contents: pure headings -> outline function. */

import type { DocNode } from '../markdown/constants';

export interface OutlineItem {
  /** Index among the document's headings. */
  index: number;
  level: number;
  text: string;
  /** ProseMirror position of the heading node (when computed from a PM doc). */
  pos: number;
}

export interface HeadingSource {
  level: number;
  text: string;
  pos: number;
}

/** Normalises heading sources into outline items; empty headings are skipped. */
export function buildOutline(headings: readonly HeadingSource[]): OutlineItem[] {
  const out: OutlineItem[] = [];
  for (const h of headings) {
    const text = h.text.replace(/\s+/g, ' ').trim();
    if (text === '') continue;
    out.push({ index: out.length, level: Math.min(6, Math.max(1, h.level)), text, pos: h.pos });
  }
  return out;
}

function textOf(node: DocNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  return (node.content ?? []).map(textOf).join('');
}

/** Headings of a document JSON (top level and nested containers); `pos` is the heading ordinal. */
export function outlineFromDoc(doc: DocNode): OutlineItem[] {
  const sources: HeadingSource[] = [];
  const walk = (nodes: DocNode[] | undefined): void => {
    for (const node of nodes ?? []) {
      if (node.type === 'heading') {
        sources.push({ level: Number(node.attrs?.level) || 1, text: textOf(node), pos: sources.length });
      } else if (node.content) walk(node.content);
    }
  };
  walk(doc.content);
  return buildOutline(sources);
}

/** Depth to indent an outline entry: relative to the shallowest heading level present. */
export function outlineDepth(items: readonly OutlineItem[], item: OutlineItem): number {
  const min = items.reduce((m, i) => Math.min(m, i.level), 6);
  return item.level - min;
}

/** Index of the heading the reader is "in" given the pos of the caret / viewport top. */
export function activeOutlineIndex(items: readonly OutlineItem[], pos: number): number {
  let active = -1;
  for (const item of items) {
    if (item.pos <= pos) active = item.index;
    else break;
  }
  return active;
}
