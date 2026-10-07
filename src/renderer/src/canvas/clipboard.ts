/**
 * Canvas clipboard (pure part): what gets copied, id remapping on paste / duplicate, and the
 * serialized payload. The engine writes it to the system clipboard under CLIPBOARD_MIME with
 * a plain-text fallback.
 */

import type { BoardDocument, BoardElement, ConnectorElement, ConnectorEnd, Point, Rect } from '@renderer/core/types';
import { unionRects } from './geometry';
import { connectorGeometry, type BoundsResolver } from './connectors';
import { collectContained, elementMap, isBoxElement } from './scene';

export const CLIPBOARD_MIME = 'application/x-whimsical-clone+json';
export const CLIPBOARD_FORMAT = 'whimsical-clone/clipboard';

export interface ClipboardPayload {
  format: typeof CLIPBOARD_FORMAT;
  version: 1;
  /** Elements in z-order. */
  elements: BoardElement[];
  /** World bounds of the copied content (to paste centred / offset). */
  bounds: Rect;
}

/** Style-only clipboard (Cmd+Alt+C / Cmd+Alt+V). */
export interface StyleClipboard {
  type: string;
  style: Record<string, unknown>;
}

/**
 * Elements to copy for a selection: the selection, group members, container contents, and
 * connectors joining two copied elements. Selected connectors with an end attached outside
 * the set are kept with that end converted to a free point at its current position.
 */
export function collectForCopy(
  doc: BoardDocument,
  ids: readonly string[],
  boundsOf: BoundsResolver,
  elementBoundsOf: (id: string) => Rect | undefined,
): ClipboardPayload | undefined {
  const byId = elementMap(doc);
  const set = new Set(ids.filter((id) => byId.has(id)));
  const groups = new Set([...set].map((id) => byId.get(id)?.groupId).filter((g): g is string => !!g));
  for (const el of doc.elements) if (el.groupId && groups.has(el.groupId)) set.add(el.id);
  for (const id of collectContained(doc, [...set])) set.add(id);
  for (const el of doc.elements) {
    if (el.type !== 'connector' || set.has(el.id)) continue;
    if (el.start.kind === 'attached' && el.end.kind === 'attached' && set.has(el.start.elementId) && set.has(el.end.elementId)) {
      set.add(el.id);
    }
  }
  if (set.size === 0) return undefined;
  const elements: BoardElement[] = [];
  for (const el of doc.elements) {
    if (!set.has(el.id)) continue;
    if (el.type === 'connector') {
      const g = connectorGeometry(el, boundsOf);
      const fix = (end: ConnectorEnd, p: Point): ConnectorEnd =>
        end.kind === 'attached' && !set.has(end.elementId) ? { kind: 'free', x: p.x, y: p.y } : end;
      elements.push({ ...el, start: fix(el.start, g.start.point), end: fix(el.end, g.end.point) });
    } else {
      elements.push(el);
    }
  }
  const rects = elements.map((e) => elementBoundsOf(e.id)).filter((r): r is Rect => !!r);
  const bounds = unionRects(rects) ?? { x: 0, y: 0, w: 0, h: 0 };
  return { format: CLIPBOARD_FORMAT, version: 1, elements: structuredClone(elements), bounds };
}

/**
 * Copies of `elements` with fresh ids, translated by `offset`. Group ids are renewed,
 * container / connector / mind-map references are remapped inside the set; references to
 * elements outside the set are dropped (connector ends become free at their stored point).
 */
export function cloneElements(elements: readonly BoardElement[], createId: () => string, offset: Point): BoardElement[] {
  const idMap = new Map<string, string>();
  for (const el of elements) idMap.set(el.id, createId());
  const groupMap = new Map<string, string>();
  const out: BoardElement[] = [];
  for (const src of elements) {
    const el = structuredClone(src) as BoardElement;
    el.id = idMap.get(src.id)!;
    if (el.groupId) {
      const g = groupMap.get(el.groupId) ?? createId();
      groupMap.set(el.groupId, g);
      el.groupId = g;
    }
    if (el.containerId) {
      const c = idMap.get(el.containerId);
      if (c) el.containerId = c;
      else delete el.containerId;
    }
    if (isBoxElement(el)) {
      el.x += offset.x;
      el.y += offset.y;
    }
    if (el.type === 'connector') {
      el.start = remapEnd(el.start, idMap, offset);
      el.end = remapEnd(el.end, idMap, offset);
      if (el.waypoints) el.waypoints = el.waypoints.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }));
    }
    if (el.type === 'mindmapNode') {
      const parent = el.treeParentId ? idMap.get(el.treeParentId) : undefined;
      if (el.treeParentId && !parent) {
        // Parent not copied: this node becomes the root of a new map.
        el.treeParentId = null;
        el.rootId = el.id;
        delete el.side;
      } else {
        el.treeParentId = parent ?? null;
      }
    }
    out.push(el);
  }
  // Mind-map roots: re-point rootId to the (possibly new) root of each copied tree.
  const byId = new Map(out.map((e) => [e.id, e]));
  for (const el of out) {
    if (el.type !== 'mindmapNode') continue;
    let cur = el;
    const seen = new Set<string>();
    while (cur.treeParentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      const p = byId.get(cur.treeParentId);
      if (!p || p.type !== 'mindmapNode') break;
      cur = p;
    }
    el.rootId = cur.id;
  }
  return out;
}

function remapEnd(end: ConnectorEnd, idMap: Map<string, string>, offset: Point): ConnectorEnd {
  if (end.kind === 'free') return { kind: 'free', x: end.x + offset.x, y: end.y + offset.y };
  const id = idMap.get(end.elementId);
  if (id) return { ...end, elementId: id };
  return end;
}

export function serializeClipboard(payload: ClipboardPayload): string {
  return JSON.stringify(payload);
}

export function parseClipboard(text: string | undefined | null): ClipboardPayload | undefined {
  if (!text) return undefined;
  try {
    const raw = JSON.parse(text) as Partial<ClipboardPayload>;
    if (raw.format !== CLIPBOARD_FORMAT || !Array.isArray(raw.elements) || !raw.bounds) return undefined;
    const elements = raw.elements.filter(
      (e): e is BoardElement => !!e && typeof e === 'object' && typeof (e as BoardElement).id === 'string' && typeof (e as BoardElement).type === 'string',
    );
    return { format: CLIPBOARD_FORMAT, version: 1, elements, bounds: raw.bounds };
  } catch {
    return undefined;
  }
}

/** Connector ids whose attached ends reference elements not in the document. */
export function danglingConnectorEnds(doc: BoardDocument): ConnectorElement[] {
  const ids = new Set(doc.elements.map((e) => e.id));
  return doc.elements.filter(
    (e): e is ConnectorElement =>
      e.type === 'connector' &&
      ((e.start.kind === 'attached' && !ids.has(e.start.elementId)) || (e.end.kind === 'attached' && !ids.has(e.end.elementId))),
  );
}
