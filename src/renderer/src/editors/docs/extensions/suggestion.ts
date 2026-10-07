/**
 * Generic bridge between @tiptap/suggestion (slash menu, @ mentions, : emoji) and React popups.
 * The extension only reports state; DocsEditor renders the popup and answers key presses.
 */

import { Extension, type Editor, type Range } from '@tiptap/core';
import { PluginKey, type EditorState } from '@tiptap/pm/state';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';

export interface SuggestionPopupState<TItem> {
  query: string;
  range: Range;
  clientRect: (() => DOMRect | null) | null;
  items: TItem[];
  /** Runs the selected item: deletes the trigger text and applies the item. */
  select: (item: TItem) => void;
}

export interface SuggestionBridge<TItem> {
  onStart(state: SuggestionPopupState<TItem>): void;
  onUpdate(state: SuggestionPopupState<TItem>): void;
  onExit(): void;
  /** Return true when the key was consumed. */
  onKeyDown(event: KeyboardEvent): boolean;
}

export interface SuggestionExtensionConfig<TItem> {
  name: string;
  char: string;
  /** Only trigger at the start of a line (slash menu). */
  startOfLine?: boolean;
  allowedPrefixes?: string[] | null;
  /** Extra guard on the editor state at the trigger. */
  allow?: (props: { state: EditorState; range: Range; editor: Editor }) => boolean;
  /** Computes the items for a query (may be async-free). */
  items: (query: string) => TItem[];
  /** Applies an item (after the trigger text has been removed). */
  command: (props: { editor: Editor; range: Range; item: TItem }) => void;
  bridge: () => SuggestionBridge<TItem> | null;
}

export function createSuggestionExtension<TItem>(config: SuggestionExtensionConfig<TItem>): Extension {
  return Extension.create({
    name: config.name,
    addProseMirrorPlugins() {
      const toState = (props: SuggestionProps<TItem, TItem>): SuggestionPopupState<TItem> => ({
        query: props.query,
        range: props.range,
        clientRect: props.clientRect ?? null,
        items: props.items,
        select: (item) => props.command(item),
      });
      return [
        Suggestion<TItem, TItem>({
          editor: this.editor,
          pluginKey: new PluginKey(`suggestion-${config.name}`),
          char: config.char,
          startOfLine: config.startOfLine ?? false,
          allowedPrefixes: config.allowedPrefixes ?? [' '],
          ...(config.allow ? { allow: config.allow } : {}),
          items: ({ query }) => config.items(query),
          command: ({ editor, range, props }) => {
            editor.chain().focus().deleteRange(range).run();
            config.command({ editor, range, item: props });
          },
          render: () => ({
            onStart: (props) => config.bridge()?.onStart(toState(props)),
            onUpdate: (props) => config.bridge()?.onUpdate(toState(props)),
            onExit: () => config.bridge()?.onExit(),
            onKeyDown: (props: SuggestionKeyDownProps) => config.bridge()?.onKeyDown(props.event) ?? false,
          }),
        }),
      ];
    },
  });
}
