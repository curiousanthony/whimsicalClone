/**
 * Runtime handlers of the mind-map shortcut table (shortcuts.ts), bound by the canvas while
 * the tab is active. Every command acts on mind-map nodes only: with a mixed selection
 * (a node plus a sticky...) `isEnabled` is false and the key falls through to the canvas
 * command of the same key (Delete, Cmd+D, arrows, Enter, Tab).
 *
 * `mindmap.addRoot` (M) is a tool, bound by the canvas from the tool table.
 */

import { emptyRichText } from '@renderer/core/richText';
import { translateKey } from '@renderer/i18n';
import type { CanvasApi, Direction, Point, ShortcutHandler } from '@renderer/core/types';
import {
  addChild,
  addParent,
  addSibling,
  deleteSelectedNodes,
  duplicateSelectedNodes,
  indent,
  mindIndex,
  moveDown,
  moveUp,
  navigateFrom,
  onlyMindSelection,
  outdent,
  primaryNode,
  relayoutNow,
  revealNode,
  selectNode,
  sizeOf,
  toggleCollapsedSelection,
  topmostSelected,
} from './actions';
import { insertList, parseList, subtreeToList, type ListItem } from './listFormat';
import { createRootNode } from './model';
import { ICON_PANEL_ID, LINK_PANEL_ID, panelAnchor } from './panels';

const DIRECTIONS: ReadonlyArray<[string, Direction]> = [
  ['mindmap.navigateUp', 'up'],
  ['mindmap.navigateDown', 'down'],
  ['mindmap.navigateLeft', 'left'],
  ['mindmap.navigateRight', 'right'],
];

/** Creates a mind map (a root node) centred on `at`; returns the root id. */
export function createMapAt(api: CanvasApi, at: Point, items: readonly ListItem[] = [], rootText = emptyRichText()): string {
  const id = api.createId();
  const probe = createRootNode(id, 0, 0, rootText);
  const size = sizeOf(probe, 'root');
  const root = createRootNode(id, Math.round(at.x - size.w / 2), Math.round(at.y - size.h / 2), rootText, size.w, size.h);
  api.update((d) => {
    d.elements.push(root);
    if (items.length > 0) insertList(d, id, items, () => api.createId());
  });
  return id;
}

function viewCentre(api: CanvasApi): Point {
  const view = (api as unknown as { visibleWorldRect?: () => { x: number; y: number; w: number; h: number } }).visibleWorldRect?.();
  if (view) return { x: view.x + view.w / 2, y: view.y + view.h / 2 };
  return api.screenToWorld({ x: 400, y: 300 });
}

async function readClipboardText(): Promise<string> {
  try {
    return (await navigator.clipboard.readText()) ?? '';
  } catch {
    return '';
  }
}

/** Paste as mind map: onto the selected node (children) or as a new map at the view centre. */
export async function pasteAsMindmap(api: CanvasApi): Promise<void> {
  const items = parseList(await readClipboardText());
  if (items.length === 0) {
    api.services.notify('mindmap:notify.nothingToPaste', { kind: 'info' });
    return;
  }
  const target = onlyMindSelection(api) ? primaryNode(api) : undefined;
  if (target) {
    let created: string[] = [];
    api.update((d) => {
      created = insertList(d, target.id, items, () => api.createId());
    });
    if (created[0]) selectNode(api, created[0]);
    return;
  }
  const single = items.length === 1;
  const rootText = single ? { blocks: [{ type: 'p' as const, spans: items[0]!.text ? [{ text: items[0]!.text }] : [] }] } : { blocks: [{ type: 'p' as const, spans: [{ text: translateKey('mindmap:defaults.root') }] }] };
  const id = createMapAt(api, viewCentre(api), single ? items[0]!.children : items, rootText);
  selectNode(api, id);
}

export async function copyAsList(api: CanvasApi): Promise<void> {
  const index = mindIndex(api);
  const tops = topmostSelected(api);
  if (tops.length === 0) return;
  const text = tops.map((n) => subtreeToList(index.nodes, index.children, n.id)).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    api.services.notify('mindmap:notify.listCopied');
  } catch {
    api.services.notify('mindmap:notify.copyFailed', { kind: 'error' });
  }
}

export function createMindmapCommands(api: CanvasApi): ShortcutHandler[] {
  const mind = () => onlyMindSelection(api);
  const row = (id: string, run: () => void, isEnabled: () => boolean = mind): ShortcutHandler => ({ id, run, isEnabled });

  const withPrimary = (fn: (id: string) => void) => () => {
    const node = primaryNode(api);
    if (node) fn(node.id);
  };

  return [
    row('mindmap.addChild', withPrimary((id) => void addChild(api, id))),
    row('mindmap.editNode', withPrimary((id) => api.startTextEditing(id))),
    row('mindmap.addSiblingAbove', withPrimary((id) => void addSibling(api, id, 'before'))),
    row('mindmap.addParent', withPrimary((id) => void addParent(api, id))),
    row('mindmap.selectParent', () => {
      const node = primaryNode(api);
      const parent = node ? mindIndex(api).nodes.get(node.treeParentId ?? '') : undefined;
      if (parent) selectNode(api, parent.id);
    }),
    ...DIRECTIONS.map(([id, dir]) => row(id, () => void navigateFrom(api, dir))),
    row('mindmap.toggleCollapse', () => toggleCollapsedSelection(api)),
    row('mindmap.collapse', () => toggleCollapsedSelection(api, true)),
    row('mindmap.expand', () => toggleCollapsedSelection(api, false)),
    row('mindmap.deleteNode', () => deleteSelectedNodes(api)),
    row('mindmap.duplicateNode', () => duplicateSelectedNodes(api)),
    row('mindmap.addIcon', () => api.openPanel(ICON_PANEL_ID, { anchor: panelAnchor(api) })),
    row('mindmap.addLink', () => api.openPanel(LINK_PANEL_ID, { anchor: panelAnchor(api) })),
    row('mindmap.indent', () => void indent(api)),
    row('mindmap.outdent', () => void outdent(api)),
    row('mindmap.moveUp', () => void moveUp(api)),
    row('mindmap.moveDown', () => void moveDown(api)),
    row('mindmap.relayout', () => {
      relayoutNow(api);
      const node = primaryNode(api);
      if (node) revealNode(api, node.id);
    }),
    row('mindmap.copyAsList', () => void copyAsList(api)),
    row('mindmap.pasteAsMindmap', () => void pasteAsMindmap(api), () => api.getMode() === 'diagram'),
  ];
}
