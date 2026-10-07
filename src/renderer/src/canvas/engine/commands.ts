/**
 * Runtime handlers for the canvas engine's command ids (canvas/shortcuts.ts). Bound through
 * EditorProps.registerShortcuts while the canvas tab is active, before tool shortcuts and
 * plugin commands (which therefore win when they bind the same id).
 */

import type { Draft } from 'immer';
import type {
  BoardDocument,
  BoardElement,
  ConnectorElement,
  Direction,
  Rect,
  SectionElement,
  ShortcutHandler,
  StylePreset,
  TextSize,
} from '@renderer/core/types';
import { isTextInputTarget } from '@renderer/core/shortcuts';
import { translateKey } from '@renderer/i18n';
import { alignOffsets, bringForward, bringToFront, distributeOffsets, groupElements, sendBackward, sendToBack, toggleLock, ungroupElements, type AlignKind } from '../arrange';
import { cloneElements } from '../clipboard';
import { directionVector, rectsIntersect, snapToGrid, unionRects, nextRotation } from '../geometry';
import { collectMoveSet, isBoxElement, isConnector } from '../scene';
import { expandGroups, nearestInDirection, selectNextInReadingOrder } from '../selection';
import { stepZoom } from '../viewport';
import { CanvasEngine, CONNECTOR_TOOL, PAN_TOOL, SELECT_TOOL } from './engine';

const TEXT_SIZES: readonly TextSize[] = ['xs', 's', 'm', 'l', 'xl', 'xxl'];

/** Gap between a quick-added element and its source (Whimsical default spacing). */
export const QUICK_ADD_GAP = 60;

const capitalize = (d: Direction) => (d.charAt(0).toUpperCase() + d.slice(1)) as 'Up' | 'Down' | 'Left' | 'Right';

/** Style key used by "Save as default style" / last-used styles (SPEC 3.1: "shape:rectangle"). */
export function styleKeyOf(el: BoardElement): string {
  if (el.type === 'shape') return `shape:${el.kind}`;
  if (el.type === 'wire') return `wire:${el.component}`;
  return el.type;
}

/** Picks the definition's style properties from an element. */
export function pickStyle(engine: CanvasEngine, el: BoardElement): StylePreset {
  const props = engine.lookup(el.type)?.styleProps ?? [];
  const out: StylePreset = {};
  const rec = el as unknown as Record<string, unknown>;
  for (const p of props) if (rec[p] !== undefined) out[p] = structuredClone(rec[p]) as StylePreset[string];
  return out;
}

function selected(engine: CanvasEngine): BoardElement[] {
  const ids = new Set(engine.getSelection());
  return engine.getDocument().elements.filter((e) => ids.has(e.id));
}

function hasSelection(engine: CanvasEngine): boolean {
  return engine.getSelection().length > 0;
}

/** Quick add (Alt+Arrow / hover "+"): blank copy of the selected element in a direction. */
export function quickAdd(engine: CanvasEngine, direction: Direction): boolean {
  const sel = engine.getSelection();
  if (sel.length !== 1) return false;
  const source = engine.getElement(sel[0]!);
  if (!source || !isBoxElement(source)) return false;
  const def = engine.lookup(source.type);
  if (!def?.quickAdd) return false;
  const srcBounds = engine.boundsOf(source.id);
  if (!srcBounds) return false;
  const v = directionVector(direction);
  const index = engine.getIndex();
  const stepX = v.x * (srcBounds.w + QUICK_ADD_GAP);
  const stepY = v.y * (srcBounds.h + QUICK_ADD_GAP);
  let offsetX = stepX;
  let offsetY = stepY;
  // Step further while the slot is occupied.
  for (let i = 0; i < 12; i++) {
    const slot: Rect = { x: srcBounds.x + offsetX, y: srcBounds.y + offsetY, w: srcBounds.w, h: srcBounds.h };
    const blocked = index.idsIn(slot).some((id) => {
      const el = engine.getElement(id);
      return el && !isConnector(el) && el.id !== source.id && rectsIntersect(slot, index.getBounds(id)!);
    });
    if (!blocked) break;
    offsetX += stepX;
    offsetY += stepY;
  }
  const [clone] = cloneElements([source], () => engine.createId(), { x: offsetX, y: offsetY });
  if (!clone) return false;
  delete clone.groupId;
  delete clone.locked;
  const newId = clone.id;
  const connectorId = engine.createId();
  engine.update((d) => {
    const draftClone = clone as Draft<BoardElement>;
    if (def.setText) def.setText(draftClone as never, engine.emptyText());
    d.elements.push(draftClone);
    if (def.quickAdd?.connect) {
      const style = engine.getStyleFor('connector') ?? {};
      const fromSide = direction === 'up' ? 'top' : direction === 'down' ? 'bottom' : direction;
      const toSide = direction === 'up' ? 'bottom' : direction === 'down' ? 'top' : direction === 'left' ? 'right' : 'left';
      const connector: ConnectorElement = {
        id: connectorId,
        type: 'connector',
        start: { kind: 'attached', elementId: source.id, side: fromSide, t: 0.5 },
        end: { kind: 'attached', elementId: newId, side: toSide, t: 0.5 },
        route: 'elbow',
        color: 'slate',
        dashed: false,
        startEndpoint: 'none',
        endEndpoint: 'arrow',
        ...(style as Partial<ConnectorElement>),
      };
      d.elements.push(connector as Draft<ConnectorElement>);
    }
  });
  engine.setSelection([newId]);
  if (def.textEditable) engine.startTextEditing(newId);
  revealRect(engine, engine.boundsOf(newId));
  return true;
}

/** Pans just enough to bring a rect into view. */
export function revealRect(engine: CanvasEngine, rect: Rect | undefined): void {
  if (!rect) return;
  const view = engine.visibleWorldRect();
  const margin = 48 / engine.getViewport().zoom;
  let dx = 0;
  let dy = 0;
  if (rect.x < view.x + margin) dx = rect.x - margin - view.x;
  else if (rect.x + rect.w > view.x + view.w - margin) dx = rect.x + rect.w + margin - (view.x + view.w);
  if (rect.y < view.y + margin) dy = rect.y - margin - view.y;
  else if (rect.y + rect.h > view.y + view.h - margin) dy = rect.y + rect.h + margin - (view.y + view.h);
  if (dx || dy) {
    const v = engine.getViewport();
    engine.setViewport({ ...v, x: v.x + dx, y: v.y + dy }, { animate: true });
  }
}

function nudge(engine: CanvasEngine, direction: Direction, step: 'grid' | 'large' | 'fine'): void {
  const ids = engine.getSelection();
  if (ids.length === 0) return;
  const grid = engine.getGridSize();
  const amount = step === 'fine' ? 1 : step === 'large' ? Math.max(grid, 1) * 5 : Math.max(grid, 1);
  const v = directionVector(direction);
  const set = collectMoveSet(engine.getDocument(), ids);
  engine.update((d) => CanvasEngine.translateInDraft(d, set, v.x * amount, v.y * amount), { coalesceKey: `nudge:${ids.join(',')}` });
}

function resizeBy(engine: CanvasEngine, dw: number, dh: number): void {
  const ids = engine.getSelection();
  const grid = Math.max(engine.getGridSize(), 1);
  engine.update(
    (d) => {
      for (const el of d.elements) {
        if (!ids.includes(el.id) || el.locked || !isBoxElement(el as BoardElement)) continue;
        const box = el as Draft<BoardElement> & Rect;
        const def = engine.lookup(el.type);
        if (!def || def.resize === 'none' || (def.resize === 'width' && dh !== 0)) continue;
        const prev = { x: box.x, y: box.y, w: box.w, h: box.h };
        const next = { ...prev, w: Math.max(grid, prev.w + dw * grid), h: Math.max(grid, prev.h + dh * grid) };
        if (def.applyResize) def.applyResize(el as never, next, prev);
        else Object.assign(box, next);
      }
    },
    { coalesceKey: `resize:${ids.join(',')}` },
  );
}

function reorder(engine: CanvasEngine, fn: 'front' | 'back' | 'forward' | 'backward'): void {
  const doc = engine.getDocument();
  const ids = new Set(expandGroups(doc, engine.getSelection()));
  if (ids.size === 0) return;
  const overlaps = (a: BoardElement, b: BoardElement) => {
    const ra = engine.boundsOf(a.id);
    const rb = engine.boundsOf(b.id);
    return !!ra && !!rb && rectsIntersect(ra, rb);
  };
  engine.update((d) => {
    const els = d.elements as unknown as BoardElement[];
    const next =
      fn === 'front'
        ? bringToFront(els, ids)
        : fn === 'back'
          ? sendToBack(els, ids)
          : fn === 'forward'
            ? bringForward(els, ids, overlaps)
            : sendBackward(els, ids, overlaps);
    d.elements = next as Draft<BoardElement>[];
  });
}

function align(engine: CanvasEngine, kind: AlignKind): void {
  const items = selected(engine)
    .filter((e) => !isConnector(e) && !e.locked)
    .map((e) => ({ id: e.id, rect: engine.boundsOf(e.id)! }))
    .filter((i) => !!i.rect);
  const offsets = alignOffsets(items, kind);
  applyOffsets(engine, offsets);
}

function distribute(engine: CanvasEngine, axis: 'h' | 'v'): void {
  const items = selected(engine)
    .filter((e) => !isConnector(e) && !e.locked)
    .map((e) => ({ id: e.id, rect: engine.boundsOf(e.id)! }))
    .filter((i) => !!i.rect);
  applyOffsets(engine, distributeOffsets(items, axis));
}

function applyOffsets(engine: CanvasEngine, offsets: Map<string, { x: number; y: number }>): void {
  if (offsets.size === 0) return;
  const doc = engine.getDocument();
  engine.update((d) => {
    for (const [id, o] of offsets) CanvasEngine.translateInDraft(d, collectMoveSet(doc, [id]), o.x, o.y);
  });
}

function stepTextSize(engine: CanvasEngine, dir: 1 | -1): void {
  const ids = new Set(engine.getSelection());
  const editing = engine.getEditingId();
  if (editing) ids.add(editing);
  engine.update(
    (d) => {
      for (const el of d.elements) {
        if (!ids.has(el.id)) continue;
        const rec = el as unknown as { textSize?: TextSize };
        if (!rec.textSize) continue;
        const i = TEXT_SIZES.indexOf(rec.textSize);
        const next = TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, i + dir))];
        if (next) rec.textSize = next;
      }
    },
    { coalesceKey: `style:${[...ids].join(',')}` },
  );
}

/** Duplicate (Cmd+D): copies of the selection, offset to the right / below by two grid steps. */
export function duplicateSelection(engine: CanvasEngine, offset?: { x: number; y: number }): string[] {
  const doc = engine.getDocument();
  const set = collectMoveSet(doc, engine.getSelection());
  // Also include connectors between selected elements.
  const source = doc.elements.filter((e) => set.has(e.id) || engine.getSelection().includes(e.id));
  if (source.length === 0) return [];
  const step = Math.max(engine.getGridSize(), 12) * 2;
  const clones = cloneElements(source, () => engine.createId(), offset ?? { x: step, y: step });
  engine.update((d) => {
    d.elements.push(...(clones as Draft<BoardElement>[]));
  });
  const selectedIds = new Set(engine.getSelection());
  const ids = clones.filter((_, i) => selectedIds.has(source[i]!.id)).map((c) => c.id);
  engine.setSelection(ids);
  return ids;
}

export function deleteSelection(engine: CanvasEngine): void {
  const doc = engine.getDocument();
  const ids = new Set(expandGroups(doc, engine.getSelection()).filter((id) => !engine.getElement(id)?.locked));
  if (ids.size === 0) return;
  engine.update((d) => {
    d.elements = d.elements.filter((e) => {
      if (ids.has(e.id)) return false;
      // Connectors attached to deleted elements go too (Whimsical).
      if (e.type === 'connector') {
        const s = e.start.kind === 'attached' && ids.has(e.start.elementId);
        const t = e.end.kind === 'attached' && ids.has(e.end.elementId);
        if (s || t) return false;
      }
      return true;
    });
    // Contents of deleted containers stay (Whimsical keeps a section's contents).
    for (const e of d.elements) if (e.containerId && ids.has(e.containerId)) delete e.containerId;
  });
  engine.setSelection([]);
}

function wrapInSection(engine: CanvasEngine): void {
  if (!engine.lookup('section')) return;
  const sel = selected(engine).filter((e) => !isConnector(e));
  const bounds = unionRects(sel.map((e) => engine.boundsOf(e.id)).filter((r): r is Rect => !!r));
  if (!bounds) return;
  const pad = 36;
  const grid = Math.max(engine.getGridSize(), 1);
  const id = engine.createId();
  const doc = engine.getDocument();
  const firstIndex = Math.min(...sel.map((e) => doc.elements.indexOf(e)));
  const style = engine.getStyleFor('section') ?? {};
  const section: SectionElement = {
    id,
    type: 'section',
    x: snapToGrid(bounds.x - pad, grid),
    y: snapToGrid(bounds.y - pad - 24, grid),
    w: snapToGrid(bounds.w + pad * 2, grid),
    h: snapToGrid(bounds.h + pad * 2 + 24, grid),
    name: translateKey('canvas:defaults.sectionName'),
    color: 'gray',
    fill: 'outline',
    clip: false,
    ...(style as Partial<SectionElement>),
  };
  const ids = new Set(sel.map((e) => e.id));
  engine.update((d) => {
    d.elements.splice(Math.max(0, firstIndex), 0, section as Draft<SectionElement>);
    for (const e of d.elements) if (ids.has(e.id) && !e.containerId) e.containerId = id;
  });
  engine.setSelection([id]);
}

/** Creates the engine's command handlers. */
export function createEngineCommands(engine: CanvasEngine, extras: { filePath: string }): ShortcutHandler[] {
  const h = (id: string, run: ShortcutHandler['run'], isEnabled?: () => boolean): ShortcutHandler => ({ id, run, isEnabled });
  const handlers: ShortcutHandler[] = [
    // Zoom
    h('canvas.zoomIn', () => engine.zoomTo(stepZoom(engine.getViewport().zoom, 1))),
    h('canvas.zoomOut', () => engine.zoomTo(stepZoom(engine.getViewport().zoom, -1))),
    h('canvas.zoomReset', () => engine.zoomTo(1)),
    h('canvas.zoomToFit', () => engine.zoomToFit('content')),
    h('canvas.zoomToSelection', () => engine.zoomToFit('selection'), () => hasSelection(engine)),

    // Tools & modes
    h('canvas.selectTool', () => engine.setActiveTool(SELECT_TOOL)),
    h('canvas.panTool', () => engine.setActiveTool(PAN_TOOL)),
    h('canvas.allTools', () => engine.openPanel('canvas.allTools')),
    h('canvas.connector', () => engine.setActiveTool(CONNECTOR_TOOL)),
    h('canvas.toggleWireframe', () => engine.setMode(engine.getMode() === 'wireframe' ? 'diagram' : 'wireframe'), () => engine.preset.toolbar === 'full'),
    h('canvas.exitWireframe', () => engine.setMode('diagram')),
    h('canvas.toggleQuickAdd', () => engine.store.setState((s) => ({ quickAddHidden: !s.quickAddHidden }))),
    ...(['up', 'down', 'left', 'right'] as const).map((d) => h(`canvas.quickAdd${capitalize(d)}`, () => void quickAdd(engine, d), () => engine.getSelection().length === 1)),

    // Selection
    h('canvas.escape', () => {
      if (engine.cancelSession()) return;
      if (engine.getEditingId()) return engine.stopTextEditing();
      if (engine.store.getState().panel) return engine.closePanel();
      if (engine.getActiveTool() !== SELECT_TOOL && engine.preset.toolbar !== 'draw') return engine.setActiveTool(SELECT_TOOL);
      engine.setSelection([]);
    }),
    h('canvas.selectNext', () => selectStep(engine, 1)),
    h('canvas.selectPrevious', () => selectStep(engine, -1)),
    ...(['up', 'down', 'left', 'right'] as const).map((d) =>
      h(`canvas.selectNeighbor${capitalize(d)}`, () => {
        const sel = engine.getSelection();
        const from = engine.selectionBounds(sel);
        if (!from) return selectStep(engine, 1);
        const next = nearestInDirection(engine.getDocument(), from, d, (id) => engine.boundsOf(id), new Set(sel));
        if (next) {
          engine.setSelection(expandGroups(engine.getDocument(), [next]));
          revealRect(engine, engine.boundsOf(next));
        }
      }),
    ),
    h('edit.selectAll', (ctx) => {
      if (ctx.event && isTextInputTarget(ctx.event.target)) {
        document.execCommand('selectAll');
        return;
      }
      engine.selectAll();
    }, () => !engine.getEditingId()),

    // Edit
    h('canvas.editText', () => {
      const tool = engine.getTool(engine.getActiveTool());
      if (tool?.create && engine.getActiveTool() !== SELECT_TOOL) {
        engine.createAtViewportCenter(tool.id);
        return;
      }
      const sel = engine.getSelection();
      const target = sel.length === 1 ? sel[0] : sel.find((id) => engine.lookup(engine.getElement(id)?.type ?? 'shape')?.textEditable);
      if (target) engine.startTextEditing(target);
    }),
    h('canvas.delete', () => deleteSelection(engine), () => hasSelection(engine)),
    h('canvas.duplicate', () => void duplicateSelection(engine), () => hasSelection(engine)),
    h('canvas.copyStyle', () => {
      const el = selected(engine)[0];
      if (el) engine.setStyleClipboard({ type: el.type, style: pickStyle(engine, el) });
    }, () => hasSelection(engine)),
    h('canvas.pasteStyle', () => pasteStyle(engine), () => hasSelection(engine) && !!engine.getStyleClipboard()),
    h('canvas.copyLink', () => {
      const id = engine.getSelection()[0];
      if (!id) return;
      // Workspace links: "wc://file/<relPath>#<elementId>" (core/types.ts TextSpan.href).
      const url = `wc://file/${encodeURI(extras.filePath)}#${id}`;
      void navigator.clipboard?.writeText(url).then(
        () => engine.services.notify('canvas:notify.linkCopied'),
        () => undefined,
      );
    }, () => hasSelection(engine)),
    h('canvas.copyAsImage', () => engine.services.notify('canvas:notify.copyAsImageUnavailable', { kind: 'info' }), () => hasSelection(engine)),
    h('canvas.saveDefaultStyle', () => {
      const el = selected(engine)[0];
      if (!el) return;
      const key = styleKeyOf(el);
      const style = pickStyle(engine, el);
      engine.update((d) => {
        d.settings.defaultStyles[key] = style as Draft<StylePreset>;
      });
      engine.services.notify('canvas:notify.defaultStyleSaved');
    }, () => hasSelection(engine)),
    h('canvas.textSizeUp', () => stepTextSize(engine, 1), () => hasSelection(engine) || !!engine.getEditingId()),
    h('canvas.textSizeDown', () => stepTextSize(engine, -1), () => hasSelection(engine) || !!engine.getEditingId()),

    // Arrange
    h('canvas.bringToFront', () => reorder(engine, 'front'), () => hasSelection(engine)),
    h('canvas.bringForward', () => reorder(engine, 'forward'), () => hasSelection(engine)),
    h('canvas.sendToBack', () => reorder(engine, 'back'), () => hasSelection(engine)),
    h('canvas.sendBackward', () => reorder(engine, 'backward'), () => hasSelection(engine)),
    h('canvas.group', () => {
      const ids = new Set(engine.getSelection());
      const groupId = engine.createId();
      engine.update((d) => void groupElements(d.elements as unknown as BoardElement[], ids, groupId));
    }, () => engine.getSelection().length > 1),
    h('canvas.ungroup', () => {
      const ids = new Set(engine.getSelection());
      engine.update((d) => void ungroupElements(d.elements as unknown as BoardElement[], ids));
    }, () => selected(engine).some((e) => e.groupId)),
    h('canvas.lock', () => {
      const ids = new Set(expandGroups(engine.getDocument(), engine.getSelection()));
      engine.update((d) => toggleLock(d.elements as unknown as BoardElement[], ids));
    }, () => hasSelection(engine)),
    h('canvas.growWidth', () => resizeBy(engine, 1, 0), () => hasSelection(engine)),
    h('canvas.shrinkWidth', () => resizeBy(engine, -1, 0), () => hasSelection(engine)),
    h('canvas.growHeight', () => resizeBy(engine, 0, 1), () => hasSelection(engine)),
    h('canvas.shrinkHeight', () => resizeBy(engine, 0, -1), () => hasSelection(engine)),
    ...(['up', 'down', 'left', 'right'] as const).flatMap((d) => [
      h(`canvas.nudge${capitalize(d)}`, () => nudge(engine, d, 'grid'), () => hasSelection(engine)),
      h(`canvas.nudge${capitalize(d)}Large`, () => nudge(engine, d, 'large'), () => hasSelection(engine)),
      h(`canvas.nudge${capitalize(d)}Fine`, () => nudge(engine, d, 'fine'), () => hasSelection(engine)),
    ]),
    h('canvas.alignLeft', () => align(engine, 'left'), () => engine.getSelection().length > 1),
    h('canvas.alignCenterH', () => align(engine, 'centerH'), () => engine.getSelection().length > 1),
    h('canvas.alignRight', () => align(engine, 'right'), () => engine.getSelection().length > 1),
    h('canvas.alignTop', () => align(engine, 'top'), () => engine.getSelection().length > 1),
    h('canvas.alignCenterV', () => align(engine, 'centerV'), () => engine.getSelection().length > 1),
    h('canvas.alignBottom', () => align(engine, 'bottom'), () => engine.getSelection().length > 1),
    h('canvas.distributeH', () => distribute(engine, 'h'), () => engine.getSelection().length > 2),
    h('canvas.distributeV', () => distribute(engine, 'v'), () => engine.getSelection().length > 2),
    h('canvas.snapToGrid', () => {
      const grid = Math.max(engine.getGridSize(), 1);
      const ids = new Set(engine.getSelection());
      engine.update((d) => {
        for (const el of d.elements) {
          if (!ids.has(el.id) || el.locked || !isBoxElement(el as BoardElement)) continue;
          const box = el as Draft<BoardElement> & Rect;
          box.x = snapToGrid(box.x, grid);
          box.y = snapToGrid(box.y, grid);
        }
      });
    }, () => hasSelection(engine)),
    h('canvas.wrapInSection', () => wrapInSection(engine), () => hasSelection(engine) && !!engine.lookup('section')),
    h('canvas.rotate', () => {
      const ids = new Set(engine.getSelection());
      engine.update((d) => {
        for (const el of d.elements) {
          if (!ids.has(el.id) || el.locked || !engine.lookup(el.type)?.rotatable) continue;
          const box = el as Draft<BoardElement> & { rotation?: 0 | 90 | 180 | 270 };
          box.rotation = nextRotation(box.rotation);
        }
      });
    }, () => selected(engine).some((e) => engine.lookup(e.type)?.rotatable)),
  ];
  return handlers;
}

function selectStep(engine: CanvasEngine, dir: 1 | -1): void {
  const next = selectNextInReadingOrder(engine.getDocument(), engine.getSelection(), (id) => engine.boundsOf(id), dir);
  if (next) {
    engine.setSelection([next]);
    revealRect(engine, engine.boundsOf(next));
  }
}

function pasteStyle(engine: CanvasEngine): void {
  const clip = engine.getStyleClipboard();
  if (!clip) return;
  const ids = new Set(engine.getSelection());
  engine.update((d) => {
    for (const el of d.elements as Draft<BoardDocument>['elements']) {
      if (!ids.has(el.id)) continue;
      const allowed = new Set(engine.lookup(el.type)?.styleProps ?? []);
      for (const [k, v] of Object.entries(clip.style)) {
        if (el.type === clip.type || allowed.has(k)) (el as unknown as Record<string, unknown>)[k] = structuredClone(v);
      }
    }
  });
}
