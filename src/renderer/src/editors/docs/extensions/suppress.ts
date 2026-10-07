/** Keymap suppression: removes a TipTap extension's default shortcuts (see keymap.ts). */

import type { AnyExtension, Extension, Mark, Node } from '@tiptap/core';

type Strippable = Extension | Mark | Node;

/** Returns the extension without its default keyboard shortcuts. */
export function withoutShortcuts<T extends Strippable>(extension: T): T {
  return (extension as unknown as { extend(config: object): AnyExtension }).extend({
    addKeyboardShortcuts() {
      return {};
    },
  }) as unknown as T;
}

/** Returns the extension without the listed default shortcuts (the others are kept). */
export function withoutKeys<T extends Strippable>(extension: T, keys: readonly string[]): T {
  return (extension as unknown as { extend(config: object): AnyExtension }).extend({
    addKeyboardShortcuts(this: { parent?: () => Record<string, unknown> }) {
      const all = { ...(this.parent?.() ?? {}) };
      for (const key of keys) delete all[key];
      return all;
    },
  }) as unknown as T;
}
