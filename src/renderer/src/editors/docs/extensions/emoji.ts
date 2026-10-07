/** `:name:` -> emoji character (stored as plain Unicode text, as SPEC 3.2 requires). */

import { Extension, InputRule } from '@tiptap/core';
import { emojis, gitHubEmojis, type EmojiItem } from '@tiptap/extension-emoji';
import { EMOJI_INPUT } from '../logic/inputRules';

let byShortcode: Map<string, EmojiItem> | null = null;

function index(): Map<string, EmojiItem> {
  if (byShortcode) return byShortcode;
  const map = new Map<string, EmojiItem>();
  for (const item of [...gitHubEmojis, ...emojis]) {
    if (!item.emoji) continue;
    for (const code of item.shortcodes ?? []) if (!map.has(code)) map.set(code, item);
  }
  byShortcode = map;
  return map;
}

export function emojiForShortcode(shortcode: string): string | null {
  return index().get(shortcode.toLowerCase())?.emoji ?? null;
}

/** Emoji whose shortcode or tags start with / contain the query, best first. */
export function searchEmojis(query: string, limit = 12): Array<{ shortcode: string; emoji: string }> {
  const q = query.toLowerCase();
  if (q.length === 0) return [];
  const starts: Array<{ shortcode: string; emoji: string }> = [];
  const contains: Array<{ shortcode: string; emoji: string }> = [];
  const seen = new Set<string>();
  for (const [code, item] of index()) {
    const char = item.emoji;
    if (!char || seen.has(char)) continue;
    if (code.startsWith(q)) {
      starts.push({ shortcode: code, emoji: char });
      seen.add(char);
    } else if (code.includes(q) || (item.tags ?? []).some((t) => t.startsWith(q))) {
      contains.push({ shortcode: code, emoji: char });
      seen.add(char);
    }
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export const EmojiRule = Extension.create({
  name: 'emojiRule',
  addInputRules() {
    return [
      new InputRule({
        find: EMOJI_INPUT,
        handler: ({ state, range, match }) => {
          const whole = match[1] ?? '';
          const char = emojiForShortcode(match[2] ?? '');
          if (!char) return null;
          const start = range.to - whole.length;
          state.tr.insertText(char, start, range.to);
          return undefined;
        },
      }),
    ];
  },
});
