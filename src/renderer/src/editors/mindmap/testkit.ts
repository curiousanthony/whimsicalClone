/** Test fixtures for the mind-map module (not part of the runtime). */

import { createEmptyBoard } from '@renderer/core/boardFormat';
import { richTextFromPlain } from '@renderer/core/richText';
import type { BoardDocument, BoardElement, MindMapNodeElement, Side, Size } from '@renderer/core/types';
import { relayoutDocument, type SizeFn } from './layout';
import { createNode, createRootNode, type NodeLevel } from './model';

export interface Spec {
  id: string;
  text?: string;
  side?: Side;
  collapsed?: boolean;
  children?: Spec[];
}

/** Fixed node sizes: root 100x40, others 80x30. */
export const fixedSize: SizeFn = (_node: MindMapNodeElement, level: NodeLevel): Size => (level === 'root' ? { w: 100, h: 40 } : { w: 80, h: 30 });

export interface MapOptions {
  orientation?: 'horizontal' | 'vertical';
  lineStyle?: 'curved' | 'elbow';
  x?: number;
  y?: number;
}

/** Builds a mind map document from a nested spec. First-level sides default to alternating right / left. */
export function mapOf(root: Spec, options: MapOptions = {}): BoardDocument {
  const elements: BoardElement[] = [];
  const vertical = options.orientation === 'vertical';
  const node = createRootNode(root.id, options.x ?? 0, options.y ?? 0, richTextFromPlain(root.text ?? root.id));
  node.map = { orientation: options.orientation ?? 'horizontal', lineStyle: options.lineStyle ?? 'curved' };
  if (root.collapsed) node.collapsed = true;
  elements.push(node);
  const walk = (spec: Spec, parentId: string, order: number, firstLevel: boolean): void => {
    const n = createNode({
      id: spec.id,
      rootId: root.id,
      treeParentId: parentId,
      order,
      text: richTextFromPlain(spec.text ?? spec.id),
      side: firstLevel ? (spec.side ?? (vertical ? 'bottom' : order % 2 === 0 ? 'right' : 'left')) : undefined,
      color: 'blue',
    });
    if (spec.collapsed) n.collapsed = true;
    elements.push(n);
    (spec.children ?? []).forEach((c, i) => walk(c, spec.id, i, false));
  };
  (root.children ?? []).forEach((c, i) => walk(c, root.id, i, true));
  return createEmptyBoard('mindmap', elements);
}

export function laidOut(root: Spec, options: MapOptions = {}): BoardDocument {
  return relayoutDocument(mapOf(root, options), fixedSize);
}

export function nodeOf(doc: BoardDocument, id: string): MindMapNodeElement {
  const el = doc.elements.find((e) => e.id === id);
  if (!el || el.type !== 'mindmapNode') throw new Error(`no node ${id}`);
  return el;
}

export function centreOf(n: MindMapNodeElement): { x: number; y: number } {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}
