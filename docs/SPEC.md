# Whimsical Clone: Product and Architecture Specification

Status: v1 (architect), 2026-10-07. Source research: `docs/research/00-07`. Where research files disagree, `00-user-decisions.md` wins, then this SPEC.

Conventions: Mac key notation `⌘` Command (`Mod` in code), `⌥` Option (`Alt`), `⇧` Shift, `⌃` Control (`Ctrl`). "Whimsical" means the real product; "the clone" means this app. A row marked **ext** is a clone extension that Whimsical does not have.

---

## 1. Product

A local-first macOS desktop app that reproduces Whimsical's look, feel, icons placement and keyboard model, without collaboration or cloud.

### 1.1 In scope

| Area | What the clone does |
|---|---|
| Boards | Infinite canvas with the full Whimsical board toolset: sticky notes, text, diagram shapes (16 + cross), connectors, images, links, icons, sections, tables, code blocks, freehand pen, mind maps, wireframe mode (components, frames, annotations). |
| Flowcharts | A board opened in diagram mode. Keyboard-only creation: shape keys, `⌥+Arrow` quick add, `Enter` to edit, arrows / `Tab` / `⌥⇧+Arrow` to move between shapes. |
| Mind maps | Tree of nodes with automatic layout (horizontal or vertical, curved or elbow lines), Whimsical keyboard model (`Tab`, `Enter`, `⌘↩`, `⌥↩`, arrows, `⌘/`...). |
| Wireframes | Board in wireframe mode: 29 components, 9 device frames, annotations, 1 px grid, toned-down colours. |
| Drawing | Minimal pen: marker thin/thick, highlighter, eraser (whole stroke), selector, Detect shapes. Pointer Events (pen works as a pointer). **No pressure-sensitive width** (user decision); pressure is stored per point for fidelity but rendering is constant width. |
| Docs | Markdown notes (`.md`) with Whimsical's block menu, input rules, shortcuts, toggles, callouts, tables, code blocks. |
| Shell | Workspace folder picker, sidebar file tree (folders = folders, files = boards/docs), Recent and Favorites, tabs, title bar, command menu (`⌘K`), search (`⌘F`, `⌘J`), preferences (theme, language, invert zoom), keyboard-shortcut help sheet (`?`), native macOS menu bar, export (PNG/SVG/PDF/Markdown), autosave. |
| i18n | Every user-visible string through i18next from day one; English shipped, French added by dropping locale files. |

### 1.2 Out of scope

Collaboration, sharing links, comments, mentions of people, presence, inbox, cloud sync, AI/agents/MCP, voting, timer, cards/task mode, version history in the cloud, multi-page files (later), Mermaid import/export (later), import from other whiteboard tools.

### 1.3 Product model (decided)

Whimsical merged flowcharts, wireframes, sticky notes, mind maps and freehand into one file type: **Board**. The clone keeps the five canvas file kinds the user asked for, but they are **presets of one canvas engine with one file format**. Every canvas file can contain every object type.

| File kind | Extension | Preset: initial mode / tool / toolbar | Notes |
|---|---|---|---|
| Board | `.wboard` | diagram / select / full | General Whimsical board. |
| Flowchart | `.wflow` | diagram / select / full | Same as board; flowchart-focused new-file template. |
| Mind map | `.wmind` | diagram / select / full | New file seeded with one root node. Mind maps can also be added to any board with `M`. |
| Wireframe | `.wwire` | wireframe / select / full | Opens in wireframe mode (1 px grid). |
| Drawing | `.wdraw` | diagram / marker / pen-only toolbar | Standalone sketch; scope `canvas.freehand` always on. Strokes are the same `stroke` elements used in every board. |
| Doc | `.md` (`.markdown` accepted) | n/a | Markdown text file. |

---

## 2. Architecture

### 2.1 Stack

Electron 44 + electron-vite 5 (Vite 7) + React 18.3 + TypeScript 5.9 (strict, `noUncheckedIndexedAccess`) + Zustand 5 + Immer 11 + i18next 26 / react-i18next 17 + TipTap 3 (+ tiptap-markdown, @tiptap/markdown available) + perfect-freehand + lucide-react 1.52 (only icon set) + @floating-ui/react + dagre (flowchart auto-layout) + d3-hierarchy (mind-map layout helpers) + rbush (spatial index) + fuse.js (search) + zod (optional validation) + chokidar 5 (watcher, main) + Vitest 4 / Testing Library / jsdom. All dependencies are installed; **agents never run `npm install`**. If a package is truly missing, report it instead.

### 2.2 Directory layout

```
whimsicalClone/
  package.json  electron.vite.config.ts  electron-builder.yml  vitest.config.ts
  tsconfig.json  tsconfig.node.json (main, preload, shared)  tsconfig.web.json (renderer, shared)
  build/entitlements.mac.plist   resources/   scripts/sync-locales.mjs
  docs/SPEC.md  docs/research/*
  src/
    shared/                       # pure TS usable by main, preload AND renderer (no DOM, no Node APIs)
      fileKinds.ts                # kinds, extensions, asset protocol, metadata dir names
      ipc.ts                      # IPC channel names + DesktopApi + payload types
      menu.ts                     # MenuSpec (renderer -> main native menu)
      keys.ts                     # key-combo grammar: parse, match, format, toAccelerator
      i18n/resources.ts           # namespaces, en static imports, other languages auto-discovered
      i18n/locales/<lng>/<ns>.json
    main/                         # Electron main process
      index.ts                    # app lifecycle, BrowserWindow, protocol (stub today)
      (ipc/*.ts, watcher.ts, menu.ts, prefs.ts, paths.ts ... to be added by the platform agent)
    preload/index.ts              # contextBridge window.api (complete; contract)
    renderer/
      index.html
      src/
        main.tsx                  # boot: prefs + locale -> i18n -> <App/>
        env.d.ts                  # window.api typing
        app/                      # composition root
          App.tsx                 # providers, global keydown -> registry
          editors.ts              # FROZEN: editor registry, canvas plugin list, all shortcut tables
        core/                     # FROZEN contracts + small shared implementations
          types.ts                # ALL shared types (schemas, contracts)
          shortcuts.ts            # ShortcutRegistry + useShortcutLabel + formatGesture
          shortcutTable.ts        # shortcutTable() helper
          history.ts              # SnapshotHistory
          boardFormat.ts          # parse/serialize/migrate board files
          editorRegistry.ts       # extension -> editor map
          canvasPlugins.ts        # CanvasPluginsContext
          palette.ts              # Whimsical colour theme, resolveColor, text sizes, grid
          richText.ts  ids.ts
        canvas/                   # shared canvas engine (one for all canvas kinds)
        editors/
          flowchart/  board/  wireframe/  draw/  mindmap/   # canvas plugins + presets
          docs/                                           # TipTap Markdown editor
        shell/                    # sidebar, tabs, title bar, editor host, command menu, search, prefs, help
        ui/                       # shared presentational primitives (Button, IconButton, Tooltip, Popover, Menu, ColorPicker...)
        i18n/                     # i18next init, translateKey, typed keys
        styles/                   # tokens.css (design tokens), global.css
        test/setup.ts
```

Path aliases: `@shared/*` -> `src/shared/*`, `@renderer/*` -> `src/renderer/src/*` (Vite, TS and Vitest).

### 2.3 Module ownership (parallel agents)

Each agent edits **only** the paths it owns. Everything else is read-only for it. Cross-module needs go through the public `index.ts` of a module or a change request to the architect.

| Module / agent | Owns (may create/edit) | Public API consumed by others |
|---|---|---|
| **architect** (frozen) | `src/shared/**` except locale files of other namespaces, `src/preload/**`, `src/renderer/src/core/**`, `src/renderer/src/app/editors.ts`, `src/renderer/src/i18n/**`, `styles/tokens.css`, configs, `package.json`, `docs/SPEC.md` | `core/types.ts` and friends |
| **platform** (main process) | `src/main/**` | IPC channels in `@shared/ipc` |
| **shell** | `src/renderer/src/shell/**`, `src/renderer/src/app/App.tsx` (+ new files in `app/` except `editors.ts`), `styles/global.css`, `locales/*/shell.json`, `locales/*/menu.json`, `locales/*/common.json` (additions only; others ask) | `EditorServices`, editor host |
| **ui** | `src/renderer/src/ui/**` | primitives (`ui/index.ts`) |
| **canvas** | `src/renderer/src/canvas/**`, `locales/*/canvas.json` | `canvas/index.ts`: `createCanvasEditorPlugin`, `canvasCorePlugin`, plus helpers it chooses to export (RichTextEditor, ColorPicker for elements, geometry utils) |
| **flowchart** | `editors/flowchart/**`, `locales/*/flowchart.json` | `editors/flowchart/index.ts` |
| **board** | `editors/board/**`, `locales/*/board.json` | `editors/board/index.ts` |
| **wireframe** | `editors/wireframe/**`, `locales/*/wireframe.json` | `editors/wireframe/index.ts` |
| **draw** | `editors/draw/**`, `locales/*/draw.json` | `editors/draw/index.ts` |
| **mindmap** | `editors/mindmap/**`, `locales/*/mindmap.json` | `editors/mindmap/index.ts` |
| **docs** | `editors/docs/**`, `locales/*/docs.json` | `editors/docs/index.ts` |

If `ui` has no dedicated agent, the shell agent owns it. `ui/` is empty at scaffold time: editor agents must not wait for it; they build small module-local components (styled with the `--wc-*` tokens) and may later switch to `ui/` exports.

**Scaffold status (what is stubbed).** Main implements only `prefs.get`, `app.getLocale`, `app.getSystemDarkMode` and `workspace.pick`; every other IPC channel must be implemented by the platform agent before the shell can open a workspace. `CanvasEditor`, `DocsEditor` and `ShellRoot` render placeholders; all canvas plugins have empty `elements`/`tools` but complete shortcut tables. `core/*`, `@shared/*`, `preload`, i18n and tokens are complete. Editor modules may import from `@renderer/core/*`, `@renderer/ui`, `@renderer/canvas` (public index only), `@renderer/i18n`, `@shared/*`, and npm packages. They never import another editor module or `shell/`.

**Change control.** `core/types.ts`, `@shared/ipc.ts`, `@shared/keys.ts`, `app/editors.ts` are frozen. An agent that needs a change writes it in its final report as a precise diff request; the architect merges. Adding a NEW optional field to an element type for the module's own element is the only change a module may request without justification.

**Locale files.** Each agent edits only its namespace in `locales/en/` and then runs `npm run i18n:sync` (mirrors keys into `fr/` with empty strings; never touches other languages' existing translations).

**Shortcut tables.** Each module owns its `shortcuts.ts` table (already written from the research). Agents may add rows for their own module, but must keep `npm test` green (no duplicate combo in one scope, labels exist, icons exist).

---

## 3. File formats

All files are UTF-8, human-readable, versioned, deterministic (stable key order, 2-space JSON indentation, trailing newline) so they diff well in git.

### 3.1 Board JSON (`.wboard` `.wflow` `.wmind` `.wwire` `.wdraw`)

```jsonc
{
  "format": "whimsical-clone/board",   // constant, identifies the file
  "version": 1,                        // integer; MIGRATIONS[n] upgrades n -> n+1 (core/boardFormat.ts)
  "kind": "flowchart",                 // board | flowchart | mindmap | wireframe | draw (preset only)
  "settings": {
    "mode": "diagram",                 // diagram | wireframe (W / Q)
    "theme": "whimsical",
    "customColors": ["#12ab34"],       // per board, from "+" in the colour picker
    "defaultStyles": { "shape:rectangle": { "color": "blue", "fillStyle": "border" } },   // ⌘⇧D
    "lastUsedStyles": { "sticky": { "color": "yellow" } },                                 // "new objects follow suit"
    "nextAnnotationNumber": 3
  },
  "elements": [ /* z-ordered back to front; ids unique (10-char nanoid) */ ],
  "extra": { }                         // unknown top-level keys preserved from newer files
}
```

Element types (authoritative TypeScript: `core/types.ts` section 3). Every element has `id`, `type`, optional `locked`, `groupId`, `containerId` (section/frame that holds it). Box elements have world `x, y, w, h` and optional `rotation` (0/90/180/270 only).

| `type` | Owner | Key fields |
|---|---|---|
| `shape` | flowchart | `kind` (rectangle, pill, oval, diamond, parallelogram, parallelogramFlipped, trapezoid, triangle, hexagon, cylinder, actor, line, bracket, cloud, star, cross), `color`, `fillStyle` (fill / border / dashed / none), `text`, `textSize`, `textAlign`, `verticalAlign`, `icon?`, `autoHeight`, `seed?` (cloud/star wobble), `dashed?` (line) |
| `connector` | canvas | `start`/`end`: `{kind:"attached", elementId, side|"auto", t?, cell?}` or `{kind:"free", x, y}`; `route` straight / curved / elbow; `waypoints?`; `color`; `dashed`; `startEndpoint`/`endEndpoint` (none, arrow, arrowOpen, triangle, triangleOutline, circle, circleOutline, diamond, diamondOutline, erdOne, erdMany, erdOneOrMany, erdZeroOrMany); `label?` `{text, t, background, color?}`; `animated?` |
| `sticky` | board | `color` (default purple), `text`, `textSize`, `textAlign`, `autoSize` |
| `text` | board | `text`, `textSize`, `textAlign`, `color`, `autoWidth` |
| `image` | board | `src` (`wsasset://...`), `naturalWidth/Height`, `caption?`, `showCaption?` |
| `link` | board | `url` (external or `wc://file/<relPath>`), `title?`, `display` card / compact |
| `icon` | board | `icon` (lucide kebab name), `color` |
| `section` | board | `name`, `color`, `fill` solid / outline, `clip` |
| `table` | board | `columns[{id,width}]`, `rows[{id,height?}]`, `cells{"row:col": {text, background?, align?}}`, `headerRow`, `tableStyle`, `textSize` |
| `code` | board | `language` or `auto`, `code` |
| `stroke` | draw | `tool` marker / highlighter, `size` thin / thick, `color`, `points` flat `[x,y,p,...]` local to `x,y` (2 decimals), `isPen?`, `detectedShape?` |
| `wire` | wireframe | `component` (29 kinds), `size` S/M/L, `state`, `color?`, `text`, `textSize`, `props` (component-specific JSON) |
| `frame` | wireframe | `device` (plain, desktop, iphone-14, iphone-x, iphone-8, ipad, android, android-tablet, apple-watch), `name`, `statusBar`, `keyboard`, `orientation` |
| `annotation` | wireframe | `color`, `text`, `autoNumber`, `number?`, `icon?`, `outline`; its arrow is a normal `connector` starting at the annotation |
| `mindmapNode` | mindmap | `rootId`, `treeParentId` (null = root), `order`, `side?` (first-level only), `text`, `textSize`, `icon?{name, placement}`, `collapsed?`, `color?` (branch colour), `map?{orientation, lineStyle}` on the root. x/y/w/h of non-root nodes are layout output written by the mindmap module in the same update. |

Rich text (`RichText`) is `{ blocks: [{ type: p|h1|h2|h3|ul|ol|check|quote|code, indent?, checked?, language?, spans: [{ text, marks?: bold|italic|strike|code|highlight[], href? }] }] }`. Soft breaks are `\n` inside span text. Mind-map nodes use paragraphs only; stickies use the full set.

Colours (`ColorRef`) are palette names (`purple`, `blue`, `green`, `violet`, `pink`, `orange`, `yellow`, `red`, `crimson`, `darkGreen`, `brown`, `gray`, `smoke`, `slate`, `white`) or custom `#rrggbb`. They are resolved at render time per role and theme (`core/palette.ts`), so dark mode needs no data migration.

Forward compatibility: unknown element `type`s are kept verbatim and rendered as a labelled placeholder box; unknown properties on known elements are kept (agents must spread existing objects when updating, never rebuild them from scratch).

Example (abridged):

```json
{
  "format": "whimsical-clone/board",
  "version": 1,
  "kind": "flowchart",
  "settings": { "mode": "diagram", "theme": "whimsical", "customColors": [], "defaultStyles": {}, "lastUsedStyles": {} },
  "elements": [
    { "id": "a1b2c3d4e5", "type": "shape", "kind": "rectangle", "x": 0, "y": 0, "w": 168, "h": 72, "color": "purple", "fillStyle": "fill",
      "text": { "blocks": [{ "type": "p", "spans": [{ "text": "Start" }] }] }, "textSize": "m", "textAlign": "center", "verticalAlign": "middle", "autoHeight": true },
    { "id": "f6g7h8i9j0", "type": "connector", "start": { "kind": "attached", "elementId": "a1b2c3d4e5", "side": "auto" },
      "end": { "kind": "free", "x": 300, "y": 36 }, "route": "elbow", "color": "slate", "dashed": false, "startEndpoint": "none", "endEndpoint": "arrow" }
  ]
}
```

### 3.2 Docs (`.md`)

- The file is the Markdown text; title = file name. Line endings normalised to `\n`, trailing newline.
- Serialization (export) uses standard Markdown: `**bold**`, `_italic_`, `~~strike~~`, `` `code` ``, `==highlight==`, GFM task lists `- [ ]`/`- [x]`, GFM tables, fenced code with language, `---` line divider, `***` section divider, nested blockquotes `>`/`>>` for quote levels.
- Non-Markdown blocks use documented extensions that round-trip:
  - Callout: `> [!callout color=blue icon=info]` followed by `>` lines.
  - Toggle list: `<details><summary>Title</summary>` ... `</details>`.
  - Embed: `::embed[https://...]{height=525 fit=text}` on its own line.
  - Nested file / internal link: `[Name](wc://file/<relPath>)`; nested board embed `::board[<relPath>]{height=525}`.
  - Images: `![alt](wsasset://<hash>.<ext>)`.
- Input rules follow Whimsical, not CommonMark: typing `*text*` makes bold, `_text_` italic, `_ ` starts a checklist (import accepts both conventions).
- Per-viewer state (collapsed headings/toggles, text size, width, focus mode) is NOT stored in the file (see 3.5).

### 3.3 Workspace folder

```
<workspace>/
  Product/                       # folders are folders
    Roadmap.wboard
    Signup flow.wflow
    Ideas.wmind
    App screens.wwire
    Sketch.wdraw
    Meeting notes.md
  .whimsical/                    # hidden from the tree
    workspace.json               # WorkspaceMeta: favorites, file icons, manual order (paths rewritten by main on rename/move)
    assets/<sha256-16>.<ext>     # content-addressed images/files, shared by all documents
```

- Assets are referenced as `wsasset://<hash>.<ext>` and served by a privileged custom protocol registered in main (reads only from `.whimsical/assets`). Content addressing makes renames/moves/copies of documents free and dedupes images.
- Hidden entries (dot-files) and unsupported files are not shown in the tree (unsupported files may be shown greyed in a later version).
- Deleting moves to the macOS Trash (`shell.trashItem`); the app never deletes permanently.

### 3.4 Preferences

`userData/preferences.json` = `Preferences` in `@shared/ipc` (theme, language, invertZoom, detectShapes, doc text size/width, sidebar pinned/width, last and recent workspaces).

### 3.5 View state

`userData/view-state/<sha1(workspaceRoot)>.json`, accessed with `api.viewState.get/set(key)`. Keys: `tabs` (open tabs, pinned, active), `recent` (recent files), `file:<relPath>:viewport`, `file:<relPath>:collapsed`, `file:<relPath>:selection` (optional). Never stored in documents.

---

## 4. IPC contract (main <-> renderer)

Authoritative types: `src/shared/ipc.ts`. Preload: `src/preload/index.ts` (complete). Main must implement every INVOKE channel with `ipcMain.handle` and return `IpcResult<T>` for fallible operations (`{ok:true,value}` or `{ok:false,code,message}`; codes `NO_WORKSPACE`, `OUTSIDE_WORKSPACE`, `NOT_FOUND`, `ALREADY_EXISTS`, `CONFLICT`, `INVALID_NAME`, `IO_ERROR`, mapped to `common:errors.<code>`).

| Group | Calls | Behaviour required in main |
|---|---|---|
| workspace | `pick(title)`, `open(absPath)`, `current()`, `readMeta()`, `writeMeta(meta)` | One workspace per window. `open` validates the folder, creates `.whimsical/` lazily, starts the watcher, records it in prefs (`lastWorkspace`, `recentWorkspaces`). |
| fs | `listTree()`, `readFile(path)`, `writeFile(path, content, {expectedHash?})`, `createFile(dir, baseName, ext, content)`, `createFolder(dir, baseName)`, `rename(path, newName)`, `move(path, destDir)`, `duplicate(path, destDir?)`, `trash(path)`, `stat(path)`, `revealInFinder(path)`, `onEvents(listener)` | All `RelPath`s are POSIX, relative to the root; resolve + `realpath` and reject anything outside (`OUTSIDE_WORKSPACE`). Writes are atomic (write `.<name>.tmp-<rand>` in the same folder, fsync, rename). `writeFile` returns the new sha256; with `expectedHash` it fails with `CONFLICT` if the disk content differs. Names are validated (no `/`, no leading `.`, not empty) and deduplicated with " 2", " 3"... `rename`/`move`/`trash` rewrite `workspace.json` paths. |
| watcher | event `fs:events` | chokidar on the root, ignoring `.whimsical/**`, dot-files and temp files; batches events (~50 ms). Echo suppression: main remembers the hash of each file it wrote for 2 s and drops `change` events whose hash matches. |
| assets | `importBytes(name, bytes)`, `importFile(absPath)`, `getPathForFile(file)` | sha256 the bytes, write `.whimsical/assets/<first 16 hex>.<ext>` if absent, return `{url, mime, width?, height?}`. Protocol handler `wsasset://` streams from that folder only. |
| prefs | `get()`, `set(patch)`, event `prefs:changed` | JSON file in userData; broadcast changes to all windows. |
| viewState | `get(key)`, `set(key, value)` | Debounced JSON write per workspace. |
| app | `setMenu(spec)`, event `app:menuCommand`, `getSystemDarkMode()`, event `app:systemDarkModeChanged`, `getLocale()`, `setWindowTitle(title)`, `confirm(opts)`, `saveExport(opts, data)`, `openExternal(url)`, `newWindow(path?)`, event `app:beforeQuit` + `app:beforeQuitDone` | See section 6.4 for the menu. Before quitting/closing a window main sends `app:beforeQuit` and waits (max 3 s) for `app:beforeQuitDone` so pending autosaves flush. `openExternal` only allows `http(s):` and `mailto:`. |

Security: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict CSP in `index.html` (`img-src 'self' data: blob: wsasset:`), navigation and `window.open` blocked (external links go through `openExternal`).

---

## 5. Editor plugin contract

Authoritative: `core/types.ts` section 7.

```ts
interface EditorPlugin<T> {
  kind: FileKind; extensions: readonly string[]; labelKey: string; newFileNameKey: string; icon: string;
  historyMode: 'host' | 'editor';
  createEmpty(): T; parse(text: string, path: RelPath): T; serialize(content: T): string;
  shortcuts: readonly ShortcutDef[];
  component: ComponentType<EditorProps<T>>;   // React.lazy allowed
}
interface EditorProps<T> {
  filePath: RelPath; title: string;
  content: T;                                   // immutable
  onChange(next: T, options?: ChangeOptions): void;
  registerShortcuts(handlers: readonly ShortcutHandler[]): Unregister;
  setScopes(scopes: readonly ScopeId[]): void;
  isActive: boolean;
  lastHistoryAction?: HistoryAction;            // host history only
  services: EditorServices;                     // api, openFile, view state, notify
}
```

- **Registry.** `app/editors.ts` (frozen) builds the extension -> editor map from each module's `index.ts`. `.wboard/.wflow/.wmind/.wwire/.wdraw` use `createCanvasEditorPlugin(preset)` (canvas module) so they share the board format and the `CanvasEditor`; `.md` uses the docs plugin.
- **Shell responsibilities (editor host).** Read file -> `parse` -> keep `{content, history, hash, dirty}` per open tab in a Zustand store -> render `component` inside `Suspense` + error boundary (parse errors show `common:errors.INVALID_FILE`, the file is never overwritten). On `onChange`: replace content, record history (`host` mode), schedule autosave. Keep inactive tabs mounted but hidden (`isActive=false`) for instant switching, up to 8 tabs (LRU unmount beyond).
- **Editor responsibilities.** Render `content`; never mutate it; produce new values with Immer; commit one `onChange` per user action (drags commit on pointer-up; typing uses `coalesceKey`); bind handlers only for command ids from its own tables; declare inner scopes with `setScopes`; restore selection from `lastHistoryAction.selection` when it changes.
- **Docs specifics.** `historyMode: 'editor'`: TipTap owns undo. The docs editor binds `edit.undo`/`edit.redo` (stacked over the shell's handlers) while active, and calls `onChange(markdown)` debounced (~300 ms) and on blur.

### 5.1 Canvas plugin contract

One engine renders every canvas kind. Each canvas module exports a `CanvasPlugin` (`core/types.ts` section 8):

```ts
interface CanvasPlugin {
  id: 'canvas'|'flowchart'|'board'|'wireframe'|'draw'|'mindmap';
  elements: ElementDefinition[];     // render, bounds, hit test, resize mode, text get/set, context bar...
  tools: ToolDefinition[];           // toolbar entries; create(api, at, rect?) or onPointerDown -> ToolSession
  shortcuts: ShortcutDef[];
  createCommands?(api: CanvasApi): ShortcutHandler[];   // bound while the canvas is active
  layers?: { below?, above? };       // world layers (mind-map branches, guides)
  panels?: Record<string, Component>;// popovers opened with api.openPanel(id) (shapes menu, component/frame launchers, icon picker)
  afterChange?(next, prev, api): BoardDocument;          // normalisation (mind-map relayout, sticky auto-size)
}
```

- `app/editors.ts` provides all six plugins through `CanvasPluginsContext`; the engine reads them with `useCanvasPlugins()`.
- The engine owns: viewport (pan/zoom, trackpad pinch = wheel+ctrlKey, `⌘`+scroll zoom toward cursor, invert option), dot grid (12 px, visible at >= 100 %; 1 px and hidden in wireframe mode), selection + marquee + `⇧`-click, transform handles (size label while resizing, `⇧` aspect, `⌥` from centre), smart guides (edges/centres, `#b1223f`) and grid snapping with `⌘` (grid only) and backtick (none), z-order, group/ungroup/deep select, lock, clipboard (custom MIME `application/x-whimsical-clone+json` + plain text/markdown fallback; paste style), copy/paste style, save default style, last-used style, quick add (`⌥+Arrow` and hover `+` buttons, `Q` hides them), connectors (all routing, endpoints, labels, attach with purple target box, `⌘`-click animate / jump), the contextual toolbar frame (common controls + the element's `ContextBar`), the shared `RichTextEditor` (TipTap-based, converts to/from `RichText`), text measurement, the left toolbar and the "All tools" (`/`) searchable menu built from every plugin's tools, bottom-right zoom cluster (hand, zoom %, command menu button), hover highlight, measure (`⌥` hover), export rendering (SVG/PNG of board, selection, sections/frames), alignment/distribution, Escape cancels an active drag.
- Rendering model: a transformed world `div` (CSS `transform: translate() scale()`), box elements as absolutely positioned wrappers (Render draws in local coordinates; SVG for shapes, HTML for text), one world-space SVG layer for connectors, layers from plugins. Virtualise offscreen elements via an rbush index (target: smooth with 10,000 items).
- Elements are hit-tested top-down by z-order; locked elements are not selectable by click (Whimsical `⌘A` skips locked).

---

## 6. Keyboard shortcut registry

### 6.1 Design

Shortcuts are **data** (`ShortcutDef` rows in each module's `shortcuts.ts`). The same rows drive keyboard dispatch, native menu accelerators (display), tooltips (`useShortcutLabel(id)`), the command menu (`⌘K`) and the help sheet (`?`).

- `id` = command id `<module>.<camelCase>`; `labelKey` defaults to `<ns>:commands.<id without first segment>`.
- `keys` use the `@shared/keys` grammar: `[Mod+][Ctrl+][Alt+][Shift+]Key`. Letters match the produced character (layout independent) with a physical fallback when `⌥` alters it; punctuation `[ ] \ . , / ; ' \` - =` and digits match the US physical position (`event.code`), as Whimsical documents.
- `gestures` are display-only pointer gestures (`Space+Drag`, `Mod+Click`, `Alt+Hover`).
- `dispatch: 'native'` rows are handled by a focused component (TipTap keymaps, markdown input rules) and are listed only.
- `allowInTextInput` lets a row fire while focus is in an input/contenteditable; otherwise bare-key rows never fire while typing.
- Runtime: modules `bind` handlers (`ShortcutHandler{id, run, isEnabled?}`), last binding wins (stack), unbound or disabled rows fall through.
- One `keydown` listener on `window` (bubble phase) calls `shortcutRegistry.handleKeyDown`. It ignores events already `defaultPrevented` (ProseMirror) or composing (IME).

### 6.2 Scopes

Resolution order, innermost first: `textEdit` > `folderView` > `canvas.mindmap` > `canvas.freehand` > `canvas.wireframe` | `canvas.diagram` > `canvas` > `docs` > `app`. The two focus-based scopes (`textEdit`, `folderView`) outrank document scopes. While the sidebar or a folder view has keyboard focus, the shell sets the active scopes to `folderView` only, so bare letters never reach the canvas behind it.

| Scope | Active when (set by) |
|---|---|
| `app` | always |
| `folderView` | the sidebar tree or a folder view has keyboard focus (shell; editor scopes are suspended meanwhile) |
| `docs` | a doc tab is active (docs editor via `setScopes`) |
| `canvas` | a canvas tab is active (engine) |
| `canvas.diagram` / `canvas.wireframe` | board mode is diagram / wireframe (engine; `W` toggles, `Q` exits wireframe). For a preset with `toolbar: 'draw'` (`.wdraw`) the engine activates neither, so shape/wireframe letters do nothing in a pen-only file. |
| `canvas.freehand` | a freehand tool (marker, highlighter, eraser, selector) is active, and always in `.wdraw` (engine + draw) |
| `canvas.mindmap` | at least one mind-map node selected and not editing (mindmap) |
| `textEdit` | a canvas object's text is being edited (engine) |

### 6.3 Key collisions (decisions)

| Key | Decision | Why |
|---|---|---|
| `H` | Freehand marker (from any mode); `⇧H` highlighter | Freehand page + live keymap; Hexagon moves to `F` in diagram mode (live keymap). |
| `F` | Hexagon (diagram) / Frame launcher (wireframe) | Scoped. |
| `A` | Annotation (both modes) | Live keymap + 2024 release; Trapezoid is menu-only. |
| `P` | Parallelogram (diagram) / Input (wireframe) | Live keymap. |
| `L` | Line shape (diagram) / Line (wireframe); `C` is the only connector key | Removes the "C or L" ambiguity. |
| `D` | Diamond (diagram) / Line (wireframe) | Official. |
| `E` | Table (diagram) / Component launcher (wireframe) / Eraser (freehand) | Scoped. |
| `S` | Shapes menu (diagram) / Selector (freehand) | Scoped. |
| `G` | Triangle (diagram) / Image (wireframe) / Grid view (folder view) | Scoped. |
| `I` | Image (diagram only; wireframe uses `G`) | Official. |
| `Q` | Hide quick add (diagram) / Exit wireframe (wireframe) | Official. |
| `Enter` | Canvas: edit text of selection; if a creation tool is armed, place the object at the viewport centre (**ext**, keyboard-only creation). Mind map selected node: start editing; while editing: add sibling. | Keeps a keyboard path to edit existing nodes; Enter twice = sibling. |
| `Tab` | Canvas: select next object (**ext**); mind map: add child | Scoped (mind map inner). |
| `⌘`+click | On connector body: animate; on connector end: jump to other end; elsewhere: deep select | Both documented. |
| `]` `[` | Bring to front / send to back; `⌘]` `⌘[` one step | Help page (the live app's `⌥]` variants are not used). |
| Paste style | `⌘⌥V`, and `⌘V` applies style when the style clipboard is the most recent copy | Official table prints `⌘V`. |
| `=` `-` `0` | Zoom in/out/100 % on canvas; `⌘=` `⌘-` `⌘0` aliases (no Electron zoom roles); in docs `⌘=`/`⌘-` change doc text size | Native menu never registers page zoom. |
| `⌘⇧K` | Inline code; inside a code block opens the language picker | Context. |
| `⌘↩` | Docs: open nested file; in a table row: insert row | Context (native). |

### 6.4 Native menu (macOS)

The renderer builds a `MenuSpec` from the registry + i18n and sends it with `api.app.setMenu` whenever the language, active editor or enabled state changes; main converts it.

- Roles only for: app menu (about, services, hide, hideOthers, unhide, quit), `cut`, `copy`, `paste`, `pasteAndMatchStyle`, window roles (minimize, zoom, front, togglefullscreen) and dev roles in development.
- Every other item is a `command` item with `registerAccelerator: false`: the accelerator is shown, the keystroke is handled by the renderer registry, a click sends `app:menuCommand` -> `shortcutRegistry.run(id, {source:'menu'})`. This makes bare letters safe and prevents double dispatch.
- Never include Electron's `zoomIn/zoomOut/resetZoom` roles or the `close` role (`⌘W` closes the tab; the window closes with its last tab).
- Undo/Redo/Select All are command items (`edit.undo`, `edit.redo`, `edit.selectAll`): the shell handler routes to `document.execCommand` for native inputs, to TipTap through the docs editor's stacked binding, otherwise to host history or canvas select-all. Canvas copy/cut/paste listen to DOM `copy`/`cut`/`paste` events, which the roles trigger for both keyboard and menu.

Menus: **App** (About, Preferences `⌘,`, Hide, Quit) · **File** (New board `⌥⌘N`, New ▸ flowchart / mind map / wireframe / drawing / doc / folder, Open workspace `⌘O`, New tab `⌘T`, New window `⇧⌘N`, Close tab `⌘W`, Export `⇧⌘E`, Print `⌘P`, Copy link to file `⌘L`, Reveal in Finder) · **Edit** (Undo, Redo, Cut, Copy, Paste, Paste style, Copy style, Duplicate, Delete, Select all, Find `⌘F`, Search workspace `⌘J`, Command menu `⌘K`) · **View** (Toggle sidebar `⌘E`, Zoom in/out/100 %/fit/selection, Wireframe mode, Interface color mode ▸ System/Light/Dark, Keyboard shortcuts `?`) · **Arrange** (front/back, group, lock, align, distribute, lay out) · **Window** (Minimize, Zoom, Next/previous tab, tabs 1-9) · **Help** (Keyboard shortcuts).

### 6.5 Help sheet

`?` opens a searchable overlay listing `getDefs()` grouped by `group` (labels `common:shortcutGroups.<group>`), filtered to the scopes relevant to the active editor; hidden rows omitted; direction families (`…Up/Down/Left/Right`) are shown as one row with `↑↓←→`; **ext** rows marked with `common:shortcutHelp.extension`.

### 6.6 Exhaustive shortcut map (generated from the code tables)

Flags: `native` = handled by the focused editor component, `in-text` = also fires while typing, **ext** = clone extension, `repeat` = auto-repeats.

#### App, files, tabs, edit, folder view (`shell/shortcuts.ts`)

| Action | Keys (macOS) | Scope | Command id | Flags |
|---|---|---|---|---|
| Open command menu | `⌘K` | `app` | `app.commandMenu` | in-text |
| Search this file or folder | `⌘F` | `app` | `app.searchFile` | in-text |
| Search workspace | `⌘J` / `⇧⌘F` | `app` | `app.searchWorkspace` | in-text |
| Open/hide sidebar | `⌘E` | `app` | `app.toggleSidebar` | in-text |
| Keyboard shortcuts | `⇧/` | `app` | `app.shortcutsHelp` |  |
| Preferences… | `⌘,` | `app` | `app.preferences` | in-text |
| Cycle color mode | (menu only) | `app` | `app.cycleTheme` |  |
| New board | `⌥⌘N` | `app` | `app.newBoard` | in-text |
| New flowchart | (menu only) | `app` | `app.newFlowchart` |  |
| New mind map | (menu only) | `app` | `app.newMindmap` |  |
| New wireframe | (menu only) | `app` | `app.newWireframe` |  |
| New drawing | (menu only) | `app` | `app.newDrawing` |  |
| New doc | (menu only) | `app` | `app.newDoc` |  |
| New folder | (menu only) | `app` | `app.newFolder` |  |
| Open workspace folder… | `⌘O` | `app` | `app.openWorkspace` | in-text, **ext** |
| New window | `⇧⌘N` | `app` | `app.newWindow` | in-text, **ext** |
| Export… | `⇧⌘E` | `app` | `app.export` | in-text |
| Print… | `⌘P` | `app` | `app.print` | in-text |
| Copy link to file | `⌘L` | `app` | `app.copyFileLink` | in-text |
| Reveal in Finder | (menu only) | `app` | `app.revealInFinder` |  |
| Rename | (menu only) | `app` | `app.renameFile` |  |
| Move to Trash | (menu only) | `app` | `app.deleteFile` |  |
| Add to / remove from Favorites | (menu only) | `app` | `app.toggleFavorite` |  |
| New tab | `⌘T` | `app` | `tab.new` | in-text |
| Close tab | `⌘W` | `app` | `tab.close` | in-text |
| Next tab | `⌃⇥` | `app` | `tab.next` | in-text, **ext** |
| Previous tab | `⌃⇧⇥` | `app` | `tab.previous` | in-text, **ext** |
| Switch to tab 1–9 | `⌘1` | `app` | `tab.select1` | in-text |
| Switch to tab 2 | `⌘2` | `app` | `tab.select2` | in-text |
| Switch to tab 3 | `⌘3` | `app` | `tab.select3` | in-text |
| Switch to tab 4 | `⌘4` | `app` | `tab.select4` | in-text |
| Switch to tab 5 | `⌘5` | `app` | `tab.select5` | in-text |
| Switch to tab 6 | `⌘6` | `app` | `tab.select6` | in-text |
| Switch to tab 7 | `⌘7` | `app` | `tab.select7` | in-text |
| Switch to tab 8 | `⌘8` | `app` | `tab.select8` | in-text |
| Switch to last tab | `⌘9` | `app` | `tab.select9` | in-text |
| Undo | `⌘Z` | `app` | `edit.undo` | in-text |
| Redo | `⇧⌘Z` / `⌘Y` | `app` | `edit.redo` | in-text |
| Select all | `⌘A` | `app` | `edit.selectAll` | in-text |
| List view | `L` | `folderView` | `folder.listView` |  |
| Grid view | `G` | `folderView` | `folder.gridView` |  |
| Delete selected files | `⌫` / `⌦` | `folderView` | `folder.delete` |  |
| Open selected file | `↩` | `folderView` | `folder.open` | **ext** |
| Select multiple items | `⇧ + Click` | `folderView` | `folder.selectMultiple` |  |

#### Canvas engine (all canvas kinds) (`canvas/shortcuts.ts`)

| Action | Keys (macOS) | Scope | Command id | Flags |
|---|---|---|---|---|
| Zoom in | `=` / `⇧=` / `⌘=` | `canvas` | `canvas.zoomIn` | repeat |
| Zoom out | `-` / `⌘-` | `canvas` | `canvas.zoomOut` | repeat |
| Zoom to 100% | `0` / `⌘0` | `canvas` | `canvas.zoomReset` |  |
| Zoom to content | `1` | `canvas` | `canvas.zoomToFit` |  |
| Zoom to selection | `2` | `canvas` | `canvas.zoomToSelection` |  |
| Zoom | `Z + Click` / `Z + Drag` / `⌘ + Scroll` | `canvas` | `canvas.zoomGesture` |  |
| Pan | `Space + Drag` / `⇧ + Scroll` | `canvas` | `canvas.panGesture` |  |
| Select | (menu only) | `canvas` | `canvas.selectTool` |  |
| Pan | (menu only) | `canvas` | `canvas.panTool` |  |
| All tools | `/` | `canvas` | `canvas.allTools` |  |
| Connector | `C` | `canvas` | `canvas.connector` |  |
| Wireframe mode | `W` | `canvas` | `canvas.toggleWireframe` |  |
| Exit wireframe mode | `Q` | `canvas.wireframe` | `canvas.exitWireframe` |  |
| Hide quick add | `Q` | `canvas.diagram` | `canvas.toggleQuickAdd` |  |
| Quick add | `⌥↑` | `canvas` | `canvas.quickAddUp` |  |
| Quick add below | `⌥↓` | `canvas` | `canvas.quickAddDown` |  |
| Quick add left | `⌥←` | `canvas` | `canvas.quickAddLeft` |  |
| Quick add right | `⌥→` | `canvas` | `canvas.quickAddRight` |  |
| Change quick add direction | `⇧ + Hover` | `canvas` | `canvas.quickAddDirection` |  |
| Deselect | `Esc` | `canvas` | `canvas.escape` |  |
| Select multiple items | `⇧ + Click` | `canvas` | `canvas.selectMultiple` |  |
| Deep select | `⌘ + Click` | `canvas` | `canvas.deepSelect` |  |
| Select all including locked | `⌘ + A + A` | `canvas` | `canvas.selectAllLocked` |  |
| Select next object | `⇥` | `canvas` | `canvas.selectNext` | **ext** |
| Select previous object | `⇧⇥` | `canvas` | `canvas.selectPrevious` | **ext** |
| Select nearest object in direction | `⌥⇧↑` | `canvas` | `canvas.selectNeighborUp` | **ext** |
| Select nearest object below | `⌥⇧↓` | `canvas` | `canvas.selectNeighborDown` | **ext** |
| Select nearest object on the left | `⌥⇧←` | `canvas` | `canvas.selectNeighborLeft` | **ext** |
| Select nearest object on the right | `⌥⇧→` | `canvas` | `canvas.selectNeighborRight` | **ext** |
| Edit text | `↩` / `⌘R` | `canvas` | `canvas.editText` |  |
| Delete | `⌫` / `⌦` | `canvas` | `canvas.delete` |  |
| Duplicate | `⌘D` / `⌥ + Drag` | `canvas` | `canvas.duplicate` |  |
| Copy style | `⌥⌘C` | `canvas` | `canvas.copyStyle` |  |
| Paste style | `⌥⌘V` | `canvas` | `canvas.pasteStyle` |  |
| Copy link to object | `⌥⇧⌘C` | `canvas` | `canvas.copyLink` |  |
| Copy as image | `⇧⌘C` | `canvas` | `canvas.copyAsImage` |  |
| Save as default style | `⇧⌘D` | `canvas` | `canvas.saveDefaultStyle` |  |
| Increase text size | `⌥⌘=` | `canvas` | `canvas.textSizeUp` | in-text |
| Decrease text size | `⌥⌘-` | `canvas` | `canvas.textSizeDown` | in-text |
| Bring to front | `]` | `canvas` | `canvas.bringToFront` |  |
| Bring forward | `⌘]` | `canvas` | `canvas.bringForward` |  |
| Send to back | `[` | `canvas` | `canvas.sendToBack` |  |
| Send backward | `⌘[` | `canvas` | `canvas.sendBackward` |  |
| Group | `⌘G` | `canvas` | `canvas.group` |  |
| Ungroup | `⇧⌘G` | `canvas` | `canvas.ungroup` |  |
| Lock / unlock | `⇧⌘L` | `canvas` | `canvas.lock` |  |
| Resize with locked aspect ratio | `⇧ + Drag` | `canvas` | `canvas.resizeAspect` |  |
| Resize from center | `⌥ + Drag` | `canvas` | `canvas.resizeFromCenter` |  |
| Ignore auto-alignment (snap to grid only) | `⌘ + Drag` | `canvas` | `canvas.snapGridOnly` |  |
| Ignore grid and auto-alignment | `` + Drag` | `canvas` | `canvas.snapNone` |  |
| Measure distance | `⌥ + Hover` | `canvas` | `canvas.measure` |  |
| Cancel move or resize | `Escape` | `canvas` | `canvas.cancelDrag` |  |
| Increase width | `⇧⌘→` | `canvas` | `canvas.growWidth` | repeat |
| Decrease width | `⇧⌘←` | `canvas` | `canvas.shrinkWidth` | repeat |
| Increase height | `⇧⌘↓` | `canvas` | `canvas.growHeight` | repeat |
| Decrease height | `⇧⌘↑` | `canvas` | `canvas.shrinkHeight` | repeat |
| Move selection | `↑` | `canvas` | `canvas.nudgeUp` | repeat |
| Move selection (large step) | `⇧↑` | `canvas` | `canvas.nudgeUpLarge` | repeat |
| Move selection by 1 px | `⌘↑` | `canvas` | `canvas.nudgeUpFine` | repeat |
| Move down | `↓` | `canvas` | `canvas.nudgeDown` | repeat |
| Move down (large step) | `⇧↓` | `canvas` | `canvas.nudgeDownLarge` | repeat |
| Move down by 1 px | `⌘↓` | `canvas` | `canvas.nudgeDownFine` | repeat |
| Move left | `←` | `canvas` | `canvas.nudgeLeft` | repeat |
| Move left (large step) | `⇧←` | `canvas` | `canvas.nudgeLeftLarge` | repeat |
| Move left by 1 px | `⌘←` | `canvas` | `canvas.nudgeLeftFine` | repeat |
| Move right | `→` | `canvas` | `canvas.nudgeRight` | repeat |
| Move right (large step) | `⇧→` | `canvas` | `canvas.nudgeRightLarge` | repeat |
| Move right by 1 px | `⌘→` | `canvas` | `canvas.nudgeRightFine` | repeat |
| Align left | (menu only) | `canvas` | `canvas.alignLeft` |  |
| Center horizontally | (menu only) | `canvas` | `canvas.alignCenterH` |  |
| Align right | (menu only) | `canvas` | `canvas.alignRight` |  |
| Align top | (menu only) | `canvas` | `canvas.alignTop` |  |
| Center vertically | (menu only) | `canvas` | `canvas.alignCenterV` |  |
| Align bottom | (menu only) | `canvas` | `canvas.alignBottom` |  |
| Distribute horizontally | (menu only) | `canvas` | `canvas.distributeH` |  |
| Distribute vertically | (menu only) | `canvas` | `canvas.distributeV` |  |
| Snap to grid | (menu only) | `canvas` | `canvas.snapToGrid` |  |
| Wrap in section | (menu only) | `canvas` | `canvas.wrapInSection` |  |
| Rotate 90° | (menu only) | `canvas` | `canvas.rotate` |  |
| Animate connector | `⌘ + Click` | `canvas` | `canvas.animateConnector` |  |
| Jump to the other end of a connector | `⌘ + Click` | `canvas` | `canvas.jumpConnectorEnd` |  |
| Bold | `⌘B` | `textEdit` | `canvasText.bold` | native |
| Italic | `⌘I` | `textEdit` | `canvasText.italic` | native |
| Strikethrough | `⇧⌘X` | `textEdit` | `canvasText.strike` | native |
| Inline code | `⇧⌘K` | `textEdit` | `canvasText.code` | native |
| Highlight | `⇧⌘H` | `textEdit` | `canvasText.highlight` | native |
| Add link | `⇧⌘U` | `textEdit` | `canvasText.link` | native |
| Paragraph | `⌘\` | `textEdit` | `canvasText.paragraph` | native |
| Bulleted list | `⇧⌘8` / `* + Space` / `- + Space` | `textEdit` | `canvasText.bulletList` | native |
| Numbered list | `⇧⌘7` / `1. + Space` | `textEdit` | `canvasText.numberedList` | native |
| Checklist | `_ + Space` | `textEdit` | `canvasText.checklist` | native |
| Line break | `⇧↩` | `textEdit` | `canvasText.lineBreak` | native |
| Link to a file | `@` | `textEdit` | `canvasText.mention` | native |
| Stop editing | `Esc` | `textEdit` | `canvasText.stopEditing` | native |

#### Flowchart / diagram shapes (`editors/flowchart/shortcuts.ts`)

| Action | Keys (macOS) | Scope | Command id | Flags |
|---|---|---|---|---|
| Diagram shapes | `S` | `canvas.diagram` | `flowchart.shapesMenu` |  |
| Rectangle | `R` | `canvas.diagram` | `flowchart.rectangle` |  |
| Pill | `U` | `canvas.diagram` | `flowchart.pill` |  |
| Oval | `O` | `canvas.diagram` | `flowchart.oval` |  |
| Diamond | `D` | `canvas.diagram` | `flowchart.diamond` |  |
| Hexagon | `F` | `canvas.diagram` | `flowchart.hexagon` |  |
| Parallelogram | `P` | `canvas.diagram` | `flowchart.parallelogram` |  |
| Flipped parallelogram | (menu only) | `canvas.diagram` | `flowchart.parallelogramFlipped` |  |
| Trapezoid | (menu only) | `canvas.diagram` | `flowchart.trapezoid` |  |
| Triangle | `G` | `canvas.diagram` | `flowchart.triangle` |  |
| Cylinder | `Y` | `canvas.diagram` | `flowchart.cylinder` |  |
| Line | `L` | `canvas.diagram` | `flowchart.line` |  |
| Bracket | `B` | `canvas.diagram` | `flowchart.bracket` |  |
| Star | `V` | `canvas.diagram` | `flowchart.star` |  |
| Cloud | `J` | `canvas.diagram` | `flowchart.cloud` |  |
| Sequence diagram actor | (menu only) | `canvas.diagram` | `flowchart.actor` |  |
| Cross | (menu only) | `canvas.diagram` | `flowchart.cross` |  |
| Lay out vertically | `⌥⇧V` | `canvas.diagram` | `flowchart.layoutVertical` |  |
| Lay out horizontally | `⌥⇧H` | `canvas.diagram` | `flowchart.layoutHorizontal` |  |

#### Board objects (sticky notes, text, image...) (`editors/board/shortcuts.ts`)

| Action | Keys (macOS) | Scope | Command id | Flags |
|---|---|---|---|---|
| Sticky note | `N` | `canvas` | `board.sticky` |  |
| Text | `T` | `canvas` | `board.text` |  |
| Image | `I` | `canvas.diagram` | `board.image` |  |
| Link | `K` | `canvas` | `board.link` |  |
| Icon | `X` | `canvas` | `board.icon` |  |
| Section | `.` | `canvas` | `board.section` |  |
| Table | `E` | `canvas.diagram` | `board.table` |  |
| Code block | (menu only) | `canvas` | `board.codeBlock` |  |
| Distribute as grid | (menu only) | `canvas` | `board.distributeGrid` |  |
| Paste as sticky notes | (menu only) | `canvas` | `board.pasteAsStickies` |  |

#### Wireframes (`editors/wireframe/shortcuts.ts`)

| Action | Keys (macOS) | Scope | Command id | Flags |
|---|---|---|---|---|
| Annotation | `A` | `canvas` | `wireframe.annotation` |  |
| Button | `B` | `canvas.wireframe` | `wireframe.button` |  |
| Line | `L` / `D` | `canvas.wireframe` | `wireframe.line` |  |
| Components | `E` | `canvas.wireframe` | `wireframe.components` |  |
| Frames | `F` | `canvas.wireframe` | `wireframe.frames` |  |
| Image | `G` | `canvas.wireframe` | `wireframe.image` |  |
| Circle | `O` | `canvas.wireframe` | `wireframe.circle` |  |
| Input | `P` | `canvas.wireframe` | `wireframe.input` |  |
| Rectangle | `R` | `canvas.wireframe` | `wireframe.rectangle` |  |
| Avatar | `V` | `canvas.wireframe` | `wireframe.avatar` |  |
| Rename frame | `Enter` | `canvas.wireframe` | `wireframe.renameFrame` |  |
| Change line direction (hold) | `⇧` | `canvas.wireframe` | `wireframe.lineDirection` |  |
| Full-width/height line (hold) | `⌘` | `canvas.wireframe` | `wireframe.lineFullSize` |  |

#### Freehand (`editors/draw/shortcuts.ts`)

| Action | Keys (macOS) | Scope | Command id | Flags |
|---|---|---|---|---|
| Marker | `H` | `canvas` | `draw.marker` |  |
| Highlighter | `⇧H` | `canvas` | `draw.highlighter` |  |
| Eraser | `E` | `canvas.freehand` | `draw.eraser` |  |
| Selector | `S` | `canvas.freehand` | `draw.selector` |  |
| Exit freehand | `Esc` | `canvas.freehand` | `draw.exit` |  |
| Thin / thick marker | (menu only) | `canvas` | `draw.toggleThickness` |  |
| Detect shapes | (menu only) | `canvas` | `draw.detectShapes` |  |

#### Mind maps (`editors/mindmap/shortcuts.ts`)

| Action | Keys (macOS) | Scope | Command id | Flags |
|---|---|---|---|---|
| Mind map | `M` | `canvas` | `mindmap.addRoot` |  |
| Add child | `⇥` | `canvas.mindmap` | `mindmap.addChild` |  |
| Edit node text | `↩` | `canvas.mindmap` | `mindmap.editNode` |  |
| Add sibling above | `⌘↩` | `canvas.mindmap` | `mindmap.addSiblingAbove` |  |
| Add parent | `⌥↩` | `canvas.mindmap` | `mindmap.addParent` |  |
| Select parent | `⇧⇥` | `canvas.mindmap` | `mindmap.selectParent` |  |
| Navigate up | `↑` | `canvas.mindmap` | `mindmap.navigateUp` | repeat |
| Navigate down | `↓` | `canvas.mindmap` | `mindmap.navigateDown` | repeat |
| Navigate left | `←` | `canvas.mindmap` | `mindmap.navigateLeft` | repeat |
| Navigate right | `→` | `canvas.mindmap` | `mindmap.navigateRight` | repeat |
| Collapse / expand | `⌘/` | `canvas.mindmap` | `mindmap.toggleCollapse` |  |
| Collapse | `⌥⌘[` | `canvas.mindmap` | `mindmap.collapse` |  |
| Expand | `⌥⌘]` | `canvas.mindmap` | `mindmap.expand` |  |
| Collapse / expand all descendants | `⌥ + Click` | `canvas.mindmap` | `mindmap.collapseAll` |  |
| Collapse / expand siblings | `⇧ + Click` | `canvas.mindmap` | `mindmap.collapseSiblings` |  |
| Collapse / expand level | `⌥⇧ + Click` | `canvas.mindmap` | `mindmap.collapseLevel` |  |
| Delete node | `⌫` / `⌦` | `canvas.mindmap` | `mindmap.deleteNode` |  |
| Duplicate node | `⌘D` | `canvas.mindmap` | `mindmap.duplicateNode` |  |
| Add icon | `⇧X` | `canvas.mindmap` | `mindmap.addIcon` |  |
| Add link | `⇧⌘U` | `canvas.mindmap` | `mindmap.addLink` |  |
| Increase indent | `⌃⌘]` | `canvas.mindmap` | `mindmap.indent` |  |
| Decrease indent | `⌃⌘[` | `canvas.mindmap` | `mindmap.outdent` |  |
| Move up among siblings | `⇧⌘↑` | `canvas.mindmap` | `mindmap.moveUp` | **ext** |
| Move down among siblings | `⇧⌘↓` | `canvas.mindmap` | `mindmap.moveDown` | **ext** |
| Lay out mind map | `⇧F12` | `canvas.mindmap` | `mindmap.relayout` |  |
| Paste as mind map | (menu only) | `canvas` | `mindmap.pasteAsMindmap` |  |
| Copy as bulleted list | (menu only) | `canvas.mindmap` | `mindmap.copyAsList` |  |
| Add sibling | `↩` | `textEdit` | `mindmap.editAddSibling` | native |
| Add child | `⇥` | `textEdit` | `mindmap.editAddChild` | native |
| Add sibling above | `⌘↩` | `textEdit` | `mindmap.editAddSiblingAbove` | native |
| Add line break | `⇧↩` | `textEdit` | `mindmap.editLineBreak` | native |
| Stop editing | `Esc` | `textEdit` | `mindmap.editStop` | native |

#### Docs (`editors/docs/shortcuts.ts`)

| Action | Keys (macOS) | Scope | Command id | Flags |
|---|---|---|---|---|
| Paragraph | `⌘\` | `docs` | `docs.paragraph` | native |
| Bold | `⌘B` / `*text*` | `docs` | `docs.bold` | native |
| Italic | `⌘I` / `_text_` | `docs` | `docs.italic` | native |
| Strikethrough | `⇧⌘X` / `~text~` | `docs` | `docs.strike` | native |
| Inline code | `⇧⌘K` / ``text`` | `docs` | `docs.inlineCode` | native |
| Highlight | `⇧⌘H` | `docs` | `docs.highlight` | native |
| Add link | `⇧⌘U` / `⌥K` | `docs` | `docs.link` | native |
| Workspace link | `@` | `docs` | `docs.mention` | native |
| Change block type | `⌘/` / `/` | `docs` | `docs.changeBlockType` | native |
| Increase indent | `⇥` | `docs` | `docs.indent` | native |
| Decrease indent | `⇧⇥` | `docs` | `docs.outdent` | native |
| Code block language (in a code block) | `⇧⌘K` | `docs` | `docs.codeLanguage` | native |
| Select line, block, then doc | `⌘A` | `docs` | `docs.selectMore` | native |
| Copy link to block | `⌥⇧⌘C` | `docs` | `docs.copyBlockLink` | in-text |
| Copy as Markdown | `⇧⌘C` | `docs` | `docs.copyAsMarkdown` | in-text |
| Larger text | `⌘=` | `docs` | `docs.textSizeUp` | in-text |
| Smaller text | `⌘-` | `docs` | `docs.textSizeDown` | in-text |
| Open nested file | `⌘↩` | `docs` | `docs.openNested` | native |
| Go to parent file | `⌘Esc` | `docs` | `docs.goToParent` | in-text |
| Focus mode | (menu only) | `docs` | `docs.focusMode` |  |
| Expand block | `⌥⌘]` | `docs` | `docs.expandBlock` | native |
| Collapse block | `⌥⌘[` | `docs` | `docs.collapseBlock` | native |
| Toggle block and descendants | `⌥ + Click` | `docs` | `docs.toggleDescendants` | native |
| Toggle block and siblings | `⇧ + Click` | `docs` | `docs.toggleSiblings` | native |
| Toggle block, siblings and descendants | `⌥⇧ + Click` | `docs` | `docs.toggleAll` | native |
| Insert row | `⌘↩` | `docs` | `docs.tableInsertRow` | native |
| Insert column | `⌥⌘↩` | `docs` | `docs.tableInsertColumn` | native |
| Remove row | `⌘⌫` | `docs` | `docs.tableRemoveRow` | native |
| Remove column | `⌥⌘⌫` | `docs` | `docs.tableRemoveColumn` | native |
| Heading 1 | `# + Space` | `docs` | `docs.mdHeading1` | native |
| Heading 2 | `## + Space` | `docs` | `docs.mdHeading2` | native |
| Heading 3 | `### + Space` | `docs` | `docs.mdHeading3` | native |
| Bulleted list | `⇧⌘8` / `* + Space` / `- + Space` | `docs` | `docs.mdBulletList` | native |
| Numbered list | `⇧⌘7` / `1. + Space` | `docs` | `docs.mdNumberedList` | native |
| Checklist | `_ + Space` | `docs` | `docs.mdChecklist` | native |
| Quote | `> + Space` | `docs` | `docs.mdQuote` | native |
| Line divider | `---` | `docs` | `docs.mdLineDivider` | native |
| Section divider | `***` | `docs` | `docs.mdSectionDivider` | native |
| Code block | ````` | `docs` | `docs.mdCodeBlock` | native |
| Emoji | `:name:` | `docs` | `docs.mdEmoji` | native |

#### Pointer and editing behaviours that are not key bindings

- Canvas: click places a tool's object at default size; drag sizes it; double-click on empty canvas creates a text (board) or nothing (wireframe); double-click on an object edits its text; `⌥`+drag duplicates; dragging from the quick-add `+` creates a connected copy; hovering a selected shape with `⇧` changes the quick-add direction.
- Mind map: hover "+" handles (child / sibling, left/right branch on the root), collapse button with descendant count, drag and drop re-parenting (child / sibling slot / root side) with live relayout and placeholder.
- Docs: `/` on an empty line opens the block menu (22 items in Whimsical's order, see research 03 section 2.2); `+` and drag handle left of each block.

---

## 7. Undo / redo

- **Host history** (`historyMode: 'host'`, all canvas kinds): `core/history.ts` `SnapshotHistory` per open tab. Every `onChange(next, opts)` records `{before, after}` references (Immer structural sharing keeps this cheap), limit 200 steps. Changes with the same `coalesceKey` within 1000 ms merge (typing in a node: key `text:<id>`; nudging: `nudge:<ids>`; colour slider: `style:<ids>`). `history: 'skip'` for normalisation (layout caches, migrations). `seal()` when the selection or tool changes so later edits do not merge.
- `⌘Z`/`⇧⌘Z`/`⌘Y` -> `edit.undo`/`edit.redo` (shell). The shell sets content to `entry.before`/`entry.after`, bumps `lastHistoryAction{kind, selection, seq}`; the canvas restores the selection (ids that still exist). Undo/redo also schedule autosave.
- While editing text inside a canvas object, ProseMirror's own history handles `⌘Z` (it prevents default first); leaving edit mode commits one coalesced change.
- **Editor history** (`docs`): TipTap history; the docs editor binds `edit.undo`/`edit.redo` while active.
- External reload (file changed on disk while clean) clears the history for that tab.

## 8. Autosave, watching, conflicts

- Autosave 500 ms after the last change, on tab close, on window blur, and on `app:beforeQuit`. Writes are serialized per file (no overlapping writes) via `writeFile(path, text, {expectedHash})`.
- Watcher events: `change` on an open, clean tab -> reload silently and show `shell:dialogs.fileChangedOnDisk`; on a dirty tab -> keep local content and overwrite on the next save (single-user, local edits win) after a toast. `unlink` -> mark the tab "deleted" (closing it or saving recreates it). Renames done inside the app update open tabs directly.
- Tree updates come from watcher events (no polling).

## 9. i18n

- i18next + react-i18next, initialised in `renderer/src/i18n/index.ts`; resources in `src/shared/i18n/locales/<lng>/<ns>.json` (shared with main for native dialogs).
- Namespaces = modules: `common`, `shell`, `menu`, `canvas`, `flowchart`, `mindmap`, `wireframe`, `board`, `draw`, `docs`. Each namespace file is owned by one module (section 2.3). (Deviation from a single `en.json`: one file per namespace avoids merge conflicts between parallel agents; adding French = adding `locales/fr/*.json`.)
- Keys: camelCase segments, nested by feature: `commands.<commandLocalName>` (labels of shortcut rows), `tooltips.*`, `contextBar.*`, `defaults.*` (default object text such as "Press me"), `errors.*`, `dialogs.*`, `placeholder.*`. Plurals with i18next suffixes `_one` / `_other`; interpolation `{{name}}`; never concatenate translated fragments.
- Typed keys: `i18next.d.ts` types `t()` from the English JSON, so a missing key is a compile error. Runtime keys stored in data (e.g. `ShortcutDef.labelKey`) go through `translateKey()`.
- Fallback: `fallbackLng: 'en'`, `returnEmptyString: false`; `npm run i18n:sync` mirrors new English keys into other locales with `""`. Language preference: `system` (macOS locale) or an explicit code; available languages are discovered from the locale folders.
- Default document text (sticky placeholder, "Central idea", wireframe "Press me") is translated when the object is created and then stored as user content.
- Only UI text is translated; user content never is. Lint rule by review: no string literals in JSX except punctuation/symbols; `aria-label`/`title` also via `t()`.

## 10. Design tokens and visual language

- CSS variables in `styles/tokens.css` (prefix `--wc-`), light and dark (`<html data-theme="dark">`, set by the shell from preference or `nativeTheme`). Values are Whimsical's own `--us-*` tokens (research 07 section 6): ink `#293744` on white, canvas `#f3f5f8`, chrome border `#d7dfe7`, accent purple `#8b30e4` (hover `#8013d9`), selection `#aa74f3`, snap guides `#b1223f`, links `#2484d4`, layered soft shadows, radii 4/6/8 px, menus 8 px.
- Fonts: Whimsical's own **Dinsical** (UI and board text) and **Monsical** (code) are SIL OFL; the CSS stack names them first and falls back to the macOS system font. Bundling the woff2 files under `src/renderer/src/assets/fonts/` with `@font-face` is a later task (needs the user's OK to download them). Base UI size 14 px; small 12 px.
- Canvas palette (`core/palette.ts`): 15 hues with strong/base/subtle/subtler/subtlest shades. Roles: shapes `fill` = base with `onFill` text; `border` style = soft fill + base stroke; sticky notes, sections and wireframe accents use the toned-down `soft` shade (Whimsical "colors toned down"). Highlighter offers the palette minus white/smoke/gray. Sticky default purple; new objects follow the last used colour.
- Text sizes (board px): XS 13, S 15, M 18 (default), L 21, XL 27, XXL 36; wireframe scale XS 10 ... XXL 32. `⌘⌥=`/`⌘⌥-` step through them.
- Grid: 12 px dots (visible from 100 % zoom) on boards; 1 px, invisible, in wireframe mode. Default sizes snap to the grid: shape 168x72, sticky 168x168, mind-map node height 36, text M.
- Icons: **lucide-react only**, 16-20 px, stroke 1.75, `currentColor`. Placement/meaning follow Whimsical; mapping (verified names in lucide-react 1.52): select `MousePointer2`, pan `Hand`, shapes `Shapes`, sticky `StickyNote`, mind map `Network`, connector `MoveUpRight`, text `Type`, section `SquareDashed`, table `Table`, image `Image`, link `Link`, icon tool `Smile`, freehand `Pencil`, highlighter `Highlighter`, eraser `Eraser`, wireframe mode `AppWindow`, components `Component`, frames `Frame`, annotation `MessageSquareText`, all tools `Plus`, command menu `Command`, search `Search`, sidebar `PanelLeft`, board file `LayoutDashboard`, flowchart file `Workflow`, mind-map file `Network`, wireframe file `AppWindow`, drawing file `PenLine`, doc file `FileText`, folder `Folder`, favourites `Star`, recent `Clock`, trash `Trash2`, lock `Lock`, group `Group`/`Ungroup`, layering `BringToFront`/`SendToBack`, align `AlignStart/Center/EndVertical|Horizontal`, distribute `AlignHorizontal/VerticalSpaceBetween`, zoom `ZoomIn`/`ZoomOut`/`Maximize`, undo `Undo2`/`Redo2`. User-insertable icons (icon tool, shape icons, node icons, file icons) are lucide kebab names rendered with `lucide-react/dynamic` (`DynamicIcon`), searchable by name + tags.
- Layout: left sidebar (resizable, pinnable, `⌘E`), tab strip in the title bar area (hidden-inset traffic lights), title with file actions chevron, breadcrumb; board left vertical toolbar; floating context bar above the selection; bottom-right cluster (hand, zoom %, command menu, help). Docs: centred column (narrow/wide), bottom-right "Text size and layout".

## 11. Per-module functional requirements (summary)

Each agent must read the research file(s) named here; this list states the minimum done-criteria.

- **canvas** (research 01, 06): everything in section 5.1; connector element with straight/curved/elbow, 13 endpoints, labels; quick add; RichTextEditor with Whimsical input rules; contextual toolbar framework; toolbar + All tools menu; export to SVG/PNG (selection, board, section/frame).
- **flowchart** (01): `shape` element with all 17 kinds rendered in SVG (cloud/star seeded wobble regenerated on resize), three fill styles + transparent, 90 degree rotation, auto-height growing downward, icon inside shape; shapes menu (`S`) with search; tools for every shape key; auto-layout vertical/horizontal (dagre) re-routing connectors; default size 168x72; `quickAdd: {connect: true}`.
- **board** (06): sticky notes (auto-grow, purple default, follow last colour, full palette soft shades, distribute as grid, paste as sticky notes one per line, `quickAdd: {connect:false}`), text, image (file picker, drag-drop, paste; asset import; captions; rotate), link cards, icon element + icon picker (`X`, lucide search), section (name, solid/outline, clip; wrap in section; contents move with it), table (create, add/remove rows/cols, header row, striped, cell colours), code block.
- **wireframe** (05): data-driven component registry (29 components with default size, props schema, renderer, context-bar controls, launcher icon), component launcher `E` (auto-focused search, fixed order), frame launcher `F` with digits 1-9, 9 device frames (status bar / keyboard toggles), overlay snapping into frames, annotations with auto-numbering, line with `⇧` direction / `⌘` full width, toned-down styling, no auto-layout in wireframe mode.
- **draw** (04): `stroke` element rendered with perfect-freehand (`thinning: 0`, constant width; marker thin 3 / thick 7, highlighter ~22 at 0.35 opacity, multiply), pointer capture, coalesced events, `touch-action: none`, pen eraser button auto-switch, whole-stroke eraser with constant screen radius and segment hit testing (rbush), dot strokes erasable, selector, Detect shapes (rectangle, circle, line, diamond) on pointer-up with undo restoring the raw stroke, resize scales points but keeps width, re-style pen type/colour after the fact.
- **mindmap** (02): `mindmapNode` elements, tidy-tree layout per side (horizontal both sides, vertical top-down), curved/elbow branches drawn in a `below` layer coloured per first-level branch, keyboard model (section 6.6 tables), collapse button with count and modifier clicks, drag/drop re-parenting with placeholder and cycle check, paste indented list onto the root -> children, copy subtree as indented list, `Shift+F12` relayout, root default "Central idea".
- **docs** (03): TipTap editor with block set (paragraph, H1-3, bullet/numbered/check lists, toggle list, table, code block with lowlight + language picker, callout 12 colours, quote levels, line/section divider, image, embed placeholder, file link), Whimsical input rules, `/` block menu, selection toolbar, block handle (`+`, drag, type menu), collapsible headings, Markdown round trip per section 3.2, per-viewer text size/width + block/word count footer, focus mode.
- **shell** (07): welcome/workspace picker, sidebar tree (create via `+`, rename, drag-drop move, favourites, recent, reveal, trash), tabs (`⌘T`, `⌘W`, `⌘1-9`, pin, duplicate, close others), title bar rename, editor host (section 5), autosave/watch/conflicts (section 8), host history, command menu `⌘K` (recent 3, fuzzy search of commands + files, shortcuts right-aligned), search panel (`⌘F` this file, `⌘J` workspace: names + extracted text), preferences (theme, language, invert zoom), help sheet, native menu sync, export dialog (PNG 1x/2x, transparent, selection; SVG; PDF via print; Markdown for docs), dark mode.
- **platform** (main): every IPC channel in section 4, watcher, asset protocol, prefs/view-state persistence, menu builder, multi-window, before-quit flush.

## 12. Testing

`npm test` (Vitest, jsdom). Required: pure logic is unit tested in the owning module (`*.test.ts` next to the code): layout algorithms, shape geometry, connector routing, hit testing, shape detection, eraser segment tests, Markdown round trip, IPC path validation (main tests use `// @vitest-environment node`). `app/registries.test.ts` guards the shared tables. `npm run typecheck` and `npm run build` must stay green after every agent.

## 13. Open questions and gaps (from research)

Exact palette hexes of canvas themes in dark mode, chrome pixel metrics, toolbar icon order, sticky default size, connector "three modes" names, full wireframe component states, device pixel sizes, and some shortcut contradictions are not verifiable without the live app; the decisions above are the clone's. Everything marked **ext** can be removed if the user prefers strict parity.
