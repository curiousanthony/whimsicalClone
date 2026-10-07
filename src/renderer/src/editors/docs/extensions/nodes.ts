/**
 * Custom document nodes and node extensions that carry Markdown-only attributes. They are pure
 * schema definitions (no React) so the schema can be built and tested without a DOM editor.
 * The matching Markdown forms are documented in docs/SPEC.md section 3.2.
 */

import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { TableCell, TableHeader } from '@tiptap/extension-table';
import {
  CALLOUT_COLORS,
  DEFAULT_CALLOUT_COLOR,
  DEFAULT_CALLOUT_ICON,
  EMBED_DEFAULT_HEIGHT,
  isCalloutColor,
} from '../markdown/constants';
import { LINE_DIVIDER_INPUT, SECTION_DIVIDER_INPUT } from '../logic/inputRules';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { color?: string; icon?: string }) => ReturnType;
      updateCallout: (attrs: { color?: string; icon?: string }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
    embed: {
      insertEmbed: (attrs: { url: string; height?: number; fit?: 'text' | 'page' }) => ReturnType;
      insertBoardEmbed: (attrs: { path: string; height?: number }) => ReturnType;
    };
  }
}

/* ------------------------------------------------------------------------------------------
 * Callout: `> [!callout color=blue icon=info]`
 * ---------------------------------------------------------------------------------------- */

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      color: {
        default: DEFAULT_CALLOUT_COLOR,
        parseHTML: (el) => {
          const value = el.getAttribute('data-color') ?? '';
          return isCalloutColor(value) ? value : DEFAULT_CALLOUT_COLOR;
        },
        renderHTML: (attrs) => ({ 'data-color': String(attrs.color ?? DEFAULT_CALLOUT_COLOR) }),
      },
      icon: {
        default: DEFAULT_CALLOUT_ICON,
        parseHTML: (el) => el.getAttribute('data-icon') ?? DEFAULT_CALLOUT_ICON,
        renderHTML: (attrs) => ({ 'data-icon': String(attrs.icon ?? DEFAULT_CALLOUT_ICON) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-callout': '' }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { color: DEFAULT_CALLOUT_COLOR, icon: DEFAULT_CALLOUT_ICON, ...attrs }),
      updateCallout:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});

/* ------------------------------------------------------------------------------------------
 * Embeds: `::embed[url]{height=525 fit=text}` and `::board[path]{height=525}`
 * ---------------------------------------------------------------------------------------- */

export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: '', parseHTML: (el) => el.getAttribute('data-url') ?? '' },
      height: { default: EMBED_DEFAULT_HEIGHT, parseHTML: (el) => Number(el.getAttribute('data-height')) || EMBED_DEFAULT_HEIGHT },
      fit: { default: 'text', parseHTML: (el) => (el.getAttribute('data-fit') === 'page' ? 'page' : 'text') },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-embed]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-embed': '',
        'data-url': String(node.attrs.url ?? ''),
        'data-height': String(node.attrs.height ?? EMBED_DEFAULT_HEIGHT),
        'data-fit': String(node.attrs.fit ?? 'text'),
      }),
      String(node.attrs.url ?? ''),
    ];
  },

  addCommands() {
    return {
      insertEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { height: EMBED_DEFAULT_HEIGHT, fit: 'text', ...attrs } }),
      insertBoardEmbed: () => () => false,
    };
  },
});

export const BoardEmbed = Node.create({
  name: 'boardEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      path: { default: '', parseHTML: (el) => el.getAttribute('data-path') ?? '' },
      height: { default: EMBED_DEFAULT_HEIGHT, parseHTML: (el) => Number(el.getAttribute('data-height')) || EMBED_DEFAULT_HEIGHT },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-board-embed]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-board-embed': '',
        'data-path': String(node.attrs.path ?? ''),
        'data-height': String(node.attrs.height ?? EMBED_DEFAULT_HEIGHT),
      }),
      String(node.attrs.path ?? ''),
    ];
  },

  addCommands() {
    return {
      insertBoardEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { height: EMBED_DEFAULT_HEIGHT, ...attrs } }),
      insertEmbed: () => () => false,
    };
  },
});

/* ------------------------------------------------------------------------------------------
 * Raw Markdown: HTML blocks, front matter and link definitions kept verbatim.
 * ---------------------------------------------------------------------------------------- */

export const RawMarkdown = Node.create({
  name: 'rawMarkdown',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      kind: { default: 'html', parseHTML: (el) => el.getAttribute('data-kind') ?? 'html', renderHTML: (a) => ({ 'data-kind': String(a.kind) }) },
    };
  },

  parseHTML() {
    return [{ tag: 'pre[data-raw-markdown]', preserveWhitespace: 'full' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['pre', mergeAttributes({ 'data-raw-markdown': '' }, HTMLAttributes), ['code', 0]];
  },
});

/* ------------------------------------------------------------------------------------------
 * Extended core nodes
 * ---------------------------------------------------------------------------------------- */

/** `---` = line divider, `***` = section divider (stored as `variant`). */
export const Divider = HorizontalRule.extend({
  addAttributes() {
    return {
      variant: {
        default: 'line',
        parseHTML: (el) => (el.getAttribute('data-variant') === 'section' ? 'section' : 'line'),
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant === 'section' ? 'section' : 'line' }),
      },
    };
  },
  addInputRules() {
    return [
      nodeInputRule({ find: LINE_DIVIDER_INPUT, type: this.type, getAttributes: () => ({ variant: 'line' }) }),
      nodeInputRule({ find: SECTION_DIVIDER_INPUT, type: this.type, getAttributes: () => ({ variant: 'section' }) }),
    ];
  },
});

/** Images are inline so they can sit inside paragraphs, as in Markdown. */
export const InlineImage = Image.configure({ inline: true, allowBase64: false });

/** Link with a title attribute; `wc://file/...` and `wsasset://` hrefs are allowed. */
export const DocLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: {
        default: null,
        parseHTML: (el) => el.getAttribute('title'),
        renderHTML: (attrs) => (attrs.title ? { title: String(attrs.title) } : {}),
      },
    };
  },
}).configure({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true,
  defaultProtocol: 'https',
  isAllowedUri: (url) => {
    const value = String(url).trim().toLowerCase();
    return !(value.startsWith('javascript:') || value.startsWith('data:') || value.startsWith('vbscript:'));
  },
});

const alignAttribute = {
  align: {
    default: null,
    parseHTML: (el: HTMLElement) => {
      const value = el.style.textAlign || el.getAttribute('align') || '';
      return value === 'left' || value === 'center' || value === 'right' ? value : null;
    },
    renderHTML: (attrs: Record<string, unknown>) => (attrs.align ? { style: `text-align: ${String(attrs.align)}` } : {}),
  },
};

/** GFM cells hold inline content only, so cells contain paragraphs and carry an alignment. */
export const DocTableCell = TableCell.extend({
  content: 'paragraph+',
  addAttributes() {
    return { ...this.parent?.(), ...alignAttribute };
  },
});

export const DocTableHeader = TableHeader.extend({
  content: 'paragraph+',
  addAttributes() {
    return { ...this.parent?.(), ...alignAttribute };
  },
});

export { CALLOUT_COLORS };
