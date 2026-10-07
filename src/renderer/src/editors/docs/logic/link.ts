/** Link helpers: href normalisation for the link popover and click classification. */

import { parseFileLink } from '../markdown/constants';

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Turns what the user typed into an href: keeps explicit schemes (https:, mailto:, wc://file/...),
 * adds https:// to bare domains and mailto: to e-mail addresses. Returns null for empty input and
 * for dangerous schemes.
 */
export function normalizeHref(input: string): string | null {
  const text = input.trim();
  if (text === '') return null;
  if (/^(javascript|data|vbscript):/i.test(text)) return null;
  if (SCHEME.test(text)) return text;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `mailto:${text}`;
  if (text.startsWith('#') || text.startsWith('/') || text.startsWith('./') || text.startsWith('../')) return text;
  if (/^[^\s/]+\.[^\s/]{2,}(?:[/?#].*)?$/.test(text) || /^localhost(:\d+)?(?:[/?#].*)?$/.test(text)) return `https://${text}`;
  return null;
}

export type LinkTarget = { kind: 'file'; path: string; anchor?: string } | { kind: 'external'; url: string } | { kind: 'anchor'; id: string };

/** What a click on a link should do. */
export function classifyHref(href: string): LinkTarget | null {
  const file = parseFileLink(href);
  if (file) return file.anchor ? { kind: 'file', path: file.path, anchor: file.anchor } : { kind: 'file', path: file.path };
  if (href.startsWith('#')) return { kind: 'anchor', id: href.slice(1) };
  if (/^(https?:|mailto:)/i.test(href)) return { kind: 'external', url: href };
  return null;
}
