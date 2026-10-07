/**
 * CanvasEngine: one instance per mounted canvas. Implements the CanvasApi contract, owns the
 * DocumentController (command layer over host history), the UI store, pointer interactions
 * (select, move, resize, marquee, pan, create, tool sessions) and the derived shortcut scopes.
 *
 * Elements never receive pointer events directly: the engine hit-tests through the spatial
 * index. DOM inside an element marked `data-wc-interactive` (or the element being edited,
 * `data-wc-editing`) is left alone so it can handle its own events.
 */

import type { ComponentType } from 'react';
import type { Draft } from 'immer';
import type {
  BoardDocument,
  BoardElement,
  BoxBoardElement,
  CanvasApi,
  CanvasMode,
  CanvasPlugin,
  CanvasPointerEvent,
  CanvasPreset,
  ChangeOptions,
  ConnectorElement,
  Direction,
  EditorServices,
  ElementDefinition,
  ElementOfType,
  ElementType,
  Point,
  Rect,
  RichText,
  ScopeId,
  Size,
  StylePreset,
  TextStyle,
  ThemeMode,
  ToolDefinition,
  ToolSession,
  Viewport,
} from '@renderer/core/types';
import type { CanvasKind } from '@shared/fileKinds';
import { newId } from '@renderer/core/ids';
import { GRID_SIZE } from '@renderer/core/palette';
import { emptyRichText } from '@renderer/core/richText';
import { DocumentController, chainNormalizers, type Recipe } from '../documentController';
import { expandRect, rectFromPoints, rotatedBounds, snapToGrid, unionRects } from '../geometry';
import { attachmentAt, createBoundsResolver, connectorGeometry, type BoundsResolver } from '../connectors';
import { cloneElements } from '../clipboard';
import { measureRichText } from '../measureText';
import { exceedsDragThreshold, isEraserPointer, toCanvasPointerEvent } from '../pointer';
import { collectMoveSet, createDefinitionLookup, elementBounds, findContainerFor, isBoxElement, isConnector, type DefinitionLookup } from '../scene';
import { applyClick, marqueeSelect, normalizeSelection, selectionsEqual } from '../selection';
import { snapModeFromModifiers, snapMovingRect, snapPoint as snapPointPure, type SnapMode } from '../snapping';
import { SceneIndex } from '../spatialIndex';
import { resizeRect, scaleRectWithin, type Handle } from '../transform';
import { DEFAULT_VIEWPORT, fitRect, panBy, screenToWorld, visibleWorldRect, worldToScreen, zoomAt } from '../viewport';
import { createCanvasStore, type CanvasState, type CanvasStore } from './store';

export const SELECT_TOOL = 'canvas.selectTool';
export const PAN_TOOL = 'canvas.panTool';
export const CONNECTOR_TOOL = 'canvas.connector';

/** Hit tolerance in screen pixels. */
const HIT_TOLERANCE_PX = 4;

export interface EngineOptions {
  kind: CanvasKind;
  preset: CanvasPreset;
  plugins: readonly CanvasPlugin[];
  content: BoardDocument;
  services: EditorServices;
  theme: ThemeMode;
  onChange(next: BoardDocument, options?: ChangeOptions): void;
  setScopes(scopes: readonly ScopeId[]): void;
}

interface Session {
  move(e: CanvasPointerEvent): void;
  up(e: CanvasPointerEvent): void;
  cancel(): void;
  Overlay?: ComponentType<{ api: CanvasApi }>;
}

/** Style clipboard shared by every canvas (Cmd+Alt+C / Cmd+Alt+V). */
let styleClipboard: { type: string; style: StylePreset } | undefined;

let activeLookup: DefinitionLookup = () => undefined;

/** Definition lookup of the most recently mounted canvas (all canvases share the plugin set). */
export function getActiveDefinitionLookup(): DefinitionLookup {
  return activeLookup;
}

const boundsResolverCache = new WeakMap<BoardDocument, BoundsResolver>();

/** Cached bounds resolver per document (used by connector geometry). */
export function boundsResolverFor(doc: BoardDocument): BoundsResolver {
  let r = boundsResolverCache.get(doc);
  if (!r) {
    r = createBoundsResolver(doc, activeLookup);
    boundsResolverCache.set(doc, r);
  }
  return r;
}

export class CanvasEngine implements CanvasApi {
  readonly kind: CanvasKind;
  readonly preset: CanvasPreset;
  readonly store: CanvasStore;
  readonly controller: DocumentController;
  readonly lookup: DefinitionLookup;
  readonly tools: readonly ToolDefinition[];
  private plugins: readonly CanvasPlugin[];
  private servicesRef: EditorServices;
  private onChangeRef: EngineOptions['onChange'];
  private setScopesRef: EngineOptions['setScopes'];
  private session: Session | undefined;
  private sessionOverlay: ComponentType<{ api: CanvasApi }> | undefined;
  private indexCache: { doc: BoardDocument; index: SceneIndex } | undefined;
  private rootEl: HTMLElement | null = null;
  private lastScopes = '';
  private active = false;
  private backtickDown = false;
  private lastPointerScreen: Point | undefined;
  private lastSelectAllAt = 0;
  private pasteCount = 0;
  invertZoom = false;

  constructor(options: EngineOptions) {
    this.kind = options.kind;
    this.preset = options.preset;
    this.plugins = options.plugins;
    this.lookup = createDefinitionLookup(options.plugins);
    activeLookup = this.lookup;
    this.tools = options.plugins.flatMap((p) => p.tools);
    this.servicesRef = options.services;
    this.onChangeRef = options.onChange;
    this.setScopesRef = options.setScopes;
    const initialTool = this.tools.some((t) => t.id === options.preset.initialTool) ? options.preset.initialTool : SELECT_TOOL;
    this.store = createCanvasStore({
      doc: options.content,
      viewport: DEFAULT_VIEWPORT,
      tool: initialTool,
      mode: options.content.settings.mode,
      theme: options.theme,
    });
    const normalizers = options.plugins
      .filter((p) => p.afterChange)
      .map((p) => (next: BoardDocument, prev: BoardDocument) => p.afterChange!(next, prev, this));
    this.controller = new DocumentController(options.content, {
      onCommit: (next, opts) => this.onChangeRef(next, opts),
      onRender: (doc) => {
        const patch: Partial<CanvasState> = { doc };
        if (doc.settings.mode !== this.store.getState().mode) patch.mode = doc.settings.mode;
        this.store.setState(patch);
      },
      normalize: normalizers.length > 0 ? chainNormalizers(normalizers) : undefined,
      getSelection: () => [...this.store.getState().selection],
    });
    this.store.subscribe(() => this.syncScopes());
  }

  /* ------------------------------------------------------------------------------------- */
  /* Host wiring                                                                            */
  /* ------------------------------------------------------------------------------------- */

  /** Called on every render with the latest props. */
  updateProps(options: Pick<EngineOptions, 'services' | 'onChange' | 'setScopes' | 'theme' | 'content'>): void {
    this.servicesRef = options.services;
    this.onChangeRef = options.onChange;
    this.setScopesRef = options.setScopes;
    activeLookup = this.lookup;
    if (options.theme !== this.store.getState().theme) this.store.setState({ theme: options.theme });
    if (this.controller.sync(options.content)) {
      // External change (undo/redo/reload): drop ids that disappeared.
      const sel = this.store.getState().selection;
      const next = normalizeSelection(options.content, sel);
      if (!selectionsEqual(sel, next)) this.store.setState({ selection: next });
      const editing = this.store.getState().editing;
      if (editing && !options.content.elements.some((e) => e.id === editing.id)) this.store.setState({ editing: undefined });
    }
  }

  setRoot(el: HTMLElement | null): void {
    this.rootEl = el;
  }

  get root(): HTMLElement | null {
    return this.rootEl;
  }

  /** Recomputes the active shortcut scopes (SPEC section 6.2) and reports changes. */
  computeScopes(): ScopeId[] {
    const s = this.store.getState();
    const scopes: ScopeId[] = ['canvas'];
    if (this.preset.toolbar !== 'draw') scopes.push(s.mode === 'wireframe' ? 'canvas.wireframe' : 'canvas.diagram');
    const tool = this.getTool(s.tool);
    if (tool?.group === 'freehand') scopes.push('canvas.freehand');
    for (const extra of this.preset.extraScopes ?? []) if (!scopes.includes(extra)) scopes.push(extra);
    if (!s.editing && s.selection.some((id) => this.getElement(id)?.type === 'mindmapNode')) scopes.push('canvas.mindmap');
    if (s.editing) scopes.push('textEdit');
    return scopes;
  }

  /** Only the active tab reports scopes to the host. */
  setActive(active: boolean): void {
    this.active = active;
  }

  syncScopes(force = false): void {
    if (!this.active) return;
    const scopes = this.computeScopes();
    const key = scopes.join('|');
    if (!force && key === this.lastScopes) return;
    this.lastScopes = key;
    this.setScopesRef(scopes);
  }

  /** Restores the selection recorded with an undo/redo step. */
  restoreSelection(selection: unknown): void {
    const ids = Array.isArray(selection) ? selection.filter((x): x is string => typeof x === 'string') : [];
    this.store.setState({ selection: normalizeSelection(this.getDocument(), ids), editing: undefined });
  }

  /* ------------------------------------------------------------------------------------- */
  /* CanvasApi                                                                              */
  /* ------------------------------------------------------------------------------------- */

  get services(): EditorServices {
    return this.servicesRef;
  }

  get theme(): ThemeMode {
    return this.store.getState().theme;
  }

  getDocument(): BoardDocument {
    return this.controller.current;
  }

  getElement<T extends ElementType = ElementType>(id: string): ElementOfType<T> | undefined {
    return this.getDocument().elements.find((e) => e.id === id) as ElementOfType<T> | undefined;
  }

  getDefinition(type: ElementType): ElementDefinition | undefined {
    return this.lookup(type);
  }

  update(recipe: (draft: Draft<BoardDocument>) => void, options?: ChangeOptions): void {
    this.controller.update(recipe, options);
  }

  createId(): string {
    const ids = new Set(this.getDocument().elements.map((e) => e.id));
    let id = newId();
    while (ids.has(id)) id = newId();
    return id;
  }

  getViewport(): Viewport {
    return this.store.getState().viewport;
  }

  setViewport(viewport: Viewport, options?: { animate?: boolean }): void {
    this.animationToken += 1;
    if (options?.animate && typeof requestAnimationFrame === 'function') {
      this.animateViewport(viewport, this.animationToken);
      return;
    }
    this.store.setState({ viewport });
  }

  private animationToken = 0;

  /** Eased viewport animation; lands on the target even when frames are throttled. */
  private animateViewport(target: Viewport, token: number): void {
    const from = this.getViewport();
    const start = performance.now();
    const duration = 180;
    const finish = () => {
      if (token === this.animationToken) this.store.setState({ viewport: target });
    };
    const step = () => {
      if (token !== this.animationToken) return;
      const t = Math.min(1, Math.max(0, (performance.now() - start) / duration));
      const k = 1 - (1 - t) ** 3;
      this.store.setState({
        viewport: { x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, zoom: from.zoom + (target.zoom - from.zoom) * k },
      });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(finish, duration + 120);
  }

  screenToWorld(p: Point): Point {
    return screenToWorld(this.getViewport(), p);
  }

  worldToScreen(p: Point): Point {
    return worldToScreen(this.getViewport(), p);
  }

  zoomToFit(target: 'content' | 'selection'): void {
    const index = this.getIndex();
    const sel = this.store.getState().selection;
    const rect =
      target === 'selection' && sel.length > 0
        ? unionRects(sel.map((id) => index.getBounds(id)).filter((r): r is Rect => !!r))
        : index.contentBounds();
    const size = this.store.getState().size;
    if (!rect || size.w === 0) {
      if (!rect) this.setViewport({ x: -size.w / 2, y: -size.h / 2, zoom: 1 }, { animate: true });
      return;
    }
    this.setViewport(fitRect(rect, size, { padding: 64, maxZoom: target === 'selection' ? 2 : 1 }), { animate: true });
  }

  /** Zooms keeping the viewport centre fixed (keyboard / buttons). */
  zoomTo(zoom: number, anchor?: Point): void {
    const s = this.store.getState();
    this.setViewport(zoomAt(s.viewport, zoom, anchor ?? { x: s.size.w / 2, y: s.size.h / 2 }));
  }

  getSelection(): readonly string[] {
    return this.store.getState().selection;
  }

  setSelection(ids: readonly string[]): void {
    const next = normalizeSelection(this.getDocument(), ids);
    const s = this.store.getState();
    if (selectionsEqual(s.selection, next)) return;
    const patch: Partial<CanvasState> = { selection: next };
    if (s.editing && !next.includes(s.editing.id)) patch.editing = undefined;
    this.store.setState(patch);
  }

  getHoveredId(): string | undefined {
    return this.store.getState().hoveredId;
  }

  getMode(): CanvasMode {
    return this.store.getState().mode;
  }

  setMode(mode: CanvasMode): void {
    if (this.getMode() === mode) return;
    this.store.setState({ mode });
    this.controller.update(
      (d) => {
        d.settings.mode = mode;
      },
      { history: 'skip' },
    );
    // Tools not offered in the new mode fall back to select.
    const tool = this.getTool(this.store.getState().tool);
    if (tool && !tool.modes.includes(mode)) this.setActiveTool(SELECT_TOOL);
  }

  getActiveTool(): string {
    return this.store.getState().tool;
  }

  setActiveTool(toolId: string): void {
    if (!this.getTool(toolId) && toolId !== SELECT_TOOL && toolId !== PAN_TOOL) return;
    if (this.store.getState().tool === toolId) return;
    this.cancelSession();
    this.store.setState({ tool: toolId, editing: undefined });
  }

  getTool(toolId: string): ToolDefinition | undefined {
    return this.tools.find((t) => t.id === toolId);
  }

  startTextEditing(id: string, options?: { selectAll?: boolean; field?: string }): void {
    const el = this.getElement(id);
    if (!el || el.locked) return;
    const def = this.lookup(el.type);
    if (!def?.textEditable) return;
    const prev = this.store.getState().editing;
    this.store.setState({
      selection: [id],
      editing: { id, selectAll: options?.selectAll, field: options?.field, seq: (prev?.seq ?? 0) + 1 },
    });
  }

  stopTextEditing(): void {
    if (!this.store.getState().editing) return;
    this.store.setState({ editing: undefined });
    // Return keyboard focus to the canvas so shortcuts keep working.
    this.rootEl?.focus({ preventScroll: true });
  }

  getEditingId(): string | undefined {
    return this.store.getState().editing?.id;
  }

  getGridSize(): number {
    return GRID_SIZE[this.getMode()];
  }

  snapPoint(p: Point, options?: { excludeIds?: readonly string[] }): Point {
    const mode = this.currentSnapMode();
    const others = this.snapCandidates(new Set(options?.excludeIds ?? []));
    return snapPointPure(p, others, { grid: this.getGridSize(), zoom: this.getViewport().zoom, mode }).point;
  }

  hitTest(p: Point): string | undefined {
    return this.getIndex().hitTest(p, { tolerance: HIT_TOLERANCE_PX / this.getViewport().zoom });
  }

  measureText(text: RichText, style: TextStyle, maxWidth?: number): Size {
    return measureRichText(text, style, maxWidth);
  }

  getStyleFor(styleKey: string): StylePreset | undefined {
    const settings = this.getDocument().settings;
    const def = settings.defaultStyles[styleKey];
    const last = settings.lastUsedStyles[styleKey];
    if (!def && !last) return undefined;
    return { ...(last ?? {}), ...(def ?? {}) };
  }

  rememberStyle(styleKey: string, style: StylePreset): void {
    this.controller.update(
      (d) => {
        d.settings.lastUsedStyles[styleKey] = { ...(d.settings.lastUsedStyles[styleKey] ?? {}), ...style } as Draft<StylePreset>;
      },
      { history: 'skip' },
    );
  }

  openPanel(panelId: string, options?: { anchor?: Point }): void {
    this.store.setState({ panel: { id: panelId, anchor: options?.anchor } });
  }

  closePanel(): void {
    if (this.store.getState().panel) this.store.setState({ panel: undefined });
    this.rootEl?.focus({ preventScroll: true });
  }

  async importImage(file: File | Blob, name?: string): Promise<{ url: string; width: number; height: number }> {
    const bytes = await file.arrayBuffer();
    const fileName = name ?? (file instanceof File ? file.name : 'image.png');
    const result = await this.services.api.assets.importBytes(fileName, bytes);
    if (!result.ok) throw new Error(result.message);
    let { width, height } = result.value;
    if (!width || !height) {
      const dims = await imageSize(file);
      width = dims.w;
      height = dims.h;
    }
    return { url: result.value.url, width: width ?? 0, height: height ?? 0 };
  }

  /* ------------------------------------------------------------------------------------- */
  /* Derived data                                                                           */
  /* ------------------------------------------------------------------------------------- */

  getIndex(): SceneIndex {
    const doc = this.getDocument();
    if (this.indexCache?.doc !== doc) this.indexCache = { doc, index: new SceneIndex(doc, this.lookup) };
    return this.indexCache.index;
  }

  boundsOf(id: string): Rect | undefined {
    return this.getIndex().getBounds(id);
  }

  selectionBounds(ids: readonly string[] = this.getSelection()): Rect | undefined {
    return unionRects(ids.map((id) => this.boundsOf(id)).filter((r): r is Rect => !!r));
  }

  visibleWorldRect(): Rect {
    const s = this.store.getState();
    return visibleWorldRect(s.viewport, s.size);
  }

  getSessionOverlay(): ComponentType<{ api: CanvasApi }> | undefined {
    return this.sessionOverlay;
  }

  getPlugins(): readonly CanvasPlugin[] {
    return this.plugins;
  }

  /** Tools offered by the toolbar for the current mode / preset. */
  availableTools(): ToolDefinition[] {
    const mode = this.getMode();
    return this.tools.filter((t) => t.modes.includes(mode) && (this.preset.toolbar === 'full' || t.group === 'freehand' || t.group === 'select'));
  }

  /** Commits text typed into an element (coalesced into one undo step per editing burst). */
  setElementText(id: string, text: RichText, field?: string): void {
    const el = this.getElement(id);
    const def = el && this.lookup(el.type);
    if (!el || !def?.setText) return;
    this.controller.update(
      (d) => {
        const target = d.elements.find((e) => e.id === id);
        if (target) def.setText!(target as never, text);
      },
      { coalesceKey: `text:${id}${field ? `:${field}` : ''}` },
    );
  }

  /** Translates elements (boxes, connector free ends and waypoints) inside a draft. */
  static translateInDraft(draft: Draft<BoardDocument>, ids: ReadonlySet<string>, dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    for (const el of draft.elements) {
      if (!ids.has(el.id)) continue;
      if (el.type === 'connector') {
        if (el.start.kind === 'free') {
          el.start.x += dx;
          el.start.y += dy;
        }
        if (el.end.kind === 'free') {
          el.end.x += dx;
          el.end.y += dy;
        }
        if (el.waypoints) for (const w of el.waypoints) (w.x += dx), (w.y += dy);
      } else if (isBoxElement(el as BoardElement)) {
        const box = el as Draft<BoardElement> & { x: number; y: number };
        box.x += dx;
        box.y += dy;
      }
    }
  }

  /* ------------------------------------------------------------------------------------- */
  /* Snapping                                                                               */
  /* ------------------------------------------------------------------------------------- */

  private currentSnapMode(native?: { metaKey: boolean }): SnapMode {
    return snapModeFromModifiers({ metaKey: native?.metaKey, backtick: this.backtickDown });
  }

  /** Bounds of nearby, non-excluded, non-connector elements for smart guides. */
  private snapCandidates(exclude: ReadonlySet<string>): Rect[] {
    const view = expandRect(this.visibleWorldRect(), 200 / this.getViewport().zoom);
    const doc = this.getDocument();
    const byId = new Map(doc.elements.map((e) => [e.id, e]));
    const out: Rect[] = [];
    for (const item of this.getIndex().search(view)) {
      if (exclude.has(item.id)) continue;
      const el = byId.get(item.id);
      if (!el || isConnector(el)) continue;
      out.push(item.bounds);
      if (out.length >= 300) break;
    }
    return out;
  }

  setBacktick(down: boolean): void {
    this.backtickDown = down;
  }

  /* ------------------------------------------------------------------------------------- */
  /* Pointer interactions                                                                   */
  /* ------------------------------------------------------------------------------------- */

  private origin(): Point {
    const r = this.rootEl?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top } : { x: 0, y: 0 };
  }

  toCanvasEvent(native: PointerEvent): CanvasPointerEvent {
    return toCanvasPointerEvent(native, this.getViewport(), this.origin());
  }

  hasSession(): boolean {
    return this.session !== undefined;
  }

  /** Escape: cancels a running gesture. Returns true when something was cancelled. */
  cancelSession(): boolean {
    const s = this.session;
    if (!s) return false;
    this.session = undefined;
    this.sessionOverlay = undefined;
    s.cancel();
    this.store.setState({ interacting: false, marquee: undefined, creationRect: undefined, guides: [], resizeLabel: undefined, panning: false });
    return true;
  }

  private startSession(session: Session, pointerId?: number): void {
    this.session = session;
    this.sessionOverlay = session.Overlay;
    if (pointerId !== undefined) {
      try {
        this.rootEl?.setPointerCapture(pointerId);
      } catch {
        /* capture can fail for synthetic events */
      }
    }
  }

  private endSession(): void {
    this.session = undefined;
    this.sessionOverlay = undefined;
    this.store.setState({ interacting: false, marquee: undefined, creationRect: undefined, guides: [], resizeLabel: undefined, panning: false });
  }

  handlePointerDown(native: PointerEvent): void {
    const target = native.target as Element | null;
    if (native.button === 2) return;
    if (target?.closest('[data-wc-interactive]')) return;
    const state = this.store.getState();
    if (state.editing && target?.closest('[data-wc-editing]')) return;
    if (this.session) this.cancelSession();
    if (state.panel) this.closePanel();
    if (state.editing) this.stopTextEditing();
    this.rootEl?.focus({ preventScroll: true });
    native.preventDefault();

    const e = this.toCanvasEvent(native);

    // Pan: middle button, Space held, or the pan tool.
    if (native.button === 1 || state.spaceDown || state.tool === PAN_TOOL) {
      this.startPan(e);
      return;
    }

    // Pen eraser end / button switches to the eraser tool when one exists.
    let toolId = state.tool;
    if (isEraserPointer(native) && this.getTool('draw.eraser')) toolId = 'draw.eraser';

    const handle = target?.closest<HTMLElement>('[data-handle]')?.dataset.handle;
    if (handle && toolId === SELECT_TOOL) {
      if (handle === 'start' || handle === 'end') this.startConnectorEndDrag(e, handle);
      else this.startResize(e, handle as Handle);
      return;
    }

    const tool = toolId !== SELECT_TOOL ? this.getTool(toolId) : undefined;
    if (tool?.onPointerDown) {
      this.startToolSession(tool, e);
      return;
    }
    if (tool?.create) {
      this.startCreate(tool, e);
      return;
    }
    this.startSelect(e);
  }

  handlePointerMove(native: PointerEvent): void {
    const origin = this.origin();
    this.lastPointerScreen = { x: native.clientX - origin.x, y: native.clientY - origin.y };
    if (this.session) {
      this.session.move(this.toCanvasEvent(native));
      return;
    }
    if (native.buttons !== 0) return;
    const target = native.target as Element | null;
    if (target?.closest('[data-wc-chrome]')) return;
    const world = this.screenToWorld(this.lastPointerScreen);
    const hovered = this.store.getState().tool === SELECT_TOOL ? this.hitTest(world) : undefined;
    if (hovered !== this.store.getState().hoveredId) this.store.setState({ hoveredId: hovered });
  }

  handlePointerUp(native: PointerEvent): void {
    const s = this.session;
    if (!s) return;
    this.session = undefined;
    this.sessionOverlay = undefined;
    s.up(this.toCanvasEvent(native));
    this.store.setState({ interacting: false, marquee: undefined, creationRect: undefined, guides: [], resizeLabel: undefined, panning: false });
  }

  handlePointerCancel(): void {
    this.cancelSession();
  }

  handlePointerLeave(): void {
    if (this.store.getState().hoveredId) this.store.setState({ hoveredId: undefined });
  }

  handleDoubleClick(native: MouseEvent): void {
    const target = native.target as Element | null;
    if (target?.closest('[data-wc-interactive]') || target?.closest('[data-wc-editing]')) return;
    if (this.store.getState().tool !== SELECT_TOOL) return;
    const origin = this.origin();
    const world = this.screenToWorld({ x: native.clientX - origin.x, y: native.clientY - origin.y });
    const hit = this.hitTest(world);
    if (hit) {
      this.startTextEditing(hit);
      return;
    }
    // Whimsical: double-click on empty board canvas creates a text (not in wireframe mode).
    const textTool = this.getTool('board.text');
    if (textTool?.create && this.getMode() === 'diagram' && this.preset.toolbar === 'full') {
      this.runCreate(textTool, this.snapPoint(world));
    }
  }

  /** Lets the session know the latest pointer position in screen coordinates. */
  getLastPointerScreen(): Point | undefined {
    return this.lastPointerScreen;
  }

  handleWheel(e: WheelEvent, next: Viewport): void {
    e.preventDefault();
    this.animationToken += 1;
    this.store.setState({ viewport: next });
  }

  /* --- pan ------------------------------------------------------------------------------ */

  private startPan(e: CanvasPointerEvent): void {
    const startScreen = e.screen;
    const startViewport = this.getViewport();
    this.store.setState({ panning: true, interacting: true });
    this.startSession(
      {
        move: (m) => this.store.setState({ viewport: panBy(startViewport, m.screen.x - startScreen.x, m.screen.y - startScreen.y) }),
        up: () => {},
        cancel: () => this.store.setState({ viewport: startViewport }),
      },
      e.pointerId,
    );
  }

  /* --- select / move / marquee ---------------------------------------------------------- */

  private startSelect(e: CanvasPointerEvent): void {
    const doc = this.getDocument();
    const zoom = this.getViewport().zoom;
    const hit = this.getIndex().hitTest(e.world, { tolerance: HIT_TOLERANCE_PX / zoom });
    const before = this.getSelection();

    if (!hit) {
      this.startMarquee(e, e.shiftKey ? before : []);
      return;
    }
    const el = doc.elements.find((x) => x.id === hit);
    if (e.metaKey && el?.type === 'connector') {
      // Cmd+click on a connector body toggles its animation (Whimsical).
      this.controller.update((d) => {
        const c = d.elements.find((x) => x.id === hit) as Draft<ConnectorElement> | undefined;
        if (!c) return;
        if (c.animated) delete c.animated;
        else c.animated = true;
      });
      this.setSelection([hit]);
      return;
    }
    const next = applyClick(doc, before, hit, { shift: e.shiftKey, deep: e.metaKey });
    this.setSelection(next);
    if (e.shiftKey && !next.includes(hit)) return;
    const clickedOnly = applyClick(doc, [], hit, { deep: e.metaKey });
    this.startMove(e, next, clickedOnly);
  }

  private startMarquee(e: CanvasPointerEvent, base: readonly string[]): void {
    const start = e.world;
    this.setSelection(base);
    this.startSession(
      {
        move: (m) => {
          const rect = rectFromPoints(start, m.world);
          const index = this.getIndex();
          const hits = marqueeSelect(this.getDocument(), rect, (id) => index.getBounds(id), this.lookup, index.idsIn(rect));
          this.store.setState({ marquee: rect, interacting: true });
          this.setSelection([...new Set([...base, ...hits])]);
        },
        up: () => {},
        cancel: () => this.setSelection(base),
      },
      e.pointerId,
    );
  }

  private startMove(e: CanvasPointerEvent, selection: readonly string[], clickedTarget: readonly string[]): void {
    const startScreen = e.screen;
    const startWorld = e.world;
    let started = false;
    let moveSet = new Set<string>();
    let startDoc: BoardDocument | undefined;
    let startRect: Rect | undefined;
    let candidates: Rect[] = [];

    const begin = (m: CanvasPointerEvent) => {
      started = true;
      this.controller.begin();
      let ids = selection;
      if (m.altKey) {
        // Alt+drag duplicates: move the copies, keep the originals.
        const doc = this.getDocument();
        const set = collectMoveSet(doc, ids);
        const source = doc.elements.filter((x) => set.has(x.id));
        const clones = cloneElements(source, () => this.createId(), { x: 0, y: 0 });
        this.controller.preview((d) => {
          d.elements.push(...(clones as Draft<BoardElement>[]));
        });
        const map = new Map(source.map((s, i) => [s.id, clones[i]!.id]));
        ids = ids.map((id) => map.get(id)).filter((x): x is string => !!x);
        this.setSelection(ids);
      }
      startDoc = this.controller.current;
      moveSet = collectMoveSet(startDoc, ids);
      const index = this.getIndex();
      startRect = unionRects(
        [...moveSet]
          .filter((id) => !isConnector(startDoc!.elements.find((x) => x.id === id)!))
          .map((id) => index.getBounds(id))
          .filter((r): r is Rect => !!r),
      );
      // Snap candidates are computed once: the document does not change during the gesture.
      candidates = this.snapCandidatesFrom(startDoc, moveSet);
      this.store.setState({ interacting: true, hoveredId: undefined });
    };

    this.startSession(
      {
        move: (m) => {
          if (!started) {
            if (!exceedsDragThreshold(startScreen, m.screen)) return;
            begin(m);
          }
          if (!startDoc || moveSet.size === 0) return;
          let dx = m.world.x - startWorld.x;
          let dy = m.world.y - startWorld.y;
          let guides: CanvasState['guides'] = [];
          if (startRect) {
            const moved = { ...startRect, x: startRect.x + dx, y: startRect.y + dy };
            const snap = snapMovingRect(moved, candidates, {
              grid: this.getGridSize(),
              zoom: this.getViewport().zoom,
              mode: this.currentSnapMode(m),
            });
            dx += snap.dx;
            dy += snap.dy;
            guides = snap.guides;
          }
          this.controller.previewFromBase((d) => CanvasEngine.translateInDraft(d, moveSet, dx, dy), startDoc);
          this.store.setState({ guides });
        },
        up: () => {
          if (!started) {
            // Plain click on a member of a multi-selection selects just that target.
            if (!e.shiftKey && !selectionsEqual(selection, clickedTarget) && selection.length > clickedTarget.length) {
              this.setSelection(clickedTarget);
            }
            return;
          }
          this.controller.commit({}, (d) => this.updateContainment(d, moveSet));
        },
        cancel: () => {
          if (started) this.controller.cancel();
          this.setSelection(selection);
        },
      },
      e.pointerId,
    );
  }

  private snapCandidatesFrom(doc: BoardDocument, exclude: ReadonlySet<string>): Rect[] {
    if (this.getDocument() === doc) return this.snapCandidates(exclude);
    const index = new SceneIndex(doc, this.lookup);
    const view = expandRect(this.visibleWorldRect(), 200 / this.getViewport().zoom);
    const byId = new Map(doc.elements.map((e) => [e.id, e]));
    return index
      .search(view)
      .filter((i) => !exclude.has(i.id) && byId.get(i.id)?.type !== 'connector')
      .slice(0, 300)
      .map((i) => i.bounds);
  }

  /** After a move: elements fully inside a container (section / frame) join it; others leave. */
  private updateContainment(d: Draft<BoardDocument>, moved: ReadonlySet<string>): void {
    const doc = d as unknown as BoardDocument;
    for (const el of d.elements) {
      if (!moved.has(el.id) || el.type === 'connector') continue;
      if (el.containerId && moved.has(el.containerId)) continue;
      const bounds = elementBounds(el as BoardElement, doc, this.lookup);
      const exclude = new Set([el.id]);
      const container = findContainerFor(doc, bounds, this.lookup, exclude);
      if (container && container !== el.id) {
        if (el.containerId !== container) el.containerId = container;
      } else if (el.containerId) {
        delete el.containerId;
      }
    }
  }

  /* --- resize --------------------------------------------------------------------------- */

  private startResize(e: CanvasPointerEvent, handle: Handle): void {
    const doc = this.getDocument();
    const ids = this.getSelection().filter((id) => {
      const el = doc.elements.find((x) => x.id === id);
      return el && !el.locked && isBoxElement(el);
    });
    if (ids.length === 0) return;
    const els = ids.map((id) => doc.elements.find((x) => x.id === id)!) as BoxBoardElement[];
    const single = els.length === 1 ? els[0] : undefined;
    const startBounds = this.selectionBounds(ids);
    if (!startBounds) return;
    const forceAspect = els.some((el) => this.lookup(el.type)?.resize === 'aspect');
    const startWorld = e.world;
    this.controller.begin();
    this.store.setState({ interacting: true, hoveredId: undefined });

    this.startSession(
      {
        move: (m) => {
          const delta = { x: m.world.x - startWorld.x, y: m.world.y - startWorld.y };
          const snapMode = this.currentSnapMode(m);
          const next = resizeRect(startBounds, handle, delta, {
            keepAspect: m.shiftKey || forceAspect,
            fromCenter: m.altKey,
            grid: snapMode === 'none' ? 0 : this.getGridSize(),
            minWidth: 8,
            minHeight: 8,
          });
          this.controller.previewFromBase((d) => {
            for (const src of els) {
              const draftEl = d.elements.find((x) => x.id === src.id);
              if (!draftEl) continue;
              const def = this.lookup(src.type);
              const prevBox: Rect = { x: src.x, y: src.y, w: src.w, h: src.h };
              let box: Rect;
              if (single) {
                const rot = src.rotation;
                box =
                  rot === 90 || rot === 270
                    ? { x: next.x + next.w / 2 - next.h / 2, y: next.y + next.h / 2 - next.w / 2, w: next.h, h: next.w }
                    : next;
              } else if (def?.resize === 'none') {
                const scaled = scaleRectWithin(rotatedBounds(prevBox, src.rotation), startBounds, next);
                const b = rotatedBounds(prevBox, src.rotation);
                box = { ...prevBox, x: prevBox.x + (scaled.x - b.x), y: prevBox.y + (scaled.y - b.y) };
              } else {
                const b = rotatedBounds(prevBox, src.rotation);
                const scaled = scaleRectWithin(b, startBounds, next);
                box =
                  src.rotation === 90 || src.rotation === 270
                    ? { x: scaled.x + scaled.w / 2 - scaled.h / 2, y: scaled.y + scaled.h / 2 - scaled.w / 2, w: scaled.h, h: scaled.w }
                    : scaled;
              }
              if (def?.applyResize) def.applyResize(draftEl as never, box, prevBox);
              else Object.assign(draftEl, { x: box.x, y: box.y, w: box.w, h: box.h });
            }
          });
          this.store.setState({ resizeLabel: { w: Math.round(next.w), h: Math.round(next.h) } });
        },
        up: () => this.controller.commit(),
        cancel: () => this.controller.cancel(),
      },
      e.pointerId,
    );
  }

  /* --- connector end drag (reattach) ---------------------------------------------------- */

  private startConnectorEndDrag(e: CanvasPointerEvent, which: 'start' | 'end'): void {
    const id = this.getSelection()[0];
    const conn = id ? (this.getElement(id) as ConnectorElement | undefined) : undefined;
    if (!conn || conn.type !== 'connector' || conn.locked) return;
    if (e.metaKey) {
      // Cmd+click on an end jumps to the other end.
      const other = which === 'start' ? conn.end : conn.start;
      const g = connectorGeometry(conn, boundsResolverFor(this.getDocument()));
      const p = which === 'start' ? g.end.point : g.start.point;
      const s = this.store.getState().size;
      this.setViewport({ x: p.x - s.w / 2 / this.getViewport().zoom, y: p.y - s.h / 2 / this.getViewport().zoom, zoom: this.getViewport().zoom }, { animate: true });
      if (other.kind === 'attached') this.setSelection([other.elementId]);
      return;
    }
    this.controller.begin();
    this.store.setState({ interacting: true });
    let target: string | undefined;
    this.startSession(
      {
        move: (m) => {
          const index = this.getIndex();
          const hit = index.hitTest(m.world, {
            tolerance: 8 / this.getViewport().zoom,
            exclude: new Set([conn.id]),
            filter: (hid) => {
              const el = this.getElement(hid);
              return !!el && !!this.lookup(el.type)?.connectable;
            },
          });
          target = hit;
          this.controller.preview((d) => {
            const c = d.elements.find((x) => x.id === conn.id) as Draft<ConnectorElement> | undefined;
            if (!c) return;
            const end = hit
              ? attachmentAt(hit, index.getBounds(hit)!, m.world, 10 / this.getViewport().zoom)
              : { kind: 'free' as const, x: m.world.x, y: m.world.y };
            if (which === 'start') c.start = end;
            else c.end = end;
          });
          this.store.setState({ hoveredId: target });
        },
        up: () => this.controller.commit(),
        cancel: () => this.controller.cancel(),
      },
      e.pointerId,
    );
  }

  /* --- tools ---------------------------------------------------------------------------- */

  private startToolSession(tool: ToolDefinition, e: CanvasPointerEvent): void {
    this.controller.begin();
    const session: ToolSession | void = tool.onPointerDown!(e, this);
    if (!session) {
      this.controller.commit();
      if (!tool.persistent) this.setActiveTool(SELECT_TOOL);
      return;
    }
    this.store.setState({ interacting: true, hoveredId: undefined });
    const bump = () => this.store.setState((s) => ({ sessionSeq: s.sessionSeq + 1 }));
    this.startSession(
      {
        move: (m) => {
          session.onPointerMove?.(m);
          bump();
        },
        up: (m) => {
          session.onPointerUp?.(m);
          this.controller.commit();
          if (!tool.persistent) this.setActiveTool(SELECT_TOOL);
        },
        cancel: () => {
          session.onCancel?.();
          this.controller.cancel();
        },
        Overlay: session.Overlay,
      },
      e.pointerId,
    );
    bump();
  }

  private startCreate(tool: ToolDefinition, e: CanvasPointerEvent): void {
    const startScreen = e.screen;
    const startWorld = this.snapPoint(e.world);
    let dragging = false;
    this.startSession(
      {
        move: (m) => {
          if (!dragging && !exceedsDragThreshold(startScreen, m.screen, 4)) return;
          dragging = true;
          const end = this.snapPoint(m.world);
          this.store.setState({ creationRect: rectFromPoints(startWorld, end), interacting: true });
        },
        up: (m) => {
          const rect = dragging ? rectFromPoints(startWorld, this.snapPoint(m.world)) : undefined;
          this.runCreate(tool, startWorld, rect && rect.w > 4 && rect.h > 4 ? rect : undefined);
        },
        cancel: () => {},
      },
      e.pointerId,
    );
  }

  /** Runs a click/drag-to-place tool and applies selection / editing / tool reset rules. */
  runCreate(tool: ToolDefinition, at: Point, rect?: Rect): string[] {
    if (!tool.create) return [];
    const ids = tool.create(this, at, rect);
    if (ids.length > 0) this.setSelection(ids);
    if (!tool.persistent) this.setActiveTool(SELECT_TOOL);
    if (tool.editAfterCreate && ids[0]) this.startTextEditing(ids[0]);
    return ids;
  }

  /** Enter with a creation tool armed: place at the viewport centre (clone extension). */
  createAtViewportCenter(toolId: string): boolean {
    const tool = this.getTool(toolId);
    if (!tool?.create) return false;
    const s = this.store.getState();
    const centre = this.screenToWorld({ x: s.size.w / 2, y: s.size.h / 2 });
    this.runCreate(tool, { x: snapToGrid(centre.x, this.getGridSize()), y: snapToGrid(centre.y, this.getGridSize()) });
    return true;
  }

  /* --- keyboard helpers ----------------------------------------------------------------- */

  setSpaceDown(down: boolean): void {
    if (this.store.getState().spaceDown !== down) this.store.setState({ spaceDown: down });
  }

  /** Cmd+A: select all unlocked; a second Cmd+A within 600 ms includes locked (Cmd+A+A). */
  selectAll(): void {
    const now = Date.now();
    const includeLocked = now - this.lastSelectAllAt < 600;
    this.lastSelectAllAt = now;
    const doc = this.getDocument();
    this.setSelection(doc.elements.filter((e) => includeLocked || !e.locked).map((e) => e.id));
  }

  /** Paste offset counter: repeated pastes cascade. */
  nextPasteOffset(): number {
    this.pasteCount += 1;
    return this.pasteCount;
  }

  resetPasteOffset(): void {
    this.pasteCount = 0;
  }

  getStyleClipboard(): { type: string; style: StylePreset } | undefined {
    return styleClipboard;
  }

  setStyleClipboard(value: { type: string; style: StylePreset }): void {
    styleClipboard = value;
  }

  /** Commits an update keeping the selection on the result. */
  commit(recipe: Recipe, options?: ChangeOptions): void {
    this.controller.update(recipe, options);
  }

  /** Empty rich text helper for tools / quick add. */
  emptyText(): RichText {
    return emptyRichText();
  }

  /** Direction helper used by quick add. */
  static readonly DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
}

function imageSize(file: Blob): Promise<Size> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') {
      resolve({ w: 0, h: 0 });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ w: 0, h: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
