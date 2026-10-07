/**
 * Tool ids of the draw module. `draw.eraser` is a literal the canvas engine switches to when the
 * pen's eraser end touches the surface. The selector is the engine's own select tool (it owns the
 * resize handles), so `draw.selector` is a command, not a tool.
 */

export type PenKind = 'markerThin' | 'markerThick' | 'highlighter';

export const DRAW_TOOL_IDS = {
  markerThin: 'draw.marker',
  markerThick: 'draw.markerThick',
  highlighter: 'draw.highlighter',
  eraser: 'draw.eraser',
} as const;

/** The engine's select tool id (canvas/engine/engine.ts SELECT_TOOL). */
export const SELECT_TOOL_ID = 'canvas.selectTool';

/** Pen kind of a tool id, undefined for non-pen tools. */
export function penKindOf(toolId: string): PenKind | undefined {
  if (toolId === DRAW_TOOL_IDS.markerThin) return 'markerThin';
  if (toolId === DRAW_TOOL_IDS.markerThick) return 'markerThick';
  if (toolId === DRAW_TOOL_IDS.highlighter) return 'highlighter';
  return undefined;
}

/** True for the tools that leave marks or erase (marker, thick marker, highlighter, eraser). */
export function isDrawTool(toolId: string): boolean {
  return penKindOf(toolId) !== undefined || toolId === DRAW_TOOL_IDS.eraser;
}
