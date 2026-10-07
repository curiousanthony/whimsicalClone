/**
 * Tools of the wireframe module.
 *
 *  - keyed component tools (B button, P input, V avatar, O circle, R rectangle, G image,
 *    L / D line): tool id == command id, so the canvas binds the keys from the tool table;
 *  - launcher pseudo tools `wireframe.components` (E) / `wireframe.frames` (F): activating
 *    them opens a searchable panel (see commands.ts); picking arms one of the place tools;
 *  - place tools for every other launcher entry and frame device (group "allTools": they
 *    show up in the "/" menu and can be armed by the launchers);
 *  - annotation (A), available in both modes.
 */

import { translateKey } from '@renderer/i18n';
import type { BoardDocument, CanvasApi, DeviceKind, Point, Rect, ToolDefinition } from '@renderer/core/types';
import { FRAME_LAUNCHER_ORDER, containerFor, frameAtPoint, frameInsertIndex, screenRect, specOf } from './frames';
import { createAnnotation, createFrame, createWire, insertFrame, lineBox } from './model';
import { LAUNCHER_ENTRIES, launcherEntry, type LauncherEntry } from './registry';

export const COMPONENTS_PANEL_ID = 'wireframe.components';
export const FRAMES_PANEL_ID = 'wireframe.frames';
export const COMPONENTS_TOOL = 'wireframe.components';
export const FRAMES_TOOL = 'wireframe.frames';

const t = (key: string): string => translateKey(`wireframe:${key}`);

/** Entries with their own key: tool id == shortcut id. */
const KEYED: Readonly<Record<string, string>> = {
  rectangle: 'wireframe.rectangle',
  button: 'wireframe.button',
  image: 'wireframe.image',
  input: 'wireframe.input',
  avatar: 'wireframe.avatar',
  circle: 'wireframe.circle',
  line: 'wireframe.line',
};

/** Tool armed when a launcher entry is picked. */
export function toolIdForEntry(entryId: string): string {
  return KEYED[entryId] ?? `wireframe.place.${entryId}`;
}

export function toolIdForDevice(device: DeviceKind): string {
  return `wireframe.frame.${device}`;
}

/** Creates a component through the canvas API; returns the new ids. */
export function createWireAt(api: CanvasApi, entryId: string, at: Point, rect?: Rect): string[] {
  const entry = launcherEntry(entryId);
  const kind = entry?.kind ?? entryId;
  const id = api.createId();
  const { element } = createWire({
    id,
    entryId,
    at,
    rect,
    t,
    style: api.getStyleFor(`wire:${kind}`),
    doc: api.getDocument(),
  });
  api.update((d) => {
    d.elements.push(element as never);
  });
  return [id];
}

export function createFrameAt(api: CanvasApi, device: DeviceKind, at: Point, rect?: Rect): string[] {
  const id = api.createId();
  const frame = createFrame({ id, device, at, rect, t });
  api.update((d) => {
    insertFrame(d, frame, frameInsertIndex(d));
  });
  return [id];
}

export function createAnnotationAt(api: CanvasApi, at: Point, rect?: Rect): string[] {
  const id = api.createId();
  const doc = api.getDocument();
  const number = doc.settings.nextAnnotationNumber ?? 1;
  const annotation = createAnnotation({ id, at, rect, t, number, style: api.getStyleFor('annotation') });
  api.update((d) => {
    d.settings.nextAnnotationNumber = number + 1;
    d.elements.push(annotation as never);
  });
  return [id];
}

function placeTool(entry: LauncherEntry): ToolDefinition {
  const keyed = KEYED[entry.id];
  return {
    id: toolIdForEntry(entry.id),
    module: 'wireframe',
    labelKey: entry.labelKey,
    icon: entry.icon,
    shortcutId: keyed,
    group: keyed ? 'wireframeComponents' : 'allTools',
    modes: ['wireframe'],
    keywordsKey: entry.keywordsKey,
    cursor: 'crosshair',
    // Shapes without default text start editing right away; labelled components keep their text.
    editAfterCreate: entry.kind === 'rectangle' || entry.kind === 'circle',
    create: (api, at, rect) => createWireAt(api, entry.id, at, rect),
  };
}

/** Line tool (L / D): Shift flips the direction, Cmd spans the frame screen (or the view). */
function viewSpan(api: CanvasApi): Rect {
  const vp = api.getViewport();
  const w = (typeof window !== 'undefined' ? window.innerWidth : 1200) / vp.zoom;
  const h = (typeof window !== 'undefined' ? window.innerHeight : 800) / vp.zoom;
  return { x: vp.x, y: vp.y, w, h };
}

const lineTool: ToolDefinition = {
  id: KEYED['line']!,
  module: 'wireframe',
  labelKey: 'wireframe:components.line',
  icon: 'Minus',
  shortcutId: KEYED['line'],
  group: 'wireframeComponents',
  modes: ['wireframe'],
  keywordsKey: 'wireframe:keywords.line',
  cursor: 'crosshair',
  create: (api, at) => createWireAt(api, 'line', at),
  onPointerDown(e, api) {
    const start = api.snapPoint(e.world);
    const frame = frameAtPoint(api.getDocument(), start.x, start.y);
    const span = frame ? screenRect(frame) : viewSpan(api);
    const [id] = createWireAt(api, 'line', start);
    if (!id) return undefined;
    const apply = (end: Point, flip: boolean, full: boolean) => {
      const { rect, direction } = lineBox({ start, end, flip, full, span });
      api.update((d) => {
        const el = d.elements.find((x) => x.id === id);
        if (!el || el.type !== 'wire') return;
        el.x = rect.x;
        el.y = rect.y;
        el.w = rect.w;
        el.h = rect.h;
        el.props['direction'] = direction;
        // The engine only reassigns containers after a move, so follow the drag here.
        const container = containerFor(d as BoardDocument, rect, new Set([id]));
        if (container) el.containerId = container;
        else delete el.containerId;
      });
    };
    apply(start, e.shiftKey, e.metaKey);
    return {
      onPointerMove(m) {
        apply(api.snapPoint(m.world), m.shiftKey, m.metaKey);
      },
      onPointerUp(m) {
        apply(api.snapPoint(m.world), m.shiftKey, m.metaKey);
        api.setSelection([id]);
      },
    };
  },
};

const annotationTool: ToolDefinition = {
  id: 'wireframe.annotation',
  module: 'wireframe',
  labelKey: 'wireframe:commands.annotation',
  icon: 'MessageSquareText',
  shortcutId: 'wireframe.annotation',
  group: 'annotation',
  modes: ['diagram', 'wireframe'],
  keywordsKey: 'wireframe:keywords.annotation',
  cursor: 'crosshair',
  editAfterCreate: true,
  create: (api, at, rect) => createAnnotationAt(api, at, rect),
};

const componentsLauncher: ToolDefinition = {
  id: COMPONENTS_TOOL,
  module: 'wireframe',
  labelKey: 'wireframe:commands.components',
  icon: 'Component',
  shortcutId: 'wireframe.components',
  group: 'wireframeComponents',
  modes: ['wireframe'],
  keywordsKey: 'wireframe:keywords.components',
};

const framesLauncher: ToolDefinition = {
  id: FRAMES_TOOL,
  module: 'wireframe',
  labelKey: 'wireframe:commands.frames',
  icon: 'Frame',
  shortcutId: 'wireframe.frames',
  group: 'wireframeFrames',
  modes: ['wireframe'],
  keywordsKey: 'wireframe:keywords.frames',
};

function frameTool(device: DeviceKind): ToolDefinition {
  return {
    id: toolIdForDevice(device),
    module: 'wireframe',
    labelKey: `wireframe:frames.${device}`,
    icon: specOf(device).icon,
    group: 'allTools',
    modes: ['wireframe'],
    keywordsKey: `wireframe:keywords.frame-${device}`,
    cursor: 'crosshair',
    create: (api, at, rect) => createFrameAt(api, device, at, rect),
  };
}

const placeTools = LAUNCHER_ENTRIES.filter((e) => e.id !== 'line').map(placeTool);

export const wireframeTools: ToolDefinition[] = [
  componentsLauncher,
  ...placeTools.filter((tool) => tool.group === 'wireframeComponents'),
  lineTool,
  framesLauncher,
  annotationTool,
  ...placeTools.filter((tool) => tool.group !== 'wireframeComponents'),
  ...FRAME_LAUNCHER_ORDER.map(frameTool),
];

export function isLauncherTool(id: string): boolean {
  return id === COMPONENTS_TOOL || id === FRAMES_TOOL;
}
