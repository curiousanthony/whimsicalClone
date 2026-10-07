/** Public API of the draw module (descriptor + canvas plugin). Imported by app/ only. */

import { createCanvasEditorPlugin } from '@renderer/canvas';

export { drawPlugin, strokeDefinition } from './plugin';
/** Embeddable read-only stroke renderer (used to draw stroke elements outside the engine, e.g. previews). */
export { StrokeView } from './StrokeView';

export const drawEditor = createCanvasEditorPlugin({
  preset: {
    kind: 'draw',
    initialMode: 'diagram',
    initialTool: 'draw.marker',
    toolbar: 'draw',
    extraScopes: ['canvas.freehand'],
  },
});
