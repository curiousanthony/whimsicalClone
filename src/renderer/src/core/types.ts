/**
 * CORE CONTRACT. Shared TypeScript types for every module of the renderer.
 *
 * Ownership: architect. Parallel module agents must NOT edit this file; request changes
 * instead (see docs/SPEC.md section "Change control"). Implementations live elsewhere:
 *   - shortcut registry  -> core/shortcuts.ts
 *   - undo history       -> core/history.ts
 *   - board file format  -> core/boardFormat.ts
 *   - rich text helpers  -> core/richText.ts
 *   - palette            -> core/palette.ts
 */

import type { ComponentType } from 'react';
import type { Draft } from 'immer';
import type { CanvasKind, FileKind } from '@shared/fileKinds';
import type { DesktopApi, RelPath } from '@shared/ipc';

/* ------------------------------------------------------------------------------------------
 * 1. Geometry
 * ---------------------------------------------------------------------------------------- */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Rect extends Point, Size {}

/** Only 90 degree steps are allowed (Whimsical rule). */
export type Rotation = 0 | 90 | 180 | 270;

export type Direction = 'up' | 'down' | 'left' | 'right';

export type Side = 'top' | 'right' | 'bottom' | 'left';

/* ------------------------------------------------------------------------------------------
 * 2. Colours and text
 * ---------------------------------------------------------------------------------------- */

/** Theme palette hues (Whimsical default theme, see core/palette.ts for values). */
export type PaletteColor =
  | 'white'
  | 'smoke'
  | 'gray'
  | 'slate'
  | 'purple'
  | 'violet'
  | 'blue'
  | 'green'
  | 'darkGreen'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'crimson'
  | 'pink'
  | 'brown';

/** A palette hue name, or a custom colour as "#rrggbb" (custom colours are per board). */
export type ColorRef = PaletteColor | `#${string}`;

/** Whimsical t-shirt text sizes. Board px: xs 13, s 15, m 18, l 21, xl 27, xxl 36. */
export type TextSize = 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl';

export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export type InlineMark = 'bold' | 'italic' | 'strike' | 'code' | 'highlight';

export interface TextSpan {
  text: string;
  marks?: InlineMark[];
  /** External URL or internal link "wc://file/<relPath>[#<elementId>]". */
  href?: string;
}

export type TextBlockType = 'p' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'check' | 'quote' | 'code';

export interface TextBlock {
  type: TextBlockType;
  /** 0-based nesting level (lists / indented paragraphs). */
  indent?: number;
  /** Only for type "check". */
  checked?: boolean;
  /** Only for type "code". */
  language?: string;
  /** Soft line breaks are "\n" inside span text. */
  spans: TextSpan[];
}

/**
 * Rich text stored in canvas elements (sticky notes, shapes, text, mind-map nodes, labels).
 * Human-readable JSON; edited through the canvas RichTextEditor (canvas module).
 */
export interface RichText {
  blocks: TextBlock[];
}

/** lucide icon name in kebab-case, e.g. "star", "circle-user-round". */
export type IconName = string;

/* ------------------------------------------------------------------------------------------
 * 3. Board elements (shared by every canvas kind: board, flowchart, mind map, wireframe, draw)
 * ---------------------------------------------------------------------------------------- */

export interface BaseElement {
  id: string;
  type: ElementType;
  locked?: boolean;
  /** Elements sharing a groupId move/select together (Cmd+G). */
  groupId?: string;
  /** Section or wireframe frame that contains this element (moves with it). */
  containerId?: string;
}

/** Element with a world-space box. Most elements are boxes; connectors are not. */
export interface BoxElement extends BaseElement {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: Rotation;
}

export type FillStyle = 'fill' | 'border' | 'dashed' | 'none';

/** Diagram shapes (Whimsical's 16 + cross). Owner: flowchart module. */
export type ShapeKind =
  | 'rectangle'
  | 'pill'
  | 'oval'
  | 'diamond'
  | 'parallelogram'
  | 'parallelogramFlipped'
  | 'trapezoid'
  | 'triangle'
  | 'hexagon'
  | 'cylinder'
  | 'actor'
  | 'line'
  | 'bracket'
  | 'cloud'
  | 'star'
  | 'cross';

export interface ShapeElement extends BoxElement {
  type: 'shape';
  kind: ShapeKind;
  color: ColorRef;
  fillStyle: FillStyle;
  text: RichText;
  textSize: TextSize;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  icon?: { name: IconName; placement: 'top' | 'left' | 'right' };
  /** Grows downward to fit text unless the user resized height manually. */
  autoHeight: boolean;
  /** Seed for the randomised outline of cloud / star (regenerated on resize). */
  seed?: number;
  /** Line shape only: dashed or solid stroke. */
  dashed?: boolean;
}

export type ConnectorRoute = 'straight' | 'curved' | 'elbow';

/** Whimsical: 8 endpoint styles + none, plus 4 ERD endpoints. */
export type Endpoint =
  | 'none'
  | 'arrow'
  | 'arrowOpen'
  | 'triangle'
  | 'triangleOutline'
  | 'circle'
  | 'circleOutline'
  | 'diamond'
  | 'diamondOutline'
  | 'erdOne'
  | 'erdMany'
  | 'erdOneOrMany'
  | 'erdZeroOrMany';

export type ConnectorEnd =
  | {
      kind: 'attached';
      elementId: string;
      /** "auto" picks the side facing the other end. */
      side: Side | 'auto';
      /** Position along the side, 0..1 (0.5 = middle). */
      t?: number;
      /** Table cell attachment: "<rowId>:<colId>". */
      cell?: string;
    }
  | { kind: 'free'; x: number; y: number };

/** Owner: canvas module (connectors attach to everything). */
export interface ConnectorElement extends BaseElement {
  type: 'connector';
  start: ConnectorEnd;
  end: ConnectorEnd;
  route: ConnectorRoute;
  /** User-moved control points / elbow segment offsets, in world coordinates. */
  waypoints?: Point[];
  color: ColorRef;
  dashed: boolean;
  startEndpoint: Endpoint;
  endEndpoint: Endpoint;
  label?: { text: RichText; t: number; background: boolean; color?: ColorRef };
  /** Cmd+click "Animate connector". */
  animated?: boolean;
}

/** Owner: board module. Square note, purple by default, auto-grows while typing. */
export interface StickyElement extends BoxElement {
  type: 'sticky';
  color: ColorRef;
  text: RichText;
  textSize: TextSize;
  textAlign: TextAlign;
  /** False once the user resizes manually. */
  autoSize: boolean;
}

/** Owner: board module. Free text; cannot rotate. */
export interface TextElement extends BoxElement {
  type: 'text';
  text: RichText;
  textSize: TextSize;
  textAlign: TextAlign;
  color: ColorRef;
  /** Width follows content until the user sets a width. */
  autoWidth: boolean;
}

/** Owner: board module. `src` is an asset URL "wsasset://<hash>.<ext>". */
export interface ImageElement extends BoxElement {
  type: 'image';
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  caption?: RichText;
  showCaption?: boolean;
}

/** Owner: board module. External URL or internal workspace link "wc://file/<relPath>". */
export interface LinkElement extends BoxElement {
  type: 'link';
  url: string;
  title?: string;
  display: 'card' | 'compact';
}

/** Owner: board module. Standalone lucide icon. */
export interface IconElement extends BoxElement {
  type: 'icon';
  icon: IconName;
  color: ColorRef;
}

/** Owner: board module. Named area; container for presenting/export. */
export interface SectionElement extends BoxElement {
  type: 'section';
  name: string;
  color: ColorRef;
  fill: 'solid' | 'outline';
  clip: boolean;
}

export interface TableCell {
  text: RichText;
  background?: ColorRef;
  align?: TextAlign;
}

/** Owner: board module. Cells keyed by "<rowId>:<colId>". */
export interface TableElement extends BoxElement {
  type: 'table';
  columns: { id: string; width: number }[];
  rows: { id: string; height?: number }[];
  cells: Record<string, TableCell>;
  headerRow: boolean;
  tableStyle: 'plain' | 'striped';
  textSize: TextSize;
}

/** Owner: board module. Standalone code block (2026.11). */
export interface CodeElement extends BoxElement {
  type: 'code';
  language: string | 'auto';
  code: string;
}

/**
 * Owner: draw module. Freehand stroke. Points are a flat array [x0,y0,p0, x1,y1,p1, ...]
 * in coordinates LOCAL to (x, y), rounded to 2 decimals; p is pressure 0..1 (stored for
 * fidelity but rendering uses constant width: user decision, no pressure sensitivity).
 * Resizing rescales the points and keeps the stroke width.
 */
export interface StrokeElement extends BoxElement {
  type: 'stroke';
  tool: 'marker' | 'highlighter';
  size: 'thin' | 'thick';
  color: ColorRef;
  points: number[];
  /** Input came from a pen (pointerType "pen"). Informational. */
  isPen?: boolean;
  /** Set by "Detect shapes"; the points are then the idealised outline. */
  detectedShape?: 'rectangle' | 'circle' | 'line' | 'diamond';
}

/** Owner: wireframe module. Component kinds (data-driven registry in editors/wireframe). */
export type WireComponentKind =
  | 'rectangle'
  | 'circle'
  | 'button'
  | 'link'
  | 'divider'
  | 'line'
  | 'image'
  | 'input'
  | 'textarea'
  | 'avatar'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'mobileTabs'
  | 'horizontalTabs'
  | 'verticalTabs'
  | 'loremIpsum'
  | 'blockText'
  | 'heading'
  | 'slider'
  | 'progressBar'
  | 'overlay'
  | 'table'
  | 'toggle'
  | 'tooltip'
  | 'stars'
  | 'video'
  | 'map'
  | 'tag';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface WireElement extends BoxElement {
  type: 'wire';
  component: WireComponentKind;
  size: 'S' | 'M' | 'L';
  /** Component state, e.g. "default" | "focused" | "disabled" | "checked" (per component). */
  state: string;
  /** Accent / semantic colour; undefined = Whimsical's toned-down default. */
  color?: ColorRef;
  text: RichText;
  textSize: TextSize;
  /** Component-specific props (tab labels, options, icon, value...). Schema per component. */
  props: Record<string, JsonValue>;
}

export type DeviceKind =
  | 'plain'
  | 'desktop'
  | 'iphone-14'
  | 'iphone-x'
  | 'iphone-8'
  | 'ipad'
  | 'android'
  | 'android-tablet'
  | 'apple-watch';

/** Owner: wireframe module. Artboard; children reference it via containerId. */
export interface FrameElement extends BoxElement {
  type: 'frame';
  device: DeviceKind;
  name: string;
  statusBar: boolean;
  keyboard: boolean;
  orientation: 'portrait' | 'landscape';
}

/** Owner: wireframe module. Numbered callout; its arrow is a regular connector. */
export interface AnnotationElement extends BoxElement {
  type: 'annotation';
  color: ColorRef;
  text: RichText;
  autoNumber: boolean;
  number?: number;
  icon?: IconName;
  outline: boolean;
}

export type MindMapOrientation = 'horizontal' | 'vertical';
export type MindMapLineStyle = 'curved' | 'elbow';

/**
 * Owner: mindmap module. A mind map is a tree of node elements living on the canvas.
 * The root node (treeParentId === null) carries map-wide settings in `map` and its x/y is
 * the anchor the user moves. x/y/w/h of non-root nodes are COMPUTED by the mind-map layout
 * (written in the same update that changes the tree) and must not be edited elsewhere.
 */
export interface MindMapNodeElement extends BoxElement {
  type: 'mindmapNode';
  /** Id of the root node of this map (equal to own id for the root). */
  rootId: string;
  treeParentId: string | null;
  /** Sort key among siblings (fractional indexing allowed). */
  order: number;
  /** First-level branches only: side of the root they grow on. */
  side?: Side;
  text: RichText;
  textSize: TextSize;
  icon?: { name: IconName; placement: 'left' | 'right' };
  collapsed?: boolean;
  /** Branch colour; children inherit unless overridden. */
  color?: ColorRef;
  /** Only on the root. */
  map?: { orientation: MindMapOrientation; lineStyle: MindMapLineStyle };
}

export type BoardElement =
  | ShapeElement
  | ConnectorElement
  | StickyElement
  | TextElement
  | ImageElement
  | LinkElement
  | IconElement
  | SectionElement
  | TableElement
  | CodeElement
  | StrokeElement
  | WireElement
  | FrameElement
  | AnnotationElement
  | MindMapNodeElement;

export type ElementType =
  | 'shape'
  | 'connector'
  | 'sticky'
  | 'text'
  | 'image'
  | 'link'
  | 'icon'
  | 'section'
  | 'table'
  | 'code'
  | 'stroke'
  | 'wire'
  | 'frame'
  | 'annotation'
  | 'mindmapNode';

export type ElementOfType<T extends ElementType> = Extract<BoardElement, { type: T }>;

export type BoxBoardElement = Exclude<BoardElement, ConnectorElement>;

/* ------------------------------------------------------------------------------------------
 * 4. Board document (.wboard / .wflow / .wmind / .wwire / .wdraw)
 * ---------------------------------------------------------------------------------------- */

export const BOARD_FORMAT = 'whimsical-clone/board' as const;
export const BOARD_VERSION = 1 as const;

export type CanvasMode = 'diagram' | 'wireframe';

/** Style properties remembered per element type ("last used" and "Save as default style"). */
export type StylePreset = Record<string, JsonValue>;

export interface BoardSettings {
  /** Last mode used (Whimsical toggles with W / Q). */
  mode: CanvasMode;
  /** Colour theme id (only "whimsical" for now). */
  theme: 'whimsical';
  /** Custom colours added with "+" in the colour picker (per board). */
  customColors: `#${string}`[];
  /** "Save as default style" (Cmd+Shift+D), keyed by element type (and shape kind / wire component). */
  defaultStyles: Record<string, StylePreset>;
  /** Last-used style per element key; new objects follow suit. */
  lastUsedStyles: Record<string, StylePreset>;
  /** Next annotation number counter. */
  nextAnnotationNumber?: number;
}

export interface BoardDocument {
  format: typeof BOARD_FORMAT;
  version: typeof BOARD_VERSION;
  kind: CanvasKind;
  settings: BoardSettings;
  /** Z-ordered, back to front. Ids are unique within the document. */
  elements: BoardElement[];
  /** Unknown top-level keys from newer versions are preserved here on load. */
  extra?: Record<string, JsonValue>;
}

/** Docs content is the Markdown text itself (.md). */
export type DocContent = string;

/* ------------------------------------------------------------------------------------------
 * 5. Shortcut registry
 * ---------------------------------------------------------------------------------------- */

/**
 * Scopes, resolved INNERMOST FIRST (index 0 wins):
 *   textEdit > folderView > canvas.mindmap > canvas.freehand > canvas.wireframe | canvas.diagram >
 *   canvas > docs > app
 * textEdit and folderView are focus-based, so they outrank document scopes. While the sidebar
 * / a folder view has focus the shell also deactivates editor scopes (active = folderView only).
 */
export type ScopeId =
  | 'app'
  | 'folderView'
  | 'docs'
  | 'canvas'
  | 'canvas.diagram'
  | 'canvas.wireframe'
  | 'canvas.freehand'
  | 'canvas.mindmap'
  | 'textEdit';

export const SCOPE_PRIORITY: readonly ScopeId[] = [
  'textEdit',
  'folderView',
  'canvas.mindmap',
  'canvas.freehand',
  'canvas.wireframe',
  'canvas.diagram',
  'canvas',
  'docs',
  'app',
];

/** Sections of the keyboard-shortcut help sheet (labels: common:shortcutGroups.<id>). */
export type ShortcutGroup =
  | 'general'
  | 'file'
  | 'tabs'
  | 'zoom'
  | 'selection'
  | 'arrange'
  | 'edit'
  | 'text'
  | 'tools'
  | 'diagram'
  | 'quickAdd'
  | 'connectors'
  | 'sticky'
  | 'wireframe'
  | 'freehand'
  | 'mindmap'
  | 'docs'
  | 'docsBlocks'
  | 'docsTables'
  | 'markdown'
  | 'folder';

/**
 * Static shortcut data. Shortcuts are DATA: the same table drives keyboard dispatch, native
 * menu accelerators (display), tooltips, the command menu and the help sheet.
 */
export interface ShortcutDef {
  /** Command id, unique app-wide: "<module>.<camelCase>", e.g. "canvas.zoomIn". */
  id: string;
  /** Key combos (see @shared/keys grammar). Empty for gesture-only entries. */
  keys: string[];
  /** Display-only pointer gestures, tokens joined by "+", e.g. "Space+Drag", "Mod+Click". */
  gestures?: string[];
  scope: ScopeId;
  /** i18n key "<ns>:<path>", e.g. "canvas:commands.zoomIn". */
  labelKey: string;
  group: ShortcutGroup;
  /**
   * "registry" (default): dispatched by the shortcut registry when a handler is bound.
   * "native": handled by the focused component itself (TipTap keymaps, markdown input
   * rules); listed for help/tooltips/menus only.
   */
  dispatch?: 'registry' | 'native';
  /** Fire even when focus is in a text input / contenteditable. */
  allowInTextInput?: boolean;
  /** Fire on auto-repeat (held key). Default false except nudges. */
  repeat?: boolean;
  /** Not in Whimsical; clone extension (shown with a marker in the help sheet). */
  extension?: boolean;
  /** Hide from the help sheet (aliases). */
  hidden?: boolean;
  /** lucide icon name for command menu / menus. */
  icon?: string;
}

/** Runtime handler bound by a mounted component for a command id. */
export interface ShortcutHandler {
  id: string;
  run: (ctx: CommandContext) => void | boolean | Promise<void>;
  /** When false the key falls through to outer scopes. Default true. */
  isEnabled?: () => boolean;
}

export interface CommandContext {
  /** "keyboard" | "menu" | "commandMenu" | "toolbar". */
  source: 'keyboard' | 'menu' | 'commandMenu' | 'toolbar';
  event?: KeyboardEvent;
}

export type Unregister = () => void;

export interface ShortcutRegistryApi {
  /** Adds static definitions (module tables). Duplicate ids throw. */
  define(defs: readonly ShortcutDef[]): Unregister;
  /** Binds runtime handlers (usually while a component is mounted/active). */
  bind(handlers: readonly ShortcutHandler[]): Unregister;
  /** Inner scopes currently active, in addition to "app" (which is always active). */
  setActiveScopes(scopes: readonly ScopeId[]): void;
  getActiveScopes(): readonly ScopeId[];
  /** Keyboard entry point; returns true (and preventDefault) when handled. */
  handleKeyDown(event: KeyboardEvent): boolean;
  /** Runs a command by id from menus / command menu / toolbar. Returns false if unbound. */
  run(id: string, ctx: CommandContext): boolean;
  isBound(id: string): boolean;
  getDef(id: string): ShortcutDef | undefined;
  getDefs(): readonly ShortcutDef[];
  /** Primary combo formatted for display ("⌘⇧D"), or undefined. */
  format(id: string): string | undefined;
  /** Primary combo as an Electron accelerator for menus, or undefined. */
  accelerator(id: string): string | undefined;
  subscribe(listener: () => void): Unregister;
}

/* ------------------------------------------------------------------------------------------
 * 6. Undo history (host-owned for JSON editors)
 * ---------------------------------------------------------------------------------------- */

export interface ChangeOptions {
  /**
   * Consecutive changes with the same key within the coalescing window (1000 ms) merge into
   * one undo step (typing in a node, dragging a slider). Drags should commit once on
   * pointer-up instead of streaming changes.
   */
  coalesceKey?: string;
  /** "skip": apply without recording (normalisation, migrations, layout caches). */
  history?: 'push' | 'skip';
  /** Opaque editor selection to restore on undo/redo (e.g. selected element ids). */
  selection?: unknown;
}

export interface HistoryAction {
  kind: 'undo' | 'redo';
  /** Selection recorded with the restored state. */
  selection?: unknown;
  /** Monotonic counter so editors can react in useEffect. */
  seq: number;
}

/* ------------------------------------------------------------------------------------------
 * 7. Editor plugin contract (one per file kind)
 * ---------------------------------------------------------------------------------------- */

export interface EditorServices {
  /** Desktop bridge (window.api). */
  api: DesktopApi;
  /** Opens another workspace file in a tab (or focuses it). */
  openFile(path: RelPath, options?: { newTab?: boolean; elementId?: string }): void;
  /** Per-viewer state for this file (viewport, collapsed toggles...). Not saved in the file. */
  getViewState<T>(key: string): T | undefined;
  setViewState(key: string, value: unknown): void;
  /** Transient toast. `messageKey` is an i18n key. */
  notify(messageKey: string, options?: { kind?: 'info' | 'error'; values?: Record<string, unknown> }): void;
}

export interface EditorProps<T> {
  /** Workspace-relative path of the open file. */
  filePath: RelPath;
  /** File name without extension. */
  title: string;
  /** Parsed, immutable document content. Never mutate; produce a new value. */
  content: T;
  /** Commit a new content value. The host records history (if historyMode "host") and autosaves. */
  onChange(next: T, options?: ChangeOptions): void;
  /**
   * Bind runtime handlers for command ids declared in the plugin's shortcut table. Handlers
   * only fire while this editor tab is active. Returns an unregister function.
   */
  registerShortcuts(handlers: readonly ShortcutHandler[]): Unregister;
  /** Declare which inner scopes are active now (e.g. ["canvas", "canvas.diagram"]). */
  setScopes(scopes: readonly ScopeId[]): void;
  /** True when this tab is the visible, focused editor. */
  isActive: boolean;
  /** Last undo/redo applied by the host (historyMode "host" only). */
  lastHistoryAction?: HistoryAction;
  services: EditorServices;
}

export interface EditorPlugin<T = unknown> {
  kind: FileKind;
  /** Extensions handled, including the dot. The first one is used for new files. */
  extensions: readonly string[];
  /** i18n key of the file type name, e.g. "common:fileKinds.flowchart". */
  labelKey: string;
  /** i18n key of the default name of a new file, e.g. "common:newFile.flowchart". */
  newFileNameKey: string;
  /** lucide-react icon component name. */
  icon: string;
  /**
   * "host": the shell keeps snapshot history of `content` and handles Cmd+Z / Cmd+Shift+Z.
   * "editor": the editor owns history (TipTap) and must bind "edit.undo" / "edit.redo".
   */
  historyMode: 'host' | 'editor';
  createEmpty(): T;
  /** Parse file text (with migrations). Throw a descriptive Error on invalid content. */
  parse(text: string, path: RelPath): T;
  /** Deterministic, human-readable serialisation. */
  serialize(content: T): string;
  /** Static shortcut table of this editor (registered by the app at startup). */
  shortcuts: readonly ShortcutDef[];
  /** The editor component (React.lazy is fine; the host wraps it in Suspense). */
  component: ComponentType<EditorProps<T>>;
}

/* ------------------------------------------------------------------------------------------
 * 8. Canvas engine plugin contract
 *
 * One canvas engine (src/renderer/src/canvas, owner: canvas module) renders every canvas
 * kind. Each canvas module (flowchart, board, wireframe, draw, mindmap) contributes element
 * definitions, tools, shortcut tables and commands through a CanvasPlugin. All plugins are
 * loaded for every canvas file, so a sticky note or a stroke can live in any board.
 * ---------------------------------------------------------------------------------------- */

export type CanvasModuleId = 'canvas' | 'flowchart' | 'board' | 'wireframe' | 'draw' | 'mindmap';

/** World point at the top-left of the viewport and zoom factor. screen = (world - {x,y}) * zoom. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type ThemeMode = 'light' | 'dark';

export interface CanvasPointerEvent {
  world: Point;
  screen: Point;
  button: number;
  buttons: number;
  pointerId: number;
  pointerType: 'mouse' | 'pen' | 'touch';
  pressure: number;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  /** Coalesced samples in world coordinates (high-rate pen input), including this one. */
  samples: Array<Point & { pressure: number }>;
  native: PointerEvent;
}

/** A pointer interaction started by a tool; the engine routes the rest of the gesture to it. */
export interface ToolSession {
  onPointerMove?(e: CanvasPointerEvent): void;
  onPointerUp?(e: CanvasPointerEvent): void;
  /** Escape or pointercancel: restore state, commit nothing. */
  onCancel?(): void;
  /** Optional transient overlay drawn in world coordinates while the session runs. */
  Overlay?: ComponentType<{ api: CanvasApi }>;
}

export type ToolbarGroup =
  | 'select'
  | 'shapes'
  | 'sticky'
  | 'mindmap'
  | 'connector'
  | 'text'
  | 'section'
  | 'table'
  | 'image'
  | 'link'
  | 'icon'
  | 'freehand'
  | 'wireframeComponents'
  | 'wireframeFrames'
  | 'annotation'
  | 'allTools';

export interface ToolDefinition {
  /** Tool id, e.g. "flowchart.rectangle". Usually equal to the command id of its shortcut. */
  id: string;
  module: CanvasModuleId;
  labelKey: string;
  /** lucide-react icon component name. */
  icon: string;
  /** Command id whose shortcut activates this tool (for tooltips). */
  shortcutId?: string;
  group: ToolbarGroup;
  /** Modes in which the tool is offered in the toolbar. */
  modes: readonly CanvasMode[];
  /** Search keywords for the "All tools" menu (i18n key of a comma-separated list). */
  keywordsKey?: string;
  cursor?: string;
  /**
   * Click/drag-to-place tools implement `create`: the engine handles the gesture (click =
   * default size at point, drag = rect) and selects the result. Return the new element ids.
   */
  create?(api: CanvasApi, at: Point, rect?: Rect): string[];
  /** Custom interaction tools (pen, eraser, connector) implement `onPointerDown` instead. */
  onPointerDown?(e: CanvasPointerEvent, api: CanvasApi): ToolSession | void;
  /** Keep the tool active after one use (pen, eraser). Default false (back to select). */
  persistent?: boolean;
  /** Text-editable creations enter text editing immediately (shapes, stickies, text). */
  editAfterCreate?: boolean;
}

export interface ElementRenderProps<E extends BoardElement = BoardElement> {
  element: E;
  /** The whole document (for elements depending on others, e.g. connectors, mind maps). */
  document: BoardDocument;
  selected: boolean;
  /** This element's text is being edited (render the editor host instead of static text). */
  editing: boolean;
  /** Pointer is over the element (Whimsical hover highlight). */
  hovered: boolean;
  zoom: number;
  theme: ThemeMode;
  mode: CanvasMode;
  api: CanvasApi;
}

export interface ContextBarProps<E extends BoardElement = BoardElement> {
  /** All selected elements of this definition's type. */
  elements: readonly E[];
  api: CanvasApi;
}

export interface ElementDefinition<E extends BoardElement = BoardElement> {
  type: E['type'];
  module: CanvasModuleId;
  /**
   * "box": the engine wraps Render in an absolutely positioned container at x/y/w/h
   * (rotation applied) and Render draws in LOCAL coordinates (0..w, 0..h).
   * "world": Render draws in WORLD coordinates in a full-canvas SVG layer (connectors).
   */
  layer: 'box' | 'world';
  Render: ComponentType<ElementRenderProps<E>>;
  /** World-space bounds (for connectors computed from their ends). */
  getBounds(element: E, document: BoardDocument): Rect;
  /** Precise hit test in world coordinates; default: inside bounds. */
  hitTest?(element: E, world: Point, tolerance: number, document: BoardDocument): boolean;
  /** Resize behaviour of the selection handles. */
  resize: 'free' | 'aspect' | 'width' | 'none';
  rotatable: boolean;
  /** Connectors can attach to it (purple target box). */
  connectable: boolean;
  /** Enter / double-click edits its text. */
  textEditable: boolean;
  /** Section / frame: elements dropped inside get containerId = this id. */
  container?: boolean;
  /** Quick add (Alt+Arrow and hover "+" buttons) clones this element; connect = add a connector. */
  quickAdd?: { connect: boolean };
  /** Property names treated as "style" (copy/paste style, last-used, default style). */
  styleProps?: readonly string[];
  getText?(element: E): RichText | undefined;
  setText?(draft: Draft<E>, text: RichText): void;
  /** Custom resize (strokes rescale points); default assigns x/y/w/h. */
  applyResize?(draft: Draft<E>, next: Rect, previous: Rect): void;
  /** Contextual toolbar section for this type (engine adds common controls). */
  ContextBar?: ComponentType<ContextBarProps<E>>;
  /** Normalise / migrate an element on load (fill defaults). Must be pure. */
  normalize?(element: E): E;
}

export interface CanvasPanelProps {
  api: CanvasApi;
  onClose(): void;
  /** Anchor in screen coordinates (toolbar button or cursor). */
  anchor?: Point;
}

export interface CanvasLayerProps {
  document: BoardDocument;
  viewport: Viewport;
  theme: ThemeMode;
  api: CanvasApi;
}

export interface CanvasPlugin {
  id: CanvasModuleId;
  elements: readonly ElementDefinition<any>[];
  tools: readonly ToolDefinition[];
  shortcuts: readonly ShortcutDef[];
  /** Runtime handlers for this plugin's command ids, created when a canvas mounts. */
  createCommands?(api: CanvasApi): ShortcutHandler[];
  /** World-space layers drawn below / above all elements (mind-map branches, guides). */
  layers?: { below?: ComponentType<CanvasLayerProps>; above?: ComponentType<CanvasLayerProps> };
  /** Popover panels opened by id via api.openPanel (shapes menu, component launcher...). */
  panels?: Record<string, ComponentType<CanvasPanelProps>>;
  /** Called after any committed change, may return a normalised document (e.g. mind-map relayout). */
  afterChange?(next: BoardDocument, previous: BoardDocument, api: CanvasApi): BoardDocument;
}

export interface CanvasPreset {
  kind: CanvasKind;
  /** Mode used when the file has never been opened. */
  initialMode: CanvasMode;
  /** Tool active on open (e.g. "draw.marker" for .wdraw). */
  initialTool: string;
  /** "full" = Whimsical board toolbar; "draw" = pen tools only (+ select / pan). */
  toolbar: 'full' | 'draw';
  /** Extra inner scopes always active for this kind (e.g. ["canvas.freehand"] for draw). */
  extraScopes?: readonly ScopeId[];
}

export interface TextStyle {
  textSize: TextSize;
  bold?: boolean;
  /** Wireframe text uses a smaller scale. */
  scale?: 'board' | 'wireframe';
}

/**
 * Imperative API of a mounted canvas, given to tools, element renderers, panels, commands.
 * Implemented by the canvas engine.
 */
export interface CanvasApi {
  readonly kind: CanvasKind;
  getDocument(): BoardDocument;
  getElement<T extends ElementType = ElementType>(id: string): ElementOfType<T> | undefined;
  getDefinition(type: ElementType): ElementDefinition | undefined;
  /** Commit a change (one undo step unless coalesced). */
  update(recipe: (draft: Draft<BoardDocument>) => void, options?: ChangeOptions): void;
  createId(): string;

  getViewport(): Viewport;
  setViewport(viewport: Viewport, options?: { animate?: boolean }): void;
  screenToWorld(p: Point): Point;
  worldToScreen(p: Point): Point;
  zoomToFit(target: 'content' | 'selection'): void;

  getSelection(): readonly string[];
  setSelection(ids: readonly string[]): void;
  getHoveredId(): string | undefined;

  getMode(): CanvasMode;
  setMode(mode: CanvasMode): void;
  getActiveTool(): string;
  setActiveTool(toolId: string): void;

  /** Starts text editing of an element (Enter / double-click / after create). */
  startTextEditing(id: string, options?: { selectAll?: boolean; field?: string }): void;
  stopTextEditing(): void;
  getEditingId(): string | undefined;

  /** Grid size of the current mode (12 px diagram, 1 px wireframe). */
  getGridSize(): number;
  /** Snap a world point (grid + smart guides) honouring Cmd / backtick modifiers. */
  snapPoint(p: Point, options?: { excludeIds?: readonly string[] }): Point;
  /** Top-most element at a world point (respects locked/hit tests). */
  hitTest(p: Point): string | undefined;
  /** Text measurement used for auto-size (sticky, shape height, mind-map nodes). */
  measureText(text: RichText, style: TextStyle, maxWidth?: number): Size;

  /** Style for a new element: default style > last used > definition defaults. */
  getStyleFor(styleKey: string): StylePreset | undefined;
  rememberStyle(styleKey: string, style: StylePreset): void;

  openPanel(panelId: string, options?: { anchor?: Point }): void;
  closePanel(): void;
  /** Imports an image into the workspace asset store. */
  importImage(file: File | Blob, name?: string): Promise<{ url: string; width: number; height: number }>;
  readonly services: EditorServices;
  readonly theme: ThemeMode;
}
