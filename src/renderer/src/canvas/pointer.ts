/**
 * Pointer Events layer: converts DOM PointerEvents into CanvasPointerEvents (world
 * coordinates, pressure, pen info, coalesced high-rate samples).
 *
 * Pen input works as a normal pointer. Pressure is reported (stored by strokes for fidelity)
 * but the engine never varies width with it (user decision). The pen's eraser end / barrel
 * eraser button is reported through `isEraserPointer`.
 */

import type { CanvasPointerEvent, Point, Viewport } from '@renderer/core/types';
import { screenToWorld } from './viewport';

/** Bit of PointerEvent.buttons set by the pen eraser (W3C Pointer Events). */
export const ERASER_BUTTONS_BIT = 32;
/** PointerEvent.button value of the eraser on pointerdown. */
export const ERASER_BUTTON = 5;

export function normalizePointerType(type: string): CanvasPointerEvent['pointerType'] {
  return type === 'pen' || type === 'touch' ? type : 'mouse';
}

/** True when the event comes from a pen's eraser (inverted stylus or eraser button). */
export function isEraserPointer(e: { pointerType: string; buttons: number; button: number }): boolean {
  return e.pointerType === 'pen' && ((e.buttons & ERASER_BUTTONS_BIT) !== 0 || e.button === ERASER_BUTTON);
}

/** Pressure normalised: mice report 0.5 while pressed (spec), pens 0..1. */
export function normalizePressure(e: { pressure: number; pointerType: string; buttons: number }): number {
  if (e.pointerType !== 'pen') return e.buttons !== 0 ? 0.5 : 0;
  return Math.max(0, Math.min(1, e.pressure));
}

/**
 * Builds a CanvasPointerEvent. `origin` is the top-left of the canvas element in client
 * coordinates.
 */
export function toCanvasPointerEvent(native: PointerEvent, viewport: Viewport, origin: Point): CanvasPointerEvent {
  const screen = { x: native.clientX - origin.x, y: native.clientY - origin.y };
  const world = screenToWorld(viewport, screen);
  const coalesced: PointerEvent[] =
    typeof native.getCoalescedEvents === 'function' && native.type === 'pointermove' ? native.getCoalescedEvents() : [];
  const sources = coalesced.length > 0 ? coalesced : [native];
  const samples = sources.map((s) => {
    const w = screenToWorld(viewport, { x: s.clientX - origin.x, y: s.clientY - origin.y });
    return { x: w.x, y: w.y, pressure: normalizePressure(s) };
  });
  return {
    world,
    screen,
    button: native.button,
    buttons: native.buttons,
    pointerId: native.pointerId,
    pointerType: normalizePointerType(native.pointerType),
    pressure: normalizePressure(native),
    shiftKey: native.shiftKey,
    altKey: native.altKey,
    metaKey: native.metaKey,
    ctrlKey: native.ctrlKey,
    samples,
    native,
  };
}

/** Screen distance (px) a pointer must travel before a press becomes a drag. */
export const DRAG_THRESHOLD_PX = 3;

export function exceedsDragThreshold(a: Point, b: Point, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.abs(a.x - b.x) > threshold || Math.abs(a.y - b.y) > threshold;
}
