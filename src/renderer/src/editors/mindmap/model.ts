/**
 * Mind-map tree model: index, queries and pure tree operations.
 *
 * A mind map is a set of `mindmapNode` elements living in a board document (core/types.ts).
 * Everything here is pure and works on plain data, so the same functions run on an Immer
 * draft inside `api.update` and on plain documents in unit tests.
 *
 * Conventions
 *   - `treeParentId === null` marks the root. `rootId` of every node points at its root.
 *   - Siblings are ordered by `order` (the normaliser renumbers them 0..n-1).
 *   - First-level branches carry `side` (right/left in horizontal maps, bottom/top in vertical
 *     ones). Deeper nodes derive their side from their first-level ancestor.
 *   - Every non-root node stores its effective branch `color` (no inheritance at render time).
 *   - A node with `w === 0 && h === 0` is hidden inside a collapsed branch (layout output).
 */

import { current, isDraft } from 'immer';
import { MINDMAP_BRANCH_COLORS, DEFAULT_COLORS } from '@renderer/core/palette';
import { emptyRichText } from '@renderer/core/richText';
import type {
  BoardElement,
  ColorRef,
  MindMapNodeElement,
  MindMapLineStyle,
  MindMapOrientation,
  RichText,
  Side,
  TextSize,
} from '@renderer/core/types';

/** Anything holding the element list: a BoardDocument, an Immer draft or a test fixture. */
export interface ElementsHolder {
  elements: BoardElement[];
}

export type NodeLevel = 'root' | 'first' | 'deep';

export const ROOT_TEXT_SIZE: TextSize = 'l';
export const NODE_TEXT_SIZE: TextSize = 'm';
export const DEFAULT_ROOT_COLOR: ColorRef = DEFAULT_COLORS.mindmapRoot;
export const DEFAULT_MAP = { orientation: 'horizontal', lineStyle: 'curved' } as const satisfies {
  orientation: MindMapOrientation;
  lineStyle: MindMapLineStyle;
};

export function isMindNode(el: BoardElement | undefined | null): el is MindMapNodeElement {
  return !!el && el.type === 'mindmapNode';
}

/* ------------------------------------------------------------------------------------------
 * Index
 * ---------------------------------------------------------------------------------------- */

export interface TreeIndex {
  readonly nodes: ReadonlyMap<string, MindMapNodeElement>;
  /** Ordered child ids per parent id (parents without children are absent). */
  readonly children: ReadonlyMap<string, readonly string[]>;
  /** Root node ids in document order. */
  readonly roots: readonly string[];
}

/** Builds the tree index of every mind-map node in `elements`. O(n log n). */
export function buildTreeIndex(elements: readonly BoardElement[]): TreeIndex {
  const nodes = new Map<string, MindMapNodeElement>();
  const position = new Map<string, number>();
  elements.forEach((el, i) => {
    if (isMindNode(el)) {
      nodes.set(el.id, el);
      position.set(el.id, i);
    }
  });
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const node of nodes.values()) {
    if (node.treeParentId === null) {
      roots.push(node.id);
      continue;
    }
    if (!nodes.has(node.treeParentId)) continue;
    const list = children.get(node.treeParentId);
    if (list) list.push(node.id);
    else children.set(node.treeParentId, [node.id]);
  }
  for (const list of children.values()) {
    list.sort((a, b) => nodes.get(a)!.order - nodes.get(b)!.order || position.get(a)! - position.get(b)!);
  }
  roots.sort((a, b) => position.get(a)! - position.get(b)!);
  return { nodes, children, roots };
}

const indexCache = new WeakMap<object, TreeIndex>();

/** Cached index for an immutable element array (documents). Never use with Immer drafts. */
export function getTreeIndex(elements: readonly BoardElement[]): TreeIndex {
  let index = indexCache.get(elements);
  if (!index) {
    index = buildTreeIndex(elements);
    indexCache.set(elements, index);
  }
  return index;
}

/* ------------------------------------------------------------------------------------------
 * Queries
 * ---------------------------------------------------------------------------------------- */

const NO_CHILDREN: readonly string[] = [];

export function childIds(index: TreeIndex, id: string): readonly string[] {
  return index.children.get(id) ?? NO_CHILDREN;
}

export function parentOf(index: TreeIndex, id: string): MindMapNodeElement | undefined {
  const node = index.nodes.get(id);
  return node?.treeParentId ? index.nodes.get(node.treeParentId) : undefined;
}

export function levelOf(node: MindMapNodeElement): NodeLevel {
  if (node.treeParentId === null) return 'root';
  return node.treeParentId === node.rootId ? 'first' : 'deep';
}

/** Root node of the map containing `id` (follows parents, robust against bad `rootId`). */
export function rootOf(index: TreeIndex, id: string): MindMapNodeElement | undefined {
  let cur = index.nodes.get(id);
  const seen = new Set<string>();
  while (cur && cur.treeParentId !== null && !seen.has(cur.id)) {
    seen.add(cur.id);
    const next = index.nodes.get(cur.treeParentId);
    if (!next) return undefined;
    cur = next;
  }
  return cur;
}

export function orientationOf(root: MindMapNodeElement | undefined): MindMapOrientation {
  return root?.map?.orientation ?? DEFAULT_MAP.orientation;
}

export function lineStyleOf(root: MindMapNodeElement | undefined): MindMapLineStyle {
  return root?.map?.lineStyle ?? DEFAULT_MAP.lineStyle;
}

export function validSides(orientation: MindMapOrientation): readonly [Side, Side] {
  return orientation === 'horizontal' ? ['right', 'left'] : ['bottom', 'top'];
}

export function defaultSide(orientation: MindMapOrientation): Side {
  return validSides(orientation)[0];
}

/** Side of the map a node grows on (undefined for the root). */
export function branchSide(index: TreeIndex, id: string): Side | undefined {
  let cur = index.nodes.get(id);
  const seen = new Set<string>();
  while (cur && cur.treeParentId !== null && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.treeParentId === cur.rootId || !index.nodes.has(cur.treeParentId)) {
      const root = rootOf(index, cur.id);
      const orientation = orientationOf(root);
      return cur.side && validSides(orientation).includes(cur.side) ? cur.side : defaultSide(orientation);
    }
    cur = index.nodes.get(cur.treeParentId);
  }
  return undefined;
}

/** Node ids below `id` (depth first, document order of siblings). */
export function descendantsOf(index: TreeIndex, id: string, includeSelf = false): string[] {
  const out: string[] = includeSelf ? [id] : [];
  const stack = [...childIds(index, id)].reverse();
  const seen = new Set<string>([id]);
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    const kids = childIds(index, cur);
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!);
  }
  return out;
}

/** True when `id` is `ancestorId` or lies below it. */
export function isInSubtree(index: TreeIndex, ancestorId: string, id: string): boolean {
  let cur = index.nodes.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    if (cur.id === ancestorId) return true;
    seen.add(cur.id);
    cur = cur.treeParentId ? index.nodes.get(cur.treeParentId) : undefined;
  }
  return false;
}

export function depthOf(index: TreeIndex, id: string): number {
  let depth = 0;
  let cur = index.nodes.get(id);
  const seen = new Set<string>();
  while (cur && cur.treeParentId !== null && !seen.has(cur.id)) {
    seen.add(cur.id);
    depth += 1;
    cur = index.nodes.get(cur.treeParentId);
  }
  return depth;
}

/** True when an ancestor (not the node itself) is collapsed, so the node is not displayed. */
export function isHidden(index: TreeIndex, id: string): boolean {
  let cur = parentOf(index, id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    if (cur.collapsed) return true;
    seen.add(cur.id);
    cur = parentOf(index, cur.id);
  }
  return false;
}

/** Children shown on the canvas (none when the node is collapsed). */
export function visibleChildren(index: TreeIndex, id: string): readonly string[] {
  return index.nodes.get(id)?.collapsed ? NO_CHILDREN : childIds(index, id);
}

/** Children of a first-level-capable parent restricted to one side (all for deeper parents). */
export function siblingsOnSameSide(index: TreeIndex, id: string): readonly string[] {
  const node = index.nodes.get(id);
  if (!node || node.treeParentId === null) return [id];
  const list = childIds(index, node.treeParentId);
  if (node.treeParentId !== node.rootId) return list;
  const side = branchSide(index, id);
  return list.filter((sid) => branchSide(index, sid) === side);
}

/** Number of first-level branches per side of a root. */
export function sideCounts(index: TreeIndex, rootId: string): Record<Side, number> {
  const counts: Record<Side, number> = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const cid of childIds(index, rootId)) {
    const side = branchSide(index, cid);
    if (side) counts[side] += 1;
  }
  return counts;
}

/** Side for a new first-level branch: the side with fewer branches (first side on a tie). */
export function pickRootSide(index: TreeIndex, rootId: string): Side {
  const root = index.nodes.get(rootId);
  const orientation = orientationOf(root);
  const [first, second] = validSides(orientation);
  // Vertical maps grow top-down by default (org-chart style): only horizontal ones balance.
  if (orientation === 'vertical') return first;
  const counts = sideCounts(index, rootId);
  return counts[first] <= counts[second] ? first : second;
}

/** Next unused (least used) branch colour for a new first-level branch of `rootId`. */
export function pickBranchColor(index: TreeIndex, rootId: string): ColorRef {
  const usage = new Map<ColorRef, number>(MINDMAP_BRANCH_COLORS.map((c) => [c, 0]));
  for (const cid of childIds(index, rootId)) {
    const c = index.nodes.get(cid)?.color;
    if (c && usage.has(c)) usage.set(c, usage.get(c)! + 1);
  }
  let best: ColorRef = MINDMAP_BRANCH_COLORS[0]!;
  let bestCount = Infinity;
  for (const color of MINDMAP_BRANCH_COLORS) {
    const n = usage.get(color)!;
    if (n < bestCount) {
      best = color;
      bestCount = n;
    }
  }
  return best;
}

/* ------------------------------------------------------------------------------------------
 * Node factory
 * ---------------------------------------------------------------------------------------- */

export interface NewNodeInit {
  id: string;
  rootId: string;
  treeParentId: string | null;
  order: number;
  x?: number;
  y?: number;
  text?: RichText;
  textSize?: TextSize;
  side?: Side;
  color?: ColorRef;
  map?: MindMapNodeElement['map'];
}

export function createNode(init: NewNodeInit): MindMapNodeElement {
  const node: MindMapNodeElement = {
    id: init.id,
    type: 'mindmapNode',
    x: init.x ?? 0,
    y: init.y ?? 0,
    w: 0,
    h: 0,
    rootId: init.rootId,
    treeParentId: init.treeParentId,
    order: init.order,
    text: init.text ?? emptyRichText(),
    textSize: init.textSize ?? (init.treeParentId === null ? ROOT_TEXT_SIZE : NODE_TEXT_SIZE),
  };
  if (init.side) node.side = init.side;
  if (init.color) node.color = init.color;
  if (init.map) node.map = init.map;
  return node;
}

/** A brand-new map: a root node with the default map settings. */
export function createRootNode(id: string, x: number, y: number, text: RichText, w = 0, h = 0): MindMapNodeElement {
  const root = createNode({
    id,
    rootId: id,
    treeParentId: null,
    order: 0,
    x,
    y,
    text,
    color: DEFAULT_ROOT_COLOR,
    map: { ...DEFAULT_MAP },
  });
  root.w = w;
  root.h = h;
  return root;
}

/* ------------------------------------------------------------------------------------------
 * Operations (mutate `doc.elements`; run them inside api.update(draft => ...))
 * ---------------------------------------------------------------------------------------- */

function node(doc: ElementsHolder, id: string): MindMapNodeElement | undefined {
  const el = doc.elements.find((e) => e.id === id);
  return isMindNode(el) ? el : undefined;
}

function maxOrder(index: TreeIndex, parentId: string): number {
  const kids = childIds(index, parentId);
  return kids.length === 0 ? -1 : index.nodes.get(kids[kids.length - 1]!)!.order;
}

/** Appends a new last child. Expands a collapsed parent. Returns the new node (or undefined). */
export function addChildNode(doc: ElementsHolder, parentId: string, id: string, init: { text?: RichText; side?: Side } = {}): MindMapNodeElement | undefined {
  const index = buildTreeIndex(doc.elements);
  const parent = index.nodes.get(parentId);
  if (!parent) return undefined;
  const root = rootOf(index, parentId);
  if (!root) return undefined;
  if (parent.collapsed) delete parent.collapsed;
  const first = parent.treeParentId === null;
  const created = createNode({
    id,
    rootId: root.id,
    treeParentId: parentId,
    order: maxOrder(index, parentId) + 1,
    x: parent.x,
    y: parent.y,
    text: init.text,
    textSize: first ? NODE_TEXT_SIZE : parent.textSize,
    side: first ? (init.side ?? pickRootSide(index, parentId)) : undefined,
    color: first ? pickBranchColor(index, parentId) : (parent.color ?? pickBranchColor(index, root.id)),
  });
  doc.elements.push(created);
  return created;
}

/** Inserts a sibling right after (default) or before `refId`. A root gets a child instead. */
export function addSiblingNode(
  doc: ElementsHolder,
  refId: string,
  id: string,
  where: 'after' | 'before' = 'after',
  init: { text?: RichText } = {},
): MindMapNodeElement | undefined {
  const index = buildTreeIndex(doc.elements);
  const ref = index.nodes.get(refId);
  if (!ref) return undefined;
  if (ref.treeParentId === null) return addChildNode(doc, refId, id, init);
  const parent = index.nodes.get(ref.treeParentId);
  const root = rootOf(index, refId);
  if (!parent || !root) return undefined;
  const kids = childIds(index, parent.id);
  const at = kids.indexOf(refId);
  const neighbourId = where === 'after' ? kids[at + 1] : kids[at - 1];
  const neighbour = neighbourId ? index.nodes.get(neighbourId) : undefined;
  let order: number;
  if (where === 'after') order = neighbour ? (ref.order + neighbour.order) / 2 : ref.order + 1;
  else order = neighbour ? (ref.order + neighbour.order) / 2 : ref.order - 1;
  const first = parent.treeParentId === null;
  const created = createNode({
    id,
    rootId: root.id,
    treeParentId: parent.id,
    order,
    x: ref.x,
    y: ref.y,
    text: init.text,
    textSize: first ? NODE_TEXT_SIZE : ref.textSize,
    side: first ? branchSide(index, refId) : undefined,
    color: first ? pickBranchColor(index, root.id) : (ref.color ?? parent.color),
  });
  doc.elements.push(created);
  return created;
}

/** Inserts a new node between `id` and its parent; `id` becomes its only child. No-op for roots. */
export function addParentNode(doc: ElementsHolder, id: string, newId: string): MindMapNodeElement | undefined {
  const index = buildTreeIndex(doc.elements);
  const cur = index.nodes.get(id);
  if (!cur || cur.treeParentId === null) return undefined;
  const first = cur.treeParentId === cur.rootId;
  const created = createNode({
    id: newId,
    rootId: cur.rootId,
    treeParentId: cur.treeParentId,
    order: cur.order,
    x: cur.x,
    y: cur.y,
    textSize: cur.textSize,
    side: first ? branchSide(index, id) : undefined,
    color: cur.color,
  });
  cur.treeParentId = newId;
  cur.order = 0;
  delete cur.side;
  delete cur.collapsed;
  doc.elements.push(created);
  return created;
}

/** Ids removed when deleting `ids` (nodes plus all their descendants). */
export function collectDeletion(index: TreeIndex, ids: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    if (!index.nodes.has(id) || out.has(id)) continue;
    for (const d of descendantsOf(index, id, true)) out.add(d);
  }
  return out;
}

/** Where selection should go after deleting `ids`: next sibling, previous sibling, else parent. */
export function selectionAfterDelete(index: TreeIndex, ids: readonly string[]): string | undefined {
  const doomed = collectDeletion(index, ids);
  const first = ids.find((id) => index.nodes.has(id));
  if (!first) return undefined;
  const parent = parentOf(index, first);
  if (!parent) return undefined;
  const kids = siblingsOnSameSide(index, first);
  const at = kids.indexOf(first);
  for (let i = at + 1; i < kids.length; i++) if (!doomed.has(kids[i]!)) return kids[i];
  for (let i = at - 1; i >= 0; i--) if (!doomed.has(kids[i]!)) return kids[i];
  return parent.id;
}

/** Deletes the given nodes with their subtrees and every connector attached to them. */
export function deleteNodes(doc: ElementsHolder, ids: Iterable<string>): Set<string> {
  const index = buildTreeIndex(doc.elements);
  const doomed = collectDeletion(index, ids);
  if (doomed.size === 0) return doomed;
  doc.elements = doc.elements.filter((el) => {
    if (doomed.has(el.id)) return false;
    if (el.type === 'connector') {
      const s = el.start.kind === 'attached' && doomed.has(el.start.elementId);
      const e = el.end.kind === 'attached' && doomed.has(el.end.elementId);
      if (s || e) return false;
    }
    return true;
  });
  return doomed;
}

/**
 * Duplicates the subtree of `id`. A non-root lands right after the original (same parent); a
 * root becomes a new map offset by `rootOffset`. Returns the id of the copy of `id`.
 */
export function duplicateSubtree(
  doc: ElementsHolder,
  id: string,
  createId: () => string,
  rootOffset = { x: 48, y: 48 },
): string | undefined {
  const index = buildTreeIndex(doc.elements);
  const src = index.nodes.get(id);
  if (!src) return undefined;
  const ids = descendantsOf(index, id, true);
  const map = new Map(ids.map((old) => [old, createId()]));
  const newRootId = src.treeParentId === null ? map.get(id)! : src.rootId;
  const kids = src.treeParentId ? childIds(index, src.treeParentId) : NO_CHILDREN;
  const next = src.treeParentId ? index.nodes.get(kids[kids.indexOf(id) + 1] ?? '') : undefined;
  const copies: MindMapNodeElement[] = [];
  for (const old of ids) {
    const el = index.nodes.get(old)!;
    // Immer drafts (api.update) cannot be structured-cloned: snapshot them first.
    const copy = structuredClone(isDraft(el) ? current(el) : el) as MindMapNodeElement;
    copy.id = map.get(old)!;
    copy.rootId = newRootId;
    delete copy.locked;
    delete copy.groupId;
    delete copy.containerId;
    if (old === id) {
      if (src.treeParentId === null) {
        copy.treeParentId = null;
        copy.x = src.x + rootOffset.x;
        copy.y = src.y + rootOffset.y;
      } else {
        copy.order = next ? (src.order + next.order) / 2 : src.order + 1;
      }
    } else {
      copy.treeParentId = map.get(el.treeParentId!)!;
    }
    copies.push(copy);
  }
  doc.elements.push(...copies);
  return map.get(id);
}

/** Moves a node (with its subtree) under `parentId` at `index` among the new siblings. */
export interface MoveTarget {
  parentId: string;
  /** Position among the new parent's children (excluding the moved node). Default: last. */
  index?: number;
  /** First-level target only: side of the map. */
  side?: Side;
}

/** True when moving `id` under `parentId` would create a cycle (or is a no-op onto itself). */
export function wouldCycle(index: TreeIndex, id: string, parentId: string): boolean {
  return isInSubtree(index, id, parentId);
}

export function moveNode(doc: ElementsHolder, id: string, target: MoveTarget): boolean {
  const index = buildTreeIndex(doc.elements);
  const moving = index.nodes.get(id);
  const parent = index.nodes.get(target.parentId);
  if (!moving || !parent || moving.treeParentId === null) return false;
  if (wouldCycle(index, id, target.parentId)) return false;
  const newRoot = rootOf(index, target.parentId);
  if (!newRoot) return false;
  const subtree = descendantsOf(index, id, true);
  const crossesMaps = newRoot.id !== moving.rootId;
  const becomesFirst = target.parentId === newRoot.id;
  const sibs = childIds(index, target.parentId).filter((s) => s !== id);
  const at = Math.max(0, Math.min(target.index ?? sibs.length, sibs.length));
  const orderedIds = [...sibs.slice(0, at), id, ...sibs.slice(at)];

  const oldParentId = moving.treeParentId;
  moving.treeParentId = target.parentId;
  if (parent.collapsed) delete parent.collapsed;
  if (becomesFirst) {
    const side = target.side ?? moving.side ?? pickRootSide(index, newRoot.id);
    moving.side = validSides(orientationOf(newRoot)).includes(side) ? side : defaultSide(orientationOf(newRoot));
  } else {
    delete moving.side;
  }
  if (crossesMaps) for (const sid of subtree) index.nodes.get(sid)!.rootId = newRoot.id;
  // Recolour into the destination branch (deeper than first-level inherits the parent's colour).
  const colour = becomesFirst ? (moving.color ?? pickBranchColor(index, newRoot.id)) : (parent.color ?? moving.color);
  if (colour) for (const sid of subtree) index.nodes.get(sid)!.color = colour;
  orderedIds.forEach((sid, i) => {
    index.nodes.get(sid)!.order = i;
  });
  // Close the gap left in the old parent.
  if (oldParentId !== target.parentId) {
    childIds(index, oldParentId)
      .filter((s) => s !== id)
      .forEach((sid, i) => {
        index.nodes.get(sid)!.order = i;
      });
  }
  return true;
}

/** Moves a node one step among its siblings (same side for first-level branches). */
export function reorderNode(doc: ElementsHolder, id: string, delta: -1 | 1): boolean {
  const index = buildTreeIndex(doc.elements);
  const cur = index.nodes.get(id);
  if (!cur || cur.treeParentId === null) return false;
  const sibs = siblingsOnSameSide(index, id);
  const at = sibs.indexOf(id);
  const other = index.nodes.get(sibs[at + delta] ?? '');
  if (!other) return false;
  const a = cur.order;
  cur.order = other.order;
  other.order = a;
  // Equal orders cannot happen after normalisation, but keep the swap stable regardless.
  if (cur.order === other.order) cur.order += delta * 0.5;
  return true;
}

/** Makes `id` the last child of its previous sibling (tree "indent"). */
export function indentNode(doc: ElementsHolder, id: string): boolean {
  const index = buildTreeIndex(doc.elements);
  const cur = index.nodes.get(id);
  if (!cur || cur.treeParentId === null) return false;
  const sibs = siblingsOnSameSide(index, id);
  const prevId = sibs[sibs.indexOf(id) - 1];
  if (!prevId) return false;
  return moveNode(doc, id, { parentId: prevId });
}

/** Makes `id` the next sibling of its parent (tree "outdent"). Not possible for first-level nodes. */
export function outdentNode(doc: ElementsHolder, id: string): boolean {
  const index = buildTreeIndex(doc.elements);
  const cur = index.nodes.get(id);
  const parent = parentOf(index, id);
  if (!cur || !parent || parent.treeParentId === null) return false;
  const grand = parent.treeParentId;
  const at = childIds(index, grand).filter((s) => s !== id).indexOf(parent.id);
  const grandIsRoot = grand === cur.rootId;
  return moveNode(doc, id, { parentId: grand, index: at + 1, side: grandIsRoot ? branchSide(index, parent.id) : undefined });
}

/* --- collapse ----------------------------------------------------------------------------- */

export function setCollapsed(doc: ElementsHolder, ids: Iterable<string>, collapsed: boolean): void {
  const index = buildTreeIndex(doc.elements);
  for (const id of ids) {
    const el = index.nodes.get(id);
    if (!el) continue;
    if (collapsed) {
      if (childIds(index, id).length > 0) el.collapsed = true;
    } else {
      delete el.collapsed;
    }
  }
}

/** Node ids affected by a modifier-click on the collapse button of `id`. */
export function collapseTargets(index: TreeIndex, id: string, scope: 'self' | 'descendants' | 'siblings' | 'level'): string[] {
  const cur = index.nodes.get(id);
  if (!cur) return [];
  if (scope === 'self') return [id];
  if (scope === 'descendants') return descendantsOf(index, id, true);
  if (scope === 'siblings') return cur.treeParentId ? [...childIds(index, cur.treeParentId)] : [id];
  const depth = depthOf(index, id);
  const root = rootOf(index, id);
  if (!root) return [id];
  return descendantsOf(index, root.id, true).filter((nid) => depthOf(index, nid) === depth);
}

/* --- styling ------------------------------------------------------------------------------ */

/** Sets the colour of a node; branches (non-root) recolour their whole subtree. */
export function setBranchColor(doc: ElementsHolder, id: string, color: ColorRef): void {
  const index = buildTreeIndex(doc.elements);
  const cur = index.nodes.get(id);
  if (!cur) return;
  if (cur.treeParentId === null) {
    cur.color = color;
    return;
  }
  for (const sid of descendantsOf(index, id, true)) index.nodes.get(sid)!.color = color;
}

export function setMapOptions(doc: ElementsHolder, rootId: string, patch: Partial<{ orientation: MindMapOrientation; lineStyle: MindMapLineStyle }>): void {
  const root = node(doc, rootId);
  if (!root || root.treeParentId !== null) return;
  const before = orientationOf(root);
  root.map = { ...DEFAULT_MAP, ...root.map, ...patch };
  if (root.map.orientation !== before) rebalanceSides(doc, rootId, root.map.orientation === 'vertical' ? 'bottom' : 'both');
}

/**
 * Re-assigns the side of every first-level branch. 'both' balances by subtree size, a single
 * side puts everything on it.
 */
export function rebalanceSides(doc: ElementsHolder, rootId: string, mode: 'both' | Side): void {
  const index = buildTreeIndex(doc.elements);
  const root = index.nodes.get(rootId);
  if (!root) return;
  const [first, second] = validSides(orientationOf(root));
  const kids = childIds(index, rootId);
  if (mode !== 'both') {
    const side = mode === first || mode === second ? mode : first;
    for (const cid of kids) index.nodes.get(cid)!.side = side;
    return;
  }
  // Greedy balance by weight (subtree size) keeping document order within each side.
  const load: Record<string, number> = { [first]: 0, [second]: 0 };
  for (const cid of kids) {
    const weight = descendantsOf(index, cid, true).length;
    const side = load[first]! <= load[second]! ? first : second;
    load[side] = load[side]! + weight;
    index.nodes.get(cid)!.side = side;
  }
}

/** Toggles a text mark on every span of a node. */
export function toggleMark(text: RichText, mark: 'bold' | 'italic'): RichText {
  const allMarked = text.blocks.every((b) => b.spans.every((s) => s.marks?.includes(mark)));
  return {
    blocks: text.blocks.map((b) => ({
      ...b,
      spans: b.spans.map((s) => {
        const marks = new Set(s.marks ?? []);
        if (allMarked) marks.delete(mark);
        else marks.add(mark);
        const { marks: _old, ...rest } = s;
        return marks.size > 0 ? { ...rest, marks: [...marks] } : rest;
      }),
    })),
  };
}

/** Sets (or clears with undefined) a link on every span of a node. */
export function setLink(text: RichText, href: string | undefined): RichText {
  return {
    blocks: text.blocks.map((b) => ({
      ...b,
      spans: b.spans.map((s) => {
        const { href: _old, ...rest } = s;
        return href ? { ...rest, href } : rest;
      }),
    })),
  };
}

/** The link shared by all spans of a node, if any. */
export function linkOf(text: RichText): string | undefined {
  for (const b of text.blocks) for (const s of b.spans) if (s.href) return s.href;
  return undefined;
}
