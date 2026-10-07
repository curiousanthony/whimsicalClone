/**
 * Freehand tools: marker (thin / thick), highlighter and the whole-stroke eraser. They run as
 * ToolSessions inside the engine's gesture transaction: the live points stay in a closure buffer
 * (drawn by a world-space overlay) and exactly one `api.update` happens on pointer-up, so a
 * stroke is one undo step. Detect shapes is applied in a second, separate undo step.
 */

import type { Draft } from 'immer';
import type {
  BoardDocument,
  BoardElement,
  CanvasApi,
  CanvasPointerEvent,
  StrokeElement,
  ToolDefinition,
  ToolSession,
} from '@renderer/core/types';
import { EraserIndex, eraserWorldRadius } from './eraser';
import { getDetectShapes } from './detectShapesPref';
import { detectShape } from './shapeDetect';
import { ERASER_RADIUS_PX, type Sample } from './strokeGeometry';
import { createLiveStrokeOverlay } from './StrokeView';
import { createStroke, penStyleFrom, shapeFields, strokeCenterLine, type PenSize, type PenTool } from './strokeModel';
import { DRAW_TOOL_IDS } from './toolIds';

/** Minimum distance between recorded samples, in screen pixels. */
const MIN_SAMPLE_PX = 1;

const MODES = ['diagram', 'wireframe'] as const;

const ERASER_CURSOR = (() => {
  const r = ERASER_RADIUS_PX;
  const size = r * 2 + 4;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='rgba(255,255,255,0.35)' stroke='%23293744' stroke-width='1.5'/></svg>`;
  return `url("data:image/svg+xml;utf8,${svg}") ${size / 2} ${size / 2}, crosshair`;
})();

function sampleOf(p: { x: number; y: number }, pressure: number): Sample {
  return { x: p.x, y: p.y, pressure: pressure > 0 ? pressure : 0.5 };
}

/** Applies Detect shapes to a just-committed stroke as its own undo step. */
export function scheduleShapeDetection(api: CanvasApi, id: string): void {
  if (!getDetectShapes()) return;
  const el = api.getElement<'stroke'>(id);
  if (!el) return;
  const detected = detectShape(strokeCenterLine(el));
  if (!detected) return;
  setTimeout(() => {
    const current = api.getElement<'stroke'>(id);
    if (!current || current.detectedShape) return;
    api.update((d: Draft<BoardDocument>) => {
      const target = d.elements.find((x) => x.id === id);
      if (target && target.type === 'stroke') Object.assign(target, shapeFields(target as StrokeElement, detected));
    });
  }, 0);
}

function startPenSession(e: CanvasPointerEvent, api: CanvasApi, tool: PenTool, size: PenSize): ToolSession {
  api.setSelection([]);
  const style = penStyleFrom(tool, size, (key) => api.getStyleFor(key));
  const buffer: Sample[] = [sampleOf(e.world, e.pressure)];
  const minDistance = () => MIN_SAMPLE_PX / Math.max(api.getViewport().zoom, 1e-6);
  const isPen = e.pointerType === 'pen';
  const push = (p: { x: number; y: number }, pressure: number) => {
    const last = buffer[buffer.length - 1]!;
    if (Math.hypot(p.x - last.x, p.y - last.y) >= minDistance()) buffer.push(sampleOf(p, pressure));
  };
  return {
    onPointerMove(m) {
      for (const s of m.samples) push(s, s.pressure);
    },
    onPointerUp(m) {
      push(m.world, m.pressure);
      const el = createStroke(api.createId(), buffer, style, { isPen, minDistance: minDistance() });
      api.update((d: Draft<BoardDocument>) => {
        d.elements.push(el as Draft<BoardElement>);
      });
      scheduleShapeDetection(api, el.id);
    },
    onCancel() {
      buffer.length = 0;
    },
    Overlay: createLiveStrokeOverlay(buffer, style, () => api.theme),
  };
}

function startEraserSession(e: CanvasPointerEvent, api: CanvasApi): ToolSession {
  api.setSelection([]);
  const strokes = api.getDocument().elements.filter((x): x is StrokeElement => x.type === 'stroke');
  const index = new EraserIndex(strokes);
  const erased = new Set<string>();
  const radius = () => eraserWorldRadius(ERASER_RADIUS_PX, api.getViewport().zoom);
  let last = e.world;

  const erase = (ids: readonly string[]) => {
    const fresh = ids.filter((id) => !erased.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) erased.add(id);
    const gone = new Set(fresh);
    // Inside the gesture transaction: previewed now, one undo step on pointer-up, restored on Escape.
    api.update((d: Draft<BoardDocument>) => {
      d.elements = d.elements.filter((x) => !gone.has(x.id));
    });
  };

  erase(index.hitPoint(e.world, radius()));
  return {
    onPointerMove(m) {
      let prev = last;
      for (const s of m.samples) {
        erase(index.hitSegment(prev, s, radius()));
        prev = s;
      }
      last = m.world;
    },
    onPointerUp(m) {
      erase(index.hitSegment(last, m.world, radius()));
    },
  };
}

function penTool(
  id: string,
  labelKey: string,
  icon: string,
  tool: PenTool,
  size: PenSize,
  shortcutId: string | undefined,
  keywordsKey: string,
): ToolDefinition {
  return {
    id,
    module: 'draw',
    labelKey,
    icon,
    shortcutId,
    group: 'freehand',
    modes: MODES,
    keywordsKey,
    cursor: 'crosshair',
    persistent: true,
    onPointerDown: (e, api) => startPenSession(e, api, tool, size),
  };
}

export const drawTools: readonly ToolDefinition[] = [
  penTool(
    DRAW_TOOL_IDS.markerThin,
    'draw:tools.markerThin',
    'Pencil',
    'marker',
    'thin',
    'draw.marker',
    'draw:keywords.marker',
  ),
  penTool(
    DRAW_TOOL_IDS.markerThick,
    'draw:tools.markerThick',
    'Brush',
    'marker',
    'thick',
    undefined,
    'draw:keywords.marker',
  ),
  penTool(
    DRAW_TOOL_IDS.highlighter,
    'draw:tools.highlighter',
    'Highlighter',
    'highlighter',
    'thick',
    'draw.highlighter',
    'draw:keywords.highlighter',
  ),
  {
    id: DRAW_TOOL_IDS.eraser,
    module: 'draw',
    labelKey: 'draw:tools.eraser',
    icon: 'Eraser',
    shortcutId: 'draw.eraser',
    group: 'freehand',
    modes: MODES,
    keywordsKey: 'draw:keywords.eraser',
    cursor: ERASER_CURSOR,
    persistent: true,
    onPointerDown: (e, api) => startEraserSession(e, api),
  },
];
