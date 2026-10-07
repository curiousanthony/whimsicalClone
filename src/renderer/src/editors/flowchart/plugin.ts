/**
 * Flowchart / diagram shapes module: shape element (16 shapes + cross), shapes menu (S), shape
 * tools, auto-layout (dagre). .wflow opens the board in diagram mode.
 *
 * Provided by the canvas engine, NOT here: connectors (routing, endpoints, labels, attach),
 * quick add (Alt+Arrow and hover buttons), neighbour selection (Alt+Shift+Arrow, Tab), nudges,
 * align / distribute, text editing (Enter), duplicate, copy / paste style.
 */

import type { CanvasPlugin } from '@renderer/core/types';
import { createFlowchartCommands } from './commands';
import { shapeDefinition } from './definition';
import { ShapesPanel, SHAPES_PANEL_ID } from './ShapesPanel';
import { fitAutoHeights } from './shapes';
import { flowchartShortcuts } from './shortcuts';
import { shapeTools } from './tools';

export const flowchartPlugin: CanvasPlugin = {
  id: 'flowchart',
  elements: [shapeDefinition],
  tools: shapeTools,
  shortcuts: flowchartShortcuts,
  createCommands: createFlowchartCommands,
  panels: { [SHAPES_PANEL_ID]: ShapesPanel },
  afterChange: (next, previous) => fitAutoHeights(next, previous),
};
