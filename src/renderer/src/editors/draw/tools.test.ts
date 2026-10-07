import { produce } from 'immer';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyBoard } from '@renderer/core/boardFormat';
import type {
  BoardDocument,
  CanvasApi,
  CommandContext,
  CanvasPointerEvent,
  StrokeElement,
  ToolDefinition,
} from '@renderer/core/types';
import { drawPlugin } from './plugin';
import { resetDetectShapesForTests, setDetectShapes } from './detectShapesPref';
import { DRAW_TOOL_IDS, SELECT_TOOL_ID, isDrawTool } from './toolIds';
import { drawTools } from './tools';

function fakeApi(initial: BoardDocument) {
  let doc = initial;
  let activeTool: string = DRAW_TOOL_IDS.markerThin;
  let selection: string[] = ['preselected'];
  let n = 0;
  let updates = 0;
  const api = {
    theme: 'light',
    services: { api: {} },
    createId: () => `id${++n}`,
    getDocument: () => doc,
    getElement: (id: string) => doc.elements.find((e) => e.id === id),
    update: (fn: (d: BoardDocument) => void) => {
      updates++;
      doc = produce(doc, fn as (d: BoardDocument) => void);
    },
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    getStyleFor: () => undefined,
    setSelection: (ids: string[]) => {
      selection = ids;
    },
    setActiveTool: (id: string) => {
      activeTool = id;
    },
    getActiveTool: () => activeTool,
    openPanel: () => undefined,
  } as unknown as CanvasApi;
  return { api, doc: () => doc, updates: () => updates, selection: () => selection, tool: () => activeTool };
}

const ev = (x: number, y: number, extra: Partial<CanvasPointerEvent> = {}): CanvasPointerEvent =>
  ({
    world: { x, y },
    screen: { x, y },
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: 'mouse',
    pressure: 0.5,
    samples: [{ x, y, pressure: 0.5 }],
    ...extra,
  }) as unknown as CanvasPointerEvent;

const toolById = (id: string): ToolDefinition => drawTools.find((t) => t.id === id)!;

function draw(
  t: ToolDefinition,
  api: CanvasApi,
  pts: Array<[number, number]>,
  extra: Partial<CanvasPointerEvent> = {},
) {
  const session = t.onPointerDown!(ev(pts[0]![0], pts[0]![1], extra), api)!;
  for (const [x, y] of pts.slice(1, -1)) session.onPointerMove?.(ev(x, y, extra));
  const last = pts[pts.length - 1]!;
  session.onPointerUp?.(ev(last[0], last[1], extra));
}

const CTX = { source: 'keyboard' } as unknown as CommandContext;

beforeEach(() => resetDetectShapesForTests());

describe('pen tools', () => {
  it('declares marker thin / thick, highlighter and eraser', () => {
    expect(drawTools.map((t) => t.id)).toEqual(['draw.marker', 'draw.markerThick', 'draw.highlighter', 'draw.eraser']);
    expect(drawTools.every((t) => t.persistent)).toBe(true);
    expect(drawPlugin.elements.map((e) => e.type)).toEqual(['stroke']);
  });

  it('commits exactly one update per stroke (one undo step) and clears the selection', () => {
    const f = fakeApi(createEmptyBoard('draw'));
    draw(toolById('draw.marker'), f.api, [
      [0, 0],
      [10, 3],
      [20, 0],
      [40, 10],
    ]);
    expect(f.updates()).toBe(1);
    expect(f.selection()).toEqual([]);
    const stroke = f.doc().elements[0] as StrokeElement;
    expect(stroke).toMatchObject({ type: 'stroke', tool: 'marker', size: 'thin' });
    expect(stroke.isPen).toBeUndefined();
  });

  it('marks pen input and keeps the thick size and highlighter style', () => {
    const f = fakeApi(createEmptyBoard('draw'));
    draw(
      toolById('draw.markerThick'),
      f.api,
      [
        [0, 0],
        [30, 30],
      ],
      { pointerType: 'pen' },
    );
    draw(toolById('draw.highlighter'), f.api, [
      [0, 50],
      [80, 50],
    ]);
    const [a, b] = f.doc().elements as StrokeElement[];
    expect(a).toMatchObject({ size: 'thick', isPen: true });
    expect(b).toMatchObject({ tool: 'highlighter', size: 'thick', color: 'yellow' });
  });

  it('commits a tap as a dot', () => {
    const f = fakeApi(createEmptyBoard('draw'));
    const session = toolById('draw.marker').onPointerDown!(ev(5, 5), f.api)!;
    session.onPointerUp?.(ev(5, 5));
    expect((f.doc().elements[0] as StrokeElement).points.length).toBe(3);
  });

  it('commits nothing when cancelled', () => {
    const f = fakeApi(createEmptyBoard('draw'));
    const session = toolById('draw.marker').onPointerDown!(ev(0, 0), f.api)!;
    session.onPointerMove?.(ev(20, 20));
    session.onCancel?.();
    expect(f.doc().elements).toHaveLength(0);
    expect(f.updates()).toBe(0);
  });

  it('applies Detect shapes as a separate undo step when enabled', async () => {
    setDetectShapes({} as never, true);
    const f = fakeApi(createEmptyBoard('draw'));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 40; i++) pts.push([i * 5, i * 0.5]);
    draw(toolById('draw.marker'), f.api, pts);
    expect(f.updates()).toBe(1);
    await new Promise((r) => setTimeout(r, 5));
    expect(f.updates()).toBe(2);
    expect((f.doc().elements[0] as StrokeElement).detectedShape).toBe('line');
  });
});

describe('eraser', () => {
  function withStrokes() {
    const f = fakeApi(createEmptyBoard('draw'));
    draw(toolById('draw.marker'), f.api, [
      [0, 0],
      [100, 0],
    ]);
    draw(toolById('draw.marker'), f.api, [
      [0, 60],
      [100, 60],
    ]);
    draw(toolById('draw.marker'), f.api, [
      [0, 120],
      [100, 120],
    ]);
    return f;
  }

  it('erases whole strokes it touches', () => {
    const f = withStrokes();
    const session = toolById('draw.eraser').onPointerDown!(ev(50, 2), f.api)!;
    expect(f.doc().elements).toHaveLength(2);
    session.onPointerMove?.(ev(50, 60, { samples: [{ x: 50, y: 60, pressure: 0.5 }] }));
    session.onPointerUp?.(ev(50, 60));
    expect(f.doc().elements).toHaveLength(1);
    expect((f.doc().elements[0] as StrokeElement).y).toBeGreaterThan(100);
  });

  it('leaves non-stroke elements alone', () => {
    const f = withStrokes();
    const board = produce(f.doc(), (d) => {
      d.elements.push({
        id: 'note',
        type: 'sticky',
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        color: 'yellow',
        text: { blocks: [] },
        textSize: 'm',
        textAlign: 'left',
      } as never);
    });
    const g = fakeApi(board);
    toolById('draw.eraser').onPointerDown!(ev(50, 50), g.api);
    expect(g.doc().elements.some((e) => e.id === 'note')).toBe(true);
  });
});

describe('commands', () => {
  it('exposes the commands referenced by the shortcut table', () => {
    const f = fakeApi(createEmptyBoard('draw'));
    const cmds = drawPlugin.createCommands!(f.api);
    const ids = cmds.map((c) => c.id);
    for (const id of ['draw.exit', 'draw.selector', 'draw.toggleThickness', 'draw.detectShapes', 'draw.penOptions'])
      expect(ids).toContain(id);
  });

  it('Escape leaves a drawing tool for select, and is disabled outside drawing tools', () => {
    const f = fakeApi(createEmptyBoard('draw'));
    const exit = drawPlugin.createCommands!(f.api).find((c) => c.id === 'draw.exit')!;
    expect(exit.isEnabled?.()).toBe(true);
    exit.run(CTX);
    expect(f.tool()).toBe(SELECT_TOOL_ID);
    expect(exit.isEnabled?.()).toBe(false);
  });

  it('toggles thin / thick marker', () => {
    const f = fakeApi(createEmptyBoard('draw'));
    const toggle = drawPlugin.createCommands!(f.api).find((c) => c.id === 'draw.toggleThickness')!;
    toggle.run(CTX);
    expect(f.tool()).toBe(DRAW_TOOL_IDS.markerThick);
    toggle.run(CTX);
    expect(f.tool()).toBe(DRAW_TOOL_IDS.markerThin);
  });
});

describe('tool ids', () => {
  it('classifies draw tools', () => {
    expect(isDrawTool('draw.eraser')).toBe(true);
    expect(isDrawTool('draw.highlighter')).toBe(true);
    expect(isDrawTool(SELECT_TOOL_ID)).toBe(false);
  });
});
