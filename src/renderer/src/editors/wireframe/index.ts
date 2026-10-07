/** Public API of the wireframe module (descriptor + canvas plugin). Imported by app/ only. */

import { createCanvasEditorPlugin } from '@renderer/canvas';

export { wireframePlugin } from './plugin';

export const wireframeEditor = createCanvasEditorPlugin({
  preset: {
    kind: 'wireframe',
    initialMode: 'wireframe',
    initialTool: 'canvas.selectTool',
    toolbar: 'full',
  },
});
