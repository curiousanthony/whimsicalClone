/** Executes a slash/block-menu item on the editor (the trigger text is already removed). */

import type { Editor } from '@tiptap/core';
import type { SlashItemId } from '../logic/slashItems';

export interface BlockCommandContext {
  openLinkPopover(): void;
  promptEmbed(): void;
  createNested(kind: 'doc' | 'board' | 'folder'): void;
}

/** Details nodes keep their open state in the DOM (persist: false); open the one at the caret. */
export function openToggleAtCaret(editor: Editor): void {
  requestAnimationFrame(() => {
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      if ($from.node(depth).type.name === 'details') {
        const dom = editor.view.nodeDOM($from.before(depth)) as HTMLElement | null;
        const button = dom?.querySelector<HTMLButtonElement>(':scope > button');
        if (dom && !dom.classList.contains('is-open')) button?.click();
        return;
      }
    }
  });
}

export function runBlockCommand(editor: Editor, id: SlashItemId, ctx: BlockCommandContext): void {
  const chain = () => editor.chain().focus();
  switch (id) {
    case 'paragraph':
      chain().setParagraph().run();
      return;
    case 'heading1':
    case 'heading2':
    case 'heading3':
      chain()
        .setHeading({ level: Number(id.slice(-1)) as 1 | 2 | 3 })
        .run();
      return;
    case 'bulletList':
      chain().toggleBulletList().run();
      return;
    case 'numberedList':
      chain().toggleOrderedList().run();
      return;
    case 'checklist':
      chain().toggleTaskList().run();
      return;
    case 'toggleList':
      chain()
        .insertContent({
          type: 'details',
          content: [{ type: 'detailsSummary' }, { type: 'detailsContent', content: [{ type: 'paragraph' }] }],
        })
        .run();
      openToggleAtCaret(editor);
      return;
    case 'table':
      chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      return;
    case 'codeBlock':
      chain().toggleCodeBlock().run();
      return;
    case 'callout':
      if (editor.isActive('callout')) chain().unsetCallout().run();
      else chain().setCallout().run();
      return;
    case 'quote':
      chain().wrapIn('blockquote').run();
      return;
    case 'unquote':
      if (editor.isActive('blockquote')) chain().lift('blockquote').run();
      return;
    case 'nestedDoc':
      ctx.createNested('doc');
      return;
    case 'nestedBoard':
      ctx.createNested('board');
      return;
    case 'nestedFolder':
      ctx.createNested('folder');
      return;
    case 'workspaceLink':
      chain().insertContent('@').run();
      return;
    case 'link':
      ctx.openLinkPopover();
      return;
    case 'embed':
      ctx.promptEmbed();
      return;
    case 'sectionDivider':
      chain().insertContent({ type: 'horizontalRule', attrs: { variant: 'section' } }).run();
      return;
    case 'lineDivider':
      chain().insertContent({ type: 'horizontalRule', attrs: { variant: 'line' } }).run();
      return;
    case 'emoji':
      chain().insertContent(':').run();
      return;
  }
}
