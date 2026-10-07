/** Progressive Select All (⌘A): line/text of the block, then the enclosing block, then the doc. */

import { AllSelection, EditorState, TextSelection, type Transaction } from '@tiptap/pm/state';

export function selectMoreTransaction(state: EditorState): Transaction | null {
  const { selection, doc } = state;
  if (selection instanceof AllSelection) return null;
  const { $from, $to, from, to } = selection;

  // 1. The text of the current textblock.
  if ($from.parent.isTextblock && $from.sameParent($to)) {
    const start = $from.start();
    const end = $from.end();
    if (from > start || to < end) {
      if (start !== end) return state.tr.setSelection(TextSelection.create(doc, start, end));
    }
  }

  // 2. Enclosing blocks, innermost first (list item, quote, callout, ... up to the top level).
  const shared = $from.sharedDepth(to);
  for (let depth = shared; depth >= 1; depth--) {
    const start = $from.start(depth);
    const end = $from.end(depth);
    if (from > start || to < end) {
      const $start = doc.resolve(start);
      const $end = doc.resolve(end);
      try {
        const candidate = TextSelection.between($start, $end);
        // A wrapper holding a single textblock selects the same text: keep widening.
        if (candidate.from === from && candidate.to === to) continue;
        return state.tr.setSelection(candidate);
      } catch {
        continue;
      }
    }
  }

  // 3. The whole document.
  return state.tr.setSelection(new AllSelection(doc));
}
