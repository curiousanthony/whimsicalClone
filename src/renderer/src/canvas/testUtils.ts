/** Test fixtures for canvas unit tests (not exported from index.ts). */

import { createEmptyBoard } from '@renderer/core/boardFormat';
import type { BoardDocument, BoardElement, ConnectorElement, ShapeElement, StickyElement } from '@renderer/core/types';

export function shape(id: string, x: number, y: number, w = 100, h = 50, extra: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id,
    type: 'shape',
    kind: 'rectangle',
    x,
    y,
    w,
    h,
    color: 'purple',
    fillStyle: 'fill',
    text: { blocks: [{ type: 'p', spans: [] }] },
    textSize: 'm',
    textAlign: 'center',
    verticalAlign: 'middle',
    autoHeight: true,
    ...extra,
  };
}

export function sticky(id: string, x: number, y: number, extra: Partial<StickyElement> = {}): StickyElement {
  return {
    id,
    type: 'sticky',
    x,
    y,
    w: 168,
    h: 168,
    color: 'yellow',
    text: { blocks: [{ type: 'p', spans: [] }] },
    textSize: 'm',
    textAlign: 'left',
    autoSize: true,
    ...extra,
  };
}

export function connector(id: string, from: string, to: string, extra: Partial<ConnectorElement> = {}): ConnectorElement {
  return {
    id,
    type: 'connector',
    start: { kind: 'attached', elementId: from, side: 'auto' },
    end: { kind: 'attached', elementId: to, side: 'auto' },
    route: 'straight',
    color: 'slate',
    dashed: false,
    startEndpoint: 'none',
    endEndpoint: 'arrow',
    ...extra,
  };
}

export function board(elements: BoardElement[]): BoardDocument {
  return createEmptyBoard('board', elements);
}

/** Lookup without plugin definitions: box elements use their own x/y/w/h. */
export const noDefinitions = () => undefined;
