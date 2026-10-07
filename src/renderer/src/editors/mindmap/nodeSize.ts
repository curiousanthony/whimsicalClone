/**
 * Node metrics and sizing: how big a mind-map node is for its text, icon and level.
 * The stored w/h of every node is this value (layout output, written by the normaliser) and
 * the Render component pads the text with the same numbers, so the editor never reflows.
 */

import { TEXT_SIZE_PX } from '@renderer/core/palette';
import { isRichTextEmpty } from '@renderer/core/richText';
import type { MindMapNodeElement, RichText, Size, TextStyle } from '@renderer/core/types';
import type { NodeLevel } from './model';
import type { SizeFn } from './layout';

export interface NodeMetrics {
  padX: number;
  padY: number;
  minW: number;
  minH: number;
  /** Text wraps beyond this width. */
  maxTextW: number;
  radius: number;
  bold: boolean;
}

export const NODE_METRICS: Record<NodeLevel, NodeMetrics> = {
  root: { padX: 22, padY: 10, minW: 112, minH: 48, maxTextW: 320, radius: 12, bold: true },
  first: { padX: 16, padY: 7, minW: 56, minH: 36, maxTextW: 280, radius: 10, bold: false },
  deep: { padX: 12, padY: 6, minW: 44, minH: 36, maxTextW: 280, radius: 8, bold: false },
};

export const ICON_SIZE = 18;
export const ICON_GAP = 6;
/** Extra width so sub-pixel differences between canvas and DOM measurement never wrap a line. */
const WIDTH_SLACK = 4;
const LINE_HEIGHT = 1.4;

export type MeasureFn = (text: RichText, style: TextStyle, maxWidth?: number) => Size;

/** Size of a node for the given text measurement function. */
export function nodeSize(node: MindMapNodeElement, level: NodeLevel, measure: MeasureFn): Size {
  const m = NODE_METRICS[level];
  const iconW = node.icon ? ICON_SIZE + ICON_GAP : 0;
  const fontSize = TEXT_SIZE_PX[node.textSize];
  let textW = 0;
  let textH = fontSize * LINE_HEIGHT;
  if (!isRichTextEmpty(node.text)) {
    const s = measure(node.text, { textSize: node.textSize, bold: m.bold }, m.maxTextW);
    textW = Math.min(m.maxTextW, s.w + WIDTH_SLACK);
    textH = Math.max(textH, s.h);
  }
  const w = Math.max(m.minW, Math.ceil(textW + m.padX * 2 + iconW));
  const h = Math.max(m.minH, Math.ceil(textH + m.padY * 2), node.icon ? ICON_SIZE + m.padY * 2 : 0);
  return { w, h };
}

/** SizeFn with a per-text cache (Immer keeps unchanged text objects identical across commits). */
export function createSizeFn(measure: MeasureFn): SizeFn {
  const cache = new WeakMap<RichText, Map<string, Size>>();
  return (node, level) => {
    const key = `${level}|${node.textSize}|${node.icon ? 1 : 0}`;
    let perText = cache.get(node.text);
    if (!perText) {
      perText = new Map();
      cache.set(node.text, perText);
    }
    const hit = perText.get(key);
    if (hit) return hit;
    const size = nodeSize(node, level, measure);
    perText.set(key, size);
    return size;
  };
}
