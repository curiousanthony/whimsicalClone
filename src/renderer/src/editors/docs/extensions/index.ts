/**
 * The TipTap extension set of the Docs editor (pure: no React). Whimsical deviates from the
 * stock TipTap behaviour in three ways handled here:
 *  - keymaps: defaults that collide with app shortcuts are stripped (see keymap.ts);
 *  - input rules: `*x*` bold, `_x_` italic, `_ ` checklist, `---` / `***` dividers;
 *  - the schema carries the attributes the Markdown extensions need (callout colour, divider
 *    variant, cell alignment, link title...), proven by the schema round-trip tests.
 */

import { markInputRule, type AnyExtension } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import Italic from '@tiptap/extension-italic';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import { Table, TableRow } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import { wrappingInputRule } from '@tiptap/core';
import { common, createLowlight } from 'lowlight';
import {
  DOUBLE_STAR_BOLD_INPUT,
  STAR_BOLD_INPUT,
  TILDE_STRIKE_INPUT,
  UNDERSCORE_CHECKLIST_INPUT,
  UNDERSCORE_ITALIC_INPUT,
} from '../logic/inputRules';
import { BoardEmbed, Callout, Divider, DocLink, DocTableCell, DocTableHeader, Embed, InlineImage, RawMarkdown } from './nodes';
import { DocsKeymap, TabFallback, type DocKeymapOptions } from './keymap';
import { withoutKeys, withoutShortcuts } from './suppress';
import { EmojiRule } from './emoji';
import { PasteAndSurround } from './pasteSurround';
import { CollapseHeadings, type CollapseOptions } from './collapseHeadings';

export const lowlight = createLowlight(common);

const DOUBLE_TILDE_STRIKE_INPUT = /(?:^|\s)(~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~))$/;

const DocBold = Bold.extend({
  addInputRules() {
    return [
      markInputRule({ find: DOUBLE_STAR_BOLD_INPUT, type: this.type }),
      markInputRule({ find: STAR_BOLD_INPUT, type: this.type }),
    ];
  },
  addPasteRules() {
    return [];
  },
});

const DocItalic = Italic.extend({
  addInputRules() {
    return [markInputRule({ find: UNDERSCORE_ITALIC_INPUT, type: this.type })];
  },
  addPasteRules() {
    return [];
  },
});

const DocStrike = withoutShortcuts(Strike).extend({
  addInputRules() {
    return [
      markInputRule({ find: DOUBLE_TILDE_STRIKE_INPUT, type: this.type }),
      markInputRule({ find: TILDE_STRIKE_INPUT, type: this.type }),
    ];
  },
  addPasteRules() {
    return [];
  },
});

/** Checklist: Whimsical's `_ ` alongside TipTap's `[ ] `. */
const DocTaskItem = TaskItem.configure({ nested: true }).extend({
  addInputRules() {
    return [
      ...(this.parent?.() ?? []),
      wrappingInputRule({
        find: UNDERSCORE_CHECKLIST_INPUT,
        type: this.type,
        getAttributes: () => ({ checked: false }),
      }),
    ];
  },
});

/** Hard break only on Shift-Enter: Mod-Enter is "open nested file" / "insert table row". */
const DocHardBreak = HardBreak.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

export interface DocExtensionOptions {
  keymap?: DocKeymapOptions;
  collapse?: CollapseOptions;
  placeholder?: () => string;
  /** aria-label of toggle-list buttons. */
  toggleLabel?: (isOpen: boolean) => string;
  /** Replacement extensions (React node views) keyed by extension name. */
  overrides?: Partial<Record<'callout' | 'embed' | 'boardEmbed' | 'codeBlock' | 'rawMarkdown', AnyExtension>>;
  /** Extra extensions appended last (suggestions, file handler...). */
  extra?: AnyExtension[];
}

export function createDocExtensions(options: DocExtensionOptions = {}): AnyExtension[] {
  const o = options.overrides ?? {};
  return [
    StarterKit.configure({
      // Replaced below by Whimsical-flavoured versions.
      bold: false,
      italic: false,
      strike: false,
      code: false,
      heading: false,
      blockquote: false,
      paragraph: false,
      hardBreak: false,
      horizontalRule: false,
      codeBlock: false,
      link: false,
      underline: false,
    }),
    withoutShortcuts(Paragraph),
    withoutShortcuts(Heading).configure({ levels: [1, 2, 3, 4, 5, 6] }),
    withoutShortcuts(Blockquote),
    DocHardBreak,
    DocBold,
    DocItalic,
    DocStrike,
    withoutShortcuts(Code),
    Highlight,
    DocLink,
    InlineImage,
    Divider,
    o.codeBlock ?? withoutKeys(CodeBlockLowlight, ['Mod-Alt-c']).configure({ lowlight, defaultLanguage: null }),
    withoutShortcuts(TaskList),
    DocTaskItem,
    Table.configure({ resizable: false, allowTableNodeSelection: true }),
    TableRow,
    DocTableHeader,
    DocTableCell,
    Details.configure({
      persist: false,
      renderToggleButton: ({ element, isOpen }) => {
        element.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
        element.setAttribute('aria-label', options.toggleLabel?.(isOpen) ?? '');
        element.setAttribute('aria-expanded', String(isOpen));
      },
    }),
    DetailsSummary,
    DetailsContent,
    o.callout ?? Callout,
    o.embed ?? Embed,
    o.boardEmbed ?? BoardEmbed,
    o.rawMarkdown ?? RawMarkdown,
    Placeholder.configure({ placeholder: options.placeholder ?? (() => ''), showOnlyCurrent: true, includeChildren: false }),
    EmojiRule,
    PasteAndSurround,
    DocsKeymap.configure(options.keymap ?? {}),
    TabFallback,
    CollapseHeadings.configure(options.collapse ?? { initial: [] }),
    ...(options.extra ?? []),
  ];
}
