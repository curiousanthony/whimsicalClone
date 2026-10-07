/** Shared constants of the Markdown <-> document converter (pure, no DOM / React). */

/** Minimal ProseMirror JSON shape (structurally compatible with TipTap's JSONContent). */
export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
}

/** The 12 Whimsical callout colours (research 03 section 2.5). */
export const CALLOUT_COLORS = [
  'blue',
  'red',
  'pale-red',
  'orange',
  'yellow',
  'brown',
  'green',
  'dark-green',
  'purple',
  'dark-purple',
  'whimsy-blue',
  'silver',
] as const;
export type CalloutColor = (typeof CALLOUT_COLORS)[number];

export const DEFAULT_CALLOUT_COLOR: CalloutColor = 'blue';
export const DEFAULT_CALLOUT_ICON = 'info';

/** Presets offered by the callout menu: Whimsical's info / error / tip / warning plus extras. */
export const CALLOUT_PRESETS: ReadonlyArray<{ id: string; color: CalloutColor; icon: string }> = [
  { id: 'info', color: 'blue', icon: 'info' },
  { id: 'error', color: 'red', icon: 'flag' },
  { id: 'tip', color: 'green', icon: 'thumbs-up' },
  { id: 'warning', color: 'yellow', icon: 'triangle-alert' },
];

/** lucide icon names a callout can carry (kebab-case, stored in the Markdown). */
export const CALLOUT_ICONS = [
  'info',
  'flag',
  'thumbs-up',
  'triangle-alert',
  'lightbulb',
  'star',
  'heart',
  'circle-check',
  'circle-x',
  'bell',
  'bookmark',
  'rocket',
  'pin',
  'zap',
  'book-open',
  'message-square',
] as const;

export const EMBED_DEFAULT_HEIGHT = 525;
export type EmbedFit = 'text' | 'page';

/** Prefix of internal links to workspace files (SPEC 3.2). */
export const FILE_LINK_PREFIX = 'wc://file/';

export const RAW_KINDS = ['html', 'frontmatter', 'definition'] as const;
export type RawKind = (typeof RAW_KINDS)[number];

export function isCalloutColor(value: string): value is CalloutColor {
  return (CALLOUT_COLORS as readonly string[]).includes(value);
}

/** Builds the internal link target of a workspace file. */
export function fileLinkHref(relPath: string): string {
  return `${FILE_LINK_PREFIX}${relPath}`;
}

/** Returns the workspace-relative path of a `wc://file/<relPath>` href (optional #anchor stripped). */
export function parseFileLink(href: string): { path: string; anchor?: string } | null {
  if (!href.startsWith(FILE_LINK_PREFIX)) return null;
  const rest = href.slice(FILE_LINK_PREFIX.length);
  const hash = rest.indexOf('#');
  const path = hash >= 0 ? rest.slice(0, hash) : rest;
  const anchor = hash >= 0 ? rest.slice(hash + 1) : undefined;
  // Paths are stored verbatim (no percent-encoding); links with spaces use the <...> form.
  return anchor ? { path, anchor } : { path };
}
