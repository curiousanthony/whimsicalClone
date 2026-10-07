/**
 * Spatial index of a board (rbush). Used for viewport culling, hit testing, marquee
 * selection, snapping candidates and connector targets. Rebuilt when `elements` changes.
 */

import RBush from 'rbush';
import type { BoardDocument, BoardElement, Point, Rect } from '@renderer/core/types';
import { expandRect, rectContainsPoint, rectContainsRect, rectsIntersect } from './geometry';
import { elementBounds, type DefinitionLookup } from './scene';

export interface IndexedItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  /** Position in document.elements (z-order, 0 = back). */
  z: number;
  bounds: Rect;
}

export interface HitTestOptions {
  /** World-space tolerance (usually a few screen pixels / zoom). */
  tolerance?: number;
  /** Skip locked elements (default true, Whimsical: locked items are not click-selectable). */
  skipLocked?: boolean;
  /** Ids to ignore (e.g. the element being dragged). */
  exclude?: ReadonlySet<string>;
  /** Extra predicate. */
  filter?: (id: string) => boolean;
}

export class SceneIndex {
  private readonly tree = new RBush<IndexedItem>();
  private readonly items = new Map<string, IndexedItem>();
  private readonly byId: Map<string, BoardElement>;

  constructor(
    readonly document: BoardDocument,
    private readonly lookup: DefinitionLookup,
  ) {
    this.byId = new Map(document.elements.map((e) => [e.id, e]));
    const list: IndexedItem[] = [];
    document.elements.forEach((el, z) => {
      const bounds = elementBounds(el, document, lookup);
      const item: IndexedItem = { minX: bounds.x, minY: bounds.y, maxX: bounds.x + bounds.w, maxY: bounds.y + bounds.h, id: el.id, z, bounds };
      list.push(item);
      this.items.set(el.id, item);
    });
    this.tree.load(list);
  }

  getBounds(id: string): Rect | undefined {
    return this.items.get(id)?.bounds;
  }

  getZ(id: string): number | undefined {
    return this.items.get(id)?.z;
  }

  /** Items intersecting `rect`, sorted back to front. */
  search(rect: Rect): IndexedItem[] {
    return this.tree
      .search({ minX: rect.x, minY: rect.y, maxX: rect.x + rect.w, maxY: rect.y + rect.h })
      .sort((a, b) => a.z - b.z);
  }

  /** Ids of items intersecting `rect`, back to front. */
  idsIn(rect: Rect): string[] {
    return this.search(rect).map((i) => i.id);
  }

  /** Ids of items fully contained in `rect`, back to front. */
  idsContainedIn(rect: Rect): string[] {
    return this.search(rect)
      .filter((i) => rectContainsRect(rect, i.bounds))
      .map((i) => i.id);
  }

  /**
   * Top-most element at a world point. Uses the definition's precise hitTest when present,
   * otherwise the (tolerance-expanded) bounds.
   */
  hitTest(p: Point, options: HitTestOptions = {}): string | undefined {
    return this.hitTestAll(p, options)[0];
  }

  /** Every element at a world point, top-most first. */
  hitTestAll(p: Point, options: HitTestOptions = {}): string[] {
    const tolerance = options.tolerance ?? 0;
    const skipLocked = options.skipLocked ?? true;
    const candidates = this.search(expandRect({ x: p.x, y: p.y, w: 0, h: 0 }, tolerance)).reverse();
    const out: string[] = [];
    for (const item of candidates) {
      if (options.exclude?.has(item.id)) continue;
      if (options.filter && !options.filter(item.id)) continue;
      const el = this.byId.get(item.id);
      if (!el) continue;
      if (skipLocked && el.locked) continue;
      const def = this.lookup(el.type);
      const hit = def?.hitTest ? def.hitTest(el, p, tolerance, this.document) : rectContainsPoint(item.bounds, p, tolerance);
      if (hit) out.push(item.id);
    }
    return out;
  }

  /** Ids intersecting `rect` (convenience for marquee). */
  intersecting(rect: Rect): string[] {
    return this.search(rect)
      .filter((i) => rectsIntersect(rect, i.bounds))
      .map((i) => i.id);
  }

  /** Bounds of all elements; undefined when the board is empty. */
  contentBounds(): Rect | undefined {
    if (this.items.size === 0) return undefined;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const i of this.items.values()) {
      minX = Math.min(minX, i.minX);
      minY = Math.min(minY, i.minY);
      maxX = Math.max(maxX, i.maxX);
      maxY = Math.max(maxY, i.maxY);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
}
