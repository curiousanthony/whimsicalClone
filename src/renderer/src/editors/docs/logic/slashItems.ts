/**
 * The `/` block menu: 22 items in Whimsical's order (research 03 section 2.2) and the pure
 * filtering used by the popup. Execution lives in extensions/blockCommands.ts.
 */

export type SlashItemId =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'checklist'
  | 'toggleList'
  | 'table'
  | 'codeBlock'
  | 'callout'
  | 'quote'
  | 'unquote'
  | 'nestedDoc'
  | 'nestedBoard'
  | 'nestedFolder'
  | 'workspaceLink'
  | 'link'
  | 'embed'
  | 'sectionDivider'
  | 'lineDivider'
  | 'emoji';

export interface SlashItem {
  id: SlashItemId;
  /** i18n key in the docs namespace (without ns): blockMenu.<id>. */
  labelKey: string;
  /** lucide-react icon name. */
  icon: string;
  /** Markdown trigger shown as a hint (typed at the start of a line). */
  trigger?: string;
  /** Shortcut command id (resolved to a key label by the registry). */
  shortcutId?: string;
  /** Extra search terms (English; the localized label is matched as well). */
  keywords: readonly string[];
}

export const SLASH_ITEMS: readonly SlashItem[] = [
  { id: 'paragraph', labelKey: 'blockMenu.paragraph', icon: 'Pilcrow', shortcutId: 'docs.paragraph', keywords: ['text', 'plain', 'p'] },
  { id: 'heading1', labelKey: 'blockMenu.heading1', icon: 'Heading1', trigger: '#', keywords: ['h1', 'title', 'header'] },
  { id: 'heading2', labelKey: 'blockMenu.heading2', icon: 'Heading2', trigger: '##', keywords: ['h2', 'subtitle', 'header'] },
  { id: 'heading3', labelKey: 'blockMenu.heading3', icon: 'Heading3', trigger: '###', keywords: ['h3', 'header'] },
  { id: 'bulletList', labelKey: 'blockMenu.bulletList', icon: 'List', trigger: '-', shortcutId: 'docs.mdBulletList', keywords: ['bullet', 'unordered', 'ul'] },
  { id: 'numberedList', labelKey: 'blockMenu.numberedList', icon: 'ListOrdered', trigger: '1.', shortcutId: 'docs.mdNumberedList', keywords: ['number', 'ordered', 'ol'] },
  { id: 'checklist', labelKey: 'blockMenu.checklist', icon: 'ListTodo', trigger: '_', keywords: ['todo', 'task', 'check', 'checkbox'] },
  { id: 'toggleList', labelKey: 'blockMenu.toggleList', icon: 'ChevronRight', keywords: ['collapse', 'details', 'accordion', 'fold'] },
  { id: 'table', labelKey: 'blockMenu.table', icon: 'Table', keywords: ['grid', 'spreadsheet', 'rows', 'columns'] },
  { id: 'codeBlock', labelKey: 'blockMenu.codeBlock', icon: 'SquareCode', trigger: '```', keywords: ['code', 'snippet', 'pre'] },
  { id: 'callout', labelKey: 'blockMenu.callout', icon: 'Info', keywords: ['info', 'note', 'tip', 'warning', 'alert', 'admonition'] },
  { id: 'quote', labelKey: 'blockMenu.quote', icon: 'Quote', trigger: '>', keywords: ['blockquote', 'cite'] },
  { id: 'unquote', labelKey: 'blockMenu.unquote', icon: 'TextQuote', keywords: ['lift', 'remove quote'] },
  { id: 'nestedDoc', labelKey: 'blockMenu.nestedDoc', icon: 'FileText', keywords: ['doc', 'page', 'file', 'new'] },
  { id: 'nestedBoard', labelKey: 'blockMenu.nestedBoard', icon: 'LayoutDashboard', keywords: ['board', 'canvas', 'new'] },
  { id: 'nestedFolder', labelKey: 'blockMenu.nestedFolder', icon: 'Folder', keywords: ['folder', 'directory', 'new'] },
  { id: 'workspaceLink', labelKey: 'blockMenu.workspaceLink', icon: 'AtSign', trigger: '@', keywords: ['mention', 'file link', 'reference'] },
  { id: 'link', labelKey: 'blockMenu.link', icon: 'Link', shortcutId: 'docs.link', keywords: ['url', 'href', 'hyperlink'] },
  { id: 'embed', labelKey: 'blockMenu.embed', icon: 'SquarePlay', keywords: ['youtube', 'figma', 'loom', 'vimeo', 'iframe', 'video'] },
  { id: 'sectionDivider', labelKey: 'blockMenu.sectionDivider', icon: 'Diamond', trigger: '***', keywords: ['divider', 'separator', 'ornament', 'hr'] },
  { id: 'lineDivider', labelKey: 'blockMenu.lineDivider', icon: 'Minus', trigger: '---', keywords: ['divider', 'separator', 'rule', 'hr', 'line'] },
  { id: 'emoji', labelKey: 'blockMenu.emoji', icon: 'Smile', trigger: ':name:', keywords: ['smile', 'face', 'icon'] },
];

function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim();
}

/** 0 = no match; higher is better. */
export function scoreSlashItem(query: string, label: string, keywords: readonly string[]): number {
  const q = normalise(query);
  if (q === '') return 1;
  const l = normalise(label);
  if (l === q) return 100;
  if (l.startsWith(q)) return 80;
  if (l.split(/[\s-]+/).some((w) => w.startsWith(q))) return 60;
  if (l.includes(q)) return 40;
  if (keywords.some((k) => normalise(k).startsWith(q))) return 30;
  if (keywords.some((k) => normalise(k).includes(q))) return 15;
  return 0;
}

/**
 * Filters and ranks items for a query typed after `/`. An empty query keeps Whimsical's order.
 * Ties keep the menu order.
 */
export function filterSlashItems(
  items: readonly SlashItem[],
  query: string,
  labelOf: (item: SlashItem) => string,
): SlashItem[] {
  if (normalise(query) === '') return [...items];
  return items
    .map((item, order) => ({ item, order, score: scoreSlashItem(query, labelOf(item), item.keywords) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((r) => r.item);
}
