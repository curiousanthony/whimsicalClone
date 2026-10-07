/**
 * Collapsible headings as a ProseMirror plugin. The collapse state is per viewer: it lives in the
 * plugin state, is reported through `onChange` (the editor persists it as view state) and is never
 * written to the Markdown file. Only top-level headings collapse.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import {
  collapseAllBelow,
  expandOneLevel,
  governingHeading,
  headingKeys,
  hiddenBlocks,
  toggleCollapsed,
  type BlockInfo,
  type ToggleModifiers,
} from '../logic/collapse';

export interface CollapseOptions {
  initial: readonly string[];
  onChange?: (collapsed: string[]) => void;
  /** aria-label of the chevron button. */
  label?: () => string;
}

export const collapseKey = new PluginKey<{ collapsed: Set<string> }>('docsCollapse');

export function topLevelBlocks(doc: PMNode): BlockInfo[] {
  const out: BlockInfo[] = [];
  doc.forEach((child) => {
    out.push(child.type.name === 'heading' ? { level: Number(child.attrs.level) || 1, text: child.textContent } : { level: null, text: '' });
  });
  return out;
}

/** Index of the top-level block containing `pos`. */
export function blockIndexAt(doc: PMNode, pos: number): number {
  let index = 0;
  let offset = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const end = offset + doc.child(i).nodeSize;
    if (pos < end) return i;
    offset = end;
    index = i;
  }
  return index;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collapse: {
      toggleHeadingCollapse: (index: number, mods?: ToggleModifiers) => ReturnType;
      expandBlockAtCaret: () => ReturnType;
      collapseBlockAtCaret: () => ReturnType;
      revealBlock: (index: number) => ReturnType;
    };
  }
}

type Meta = { set: Set<string> };

export const CollapseHeadings = Extension.create<CollapseOptions>({
  name: 'collapseHeadings',

  addOptions() {
    return { initial: [] };
  },

  addCommands() {
    const apply =
      (compute: (blocks: BlockInfo[], collapsed: ReadonlySet<string>, state: import('@tiptap/pm/state').EditorState) => Set<string> | null) =>
      () =>
      ({ state, tr, dispatch }: { state: import('@tiptap/pm/state').EditorState; tr: import('@tiptap/pm/state').Transaction; dispatch?: (tr: import('@tiptap/pm/state').Transaction) => void }) => {
        const current = collapseKey.getState(state)?.collapsed ?? new Set<string>();
        const next = compute(topLevelBlocks(state.doc), current, state);
        if (!next) return false;
        if (dispatch) dispatch(tr.setMeta(collapseKey, { set: next } satisfies Meta));
        return true;
      };
    return {
      toggleHeadingCollapse: (index, mods) =>
        apply((blocks, collapsed) => (blocks[index]?.level == null ? null : toggleCollapsed(blocks, collapsed, index, mods)))(),
      expandBlockAtCaret: () =>
        apply((blocks, collapsed, state) => {
          const i = governingHeading(blocks, blockIndexAt(state.doc, state.selection.from));
          return i < 0 ? null : expandOneLevel(blocks, collapsed, i);
        })(),
      collapseBlockAtCaret: () =>
        apply((blocks, collapsed, state) => {
          const i = governingHeading(blocks, blockIndexAt(state.doc, state.selection.from));
          return i < 0 ? null : collapseAllBelow(blocks, collapsed, i);
        })(),
      revealBlock: (index) =>
        apply((blocks, collapsed) => {
          // Expand every collapsed heading whose section contains the block.
          const hidden = hiddenBlocks(blocks, collapsed);
          if (!hidden.has(index)) return null;
          const keys = headingKeys(blocks);
          const next = new Set(collapsed);
          for (let i = index; i >= 0; i--) {
            const key = keys[i];
            if (key && next.has(key) && hiddenBlocks(blocks, new Set([key])).has(index)) next.delete(key);
          }
          return next;
        })(),
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: collapseKey,
        state: {
          init: () => ({ collapsed: new Set(options.initial) }),
          apply: (tr, value) => {
            const meta = tr.getMeta(collapseKey) as Meta | undefined;
            if (meta) {
              queueMicrotask(() => options.onChange?.([...meta.set]));
              return { collapsed: meta.set };
            }
            return value;
          },
        },
        props: {
          decorations: (state) => {
            const collapsed = collapseKey.getState(state)?.collapsed ?? new Set<string>();
            const blocks = topLevelBlocks(state.doc);
            const keys = headingKeys(blocks);
            const hidden = hiddenBlocks(blocks, collapsed);
            const decos: Decoration[] = [];
            let pos = 0;
            state.doc.forEach((child, _offset, index) => {
              const end = pos + child.nodeSize;
              if (hidden.has(index)) {
                decos.push(Decoration.node(pos, end, { class: 'wc-block-hidden' }));
              } else if (child.type.name === 'heading') {
                const key = keys[index];
                const isCollapsed = key !== null && key !== undefined && collapsed.has(key);
                decos.push(Decoration.node(pos, end, { class: isCollapsed ? 'wc-heading is-collapsed' : 'wc-heading' }));
                decos.push(
                  Decoration.widget(
                    pos + 1,
                    (view) => {
                      const button = document.createElement('button');
                      button.type = 'button';
                      button.className = 'wc-heading-toggle';
                      button.contentEditable = 'false';
                      button.tabIndex = -1;
                      button.setAttribute('aria-label', options.label?.() ?? 'Collapse');
                      button.setAttribute('aria-expanded', String(!isCollapsed));
                      button.innerHTML =
                        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
                      button.addEventListener('mousedown', (e) => e.preventDefault());
                      button.addEventListener('click', (e) => {
                        e.preventDefault();
                        const current = collapseKey.getState(view.state)?.collapsed ?? new Set<string>();
                        const next = toggleCollapsed(topLevelBlocks(view.state.doc), current, index, { alt: e.altKey, shift: e.shiftKey });
                        view.dispatch(view.state.tr.setMeta(collapseKey, { set: next } satisfies Meta));
                      });
                      return button;
                    },
                    { side: -1, key: `toggle-${index}-${isCollapsed ? 'c' : 'o'}`, ignoreSelection: true },
                  ),
                );
              }
              pos = end;
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
