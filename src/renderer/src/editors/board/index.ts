/** Public API of the board module (descriptor + canvas plugin). Imported by app/ only. */

import { createCanvasEditorPlugin } from '@renderer/canvas';

export { boardPlugin, boardElementDefinitions } from './plugin';
export { stickyDefinition } from './elements/sticky';
export { textDefinition } from './elements/text';
export { createStickyElement, createTextElement, STICKY_SIZE } from './model';
export { createStickyAt, createTextAt } from './tools';

export const boardEditor = createCanvasEditorPlugin({
  preset: {
    kind: 'board',
    initialMode: 'diagram',
    initialTool: 'canvas.selectTool',
    toolbar: 'full',
  },
});
