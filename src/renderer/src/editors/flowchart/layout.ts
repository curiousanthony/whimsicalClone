/**
 * Flowchart auto-layout (owner: flowchart). Pure graph layout around dagre plus the planner
 * that turns a canvas selection into positions and connector fix-ups.
 *
 * Whimsical: select 2+ connected objects, "Lay out vertically" (top to bottom) or
 * "Lay out horizontally" (left to right); connectors are re-routed.
 */

import dagre from '@dagrejs/dagre';
import type { BoardDocument, BoardElement, ConnectorElement, Rect, Side } from '@renderer/core/types';

export type LayoutDirection = 'TB' | 'LR';

export interface LayoutNode {
  id: string;
  w: number;
  h: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export const LAYOUT_NODE_SEP = 60;
export const LAYOUT_RANK_SEP = 72;

/**
 * Computes node top-left positions. The result keeps the top-left corner of the ORIGINAL
 * union of `nodes` (given as `origin`) fixed and snaps to `grid`.
 */
export function layoutGraph(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  direction: LayoutDirection,
  origin: { x: number; y: number } = { x: 0, y: 0 },
  grid = 12,
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return result;
  const g = new dagre.graphlib.Graph({ multigraph: false });
  g.setGraph({ rankdir: direction, nodesep: LAYOUT_NODE_SEP, ranksep: LAYOUT_RANK_SEP, marginx: 0, marginy: 0, ranker: 'network-simplex' });
  g.setDefaultEdgeLabel(() => ({}));
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) g.setNode(n.id, { width: n.w, height: n.h });
  for (const e of edges) {
    if (e.from !== e.to && ids.has(e.from) && ids.has(e.to)) g.setEdge(e.from, e.to);
  }
  dagre.layout(g);
  let minX = Infinity;
  let minY = Infinity;
  const raw = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.id);
    const x = p.x - n.w / 2;
    const y = p.y - n.h / 2;
    raw.set(n.id, { x, y });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  }
  const snap = (v: number) => (grid > 0 ? Math.round(v / grid) * grid : v);
  for (const [id, p] of raw) result.set(id, { x: snap(origin.x + p.x - minX), y: snap(origin.y + p.y - minY) });
  return result;
}

export interface LayoutPlan {
  positions: Map<string, { x: number; y: number }>;
  /** Connectors between laid-out elements: sides to use (or "auto"); waypoints are dropped. */
  connectors: Map<string, { from: Side | 'auto'; to: Side | 'auto' }>;
}

function isBox(el: BoardElement): el is BoardElement & Rect {
  const o = el as unknown as Record<string, unknown>;
  return typeof o.x === 'number' && typeof o.y === 'number' && typeof o.w === 'number' && typeof o.h === 'number';
}

function attachedIds(c: ConnectorElement): [string, string] | undefined {
  return c.start.kind === 'attached' && c.end.kind === 'attached' ? [c.start.elementId, c.end.elementId] : undefined;
}

/**
 * Elements a layout command acts on. 2+ selected objects: exactly those. One selected object:
 * the connected diagram it belongs to. Nothing selected: every connected object of the board.
 */
export function layoutTargets(doc: BoardDocument, selection: readonly string[]): string[] {
  const byId = new Map(doc.elements.map((e) => [e.id, e]));
  const selected = selection.filter((id) => {
    const el = byId.get(id);
    return !!el && el.type !== 'connector';
  });
  if (selected.length >= 2) return selected;
  const adjacency = new Map<string, Set<string>>();
  for (const el of doc.elements) {
    if (el.type !== 'connector') continue;
    const ends = attachedIds(el);
    if (!ends || ends[0] === ends[1]) continue;
    if (!byId.has(ends[0]) || !byId.has(ends[1])) continue;
    (adjacency.get(ends[0]) ?? adjacency.set(ends[0], new Set()).get(ends[0])!).add(ends[1]);
    (adjacency.get(ends[1]) ?? adjacency.set(ends[1], new Set()).get(ends[1])!).add(ends[0]);
  }
  if (selected.length === 0) return [...adjacency.keys()];
  const seen = new Set<string>([selected[0]!]);
  const stack = [selected[0]!];
  while (stack.length > 0) {
    for (const next of adjacency.get(stack.pop()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return [...seen];
}

/**
 * Plans a layout for `ids`. Needs 2+ unlocked box elements joined by attached connectors;
 * returns undefined otherwise.
 */
export function planLayout(doc: BoardDocument, ids: readonly string[], direction: LayoutDirection, grid = 12): LayoutPlan | undefined {
  const wanted = new Set(ids);
  const boxes = doc.elements.filter((e): e is BoardElement & Rect => wanted.has(e.id) && e.type !== 'connector' && isBox(e) && !e.locked);
  if (boxes.length < 2) return undefined;
  const inSet = new Set(boxes.map((b) => b.id));
  const connectors = doc.elements.filter((e): e is ConnectorElement => {
    if (e.type !== 'connector') return false;
    const ends = attachedIds(e);
    return !!ends && inSet.has(ends[0]) && inSet.has(ends[1]);
  });
  if (connectors.length === 0) return undefined;
  const edges: LayoutEdge[] = connectors.map((c) => {
    const [from, to] = attachedIds(c)!;
    return { from, to };
  });
  // Rotated 90/270 elements occupy a swapped box.
  const nodes: LayoutNode[] = boxes.map((b) => {
    const rot = (b as { rotation?: number }).rotation;
    const swapped = rot === 90 || rot === 270;
    return { id: b.id, w: swapped ? b.h : b.w, h: swapped ? b.w : b.h };
  });
  const origin = {
    x: Math.min(...boxes.map((b) => rotatedOrigin(b).x)),
    y: Math.min(...boxes.map((b) => rotatedOrigin(b).y)),
  };
  const laid = layoutGraph(nodes, edges, direction, origin, grid);
  // Convert the visual top-left back to the element's own x/y (they differ for 90/270).
  const positions = new Map<string, { x: number; y: number }>();
  const centers = new Map<string, { x: number; y: number }>();
  for (const b of boxes) {
    const p = laid.get(b.id)!;
    const o = rotatedOrigin(b);
    positions.set(b.id, { x: p.x + (b.x - o.x), y: p.y + (b.y - o.y) });
    const n = nodes.find((x) => x.id === b.id)!;
    centers.set(b.id, { x: p.x + n.w / 2, y: p.y + n.h / 2 });
  }
  const sides = layoutSides(direction);
  const connectorSides = new Map<string, { from: Side | 'auto'; to: Side | 'auto' }>();
  for (const c of connectors) {
    const [from, to] = attachedIds(c)!;
    const a = centers.get(from)!;
    const b = centers.get(to)!;
    // Connectors that run along the layout direction use its natural sides; others pick freely.
    const forward = direction === 'TB' ? b.y > a.y : b.x > a.x;
    connectorSides.set(c.id, forward ? sides : { from: 'auto', to: 'auto' });
  }
  return { positions, connectors: connectorSides };
}

function rotatedOrigin(b: BoardElement & Rect): { x: number; y: number } {
  const rot = (b as { rotation?: number }).rotation;
  if (rot === 90 || rot === 270) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    return { x: cx - b.h / 2, y: cy - b.w / 2 };
  }
  return { x: b.x, y: b.y };
}

/** Sides a connector leaves / enters for a layout direction. */
export function layoutSides(direction: LayoutDirection): { from: Side; to: Side } {
  return direction === 'TB' ? { from: 'bottom', to: 'top' } : { from: 'right', to: 'left' };
}
