/**
 * Whimsical's docs keymap. TipTap's default keymaps are stripped from the individual extensions
 * (see index.ts) because the shortcut registry yields to defaultPrevented, so a stray default
 * such as Mod-e (inline code) would silently steal app shortcuts like Toggle sidebar.
 */

import { Extension } from '@tiptap/core';
import { CellSelection } from '@tiptap/pm/tables';
import type { Editor } from '@tiptap/core';
import { selectMoreTransaction } from './selectMore';

export interface DocKeymapOptions {
  /** ⌘⇧U / ⌥K: open the link popover. */
  onLink?: () => void;
  /** ⌘/: open the block type menu for the current block. */
  onBlockMenu?: () => void;
  /** ⌘↩ outside tables: open the nested file at the caret. */
  onOpenNested?: () => boolean;
  /** ⌘⌥] / ⌘⌥[. */
  onExpandBlock?: () => boolean;
  onCollapseBlock?: () => boolean;
}

export const LANGUAGE_PICKER_EVENT = 'docs:open-language-picker';

function inCodeBlock(editor: Editor): boolean {
  return editor.isActive('codeBlock');
}

function inTable(editor: Editor): boolean {
  return editor.isActive('table');
}

export const DocsKeymap = Extension.create<DocKeymapOptions>({
  name: 'docsKeymap',
  // Above TipTap's core keymap (Mod-a select all, Mod-Enter exit code) so our versions win.
  priority: 200,

  addOptions() {
    return {};
  },

  addKeyboardShortcuts() {
    const o = this.options;
    const editor = this.editor;
    return {
      'Mod-\\': () => editor.commands.setParagraph(),
      'Mod-Shift-x': () => editor.commands.toggleStrike(),
      'Mod-Shift-k': () => {
        if (inCodeBlock(editor)) {
          editor.view.dom.dispatchEvent(new CustomEvent(LANGUAGE_PICKER_EVENT, { bubbles: true }));
          return true;
        }
        return editor.commands.toggleCode();
      },
      'Mod-Shift-u': () => {
        o.onLink?.();
        return true;
      },
      'Alt-k': () => {
        o.onLink?.();
        return true;
      },
      'Mod-/': () => {
        o.onBlockMenu?.();
        return true;
      },
      'Shift-Enter': () => (inCodeBlock(editor) ? false : editor.commands.setHardBreak()),
      'Mod-Enter': () => {
        if (inTable(editor)) return editor.commands.addRowAfter();
        return o.onOpenNested?.() ?? false;
      },
      'Mod-Alt-Enter': () => (inTable(editor) ? editor.commands.addColumnAfter() : false),
      'Mod-Backspace': () => {
        const sel = editor.state.selection;
        return sel instanceof CellSelection && sel.isRowSelection() ? editor.commands.deleteRow() : false;
      },
      'Mod-Alt-Backspace': () => (inTable(editor) ? editor.commands.deleteColumn() : false),
      'Mod-a': () => {
        const tr = selectMoreTransaction(editor.state);
        if (!tr) return true;
        editor.view.dispatch(tr);
        return true;
      },
      'Mod-Alt-]': () => o.onExpandBlock?.() ?? false,
      'Mod-Alt-[': () => o.onCollapseBlock?.() ?? false,
    };
  },
});

/**
 * Fallbacks with low priority so list/table/code handlers run first: Tab must never move focus
 * out of the page.
 */
export const TabFallback = Extension.create({
  name: 'tabFallback',
  priority: 20,
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.isActive('codeBlock')) return editor.commands.insertContent('  ');
        return true;
      },
      'Shift-Tab': () => true,
    };
  },
});
