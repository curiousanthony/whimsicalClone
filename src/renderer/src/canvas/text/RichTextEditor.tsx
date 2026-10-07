/**
 * Inline rich-text editor for canvas objects (TipTap). Converts to/from the stored RichText
 * model and applies Whimsical's text keymap and input rules:
 *   Cmd+B bold, Cmd+I italic, Cmd+Shift+X strike, Cmd+Shift+K code, Cmd+Shift+H highlight,
 *   Cmd+\ paragraph, Cmd+Shift+8 / "* " / "- " bullets, Cmd+Shift+7 / "1. " numbers,
 *   "_ " checklist, *text* bold, _text_ italic, Shift+Enter line break, Esc stops editing.
 * ProseMirror keeps its own undo while editing (SPEC section 7); leaving edit mode leaves one
 * coalesced change in the host history.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension, markInputRule, wrappingInputRule, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Highlight from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extensions';
import type { RichText } from '@renderer/core/types';
import { pmToRichText, richTextToPm, type PmNode } from '../richTextPm';

export interface RichTextEditorProps {
  value: RichText;
  onChange(next: RichText): void;
  /** Esc / blur / Cmd+Enter. */
  onDone(): void;
  /** Select all text on mount (new objects, quick add). */
  selectAll?: boolean;
  /** Restrict to paragraphs and soft breaks (mind-map nodes, labels). */
  paragraphsOnly?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Enter (without Shift) calls this instead of inserting a paragraph (mind-map siblings). */
  onEnter?: () => boolean;
  /** Tab calls this (mind-map child). Return true when handled. */
  onTab?: (shift: boolean) => boolean;
}

/** Whimsical input rules: *bold*, _italic_, "_ " checklist. */
const WhimsicalText = Extension.create({
  name: 'whimsicalText',
  addInputRules() {
    const rules = [];
    const bold = this.editor.schema.marks.bold;
    const italic = this.editor.schema.marks.italic;
    if (bold) rules.push(markInputRule({ find: /(?:^|\s)(\*(?!\s+\*)((?:[^*]+))\*(?!\s+\*))$/, type: bold }));
    if (italic) rules.push(markInputRule({ find: /(?:^|\s)(_(?!\s+_)((?:[^_]+))_(?!\s+_))$/, type: italic }));
    const taskList = this.editor.schema.nodes.taskList;
    if (taskList) rules.push(wrappingInputRule({ find: /^\s*_\s$/, type: taskList }));
    return rules;
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
      'Mod-Shift-k': () => this.editor.commands.toggleCode(),
      'Mod-Shift-h': () => this.editor.commands.toggleHighlight(),
      'Mod-\\': () => this.editor.chain().clearNodes().setParagraph().run(),
      'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
      'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
      'Mod-Shift-u': () => {
        const prev = this.editor.getAttributes('link').href as string | undefined;
        if (prev) return this.editor.chain().focus().unsetLink().run();
        const { from, to } = this.editor.state.selection;
        const text = this.editor.state.doc.textBetween(from, to).trim();
        if (/^(https?:\/\/|mailto:|wc:\/\/)/.test(text)) return this.editor.chain().focus().setLink({ href: text }).run();
        return false;
      },
    };
  },
});

export function RichTextEditor(props: RichTextEditorProps): JSX.Element {
  const { value, selectAll, paragraphsOnly, placeholder, className, style } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const lastEmitted = useRef<RichText>(value);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: paragraphsOnly ? false : { levels: [1, 2, 3] },
        bulletList: paragraphsOnly ? false : {},
        orderedList: paragraphsOnly ? false : {},
        listItem: paragraphsOnly ? false : {},
        listKeymap: paragraphsOnly ? false : {},
        blockquote: paragraphsOnly ? false : {},
        codeBlock: paragraphsOnly ? false : {},
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
        trailingNode: false,
        underline: false,
        link: { openOnClick: false, autolink: true },
      }),
      ...(paragraphsOnly ? [] : [TaskList, TaskItem.configure({ nested: true })]),
      Highlight,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      WhimsicalText,
    ],
    // Extensions are fixed for the lifetime of one editing session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content: richTextToPm(value) as JSONContent,
    autofocus: selectAll ? 'all' : 'end',
    editorProps: {
      attributes: { class: 'wc-rte-content', spellcheck: 'true' },
      handleKeyDown: (_view, event) => {
        const p = propsRef.current;
        if (event.key === 'Escape' || (event.key === 'Enter' && event.metaKey)) {
          event.preventDefault();
          p.onDone();
          return true;
        }
        if (event.key === 'Enter' && !event.shiftKey && !event.altKey && p.onEnter) {
          if (p.onEnter()) {
            event.preventDefault();
            return true;
          }
        }
        if (event.key === 'Tab' && p.onTab && p.onTab(event.shiftKey)) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const next = pmToRichText(ed.getJSON() as PmNode);
      lastEmitted.current = next;
      propsRef.current.onChange(next);
    },
  });

  // Focus synchronously after mount so keys typed right after Enter / quick add reach the
  // editor instead of the canvas shortcuts (TipTap's own autofocus is deferred).
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    try {
      editor.commands.focus(selectAll ? 'all' : 'end', { scrollIntoView: false });
    } catch {
      /* view not mounted yet; TipTap's autofocus will follow */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // External value changes (undo inside the host while editing) replace the content.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    const current = pmToRichText(editor.getJSON() as PmNode);
    if (JSON.stringify(current) === JSON.stringify(value)) return;
    lastEmitted.current = value;
    editor.commands.setContent(richTextToPm(value) as JSONContent, { emitUpdate: false });
  }, [editor, value]);

  return (
    <EditorContent
      editor={editor}
      className={['wc-rte', className].filter(Boolean).join(' ')}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => {
        // Leaving the editor for another part of the app ends editing.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) propsRef.current.onDone();
      }}
    />
  );
}
