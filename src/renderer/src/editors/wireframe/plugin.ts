/**
 * Wireframe module: wire components (data-driven registry), device frames, annotations,
 * component / frame launchers. .wwire opens the board in wireframe mode (1 px grid).
 *
 * Provided by the canvas engine, NOT here: selection / transform / snapping, connectors,
 * z-order, copy / paste style, save default style, text editing (Enter renames a frame since
 * the frame is a text-editable element), W / Q mode switching.
 */

import { produce } from 'immer';
import type { CanvasPlugin, WireElement } from '@renderer/core/types';
import { createWireframeCommands } from './commands';
import { annotationDefinition, frameDefinition, wireDefinition } from './definitions';
import { ComponentsPanel, FramesPanel } from './LauncherPanels';
import { autoWidthTargets } from './model';
import { wireframeShortcuts } from './shortcuts';
import { COMPONENTS_PANEL_ID, FRAMES_PANEL_ID, wireframeTools } from './tools';

export const wireframePlugin: CanvasPlugin = {
  id: 'wireframe',
  elements: [wireDefinition, frameDefinition, annotationDefinition],
  tools: wireframeTools,
  shortcuts: wireframeShortcuts,
  createCommands: createWireframeCommands,
  panels: { [COMPONENTS_PANEL_ID]: ComponentsPanel, [FRAMES_PANEL_ID]: FramesPanel },
  afterChange(next, previous, api) {
    const measure = (el: WireElement) =>
      api.measureText(el.text, { textSize: el.textSize, scale: 'wireframe', bold: el.component === 'button' }).w;
    const targets = autoWidthTargets(next, previous, measure);
    if (targets.size === 0) return next;
    return produce(next, (d) => {
      for (const el of d.elements) {
        const w = targets.get(el.id);
        if (w !== undefined && el.type === 'wire') el.w = w;
      }
    });
  },
};
