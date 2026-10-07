/**
 * Runtime command handlers of the flowchart module (owner: flowchart): shapes menu and
 * auto-layout. Shape keys are bound by the canvas from the tool table.
 */

import type { CanvasApi, ShortcutHandler } from '@renderer/core/types';
import { GRID } from './shapes';
import { layoutTargets, planLayout, type LayoutDirection } from './layout';
import { SHAPES_PANEL_ID } from './ShapesPanel';

/** Lays out the selected connected objects; returns false when there is nothing to lay out. */
export function runLayout(api: CanvasApi, direction: LayoutDirection): boolean {
  const doc = api.getDocument();
  const plan = planLayout(doc, layoutTargets(doc, api.getSelection()), direction, GRID);
  if (!plan) {
    api.services.notify('flowchart:notify.layoutNeedsConnected', { kind: 'info' });
    return false;
  }
  api.update((d) => {
    for (const el of d.elements) {
      const p = plan.positions.get(el.id);
      if (p && 'x' in el) {
        el.x = p.x;
        el.y = p.y;
        continue;
      }
      const sides = plan.connectors.get(el.id);
      if (sides && el.type === 'connector') {
        delete el.waypoints;
        if (el.start.kind === 'attached' && !el.start.cell) {
          el.start.side = sides.from;
          delete el.start.t;
        }
        if (el.end.kind === 'attached' && !el.end.cell) {
          el.end.side = sides.to;
          delete el.end.t;
        }
      }
    }
  });
  return true;
}

export function createFlowchartCommands(api: CanvasApi): ShortcutHandler[] {
  const diagram = () => api.getMode() === 'diagram';
  return [
    { id: 'flowchart.shapesMenu', run: () => api.openPanel(SHAPES_PANEL_ID), isEnabled: diagram },
    { id: 'flowchart.layoutVertical', run: () => void runLayout(api, 'TB'), isEnabled: diagram },
    { id: 'flowchart.layoutHorizontal', run: () => void runLayout(api, 'LR'), isEnabled: diagram },
  ];
}
