/** Public API of the flowchart module (descriptor + canvas plugin). Imported by app/ only. */

import { createCanvasEditorPlugin } from '@renderer/canvas';

export { flowchartPlugin } from './plugin';

export const flowchartEditor = createCanvasEditorPlugin({
  preset: {
    kind: 'flowchart',
    initialMode: 'diagram',
    initialTool: 'canvas.selectTool',
    toolbar: 'full',
  },
});
