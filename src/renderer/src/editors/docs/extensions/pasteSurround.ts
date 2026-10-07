/**
 * Typing an opening quote/bracket over a selection wraps it (blog); pasting plain text that is
 * Markdown, or tab-separated cells from a spreadsheet, creates blocks instead of literal text.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { surroundWith } from '../logic/inputRules';
import { looksLikeMarkdown, parseTsvTable, tableJson } from '../logic/paste';
import { markdownToDoc } from '../markdown/parse';

export const PasteAndSurround = Extension.create({
  name: 'pasteAndSurround',

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('docsPasteAndSurround'),
        props: {
          handleTextInput: (view, from, to, text) => {
            const close = surroundWith(text);
            if (!close || from === to) return false;
            const { state } = view;
            const $from = state.doc.resolve(from);
            if (!$from.parent.isTextblock || $from.parent.type.spec.code || !$from.sameParent(state.doc.resolve(to))) return false;
            const tr = state.tr.insertText(close, to).insertText(text, from);
            tr.setSelection(TextSelection.create(tr.doc, from + text.length, to + text.length));
            view.dispatch(tr.scrollIntoView());
            return true;
          },
          handlePaste: (view, event) => {
            const data = event.clipboardData;
            if (!data) return false;
            if (data.getData('text/html')) return false;
            if (view.state.selection.$from.parent.type.spec.code) return false;
            const text = data.getData('text/plain');
            if (!text) return false;
            const rows = parseTsvTable(text);
            if (rows) {
              editor.chain().focus().insertContent(tableJson(rows)).run();
              return true;
            }
            if (looksLikeMarkdown(text)) {
              const doc = markdownToDoc(text);
              editor.chain().focus().insertContent(doc.content ?? []).run();
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});
