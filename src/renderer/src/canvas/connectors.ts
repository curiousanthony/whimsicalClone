/**
 * Connector geometry (pure): end resolution, straight / curved / elbow routing, SVG paths,
 * bounds and hit testing. Connectors attach to any connectable element's box.
 */

import type { BoardDocument, BoardElement, ConnectorElement, ConnectorEnd, Point, Rect, Side } from '@renderer/core/types';
import {
  boundsOfPoints,
  distance,
  distanceToPolyline,
  expandRect,
  nearestSide,
  pointAlongPolyline,
  pointOnSide,
  rectCenter,
  sampleCubic,
  sideFacing,
  sideNormal,
} from './geometry';
import { elementBounds, elementMap, type DefinitionLookup } from './scene';

/** Distance an elbow route leaves an element before turning. */
export const ELBOW_STUB = 24;

export interface ResolvedEnd {
  point: Point;
  /** Side the connector leaves through (attached ends, or inferred for free ends). */
  side?: Side;
  /** Box of the attached element. */
  rect?: Rect;
  attached: boolean;
}

export interface ConnectorGeometry {
  start: ResolvedEnd;
  end: ResolvedEnd;
  /** Polyline approximation (used for hit testing, bounds and label placement). */
  points: Point[];
  /** SVG path data. */
  d: string;
  /** Unit tangent pointing OUT of the path at each end (for endpoint markers). */
  startAngle: number;
  endAngle: number;
}

export type BoundsResolver = (id: string) => Rect | undefined;

/** Bounds resolver for connector ends over a document. */
export function createBoundsResolver(doc: BoardDocument, lookup: DefinitionLookup): BoundsResolver {
  const byId = elementMap(doc);
  const cache = new Map<string, Rect | undefined>();
  return (id) => {
    if (cache.has(id)) return cache.get(id);
    const el: BoardElement | undefined = byId.get(id);
    const r = el && el.type !== 'connector' ? elementBounds(el, doc, lookup) : undefined;
    cache.set(id, r);
    return r;
  };
}

/** Rough anchor of an end (centre of the attached box or the free point). */
function anchorOf(end: ConnectorEnd, boundsOf: BoundsResolver): Point | undefined {
  if (end.kind === 'free') return { x: end.x, y: end.y };
  const r = boundsOf(end.elementId);
  return r ? rectCenter(r) : undefined;
}

/** Resolves one end. `toward` is the other end's anchor (for "auto" sides). */
export function resolveEnd(end: ConnectorEnd, toward: Point | undefined, boundsOf: BoundsResolver): ResolvedEnd {
  if (end.kind === 'free') return { point: { x: end.x, y: end.y }, attached: false };
  const r = boundsOf(end.elementId);
  if (!r) return { point: { x: 0, y: 0 }, attached: false };
  const side: Side = end.side === 'auto' ? (toward ? sideFacing(r, toward) : 'right') : end.side;
  const t = end.side === 'auto' ? 0.5 : (end.t ?? 0.5);
  return { point: pointOnSide(r, side, t), side, rect: r, attached: true };
}

function inferFreeSide(from: Point, to: Point): Side {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

function opposite(side: Side): Side {
  return side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left';
}

function isHorizontal(side: Side): boolean {
  return side === 'left' || side === 'right';
}

/** Removes consecutive duplicates and collinear middle points. */
export function simplifyOrthogonal(points: Point[]): Point[] {
  const dedup: Point[] = [];
  for (const p of points) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) dedup.push(p);
  }
  const out: Point[] = [];
  for (let i = 0; i < dedup.length; i++) {
    const a = out[out.length - 1];
    const b = dedup[i]!;
    const c = dedup[i + 1];
    if (a && c) {
      const collinear = (Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01) || (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01);
      if (collinear) continue;
    }
    out.push(b);
  }
  return out;
}

/**
 * Orthogonal route between two ends leaving through their sides. Uses stubs of ELBOW_STUB
 * and a single mid segment; `mid` (from a waypoint) overrides the middle coordinate.
 */
export function elbowRoute(start: Point, startSide: Side, end: Point, endSide: Side, mid?: Point): Point[] {
  const n1 = sideNormal(startSide);
  const n2 = sideNormal(endSide);
  const s = { x: start.x + n1.x * ELBOW_STUB, y: start.y + n1.y * ELBOW_STUB };
  const e = { x: end.x + n2.x * ELBOW_STUB, y: end.y + n2.y * ELBOW_STUB };
  const pts: Point[] = [start, s];
  const h1 = isHorizontal(startSide);
  const h2 = isHorizontal(endSide);
  if (h1 && h2) {
    const mx = mid?.x ?? (s.x + e.x) / 2;
    // Facing sides with enough room: one vertical segment in the middle.
    if ((startSide === 'right' && end.x > start.x) || (startSide === 'left' && end.x < start.x) || mid) {
      pts.push({ x: mx, y: s.y }, { x: mx, y: e.y });
    } else {
      const my = (s.y + e.y) / 2;
      pts.push({ x: s.x, y: my }, { x: e.x, y: my });
    }
  } else if (!h1 && !h2) {
    const my = mid?.y ?? (s.y + e.y) / 2;
    if ((startSide === 'bottom' && end.y > start.y) || (startSide === 'top' && end.y < start.y) || mid) {
      pts.push({ x: s.x, y: my }, { x: e.x, y: my });
    } else {
      const mx = (s.x + e.x) / 2;
      pts.push({ x: mx, y: s.y }, { x: mx, y: e.y });
    }
  } else if (h1) {
    pts.push({ x: e.x, y: s.y });
  } else {
    pts.push({ x: s.x, y: e.y });
  }
  pts.push(e, end);
  return simplifyOrthogonal(pts);
}

function pathFromPolyline(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
}

/** Polyline with rounded corners (Whimsical elbow connectors have soft corners). */
function roundedPath(points: readonly Point[], radius: number): string {
  if (points.length < 3) return pathFromPolyline(points);
  let d = `M${round(points[0]!.x)} ${round(points[0]!.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    const r = Math.min(radius, distance(prev, cur) / 2, distance(cur, next) / 2);
    const a = towards(cur, prev, r);
    const b = towards(cur, next, r);
    d += ` L${round(a.x)} ${round(a.y)} Q${round(cur.x)} ${round(cur.y)} ${round(b.x)} ${round(b.y)}`;
  }
  const last = points[points.length - 1]!;
  return `${d} L${round(last.x)} ${round(last.y)}`;
}

function towards(from: Point, to: Point, len: number): Point {
  const d = distance(from, to);
  if (d === 0) return { ...from };
  return { x: from.x + ((to.x - from.x) / d) * len, y: from.y + ((to.y - from.y) / d) * len };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function angle(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Full geometry of a connector. */
export function connectorGeometry(conn: ConnectorElement, boundsOf: BoundsResolver): ConnectorGeometry {
  const anchorA = anchorOf(conn.start, boundsOf);
  const anchorB = anchorOf(conn.end, boundsOf);
  const start = resolveEnd(conn.start, anchorB, boundsOf);
  const end = resolveEnd(conn.end, start.attached ? anchorA : start.point, boundsOf);
  // Re-resolve the start toward the actual end point when it is auto and the end is attached.
  const startFinal = conn.start.kind === 'attached' && conn.start.side === 'auto' ? resolveEnd(conn.start, end.point, boundsOf) : start;
  const s = startFinal;
  const sSide = s.side ?? inferFreeSide(s.point, end.point);
  const eSide = end.side ?? (s.side ? opposite(inferFreeSide(s.point, end.point)) : inferFreeSide(end.point, s.point));
  const waypoints = conn.waypoints ?? [];

  let points: Point[];
  let d: string;
  switch (conn.route) {
    case 'elbow': {
      points = elbowRoute(s.point, sSide, end.point, eSide, waypoints[0]);
      d = roundedPath(points, 8);
      break;
    }
    case 'curved': {
      const len = Math.max(40, distance(s.point, end.point) * 0.4);
      const n1 = s.attached || s.side ? sideNormal(sSide) : unit(s.point, end.point);
      const n2 = end.attached || end.side ? sideNormal(eSide) : unit(end.point, s.point);
      const c1 = waypoints[0] ?? { x: s.point.x + n1.x * len, y: s.point.y + n1.y * len };
      const c2 = waypoints[1] ?? waypoints[0] ?? { x: end.point.x + n2.x * len, y: end.point.y + n2.y * len };
      points = sampleCubic(s.point, c1, c2, end.point, 32);
      d = `M${round(s.point.x)} ${round(s.point.y)} C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(end.point.x)} ${round(end.point.y)}`;
      break;
    }
    default: {
      points = [s.point, ...waypoints, end.point];
      d = pathFromPolyline(points);
    }
  }
  const p0 = points[0]!;
  const p1 = points[1] ?? end.point;
  const q0 = points[points.length - 1]!;
  const q1 = points[points.length - 2] ?? s.point;
  return { start: s, end, points, d, startAngle: angle(p1, p0), endAngle: angle(q1, q0) };
}

function unit(from: Point, to: Point): Point {
  const d = distance(from, to) || 1;
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
}

/** World bounds of a connector (padded for endpoint markers). */
export function connectorBounds(conn: ConnectorElement, boundsOf: BoundsResolver): Rect {
  const g = connectorGeometry(conn, boundsOf);
  return expandRect(boundsOfPoints(g.points) ?? { x: 0, y: 0, w: 0, h: 0 }, 8);
}

export function hitTestConnector(conn: ConnectorElement, p: Point, tolerance: number, boundsOf: BoundsResolver): boolean {
  const g = connectorGeometry(conn, boundsOf);
  return distanceToPolyline(p, g.points) <= Math.max(tolerance, 6);
}

/** Position of the label (t along the path). */
export function labelPosition(conn: ConnectorElement, boundsOf: BoundsResolver): Point {
  const g = connectorGeometry(conn, boundsOf);
  return pointAlongPolyline(g.points, conn.label?.t ?? 0.5);
}

/**
 * Attachment for a pointer over a target box: near an edge (within `edgeTolerance`) it pins
 * that side and position; otherwise "auto" (Whimsical picks the facing side).
 */
export function attachmentAt(targetId: string, rect: Rect, p: Point, edgeTolerance: number): ConnectorEnd {
  const near = nearestSide(rect, p);
  if (near.distance <= edgeTolerance) {
    const t = Math.abs(near.t - 0.5) < 0.12 ? 0.5 : Math.round(near.t * 100) / 100;
    return { kind: 'attached', elementId: targetId, side: near.side, t };
  }
  return { kind: 'attached', elementId: targetId, side: 'auto' };
}

/** Ids of connectors attached to any of `ids`. */
export function connectorsAttachedTo(doc: BoardDocument, ids: ReadonlySet<string>): string[] {
  return doc.elements
    .filter(
      (e): e is ConnectorElement =>
        e.type === 'connector' &&
        ((e.start.kind === 'attached' && ids.has(e.start.elementId)) || (e.end.kind === 'attached' && ids.has(e.end.elementId))),
    )
    .map((e) => e.id);
}

/** Endpoint marker SVG path in a local frame where the tip is at (0,0) pointing to +x. */
export function endpointMarker(kind: ConnectorElement['startEndpoint'], size: number): { d: string; fill: boolean } | undefined {
  const s = size;
  switch (kind) {
    case 'none':
      return undefined;
    case 'arrow':
      return { d: `M0 0 L${-s * 1.6} ${-s * 0.9} L${-s * 1.2} 0 L${-s * 1.6} ${s * 0.9} Z`, fill: true };
    case 'arrowOpen':
      return { d: `M${-s * 1.6} ${-s} L0 0 L${-s * 1.6} ${s}`, fill: false };
    case 'triangle':
      return { d: `M0 0 L${-s * 1.8} ${-s} L${-s * 1.8} ${s} Z`, fill: true };
    case 'triangleOutline':
      return { d: `M0 0 L${-s * 1.8} ${-s} L${-s * 1.8} ${s} Z`, fill: false };
    case 'circle':
      return { d: circlePath(-s, 0, s), fill: true };
    case 'circleOutline':
      return { d: circlePath(-s, 0, s), fill: false };
    case 'diamond':
      return { d: `M0 0 L${-s * 1.2} ${-s} L${-s * 2.4} 0 L${-s * 1.2} ${s} Z`, fill: true };
    case 'diamondOutline':
      return { d: `M0 0 L${-s * 1.2} ${-s} L${-s * 2.4} 0 L${-s * 1.2} ${s} Z`, fill: false };
    case 'erdOne':
      return { d: `M${-s * 1.2} ${-s} L${-s * 1.2} ${s} M${-s * 2} ${-s} L${-s * 2} ${s}`, fill: false };
    case 'erdMany':
      return { d: `M0 ${-s} L${-s * 1.8} 0 L0 ${s}`, fill: false };
    case 'erdOneOrMany':
      return { d: `M0 ${-s} L${-s * 1.8} 0 L0 ${s} M${-s * 2.4} ${-s} L${-s * 2.4} ${s}`, fill: false };
    case 'erdZeroOrMany':
      return { d: `M0 ${-s} L${-s * 1.8} 0 L0 ${s} ${circlePath(-s * 3.1, 0, s * 0.7)}`, fill: false };
  }
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;
}

/** How far the line must stop short of the tip so it does not poke through a marker. */
export function markerInset(kind: ConnectorElement['startEndpoint'], size: number): number {
  switch (kind) {
    case 'arrow':
      return size * 1.2;
    case 'triangle':
    case 'triangleOutline':
      return size * 1.8;
    case 'circle':
    case 'circleOutline':
      return size * 2;
    case 'diamond':
    case 'diamondOutline':
      return size * 2.4;
    default:
      return 0;
  }
}
