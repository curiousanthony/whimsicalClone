/**
 * Minimal canvas plugin used by canvas tests and the dev harness: a "shape" box element with
 * text and a rectangle tool. Not exported from index.ts (the flowchart module owns shapes).
 */

import { resolveColor } from '@renderer/core/palette';
import { emptyRichText } from '@renderer/core/richText';
import type { CanvasPlugin, ElementDefinition, ShapeElement } from '@renderer/core/types';
import { CanvasText } from './text/CanvasText';

export const testShapeDefinition: ElementDefinition<ShapeElement> = {
  type: 'shape',
  module: 'flowchart',
  layer: 'box',
  Render: ({ element, editing, api, theme }) => (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        borderRadius: 6,
        background: resolveColor(element.color, element.fillStyle === 'fill' ? 'fill' : 'soft', theme),
        border: `2px solid ${resolveColor(element.color, 'stroke', theme)}`,
      }}
    >
      <CanvasText
        element={element}
        text={element.text}
        editing={editing}
        api={api}
        textSize={element.textSize}
        align="center"
        verticalAlign="middle"
        padding={8}
        color={resolveColor(element.color, element.fillStyle === 'fill' ? 'onFill' : 'text', theme)}
      />
    </div>
  ),
  getBounds: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
  resize: 'free',
  rotatable: true,
  connectable: true,
  textEditable: true,
  quickAdd: { connect: true },
  styleProps: ['color', 'fillStyle'],
  getText: (e) => e.text,
  setText: (d, text) => {
    d.text = text;
  },
};

export const testPlugin: CanvasPlugin = {
  id: 'flowchart',
  elements: [testShapeDefinition],
  tools: [
    {
      id: 'test.rectangle',
      module: 'flowchart',
      labelKey: 'canvas:toolbar.select',
      icon: 'Square',
      shortcutId: 'test.rectangle',
      group: 'shapes',
      modes: ['diagram'],
      editAfterCreate: true,
      create(api, at, rect) {
        const id = api.createId();
        const r = rect ?? { x: at.x - 84, y: at.y - 36, w: 168, h: 72 };
        const shape: ShapeElement = {
          id,
          type: 'shape',
          kind: 'rectangle',
          ...r,
          color: 'purple',
          fillStyle: 'fill',
          text: emptyRichText(),
          textSize: 'm',
          textAlign: 'center',
          verticalAlign: 'middle',
          autoHeight: true,
        };
        api.update((d) => {
          d.elements.push(shape);
        });
        return [id];
      },
    },
  ],
  shortcuts: [],
};
