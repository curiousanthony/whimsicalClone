/**
 * Indented-list import/export for mind maps (pure).
 *
 *   paste a bulleted / indented list onto a node  -> its lines become child nodes
 *   copy a node as a list                         -> indented Markdown bullets
 *
 * Both Whimsical features: "Paste as > Mind maps" and "select the main node, copy, paste
 * special elsewhere" (research 02 section 6).
 */

import { plainText, richTextFromPlain } from '@renderer/core/richText';
import type { MindMapNodeElement, RichText } from '@renderer/core/types';
import { childIds, createNode, pickBranchColor, pickRootSide, type ElementsHolder, buildTreeIndex, rootOf } from './model';

export interface ListItem {
  text: string;
  children: ListItem[];
}

const BULLET = /^(?:[-*+•◦▪]|\d+[.)]|[a-zA-Z][.)])\s+/;

/** Measures leading whitespace (tab = 4 columns). */
function indentOf(line: string): number {
  let n = 0;
  for (const ch of line) {
    if (ch === ' ') n += 1;
    else if (ch === '\t') n += 4;
    else break;
  }
  return n;
}

/** Parses an indented / bulleted list into a forest. Returns [] for blank input. */
export function parseList(text: string): ListItem[] {
  const roots: ListItem[] = [];
  const stack: Array<{ indent: number; item: ListItem }> = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const indent = indentOf(raw);
    const content = raw.trim().replace(BULLET, '').trim();
    if (content === '') continue;
    const item: ListItem = { text: content, children: [] };
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const parent = stack[stack.length - 1]?.item;
    if (parent) parent.children.push(item);
    else roots.push(item);
    stack.push({ indent, item });
  }
  return roots;
}

/** Number of nodes in a forest. */
export function countItems(items: readonly ListItem[]): number {
  return items.reduce((n, i) => n + 1 + countItems(i.children), 0);
}

/** True when the text looks like a list worth turning into nodes (several lines). */
export function looksLikeList(text: string): boolean {
  return parseList(text).length > 0 && countItems(parseList(text)) > 1;
}

/**
 * Appends the items as new descendants of `parentId` (mutates `doc`, run inside api.update).
 * Returns the ids of the created first-level children.
 */
export function insertList(doc: ElementsHolder, parentId: string, items: readonly ListItem[], createId: () => string): string[] {
  const created: string[] = [];
  const add = (item: ListItem, targetParentId: string, topLevel: boolean): void => {
    const index = buildTreeIndex(doc.elements);
    const parent = index.nodes.get(targetParentId);
    const root = rootOf(index, targetParentId);
    if (!parent || !root) return;
    const first = parent.treeParentId === null;
    const order = childIds(index, targetParentId).length;
    const node: MindMapNodeElement = createNode({
      id: createId(),
      rootId: root.id,
      treeParentId: targetParentId,
      order,
      x: parent.x,
      y: parent.y,
      text: richTextFromPlain(item.text),
      textSize: first ? 'm' : parent.textSize,
      side: first ? pickRootSide(index, targetParentId) : undefined,
      color: first ? pickBranchColor(index, targetParentId) : (parent.color ?? pickBranchColor(index, root.id)),
    });
    doc.elements.push(node);
    if (topLevel) created.push(node.id);
    for (const child of item.children) add(child, node.id, false);
  };
  const parent = doc.elements.find((e) => e.id === parentId);
  if (parent && parent.type === 'mindmapNode' && parent.collapsed) delete parent.collapsed;
  for (const item of items) add(item, parentId, true);
  return created;
}

/** One line of text for a node (soft breaks become spaces). */
function lineOf(text: RichText): string {
  return plainText(text).replace(/\s*\n\s*/g, ' ').trim();
}

/** Serialises the subtree below (and including) `id` as an indented Markdown bullet list. */
export function subtreeToList(nodes: ReadonlyMap<string, MindMapNodeElement>, children: ReadonlyMap<string, readonly string[]>, id: string): string {
  const lines: string[] = [];
  const walk = (nid: string, depth: number): void => {
    const node = nodes.get(nid);
    if (!node) return;
    lines.push(`${'  '.repeat(depth)}- ${lineOf(node.text)}`);
    for (const c of children.get(nid) ?? []) walk(c, depth + 1);
  };
  walk(id, 0);
  return lines.join('\n');
}
