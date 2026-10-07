/**
 * Canvas engine's own plugin (owner: canvas module): connector element, select / pan /
 * connector tools, and engine-wide shortcuts. Engine command handlers are bound by the
 * CanvasEditor itself (they need engine internals); see engine/commands.ts.
 */

import type { CanvasPlugin } from '@renderer/core/types';
import { connectorDefinition, connectorTool, panTool, selectTool } from './elements/connector';
import { canvasShortcuts } from './shortcuts';

export const canvasCorePlugin: CanvasPlugin = {
  id: 'canvas',
  elements: [connectorDefinition],
  tools: [selectTool, panTool, connectorTool],
  shortcuts: canvasShortcuts,
};
