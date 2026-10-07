/**
 * Grid snapping and smart guides (pure).
 *
 * Whimsical rules: items snap to the grid (12 px boards, 1 px wireframes); alignment with the
 * edges / centres of other items (smart guides, red #b1223f) takes precedence over the grid.
 * Cmd while dragging = grid only; backtick while dragging = no snapping at all.
 */

import type { Point, Rect } from '@renderer/core/types';
import { snapToGrid } from './geometry';

export type SnapMode = 'all' | 'grid' | 'none';

/** A guide line in world coordinates. axis "x" = vertical line at x = `at`. */
export interface SnapGuide {
  axis: 'x' | 'y';
  at: number;
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

/** Snap threshold in screen pixels. */
export const SNAP_THRESHOLD_PX = 6;

export function snapModeFromModifiers(mods: { metaKey?: boolean; backtick?: boolean }): SnapMode {
  if (mods.backtick) return 'none';
  if (mods.metaKey) return 'grid';
  return 'all';
}

function linesX(r: Rect): number[] {
  return [r.x, r.x + r.w / 2, r.x + r.w];
}

function linesY(r: Rect): number[] {
  return [r.y, r.y + r.h / 2, r.y + r.h];
}

interface AxisMatch {
  offset: number;
  /** Target line positions that match after applying the offset. */
  targets: number[];
}

function bestAxisMatch(moving: number[], targets: number[], threshold: number): AxisMatch | undefined {
  let best: number | undefined;
  for (const m of moving) {
    for (const t of targets) {
      const d = t - m;
      if (Math.abs(d) <= threshold && (best === undefined || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  if (best === undefined) return undefined;
  const offset = best;
  const matched = new Set<number>();
  for (const m of moving) for (const t of targets) if (Math.abs(t - (m + offset)) < 0.01) matched.add(t);
  return { offset, targets: [...matched] };
}

/**
 * Snaps a moving rect (already translated by the raw drag delta) against `others` and the grid.
 * Returns the extra offset to apply and the guides to draw.
 */
export function snapMovingRect(
  moving: Rect,
  others: readonly Rect[],
  options: { grid: number; zoom: number; mode: SnapMode; thresholdPx?: number },
): SnapResult {
  if (options.mode === 'none') return { dx: 0, dy: 0, guides: [] };
  const threshold = (options.thresholdPx ?? SNAP_THRESHOLD_PX) / options.zoom;
  let dx: number | undefined;
  let dy: number | undefined;
  const guides: SnapGuide[] = [];

  if (options.mode === 'all' && others.length > 0) {
    const mx = bestAxisMatch(linesX(moving), others.flatMap(linesX), threshold);
    const my = bestAxisMatch(linesY(moving), others.flatMap(linesY), threshold);
    if (mx) dx = mx.offset;
    if (my) dy = my.offset;
    const snapped: Rect = { x: moving.x + (dx ?? 0), y: moving.y + (dy ?? 0), w: moving.w, h: moving.h };
    if (mx) {
      for (const at of mx.targets) {
        const related = others.filter((o) => linesX(o).some((v) => Math.abs(v - at) < 0.01));
        const ys = [snapped.y, snapped.y + snapped.h, ...related.flatMap((o) => [o.y, o.y + o.h])];
        guides.push({ axis: 'x', at, from: Math.min(...ys), to: Math.max(...ys) });
      }
    }
    if (my) {
      for (const at of my.targets) {
        const related = others.filter((o) => linesY(o).some((v) => Math.abs(v - at) < 0.01));
        const xs = [snapped.x, snapped.x + snapped.w, ...related.flatMap((o) => [o.x, o.x + o.w])];
        guides.push({ axis: 'y', at, from: Math.min(...xs), to: Math.max(...xs) });
      }
    }
  }

  if (options.grid > 1) {
    if (dx === undefined) dx = snapToGrid(moving.x, options.grid) - moving.x;
    if (dy === undefined) dy = snapToGrid(moving.y, options.grid) - moving.y;
  }
  return { dx: dx ?? 0, dy: dy ?? 0, guides };
}

/** Snaps a single point (resize handles, tool placement) to guides of `others` and the grid. */
export function snapPoint(
  p: Point,
  others: readonly Rect[],
  options: { grid: number; zoom: number; mode: SnapMode; thresholdPx?: number },
): { point: Point; guides: SnapGuide[] } {
  const r = snapMovingRect({ x: p.x, y: p.y, w: 0, h: 0 }, others, options);
  return { point: { x: p.x + r.dx, y: p.y + r.dy }, guides: r.guides };
}
