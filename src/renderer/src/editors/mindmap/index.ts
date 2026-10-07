/** Public API of the mindmap module (descriptor + canvas plugin). Imported by app/ only. */

import { createCanvasEditorPlugin } from '@renderer/canvas';
import { newId } from '@renderer/core/ids';
import { richTextFromPlain } from '@renderer/core/richText';
import { translateKey } from '@renderer/i18n';
import { sizeOf } from './actions';
import { createRootNode } from './model';

export { mindmapPlugin } from './plugin';

/** Root node of a brand-new mind map, centred on the origin. */
export function seedMindmapElements() {
  const text = richTextFromPlain(translateKey('mindmap:defaults.root'));
  const id = newId();
  const probe = createRootNode(id, 0, 0, text);
  const size = sizeOf(probe, 'root');
  return [createRootNode(id, Math.round(-size.w / 2), Math.round(-size.h / 2), text, size.w, size.h)];
}

export const mindmapEditor = createCanvasEditorPlugin({
  preset: {
    kind: 'mindmap',
    initialMode: 'diagram',
    initialTool: 'canvas.selectTool',
    toolbar: 'full',
  },
  seedElements: seedMindmapElements,
});
