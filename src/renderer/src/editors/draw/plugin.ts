/**
 * Freehand module: stroke element, marker / highlighter / eraser tools, selector and Detect
 * shapes commands, pen options panel. A .wdraw file is a board with the pen toolbar only. All
 * plugins load on every canvas, so strokes can be drawn on any board, around shapes and stickies.
 */

import type { Draft } from 'immer';
import type { CanvasApi, CanvasPlugin, ElementDefinition, ShortcutHandler, StrokeElement } from '@renderer/core/types';
import { StrokeElementRender } from './StrokeView';
import { getDetectShapes, hydrateDetectShapes, setDetectShapes } from './detectShapesPref';
import { PenPanel, StrokeContextBar } from './penUi';
import { drawShortcuts } from './shortcuts';
import { resizeStroke, strokeBounds, strokeContainsPoint } from './strokeGeometry';
import { normalizeStroke } from './strokeModel';
import { drawTools } from './tools';
import { DRAW_TOOL_IDS, SELECT_TOOL_ID, isDrawTool } from './toolIds';

export const strokeDefinition: ElementDefinition<StrokeElement> = {
  type: 'stroke',
  module: 'draw',
  layer: 'box',
  Render: StrokeElementRender,
  getBounds: (element) => strokeBounds(element),
  hitTest: (element, world, tolerance) => strokeContainsPoint(element, world, tolerance),
  resize: 'free',
  rotatable: false,
  connectable: false,
  textEditable: false,
  styleProps: ['tool', 'size', 'color'],
  applyResize: (draft: Draft<StrokeElement>, next, previous) => {
    Object.assign(draft, resizeStroke(draft as StrokeElement, next, previous));
  },
  ContextBar: StrokeContextBar,
  normalize: normalizeStroke,
};

/** Runtime handlers for the draw commands that are not tools (tools are bound by the engine). */
export function createDrawCommands(api: CanvasApi): ShortcutHandler[] {
  hydrateDetectShapes(api.services.api);
  return [
    {
      // Escape leaves the drawing tools. In a .wdraw file the freehand scope is always on, so
      // this is only enabled while a drawing tool is active; otherwise Escape falls through
      // to the engine (deselect).
      id: 'draw.exit',
      run: () => api.setActiveTool(SELECT_TOOL_ID),
      isEnabled: () => isDrawTool(api.getActiveTool()),
    },
    {
      // The selector is the engine's select tool (it owns move, marquee and resize handles).
      id: 'draw.selector',
      run: () => api.setActiveTool(SELECT_TOOL_ID),
    },
    {
      id: 'draw.toggleThickness',
      run: () =>
        api.setActiveTool(
          api.getActiveTool() === DRAW_TOOL_IDS.markerThick ? DRAW_TOOL_IDS.markerThin : DRAW_TOOL_IDS.markerThick,
        ),
      isEnabled: () =>
        api.getActiveTool() === DRAW_TOOL_IDS.markerThin || api.getActiveTool() === DRAW_TOOL_IDS.markerThick,
    },
    {
      id: 'draw.detectShapes',
      run: () => setDetectShapes(api.services.api, !getDetectShapes()),
    },
    {
      id: 'draw.penOptions',
      run: () => {
        if (!isDrawTool(api.getActiveTool())) api.setActiveTool(DRAW_TOOL_IDS.markerThin);
        api.openPanel('draw.pen');
      },
    },
  ];
}

export const drawPlugin: CanvasPlugin = {
  id: 'draw',
  elements: [strokeDefinition],
  tools: drawTools,
  shortcuts: drawShortcuts,
  createCommands: createDrawCommands,
  panels: { 'draw.pen': PenPanel },
};
