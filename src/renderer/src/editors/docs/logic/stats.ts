/** Footer statistics: block count and word count (Whimsical shows both). */

import type { DocNode } from '../markdown/constants';

const BLOCK_LEAVES = new Set([
  'paragraph',
  'heading',
  'codeBlock',
  'horizontalRule',
  'embed',
  'boardEmbed',
  'rawMarkdown',
  'detailsSummary',
]);

export interface DocStats {
  blocks: number;
  words: number;
}

function textOf(node: DocNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  const parts = (node.content ?? []).map(textOf);
  return BLOCK_LEAVES.has(node.type) || node.type === 'tableCell' || node.type === 'tableHeader' ? `${parts.join('')} ` : parts.join('');
}

export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+(?:['’\-.][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

/** Counts leaf blocks (an empty trailing paragraph does not count) and words. */
export function docStats(doc: DocNode): DocStats {
  let blocks = 0;
  const walk = (nodes: DocNode[] | undefined): void => {
    for (const node of nodes ?? []) {
      if (BLOCK_LEAVES.has(node.type)) {
        const empty = node.type === 'paragraph' && (node.content ?? []).length === 0;
        if (!empty) blocks++;
      } else if (node.content) walk(node.content);
    }
  };
  walk(doc.content);
  return { blocks, words: countWords(textOf(doc)) };
}
