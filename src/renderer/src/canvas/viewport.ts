/**
 * Viewport math. Contract (core/types.ts): screen = (world - {x, y}) * zoom, where {x, y} is
 * the world point at the top-left of the canvas element.
 */

import type { Point, Rect, Size, Viewport } from '@renderer/core/types';
import { clamp } from './geometry';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
/** Discrete zoom stops used by =, -, the zoom menu and toolbar buttons. */
export const ZOOM_STEPS: readonly number[] = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4];

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

export function clampZoom(zoom: number): number {
  return clamp(zoom, MIN_ZOOM, MAX_ZOOM);
}

export function screenToWorld(viewport: Viewport, p: Point): Point {
  return { x: p.x / viewport.zoom + viewport.x, y: p.y / viewport.zoom + viewport.y };
}

export function worldToScreen(viewport: Viewport, p: Point): Point {
  return { x: (p.x - viewport.x) * viewport.zoom, y: (p.y - viewport.y) * viewport.zoom };
}

/** World rect currently visible in a canvas element of `size` screen pixels. */
export function visibleWorldRect(viewport: Viewport, size: Size): Rect {
  return { x: viewport.x, y: viewport.y, w: size.w / viewport.zoom, h: size.h / viewport.zoom };
}

/** New viewport with `zoom`, keeping the world point under `screenAnchor` fixed. */
export function zoomAt(viewport: Viewport, zoom: number, screenAnchor: Point): Viewport {
  const next = clampZoom(zoom);
  const world = screenToWorld(viewport, screenAnchor);
  return { zoom: next, x: world.x - screenAnchor.x / next, y: world.y - screenAnchor.y / next };
}

/** Pans by a screen-space delta (dragging the content by +dx moves the viewport by -dx). */
export function panBy(viewport: Viewport, dxScreen: number, dyScreen: number): Viewport {
  return { zoom: viewport.zoom, x: viewport.x - dxScreen / viewport.zoom, y: viewport.y - dyScreen / viewport.zoom };
}

/** Next zoom stop above (dir 1) or below (dir -1) the current zoom. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  const eps = 1e-3;
  if (dir > 0) return ZOOM_STEPS.find((z) => z > zoom + eps) ?? MAX_ZOOM;
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    const z = ZOOM_STEPS[i]!;
    if (z < zoom - eps) return z;
  }
  return MIN_ZOOM;
}

/**
 * Viewport that fits `target` into `size` with `padding` screen pixels around it. The zoom
 * is capped at `maxZoom` (Whimsical never zooms past 100% when fitting content).
 */
export function fitRect(target: Rect, size: Size, options: { padding?: number; maxZoom?: number } = {}): Viewport {
  const padding = options.padding ?? 64;
  const maxZoom = options.maxZoom ?? 1;
  const availW = Math.max(1, size.w - padding * 2);
  const availH = Math.max(1, size.h - padding * 2);
  const zoom = clampZoom(Math.min(maxZoom, availW / Math.max(target.w, 1), availH / Math.max(target.h, 1)));
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  return { zoom, x: cx - size.w / 2 / zoom, y: cy - size.h / 2 / zoom };
}

/** Viewport centred on a world point at the given zoom. */
export function centerOn(point: Point, size: Size, zoom: number): Viewport {
  return { zoom, x: point.x - size.w / 2 / zoom, y: point.y - size.h / 2 / zoom };
}

/**
 * Wheel handling (macOS trackpads): pinch arrives as wheel + ctrlKey; Cmd+wheel zooms; plain
 * wheel pans (two-finger swipe); Shift+wheel pans horizontally (mouse wheels).
 * Returns the next viewport.
 */
export function viewportFromWheel(
  viewport: Viewport,
  e: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  anchor: Point,
  options: { invertZoom?: boolean } = {},
): Viewport {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  const dx = e.deltaX * unit;
  const dy = e.deltaY * unit;
  if (e.ctrlKey || e.metaKey) {
    // Pinch deltas are small; Cmd+wheel from a mouse are large: clamp the step.
    const sign = options.invertZoom ? -1 : 1;
    const factor = Math.exp(clamp(-dy * sign * (e.ctrlKey ? 0.01 : 0.002), -0.5, 0.5));
    return zoomAt(viewport, viewport.zoom * factor, anchor);
  }
  if (e.shiftKey && dx === 0) return panBy(viewport, -dy, 0);
  return panBy(viewport, -dx, -dy);
}

export function viewportsEqual(a: Viewport, b: Viewport): boolean {
  return a.x === b.x && a.y === b.y && a.zoom === b.zoom;
}

export function isValidViewport(v: unknown): v is Viewport {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return [o.x, o.y, o.zoom].every((n) => typeof n === 'number' && Number.isFinite(n)) && (o.zoom as number) > 0;
}
