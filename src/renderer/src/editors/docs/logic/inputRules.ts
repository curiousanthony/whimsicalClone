/**
 * Whimsical's Markdown-style input rules (research 03 section 3). They differ from CommonMark:
 * a single `*text*` is BOLD, `_text_` is italic, `_ ` starts a checklist. Pure regexes so they
 * can be unit-tested without an editor.
 */

/** `*bold*` (single stars). Typing the closing `*` triggers it. */
export const STAR_BOLD_INPUT = /(?:^|\s)(\*(?!\s+\*)((?:[^*]+))\*(?!\s+\*))$/;
/** `**bold**` (standard Markdown, still accepted). */
export const DOUBLE_STAR_BOLD_INPUT = /(?:^|\s)(\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*))$/;
/** `_italic_`. */
export const UNDERSCORE_ITALIC_INPUT = /(?:^|\s)(_(?!\s+_)((?:[^_]+))_(?!\s+_))$/;
/** `~strike~` (Whimsical) alongside the GFM `~~strike~~`. */
export const TILDE_STRIKE_INPUT = /(?:^|\s)(~(?!\s+~)((?:[^~]+))~(?!\s+~))$/;
/** `_ ` at the start of a block starts a checklist. */
export const UNDERSCORE_CHECKLIST_INPUT = /^\s*(_)\s$/;
/** `---` makes a line divider. */
export const LINE_DIVIDER_INPUT = /^(?:---|—-)$/;
/** `***` makes a section divider. */
export const SECTION_DIVIDER_INPUT = /^\*\*\*$/;
/** `:name:` makes an emoji. */
export const EMOJI_INPUT = /(?:^|\s)(:([a-z0-9_+-]{2,}):)$/;

/** Pairs used to wrap a selection when an opening character is typed (blog: "surround"). */
export const SURROUND_PAIRS: Readonly<Record<string, string>> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
  '“': '”',
  '‘': '’',
  '<': '>',
};

/** Closing character for the opening one typed over a non-empty selection, or null. */
export function surroundWith(opening: string): string | null {
  return SURROUND_PAIRS[opening] ?? null;
}
