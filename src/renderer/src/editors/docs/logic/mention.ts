/** `@` workspace links: flatten the workspace tree into linkable files and filter by query. */

import { kindFromPath, titleFromPath, type FileKind } from '@shared/fileKinds';
import type { TreeNode } from '@shared/ipc';

export interface LinkableFile {
  path: string;
  /** Display name without extension. */
  name: string;
  kind: FileKind;
  /** Containing folder ("" for the workspace root). */
  folder: string;
  mtimeMs: number;
}

/** All app documents of the workspace tree. */
export function flattenFiles(tree: TreeNode): LinkableFile[] {
  const out: LinkableFile[] = [];
  const walk = (node: TreeNode): void => {
    if (node.type === 'file') {
      const kind = node.kind ?? kindFromPath(node.path);
      if (kind) {
        const slash = node.path.lastIndexOf('/');
        out.push({
          path: node.path,
          name: titleFromPath(node.path),
          kind,
          folder: slash >= 0 ? node.path.slice(0, slash) : '',
          mtimeMs: node.mtimeMs,
        });
      }
      return;
    }
    node.children?.forEach(walk);
  };
  walk(tree);
  return out;
}

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

/** Ranks files for a query: prefix > word prefix > substring; empty query = most recent first. */
export function filterFiles(files: readonly LinkableFile[], query: string, excludePath?: string, limit = 8): LinkableFile[] {
  const q = norm(query.trim());
  const pool = files.filter((f) => f.path !== excludePath);
  if (q === '') return [...pool].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
  const scored: Array<{ file: LinkableFile; score: number }> = [];
  for (const file of pool) {
    const n = norm(file.name);
    let score = 0;
    if (n === q) score = 100;
    else if (n.startsWith(q)) score = 80;
    else if (n.split(/[\s\-_]+/).some((w) => w.startsWith(q))) score = 60;
    else if (n.includes(q)) score = 40;
    else if (norm(file.folder).includes(q)) score = 10;
    if (score > 0) scored.push({ file, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.file.mtimeMs - a.file.mtimeMs)
    .slice(0, limit)
    .map((s) => s.file);
}

/** Relative path of `target` unchanged (links are workspace-relative, SPEC 3.2). */
export function fileLinkText(file: LinkableFile): string {
  return file.name;
}
