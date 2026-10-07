/**
 * Scene helpers: element definitions lookup, bounds, containment and move sets. Pure.
 */

import type {
  BoardDocument,
  BoardElement,
  BoxBoardElement,
  CanvasPlugin,
  ConnectorElement,
  ElementDefinition,
  Rect,
} from '@renderer/core/types';
import { rectContainsRect, rotatedBounds } from './geometry';

/** Returns the element definition of a type (undefined for unknown types). */
export type DefinitionLookup = (type: string) => ElementDefinition | undefined;

/** Builds a lookup from plugins; the first plugin defining a type wins. */
export function createDefinitionLookup(plugins: readonly CanvasPlugin[]): DefinitionLookup {
  const map = new Map<string, ElementDefinition>();
  for (const plugin of plugins) {
    for (const def of plugin.elements) {
      if (!map.has(def.type)) map.set(def.type, def as ElementDefinition);
    }
  }
  return (type) => map.get(type);
}

export function isConnector(el: BoardElement): el is ConnectorElement {
  return el.type === 'connector';
}

/** True when the element has a numeric world box (x, y, w, h). Unknown types included. */
export function isBoxElement(el: BoardElement): el is BoxBoardElement {
  const o = el as unknown as Record<string, unknown>;
  return typeof o.x === 'number' && typeof o.y === 'number' && typeof o.w === 'number' && typeof o.h === 'number';
}

/** Box of an element ignoring rotation (its local frame). */
export function elementBox(el: BoardElement): Rect | undefined {
  if (!isBoxElement(el)) return undefined;
  return { x: el.x, y: el.y, w: el.w, h: el.h };
}

/** World-space bounds of an element (rotation applied). */
export function elementBounds(el: BoardElement, doc: BoardDocument, lookup: DefinitionLookup): Rect {
  const def = lookup(el.type);
  if (def) return def.getBounds(el, doc);
  if (isBoxElement(el)) return rotatedBounds({ x: el.x, y: el.y, w: el.w, h: el.h }, el.rotation);
  return { x: 0, y: 0, w: 0, h: 0 };
}

export function elementMap(doc: BoardDocument): Map<string, BoardElement> {
  return new Map(doc.elements.map((e) => [e.id, e]));
}

/** Ids of elements whose containerId chain leads to one of `ids` (sections, frames). */
export function collectContained(doc: BoardDocument, ids: Iterable<string>): Set<string> {
  const result = new Set<string>();
  const roots = new Set(ids);
  const byContainer = new Map<string, string[]>();
  for (const el of doc.elements) {
    if (!el.containerId) continue;
    const list = byContainer.get(el.containerId) ?? [];
    list.push(el.id);
    byContainer.set(el.containerId, list);
  }
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const child of byContainer.get(id) ?? []) {
      if (result.has(child) || roots.has(child)) continue;
      result.add(child);
      stack.push(child);
    }
  }
  return result;
}

/**
 * Everything that moves when `ids` are dragged: the ids, their group members, the contents of
 * containers, and connectors whose both attached ends are inside the set (their free ends and
 * waypoints are translated too). Locked elements never move.
 */
export function collectMoveSet(doc: BoardDocument, ids: readonly string[]): Set<string> {
  const byId = elementMap(doc);
  const set = new Set<string>();
  for (const id of ids) {
    const el = byId.get(id);
    if (el && !el.locked) set.add(id);
  }
  const groups = new Set([...set].map((id) => byId.get(id)?.groupId).filter((g): g is string => !!g));
  if (groups.size > 0) {
    for (const el of doc.elements) if (el.groupId && groups.has(el.groupId) && !el.locked) set.add(el.id);
  }
  for (const id of collectContained(doc, [...set])) {
    const el = byId.get(id);
    if (el && !el.locked) set.add(id);
  }
  for (const el of doc.elements) {
    if (!isConnector(el) || set.has(el.id)) continue;
    const s = el.start.kind === 'attached' ? set.has(el.start.elementId) : false;
    const e = el.end.kind === 'attached' ? set.has(el.end.elementId) : false;
    // Connectors between two moved elements move with them (their waypoints shift too). A
    // connector with a free end keeps that end where it is (Whimsical behaviour).
    if (s && e) set.add(el.id);
  }
  return set;
}

/**
 * Innermost container (section / frame) that fully contains `bounds`, excluding `exclude`.
 * Later elements (higher z) win when nested.
 */
export function findContainerFor(
  doc: BoardDocument,
  bounds: Rect,
  lookup: DefinitionLookup,
  exclude: ReadonlySet<string>,
): string | undefined {
  let found: { id: string; area: number } | undefined;
  for (const el of doc.elements) {
    if (exclude.has(el.id)) continue;
    const def = lookup(el.type);
    if (!def?.container) continue;
    const r = elementBounds(el, doc, lookup);
    if (!rectContainsRect(r, bounds)) continue;
    const area = r.w * r.h;
    if (!found || area <= found.area) found = { id: el.id, area };
  }
  return found?.id;
}

/** Index of each element id in z-order (0 = back). */
export function zIndexMap(doc: BoardDocument): Map<string, number> {
  return new Map(doc.elements.map((e, i) => [e.id, i]));
}
