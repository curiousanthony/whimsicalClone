/**
 * ElementDefinitions of the wireframe module: `wire` (all 29 components), `frame` (device
 * artboards, container) and `annotation`.
 */

import type { Draft } from 'immer';
import { emptyRichText, richTextFromPlain } from '@renderer/core/richText';
import type { AnnotationElement, ElementDefinition, FrameElement, Rect, WireElement } from '@renderer/core/types';
import { AnnotationRender } from './AnnotationView';
import { AnnotationContextBar, FrameContextBar, WireContextBar } from './contextBars';
import { TEXTUAL } from './drawModel';
import { WireRender } from './draw';
import { FrameRender } from './FrameView';
import { defaultFrameSize } from './frames';
import { frameNameFromText, frameText, constrainResize } from './model';
import { entryOf, normalizeWire } from './registry';

/** Style properties remembered per component ("last used", "save as default style"). */
export const WIRE_STYLE_PROPS = ['color', 'textSize'] as const;

export function applyWireResize(draft: Draft<WireElement>, next: Rect, previous: Rect): void {
  const r = constrainResize(draft as WireElement, next, previous);
  draft.x = r.x;
  draft.y = r.y;
  draft.w = r.w;
  draft.h = r.h;
  // A manual width switches auto-width off (Whimsical: auto-sized buttons until resized).
  if (entryOf(draft.component).autoWidth && Math.abs(r.w - previous.w) > 0.5) draft.props['autoWidth'] = false;
}

export const wireDefinition: ElementDefinition<WireElement> = {
  type: 'wire',
  module: 'wireframe',
  layer: 'box',
  Render: WireRender,
  getBounds: (el) => ({ x: el.x, y: el.y, w: el.w, h: el.h }),
  hitTest(el, world, tolerance) {
    // Lines are thin: widen their hit area.
    const pad = el.component === 'line' || el.component === 'divider' ? Math.max(tolerance, 6) : tolerance;
    return (
      world.x >= el.x - pad && world.x <= el.x + el.w + pad && world.y >= el.y - pad && world.y <= el.y + el.h + pad
    );
  },
  resize: 'free',
  rotatable: false,
  connectable: true,
  textEditable: true,
  styleProps: WIRE_STYLE_PROPS,
  getText: (el) => (TEXTUAL.has(el.component) ? el.text : undefined),
  setText(draft, text) {
    draft.text = text;
  },
  applyResize: applyWireResize,
  ContextBar: WireContextBar,
  normalize(el) {
    const n = normalizeWire(el);
    return n.text && n.textSize ? n : { ...n, text: n.text ?? emptyRichText(), textSize: n.textSize ?? 'm' };
  },
};

export const frameDefinition: ElementDefinition<FrameElement> = {
  type: 'frame',
  module: 'wireframe',
  layer: 'box',
  Render: FrameRender,
  getBounds: (el) => ({ x: el.x, y: el.y, w: el.w, h: el.h }),
  resize: 'free',
  rotatable: false,
  connectable: true,
  textEditable: true,
  container: true,
  styleProps: ['statusBar', 'keyboard'],
  getText: (el) => frameText(el),
  setText(draft, text) {
    const name = frameNameFromText(text);
    if (name) draft.name = name;
  },
  ContextBar: FrameContextBar,
  normalize(el) {
    const size = defaultFrameSize(el.device ?? 'plain');
    return {
      ...el,
      device: el.device ?? 'plain',
      name: el.name ?? '',
      statusBar: el.statusBar ?? false,
      keyboard: el.keyboard ?? false,
      orientation: el.orientation ?? 'portrait',
      w: el.w || size.w,
      h: el.h || size.h,
    };
  },
};

export const annotationDefinition: ElementDefinition<AnnotationElement> = {
  type: 'annotation',
  module: 'wireframe',
  layer: 'box',
  Render: AnnotationRender,
  getBounds: (el) => ({ x: el.x, y: el.y, w: el.w, h: el.h }),
  resize: 'free',
  rotatable: false,
  connectable: true,
  textEditable: true,
  styleProps: ['color', 'outline', 'autoNumber'],
  getText: (el) => el.text,
  setText(draft, text) {
    draft.text = text;
  },
  ContextBar: AnnotationContextBar,
  normalize(el) {
    return {
      ...el,
      color: el.color ?? 'purple',
      text: el.text ?? richTextFromPlain(''),
      autoNumber: el.autoNumber ?? true,
      outline: el.outline ?? false,
    };
  },
};
