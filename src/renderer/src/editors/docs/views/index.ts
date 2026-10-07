import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import type { AnyExtension } from '@tiptap/core';
import { BoardEmbed, Callout, Embed, RawMarkdown } from '../extensions/nodes';
import { lowlight } from '../extensions';
import { withoutKeys } from '../extensions/suppress';
import { CalloutView } from './CalloutView';
import { BoardEmbedView, EmbedView, type EmbedViewOptions } from './EmbedView';
import { CodeBlockView } from './CodeBlockView';
import { RawView } from './RawView';

/** React node views for the custom blocks, as `overrides` for createDocExtensions. */
export function createViewOverrides(options: EmbedViewOptions): {
  callout: AnyExtension;
  embed: AnyExtension;
  boardEmbed: AnyExtension;
  codeBlock: AnyExtension;
  rawMarkdown: AnyExtension;
} {
  return {
    callout: Callout.extend({
      addNodeView() {
        return ReactNodeViewRenderer(CalloutView);
      },
    }),
    embed: Embed.extend({
      addOptions() {
        return options;
      },
      addNodeView() {
        return ReactNodeViewRenderer(EmbedView);
      },
    }),
    boardEmbed: BoardEmbed.extend({
      addOptions() {
        return options;
      },
      addNodeView() {
        return ReactNodeViewRenderer(BoardEmbedView);
      },
    }),
    codeBlock: withoutKeys(CodeBlockLowlight, ['Mod-Alt-c']).extend({
      addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView);
      },
    }).configure({ lowlight, defaultLanguage: null }),
    rawMarkdown: RawMarkdown.extend({
      addNodeView() {
        return ReactNodeViewRenderer(RawView);
      },
    }),
  };
}
