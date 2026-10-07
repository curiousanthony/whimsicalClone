/**
 * Pure helpers over the workspace tree and RelPaths (no React, no IPC).
 */

import { kindFromPath, titleFromPath } from '@shared/fileKinds';
import type { RelPath, TreeNode, WorkspaceMeta } from '@shared/ipc';

export function parentOf(path: RelPath): RelPath {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function baseName(path: RelPath): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? path : path.slice(i + 1);
}

export function joinPath(dir: RelPath, name: string): RelPath {
  return dir === '' ? name : `${dir}/${name}`;
}

/** Display title: file name without its app extension. */
export function displayName(path: RelPath, rootName = ''): string {
  if (path === '') return rootName;
  return titleFromPath(baseName(path));
}

/** True when `path` is `ancestor` or inside it. */
export function isWithin(path: RelPath, ancestor: RelPath): boolean {
  if (ancestor === '') return true;
  return path === ancestor || path.startsWith(`${ancestor}/`);
}

/** Rewrites `path` if it is `from` or inside it; otherwise returns it unchanged. */
export function rebasePath(path: RelPath, from: RelPath, to: RelPath): RelPath {
  if (path === from) return to;
  if (from !== '' && path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  return path;
}

export function findNode(root: TreeNode | null, path: RelPath): TreeNode | null {
  if (!root) return null;
  if (path === '') return root;
  let node: TreeNode | undefined = root;
  const parts = path.split('/');
  let current = '';
  for (const part of parts) {
    current = current === '' ? part : `${current}/${part}`;
    node = node?.children?.find((c) => c.path === current);
    if (!node) return null;
  }
  return node;
}

/** All files (depth-first, tree order), optionally only supported documents. */
export function listFiles(root: TreeNode | null, onlyDocuments = true): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (node: TreeNode) => {
    for (const child of node.children ?? []) {
      if (child.type === 'folder') walk(child);
      else if (!onlyDocuments || child.kind) out.push(child);
    }
  };
  if (root) walk(root);
  return out;
}

/** Children sorted by the folder's manual order (names) when present, then default order. */
export function orderedChildren(node: TreeNode, meta: WorkspaceMeta | null, showUnsupported = false): TreeNode[] {
  const children = (node.children ?? []).filter((c) => c.type === 'folder' || showUnsupported || !!c.kind);
  const order = meta?.manualOrder[node.path];
  if (!order || order.length === 0) return children;
  const rank = new Map(order.map((name, i) => [name, i]));
  return [...children].sort((a, b) => {
    const ra = rank.get(a.name);
    const rb = rank.get(b.name);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return 0;
  });
}

/** Rows of the visible tree given expanded folders (for keyboard navigation). */
export interface VisibleRow {
  node: TreeNode;
  depth: number;
}

export function visibleRows(
  root: TreeNode | null,
  expanded: ReadonlySet<RelPath>,
  meta: WorkspaceMeta | null,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const walk = (node: TreeNode, depth: number) => {
    for (const child of orderedChildren(node, meta)) {
      rows.push({ node: child, depth });
      if (child.type === 'folder' && expanded.has(child.path)) walk(child, depth + 1);
    }
  };
  if (root) walk(root, 0);
  return rows;
}

/** Folder that should receive new files: the folder itself, or the parent of a file. */
export function containingFolder(root: TreeNode | null, path: RelPath | null | undefined): RelPath {
  if (!path) return '';
  const node = findNode(root, path);
  if (node?.type === 'folder') return node.path;
  return parentOf(path);
}

/** Can `source` be moved into folder `dest`? (not into itself, not a no-op). */
export function canMoveInto(source: RelPath, dest: RelPath): boolean {
  if (source === '') return false;
  if (isWithin(dest, source)) return false;
  return parentOf(source) !== dest;
}

/** Workspace link for a file (`wc://file/<relPath>`), URL-encoded per segment. */
export function fileLink(path: RelPath): string {
  return `wc://file/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Parses a `wc://file/...` link back to a RelPath, or null. */
export function parseFileLink(link: string): RelPath | null {
  const prefix = 'wc://file/';
  if (!link.startsWith(prefix)) return null;
  try {
    return link
      .slice(prefix.length)
      .split('/')
      .map((s) => decodeURIComponent(s))
      .join('/');
  } catch {
    return null;
  }
}

export function isDocumentPath(path: RelPath): boolean {
  return kindFromPath(path) !== null;
}
