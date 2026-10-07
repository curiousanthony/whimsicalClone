/**
 * File kinds known to the app. Shared by main (tree filtering, creation) and renderer
 * (editor registry). Pure data: no DOM, no Node APIs.
 */

export type CanvasKind = 'board' | 'flowchart' | 'mindmap' | 'wireframe' | 'draw';
export type FileKind = CanvasKind | 'doc';

export interface FileKindInfo {
  kind: FileKind;
  /** Primary extension including the dot, e.g. ".wflow". Used when creating files. */
  extension: string;
  /** i18n key (namespace "common") for the human-readable type name. */
  labelKey: string;
  /** lucide-react icon component name used in the sidebar and create menu. */
  icon: string;
  /** Colour token (see core/palette.ts) used for the file icon. */
  color: 'purple' | 'blue' | 'green' | 'violet' | 'pink' | 'orange' | 'gray';
  /** Whether the file is a JSON board document (all canvas kinds) or Markdown text. */
  format: 'board-json' | 'markdown';
}

export const FILE_KINDS: readonly FileKindInfo[] = [
  { kind: 'board', extension: '.wboard', labelKey: 'fileKinds.board', icon: 'LayoutDashboard', color: 'purple', format: 'board-json' },
  { kind: 'flowchart', extension: '.wflow', labelKey: 'fileKinds.flowchart', icon: 'Workflow', color: 'violet', format: 'board-json' },
  { kind: 'mindmap', extension: '.wmind', labelKey: 'fileKinds.mindmap', icon: 'Network', color: 'pink', format: 'board-json' },
  { kind: 'wireframe', extension: '.wwire', labelKey: 'fileKinds.wireframe', icon: 'AppWindow', color: 'green', format: 'board-json' },
  { kind: 'draw', extension: '.wdraw', labelKey: 'fileKinds.draw', icon: 'PenLine', color: 'orange', format: 'board-json' },
  { kind: 'doc', extension: '.md', labelKey: 'fileKinds.doc', icon: 'FileText', color: 'blue', format: 'markdown' },
] as const;

/** Extra extensions accepted when opening (mapped to the same kind). */
const EXTENSION_ALIASES: Record<string, FileKind> = {
  '.markdown': 'doc',
};

export const CANVAS_KINDS: readonly CanvasKind[] = ['board', 'flowchart', 'mindmap', 'wireframe', 'draw'];

export function isCanvasKind(kind: FileKind): kind is CanvasKind {
  return kind !== 'doc';
}

export function getFileKindInfo(kind: FileKind): FileKindInfo {
  const info = FILE_KINDS.find((k) => k.kind === kind);
  if (!info) throw new Error(`Unknown file kind: ${kind}`);
  return info;
}

/** Returns the lowercase extension of a path including the dot ("" if none). */
export function extensionOf(path: string): string {
  const base = path.split('/').pop() ?? path;
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot).toLowerCase();
}

/** Maps a file path to its kind, or null if the file is not an app document. */
export function kindFromPath(path: string): FileKind | null {
  const ext = extensionOf(path);
  const direct = FILE_KINDS.find((k) => k.extension === ext);
  if (direct) return direct.kind;
  return EXTENSION_ALIASES[ext] ?? null;
}

/** File name without its app extension, used as the document title. */
export function titleFromPath(path: string): string {
  const base = path.split('/').pop() ?? path;
  const ext = extensionOf(base);
  return kindFromPath(base) ? base.slice(0, base.length - ext.length) : base;
}

/** Workspace-relative directory that holds app metadata. Hidden from the tree. */
export const WORKSPACE_META_DIR = '.whimsical';
/** Workspace-relative directory of content-addressed assets (images, files). */
export const WORKSPACE_ASSETS_DIR = '.whimsical/assets';
/** Custom protocol used by the renderer to load workspace assets: wsasset://<file>. */
export const ASSET_PROTOCOL = 'wsasset';
