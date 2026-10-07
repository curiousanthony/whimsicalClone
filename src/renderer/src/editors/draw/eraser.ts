/**
 * Whole-stroke eraser logic (pure). The eraser path is treated as line SEGMENTS between
 * consecutive pointer samples so a fast sweep cannot tunnel through a stroke. Broad phase: rbush
 * over stroke bounds; narrow phase: segment-to-polyline distance against
 * radius + half the stroke width. Dots (single-point strokes) are handled by point distance.
 */

import RBush from 'rbush';
import type { StrokeElement } from '@renderer/core/types';
import { distSegmentPolyline, segmentBounds, strokeWidth, worldPoints, type Pt } from './strokeGeometry';

interface Item {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  half: number;
  line: Pt[];
}

export class EraserIndex {
  private readonly tree = new RBush<Item>();

  constructor(strokes: readonly StrokeElement[]) {
    const items: Item[] = [];
    for (const s of strokes) {
      if (s.locked) continue;
      items.push({
        minX: s.x,
        minY: s.y,
        maxX: s.x + s.w,
        maxY: s.y + s.h,
        id: s.id,
        half: strokeWidth(s) / 2,
        line: worldPoints(s),
      });
    }
    this.tree.load(items);
  }

  /** Ids of strokes touched by the segment a-b swept by a disc of `radius` (world units). */
  hitSegment(a: Pt, b: Pt, radius: number): string[] {
    const query = segmentBounds(a, b, radius);
    const hits: string[] = [];
    for (const item of this.tree.search(query)) {
      if (distSegmentPolyline(a, b, item.line) <= radius + item.half) hits.push(item.id);
    }
    return hits;
  }

  /** Ids of strokes touched by a disc at one point (pointer-down, dots). */
  hitPoint(p: Pt, radius: number): string[] {
    return this.hitSegment(p, p, radius);
  }
}

/** World radius of the eraser disc for a zoom factor (constant on screen). */
export function eraserWorldRadius(radiusPx: number, zoom: number): number {
  return radiusPx / Math.max(zoom, 1e-6);
}
