import { produce } from 'immer';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyBoard } from '@renderer/core/boardFormat';
import type { BoardDocument, CanvasApi, ConnectorElement, ShapeElement } from '@renderer/core/types';
import { createFlowchartCommands, runLayout } from './commands';
import { createShape } from './shapes';
import { createShapeAt } from './tools';

const box = (id: string, x: number, y: number): ShapeElement => createShape({ id, kind: 'rectangle', at: { x: 0, y: 0 }, rect: { x, y, w: 168, h: 72 } });
const link = (id: string, from: string, to: string): ConnectorElement => ({
  id,
  type: 'connector',
  start: { kind: 'attached', elementId: from, side: 'right', t: 0.3 },
  end: { kind: 'attached', elementId: to, side: 'left' },
  route: 'elbow',
  color: 'slate',
  dashed: false,
  startEndpoint: 'none',
  endEndpoint: 'arrow',
  waypoints: [{ x: 5, y: 5 }],
});

/** Minimal in-memory CanvasApi: only what the flowchart commands touch. */
function fakeApi(initial: BoardDocument, selection: string[] = []) {
  let doc = initial;
  const notify = vi.fn();
  const openPanel = vi.fn();
  const api = {
    getDocument: () => doc,
    getSelection: () => selection,
    getMode: () => 'diagram' as const,
    update: (recipe: (d: BoardDocument) => void) => {
      doc = produce(doc, recipe);
    },
    createId: () => 'new-id',
    getStyleFor: () => undefined,
    openPanel,
    services: { notify },
  } as unknown as CanvasApi;
  return { api, notify, openPanel, get doc() { return doc; } };
}

describe('runLayout', () => {
  const base = () => createEmptyBoard('flowchart', [box('a', 0, 0), box('b', 600, 0), box('c', 1200, 0), link('k1', 'a', 'b'), link('k2', 'b', 'c')]);

  it('moves the selection into a vertical stack and resets connector sides and waypoints', () => {
    const f = fakeApi(base(), ['a', 'b', 'c']);
    expect(runLayout(f.api, 'TB')).toBe(true);
    const [a, b, c] = ['a', 'b', 'c'].map((id) => f.doc.elements.find((e) => e.id === id) as ShapeElement);
    expect(a!.y).toBeLessThan(b!.y);
    expect(b!.y).toBeLessThan(c!.y);
    const k1 = f.doc.elements.find((e) => e.id === 'k1') as ConnectorElement;
    expect(k1.start).toMatchObject({ side: 'bottom' });
    expect((k1.start as { t?: number }).t).toBeUndefined();
    expect(k1.end).toMatchObject({ side: 'top' });
    expect(k1.waypoints).toBeUndefined();
  });

  it('notifies when there is nothing connected to lay out', () => {
    const f = fakeApi(createEmptyBoard('flowchart', [box('a', 0, 0), box('b', 300, 0)]), ['a', 'b']);
    expect(runLayout(f.api, 'LR')).toBe(false);
    expect(f.notify).toHaveBeenCalledWith('flowchart:notify.layoutNeedsConnected', { kind: 'info' });
  });
});

describe('createShapeAt', () => {
  it('adds a shape to the document and returns its id', () => {
    const f = fakeApi(createEmptyBoard('flowchart'));
    const id = createShapeAt(f.api, 'diamond', { x: 240, y: 120 });
    expect(id).toBe('new-id');
    expect(f.doc.elements).toHaveLength(1);
    expect(f.doc.elements[0]).toMatchObject({ type: 'shape', kind: 'diamond' });
  });
});

describe('createFlowchartCommands', () => {
  it('binds the shapes menu and both layout commands, enabled in diagram mode only', () => {
    const f = fakeApi(createEmptyBoard('flowchart'));
    const handlers = createFlowchartCommands(f.api);
    expect(handlers.map((h) => h.id).sort()).toEqual(['flowchart.layoutHorizontal', 'flowchart.layoutVertical', 'flowchart.shapesMenu']);
    handlers.find((h) => h.id === 'flowchart.shapesMenu')!.run({ source: 'keyboard' } as never);
    expect(f.openPanel).toHaveBeenCalledWith('flowchart.shapesMenu');
    for (const h of handlers) expect(h.isEnabled!()).toBe(true);
  });
});
