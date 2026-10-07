/**
 * Mind-map actions on a mounted canvas (CanvasApi): shared by the keyboard commands, the node
 * renderer (Enter / Tab while editing, hover buttons) and the context bar.
 * Every action is ONE undo step; editing is entered on the created node when relevant.
 */

import { measureRichText } from '@renderer/canvas';
import { isRichTextEmpty } from '@renderer/core/richText';
import type { CanvasApi, ChangeOptions, MindMapNodeElement, Rect, RichText, Side } from '@renderer/core/types';
import { layoutDocument } from './layout';
import {
  addChildNode,
  addParentNode,
  addSiblingNode,
  buildTreeIndex,
  childIds,
  collapseTargets,
  deleteNodes,
  descendantsOf,
  duplicateSubtree,
  indentNode,
  isHidden,
  isMindNode,
  moveNode,
  outdentNode,
  parentOf,
  reorderNode,
  selectionAfterDelete,
  setCollapsed,
  siblingsOnSameSide,
  type ElementsHolder,
  type TreeIndex,
} from './model';
import { createSizeFn } from './nodeSize';
import { navigate, type NavResult } from './navigation';
import type { Direction } from '@renderer/core/types';

/** Size function shared by the normaliser, the renderer and the actions. */
export const sizeOf = createSizeFn((text, style, maxWidth) => measureRichText(text, style, maxWidth));

/* ------------------------------------------------------------------------------------------
 * Selection helpers
 * ---------------------------------------------------------------------------------------- */

export function mindIndex(api: CanvasApi): TreeIndex {
  return buildTreeIndex(api.getDocument().elements);
}

/** Selected mind-map nodes in selection order. */
export function selectedNodes(api: CanvasApi): MindMapNodeElement[] {
  const out: MindMapNodeElement[] = [];
  for (const id of api.getSelection()) {
    const el = api.getElement(id);
    if (isMindNode(el)) out.push(el);
  }
  return out;
}

/** True when the selection is made of mind-map nodes only (mixed selections use canvas commands). */
export function onlyMindSelection(api: CanvasApi): boolean {
  const ids = api.getSelection();
  return ids.length > 0 && ids.every((id) => isMindNode(api.getElement(id)));
}

/** The node keyboard commands act on: the last selected one. */
export function primaryNode(api: CanvasApi): MindMapNodeElement | undefined {
  const nodes = selectedNodes(api);
  return nodes[nodes.length - 1];
}

/** Selected nodes without those whose ancestor is selected too (subtree operations). */
export function topmostSelected(api: CanvasApi): MindMapNodeElement[] {
  const index = mindIndex(api);
  const nodes = selectedNodes(api);
  const ids = new Set(nodes.map((n) => n.id));
  return nodes.filter((n) => {
    let p = parentOf(index, n.id);
    while (p) {
      if (ids.has(p.id)) return false;
      p = parentOf(index, p.id);
    }
    return true;
  });
}

/* ------------------------------------------------------------------------------------------
 * Viewport
 * ---------------------------------------------------------------------------------------- */

/** Pans just enough to keep a node visible (engine exposes the visible rect at runtime). */
export function revealNode(api: CanvasApi, id: string): void {
  const el = api.getElement(id);
  const view = (api as unknown as { visibleWorldRect?: () => Rect }).visibleWorldRect?.();
  if (!el || !view || !isMindNode(el) || (el.w === 0 && el.h === 0)) return;
  const zoom = api.getViewport().zoom;
  const margin = 56 / zoom;
  let dx = 0;
  let dy = 0;
  if (el.x < view.x + margin) dx = el.x - margin - view.x;
  else if (el.x + el.w > view.x + view.w - margin) dx = el.x + el.w + margin - (view.x + view.w);
  if (el.y < view.y + margin) dy = el.y - margin - view.y;
  else if (el.y + el.h > view.y + view.h - margin) dy = el.y + el.h + margin - (view.y + view.h);
  if (dx || dy) {
    const v = api.getViewport();
    api.setViewport({ ...v, x: v.x + dx, y: v.y + dy }, { animate: true });
  }
}

export function selectNode(api: CanvasApi, id: string): void {
  api.setSelection([id]);
  revealNode(api, id);
}

/* ------------------------------------------------------------------------------------------
 * Creation
 * ---------------------------------------------------------------------------------------- */

function finishCreate(api: CanvasApi, id: string | undefined, edit: boolean): string | undefined {
  if (!id) return undefined;
  api.setSelection([id]);
  if (edit) api.startTextEditing(id);
  revealNode(api, id);
  return id;
}

/** Tab: new last child (a collapsed parent expands). First-level children of a root take `side`. */
export function addChild(api: CanvasApi, parentId: string, options: { side?: Side; edit?: boolean } = {}): string | undefined {
  const id = api.createId();
  let created = false;
  api.update((d) => {
    created = !!addChildNode(d, parentId, id, { side: options.side });
  });
  return created ? finishCreate(api, id, options.edit !== false) : undefined;
}

/** Enter (while editing) / Cmd+Enter: new sibling after or before. A root gets a child instead. */
export function addSibling(api: CanvasApi, refId: string, where: 'after' | 'before', options: { edit?: boolean } = {}): string | undefined {
  const id = api.createId();
  let created = false;
  api.update((d) => {
    created = !!addSiblingNode(d, refId, id, where);
  });
  return created ? finishCreate(api, id, options.edit !== false) : undefined;
}

/** Alt+Enter: new node between `id` and its parent. */
export function addParent(api: CanvasApi, id: string, options: { edit?: boolean } = {}): string | undefined {
  const newId = api.createId();
  let created = false;
  api.update((d) => {
    created = !!addParentNode(d, id, newId);
  });
  return created ? finishCreate(api, newId, options.edit !== false) : undefined;
}

/* ------------------------------------------------------------------------------------------
 * Editing
 * ---------------------------------------------------------------------------------------- */

export function nodeText(api: CanvasApi, id: string): RichText | undefined {
  const el = api.getElement(id);
  return isMindNode(el) ? el.text : undefined;
}

export function isEmptyNode(api: CanvasApi, id: string): boolean {
  const el = api.getElement(id);
  return isMindNode(el) && isRichTextEmpty(el.text) && !el.icon;
}

/**
 * Called when text editing of `id` ended. A freshly created node left empty is removed
 * (Whimsical: empty nodes do not stay on the map) and the selection moves to its neighbour.
 */
export function discardIfEmpty(api: CanvasApi, id: string): boolean {
  const el = api.getElement(id);
  if (!isMindNode(el) || el.treeParentId === null || !isEmptyNode(api, id)) return false;
  const index = mindIndex(api);
  if (childIds(index, id).length > 0) return false;
  // An empty parent that only existed to hold this node goes too (Tab, Tab, Esc on blank nodes).
  let doomed = id;
  for (;;) {
    const parent = parentOf(index, doomed);
    if (!parent || parent.treeParentId === null || !isEmptyNode(api, parent.id) || api.getEditingId() === parent.id) break;
    if (childIds(index, parent.id).length !== 1) break;
    doomed = parent.id;
  }
  const sibs = siblingsOnSameSide(index, doomed);
  const next = sibs[sibs.indexOf(doomed) - 1] ?? parentOf(index, doomed)?.id;
  api.update((d) => {
    deleteNodes(d, [doomed]);
  });
  const sel = api.getSelection();
  if (sel.length === 0 || sel.includes(id) || sel.includes(doomed)) api.setSelection(next ? [next] : []);
  return true;
}

/** Stops editing and selects the parent (Shift+Tab). */
export function selectParentOf(api: CanvasApi, id: string): void {
  const parent = parentOf(mindIndex(api), id);
  api.stopTextEditing();
  if (parent) selectNode(api, parent.id);
}

/**
 * CanvasApi wrapper for the text editor of one node: a stale editor (the one being replaced
 * when Enter / Tab starts editing another node) must not stop the new node's editing when it
 * blurs while unmounting.
 */
export function guardedApi(api: CanvasApi, id: string): CanvasApi {
  const wrapper = Object.create(api) as CanvasApi;
  Object.defineProperty(wrapper, 'stopTextEditing', {
    value: () => {
      if (api.getEditingId() === id) api.stopTextEditing();
    },
  });
  return wrapper;
}

/* ------------------------------------------------------------------------------------------
 * Structure
 * ---------------------------------------------------------------------------------------- */

export function deleteSelectedNodes(api: CanvasApi): void {
  const ids = selectedNodes(api).map((n) => n.id);
  if (ids.length === 0) return;
  const index = mindIndex(api);
  const next = selectionAfterDelete(index, ids);
  api.update((d) => {
    deleteNodes(d, ids);
  });
  api.setSelection(next && api.getElement(next) ? [next] : []);
  if (next) revealNode(api, next);
}

export function duplicateSelectedNodes(api: CanvasApi): void {
  const tops = topmostSelected(api);
  if (tops.length === 0) return;
  const copies: string[] = [];
  api.update((d) => {
    for (const n of tops) {
      const id = duplicateSubtree(d, n.id, () => api.createId());
      if (id) copies.push(id);
    }
  });
  if (copies.length > 0) {
    api.setSelection(copies);
    revealNode(api, copies[copies.length - 1]!);
  }
}

/** Runs a structural edit on every topmost selected node; selection is kept. */
export function restructure(api: CanvasApi, op: (doc: ElementsHolder, id: string) => boolean): boolean {
  const ids = topmostSelected(api).map((n) => n.id);
  let any = false;
  api.update((d) => {
    for (const id of ids) any = op(d, id) || any;
  });
  const last = ids[ids.length - 1];
  if (last) revealNode(api, last);
  return any;
}

export const moveUp = (api: CanvasApi) => restructure(api, (d, id) => reorderNode(d, id, -1));
export const moveDown = (api: CanvasApi) => restructure(api, (d, id) => reorderNode(d, id, 1));
export const indent = (api: CanvasApi) => restructure(api, (d, id) => indentNode(d, id));
export const outdent = (api: CanvasApi) => restructure(api, (d, id) => outdentNode(d, id));

/** Moves a node under another parent (used by tests and the context menu). */
export function reparent(api: CanvasApi, id: string, parentId: string, index?: number, side?: Side): boolean {
  let ok = false;
  api.update((d) => {
    ok = moveNode(d, id, { parentId, index, side });
  });
  return ok;
}

/* ------------------------------------------------------------------------------------------
 * Collapse
 * ---------------------------------------------------------------------------------------- */

export type CollapseScope = 'self' | 'descendants' | 'siblings' | 'level';

/** Collapses or expands the given scope around `id`; keeps the selection visible. */
export function setCollapsedScope(api: CanvasApi, id: string, scope: CollapseScope, collapsed: boolean): void {
  const targets = collapseTargets(mindIndex(api), id, scope);
  if (targets.length === 0) return;
  api.update((d) => {
    setCollapsed(d, targets, collapsed);
  });
  settleSelection(api);
}

export function toggleCollapsedSelection(api: CanvasApi, force?: boolean): void {
  const index = mindIndex(api);
  const nodes = selectedNodes(api).filter((n) => childIds(index, n.id).length > 0);
  if (nodes.length === 0) return;
  const collapse = force ?? !nodes.every((n) => n.collapsed);
  api.update((d) => {
    setCollapsed(d, nodes.map((n) => n.id), collapse);
  });
  settleSelection(api);
}

/** Selected nodes hidden by a collapse are replaced by their collapsed ancestor. */
export function settleSelection(api: CanvasApi): void {
  const index = mindIndex(api);
  const sel = api.getSelection();
  const next: string[] = [];
  for (const id of sel) {
    let cur = id;
    if (index.nodes.has(cur) && isHidden(index, cur)) {
      let p = parentOf(index, cur);
      while (p && isHidden(index, p.id)) p = parentOf(index, p.id);
      cur = p?.id ?? cur;
    }
    if (!next.includes(cur)) next.push(cur);
  }
  if (next.length !== sel.length || next.some((id, i) => id !== sel[i])) api.setSelection(next);
}

/** Collapsed descendant count shown on the collapse button. */
export function hiddenCount(index: TreeIndex, id: string): number {
  return descendantsOf(index, id).length;
}

/* ------------------------------------------------------------------------------------------
 * Navigation
 * ---------------------------------------------------------------------------------------- */

export function navigateFrom(api: CanvasApi, direction: Direction): NavResult | undefined {
  const from = primaryNode(api);
  if (!from) return undefined;
  const doc = api.getDocument();
  const index = buildTreeIndex(doc.elements);
  const result = navigate(index, from.id, direction, (id) => {
    const n = index.nodes.get(id);
    return n ? { x: n.x, y: n.y, w: n.w, h: n.h } : undefined;
  });
  if (!result) return undefined;
  if (result.expand) {
    api.update((d) => {
      setCollapsed(d, [result.expand!], false);
    });
  }
  selectNode(api, result.select);
  return result;
}

/* ------------------------------------------------------------------------------------------
 * Layout
 * ---------------------------------------------------------------------------------------- */

/** Re-runs the layout now (Shift+F12). A no-op when every node already rests where it should. */
export function relayoutNow(api: CanvasApi, options?: ChangeOptions): void {
  const doc = api.getDocument();
  const placements = layoutDocument(doc, sizeOf);
  const stale = doc.elements.some((el) => {
    if (!isMindNode(el)) return false;
    const p = placements.get(el.id);
    return !!p && (p.x !== el.x || p.y !== el.y || p.w !== el.w || p.h !== el.h);
  });
  if (!stale) return;
  api.update((d) => {
    for (const el of d.elements) {
      if (el.type !== 'mindmapNode') continue;
      const p = placements.get(el.id);
      if (!p) continue;
      el.x = p.x;
      el.y = p.y;
      el.w = p.w;
      el.h = p.h;
    }
  }, options);
}
