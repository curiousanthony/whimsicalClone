# Whimsical Clone

A local-first macOS desktop clone of [Whimsical](https://whimsical.com): boards with sticky notes, flowcharts, mind maps, wireframes, freehand drawing and Markdown docs, driven by Whimsical's keyboard shortcuts.

There is no account, no cloud and no collaboration. You pick a workspace folder. Folders stay folders, and every board or doc is a plain file you own, so it works with Git, Dropbox, Time Machine or anything else that syncs files.

## Features

**Workspace and shell**
- Workspace = any folder on disk. The sidebar tree shows folders and app files. It supports create (`+`), rename, drag-and-drop move, duplicate, favourites, recent files, Reveal in Finder, and Move to Trash (the app never deletes permanently).
- Tabs (`⌘T`, `⌘W`, `⌘1`…`⌘9`, pin, duplicate, close others), title bar with breadcrumb and inline rename, folder views (list/grid), and a "New tab" home page.
- Command menu (`⌘K`) with recent commands, fuzzy search over commands and files, and shortcuts shown on the right. Search this file (`⌘F`) and search the workspace (`⌘J`, names and text).
- Native macOS menu bar generated from the same shortcut tables. Keyboard-shortcut help sheet (`?`). Preferences: theme (System/Light/Dark), language, invert zoom.
- Autosave (500 ms debounce, atomic writes, flushed before quit). An external-change watcher reloads clean files. On conflict, local edits win.
- Export: PDF through the print dialog for every file, and Markdown (download or copy) for docs. PNG/SVG export of boards is not implemented yet (see Status).

**Canvas (all board kinds share one engine and one file format)**
- Every canvas file can hold every object type: sticky notes, text, flowchart shapes, connectors (straight/curved/elbow, labels, endpoints), images, links, icons, sections, tables, code blocks, wireframe components, device frames, annotations, mind maps and pen strokes.
- Whimsical interactions: quick add (`⌥` + arrows and hover "+"), snapping and guides, multi-select, grouping, lock, arrange (`[` `]`), copy/paste style, last-used and default styles, zoom and pan, and per-viewer viewport.
- Flowcharts: shape keys (`R` rectangle, `U` pill, `O` oval, `D` diamond, `F` hexagon, `P` parallelogram, `G` triangle, `Y` cylinder…), auto layout.
- Mind maps: keyboard-only creation (`M` new map, `⇥` child, `↩` edit / sibling while editing, `⌘↩` sibling above, `⌥↩` parent), arrow-key navigation, collapse/expand, indent/outdent, relayout, paste a bulleted list as a mind map, copy as list.
- Wireframes: wireframe mode with a 1 px grid, components (button, input, avatar, image, line…), device frames, annotations and a component launcher.
- Freehand: marker, highlighter, eraser and selector. Strokes are smoothed with perfect-freehand, and pointer pressure from a tablet or Apple Pencil is recorded per point. Optional shape detection is available.

**Docs (`.md`)**
- TipTap editor with Whimsical's block set: headings, lists, checklists, toggle lists, tables, code blocks with syntax highlighting and a language picker, 12-colour callouts, quote levels, line and section dividers, images, embeds and workspace links.
- Whimsical input rules (`*bold*`, `_italic_`, `~strike~`, `_ ` checklist, `---`, `***`, `:emoji:`), the `/` block menu, the `@` file-link menu, a selection toolbar, and a block handle (`+`, drag, turn into, duplicate, delete).
- Collapsible headings, a table of contents, per-viewer text size and width (`⌘=` / `⌘-`), block and word count, and focus modes (full screen, paragraph focus, typewriter).
- Nested docs, boards and folders: the nested files of `Notes.md` live in the sibling folder `Notes/`. `⌘↩` opens a linked file and `⌘Esc` goes back to the parent doc.
- Files stay standard Markdown. Whimsical-only blocks use documented, round-tripping extensions (see `docs/SPEC.md` §3.2). Opening a file never rewrites it.

## File formats

| File | Extension | Opens as |
|---|---|---|
| Board | `.wboard` | General board (diagram mode, full toolbar) |
| Flowchart | `.wflow` | Board in diagram mode |
| Mind map | `.wmind` | Board seeded with a mind-map root |
| Wireframe | `.wwire` | Board in wireframe mode |
| Drawing | `.wdraw` | Board with the pen toolbar |
| Doc | `.md` (`.markdown` accepted) | Markdown editor |

Board files are versioned, human-readable JSON (`docs/SPEC.md` §3.1); unknown fields are preserved. Images are stored once, content-addressed, in `<workspace>/.whimsical/assets/` and referenced as `wsasset://<hash>.<ext>`. Per-viewer state (open tabs, viewports, collapsed headings, recents) lives in the app's user-data folder, never in your files.

## Keyboard shortcuts

The most used ones (macOS):

| Action | Keys |
|---|---|
| Command menu | `⌘K` |
| Search workspace / this file | `⌘J` / `⌘F` |
| Toggle sidebar | `⌘E` |
| New board | `⌥⌘N` |
| New tab / close tab / switch tab | `⌘T` / `⌘W` / `⌘1`…`⌘9` |
| Undo / redo | `⌘Z` / `⇧⌘Z` |
| Shortcut help sheet | `?` |
| Pan | `Space` + drag, or scroll |
| Rectangle, pill, oval, diamond | `R`, `U`, `O`, `D` |
| Connector / line | `C` / `L` |
| Sticky note / text / section | `N` / `T` / `.` |
| Quick add in a direction | `⌥` + arrow |
| Zoom in / out / to fit / 100 % | `=` / `-` / `1` / `0` |
| Mind map: new / child / sibling | `M` / `⇥` / `↩` (while editing) |
| Wireframe mode | `W` (frames `F`, button `B`, input `P`) |
| Marker / highlighter | `H` / `⇧H` |
| Docs: block menu / link / Markdown copy | `/` or `⌘/` / `⇧⌘U` / `⇧⌘C` |

The complete reference below is generated from the code tables (the same data drives key handling, the menu bar, tooltips, the command menu and the `?` sheet). Rows marked *clone addition* are not in Whimsical.

<details>
<summary><strong>App, files, tabs, edit and folder views</strong> (25)</summary>

| Action | Keys |
|---|---|
| Open command menu | `⌘K` |
| Search this file or folder | `⌘F` |
| Search workspace | `⌘J` / `⇧⌘F` |
| Open/hide sidebar | `⌘E` |
| Keyboard shortcuts | `⇧/` |
| Preferences… | `⌘,` |
| New board | `⌥⌘N` |
| Open workspace folder… *(clone addition)* | `⌘O` |
| New window *(clone addition)* | `⇧⌘N` |
| Export… | `⇧⌘E` |
| Print… | `⌘P` |
| Copy link to file | `⌘L` |
| New tab | `⌘T` |
| Close tab | `⌘W` |
| Next tab *(clone addition)* | `⌃⇥` |
| Previous tab *(clone addition)* | `⌃⇧⇥` |
| Switch to tab 1–9 | `⌘1` |
| Undo | `⌘Z` |
| Redo | `⇧⌘Z` / `⌘Y` |
| Select all | `⌘A` |
| List view | `L` |
| Grid view | `G` |
| Delete selected files | `⌫` / `⌦` |
| Open selected file *(clone addition)* | `↩` |
| Select multiple items | `⇧ + Click` |

</details>

<details>
<summary><strong>Canvas (every board kind)</strong> (53)</summary>

| Action | Keys |
|---|---|
| Zoom in | `=` / `⇧=` / `⌘=` |
| Zoom out | `-` / `⌘-` |
| Zoom to 100% | `0` / `⌘0` |
| Zoom to content | `1` |
| Zoom to selection | `2` |
| Zoom | `Z + Click` / `Z + Drag` / `⌘ + Scroll` |
| Pan | `Space + Drag` / `⇧ + Scroll` |
| All tools | `/` |
| Connector | `C` |
| Wireframe mode | `W` |
| Exit wireframe mode | `Q` |
| Hide quick add | `Q` |
| Quick add | `⌥↑` |
| Change quick add direction | `⇧ + Hover` |
| Deselect | `Esc` |
| Select multiple items | `⇧ + Click` |
| Deep select | `⌘ + Click` |
| Select all including locked | `⌘ + A + A` |
| Select next object *(clone addition)* | `⇥` |
| Select previous object *(clone addition)* | `⇧⇥` |
| Select nearest object in direction *(clone addition)* | `⌥⇧↑` |
| Edit text | `↩` / `⌘R` |
| Delete | `⌫` / `⌦` |
| Duplicate | `⌘D` / `⌥ + Drag` |
| Copy style | `⌥⌘C` |
| Paste style | `⌥⌘V` |
| Copy link to object | `⌥⇧⌘C` |
| Copy as image | `⇧⌘C` |
| Save as default style | `⇧⌘D` |
| Increase text size | `⌥⌘=` |
| Decrease text size | `⌥⌘-` |
| Bring to front | `]` |
| Bring forward | `⌘]` |
| Send to back | `[` |
| Send backward | `⌘[` |
| Group | `⌘G` |
| Ungroup | `⇧⌘G` |
| Lock / unlock | `⇧⌘L` |
| Resize with locked aspect ratio | `⇧ + Drag` |
| Resize from center | `⌥ + Drag` |
| Ignore auto-alignment (snap to grid only) | `⌘ + Drag` |
| Ignore grid and auto-alignment | `ˋ + Drag` |
| Measure distance | `⌥ + Hover` |
| Cancel move or resize | `Escape` |
| Increase width | `⇧⌘→` |
| Decrease width | `⇧⌘←` |
| Increase height | `⇧⌘↓` |
| Decrease height | `⇧⌘↑` |
| Move selection | `↑` |
| Move selection (large step) | `⇧↑` |
| Move selection by 1 px | `⌘↑` |
| Animate connector | `⌘ + Click` |
| Jump to the other end of a connector | `⌘ + Click` |

</details>

<details>
<summary><strong>Text editing on the canvas</strong> (13)</summary>

| Action | Keys |
|---|---|
| Bold | `⌘B` |
| Italic | `⌘I` |
| Strikethrough | `⇧⌘X` |
| Inline code | `⇧⌘K` |
| Highlight | `⇧⌘H` |
| Add link | `⇧⌘U` |
| Paragraph | `⌘\` |
| Bulleted list | `⇧⌘8` / `* + Space` / `- + Space` |
| Numbered list | `⇧⌘7` / `1. + Space` |
| Checklist | `_ + Space` |
| Line break | `⇧↩` |
| Link to a file | `@` |
| Stop editing | `Esc` |

</details>

<details>
<summary><strong>Flowchart shapes</strong> (15)</summary>

| Action | Keys |
|---|---|
| Diagram shapes | `S` |
| Rectangle | `R` |
| Pill | `U` |
| Oval | `O` |
| Diamond | `D` |
| Hexagon | `F` |
| Parallelogram | `P` |
| Triangle | `G` |
| Cylinder | `Y` |
| Line | `L` |
| Bracket | `B` |
| Star | `V` |
| Cloud | `J` |
| Lay out vertically | `⌥⇧V` |
| Lay out horizontally | `⌥⇧H` |

</details>

<details>
<summary><strong>Board objects</strong> (7)</summary>

| Action | Keys |
|---|---|
| Sticky note | `N` |
| Text | `T` |
| Image | `I` |
| Link | `K` |
| Icon | `X` |
| Section | `.` |
| Table | `E` |

</details>

<details>
<summary><strong>Wireframes</strong> (13)</summary>

| Action | Keys |
|---|---|
| Annotation | `A` |
| Button | `B` |
| Line | `L` / `D` |
| Components | `E` |
| Frames | `F` |
| Image | `G` |
| Circle | `O` |
| Input | `P` |
| Rectangle | `R` |
| Avatar | `V` |
| Rename frame | `Enter` |
| Change line direction (hold) | `⇧` |
| Full-width/height line (hold) | `⌘` |

</details>

<details>
<summary><strong>Freehand drawing</strong> (6)</summary>

| Action | Keys |
|---|---|
| Marker | `H` |
| Highlighter | `⇧H` |
| Eraser | `E` |
| Selector | `S` |
| Exit freehand | `Esc` |
| Pen options *(clone addition)* | `⇧C` |

</details>

<details>
<summary><strong>Mind maps</strong> (30)</summary>

| Action | Keys |
|---|---|
| Mind map | `M` |
| Add child | `⇥` |
| Edit node text | `↩` |
| Add sibling above | `⌘↩` |
| Add parent | `⌥↩` |
| Select parent | `⇧⇥` |
| Navigate up | `↑` |
| Navigate down | `↓` |
| Navigate left | `←` |
| Navigate right | `→` |
| Collapse / expand | `⌘/` |
| Collapse | `⌥⌘[` |
| Expand | `⌥⌘]` |
| Collapse / expand all descendants | `⌥ + Click` |
| Collapse / expand siblings | `⇧ + Click` |
| Collapse / expand level | `⌥⇧ + Click` |
| Delete node | `⌫` / `⌦` |
| Duplicate node | `⌘D` |
| Add icon | `⇧X` |
| Add link | `⇧⌘U` |
| Increase indent | `⌃⌘]` |
| Decrease indent | `⌃⌘[` |
| Move up among siblings *(clone addition)* | `⇧⌘↑` |
| Move down among siblings *(clone addition)* | `⇧⌘↓` |
| Lay out mind map | `⇧F12` |
| Add sibling | `↩` |
| Add child | `⇥` |
| Add sibling above | `⌘↩` |
| Add line break | `⇧↩` |
| Stop editing | `Esc` |

</details>

<details>
<summary><strong>Docs</strong> (38)</summary>

| Action | Keys |
|---|---|
| Paragraph | `⌘\` |
| Bold | `⌘B` / `*text*` |
| Italic | `⌘I` / `_text_` |
| Strikethrough | `⇧⌘X` / `~text~` |
| Inline code | `⇧⌘K` / `ˋtextˋ` |
| Highlight | `⇧⌘H` |
| Add link | `⇧⌘U` / `⌥K` |
| Workspace link | `@` |
| Change block type | `⌘/` / `/` |
| Increase indent | `⇥` |
| Decrease indent | `⇧⇥` |
| Code block language (in a code block) | `⇧⌘K` |
| Copy link to block | `⌥⇧⌘C` |
| Copy as Markdown | `⇧⌘C` |
| Larger text | `⌘=` |
| Smaller text | `⌘-` |
| Open nested file | `⌘↩` |
| Go to parent file | `⌘Esc` |
| Expand block | `⌥⌘]` |
| Collapse block | `⌥⌘[` |
| Toggle block and descendants | `⌥ + Click` |
| Toggle block and siblings | `⇧ + Click` |
| Toggle block, siblings and descendants | `⌥⇧ + Click` |
| Insert row | `⌘↩` |
| Insert column | `⌥⌘↩` |
| Remove row | `⌘⌫` |
| Remove column | `⌥⌘⌫` |
| Heading 1 | `# + Space` |
| Heading 2 | `## + Space` |
| Heading 3 | `### + Space` |
| Bulleted list | `⇧⌘8` / `* + Space` / `- + Space` |
| Numbered list | `⇧⌘7` / `1. + Space` |
| Checklist | `_ + Space` |
| Quote | `> + Space` |
| Line divider | `---` |
| Section divider | `***` |
| Code block | `ˋˋˋ` |
| Emoji | `:name:` |

</details>

## Development

Requirements: macOS and Node.js 22 or 24 LTS (Node 25 works, with engine warnings from some packages).

```bash
npm install          # once
npm run dev          # Electron + Vite with hot reload
npm run typecheck    # tsc, strict (main/preload/shared, then renderer)
npm test             # Vitest (unit, jsdom component and integration tests)
npm run build        # typecheck + production bundle in out/
npm run preview      # run the production bundle
npm run i18n:sync    # mirror new English keys into the other locales
npm run format       # prettier
```

On first launch, choose a workspace folder (or create an empty one). The app reopens the last workspace on the next launch.

## Building the macOS app

```bash
npm run dist:mac     # .dmg and .zip in release/, for the architecture of the build machine
```

The build is **not signed or notarized**. On another Mac, open it with right-click > Open the first time, or sign it yourself (set `CSC_LINK` / `CSC_KEY_PASSWORD` and the notarization variables for electron-builder). App settings live in `electron-builder.yml` and `build/entitlements.mac.plist`.

## Adding a language

All user-visible strings go through i18next. English is the source of truth, with one JSON file per namespace (= module) in `src/shared/i18n/locales/en/`.

1. Create the placeholder files for the new language, e.g. German:
   ```bash
   npm run i18n:sync -- de
   ```
   This writes `src/shared/i18n/locales/de/<namespace>.json` with the same keys and empty strings.
2. Translate the values. Empty strings fall back to English, so you can ship a partial translation. Keep `{{placeholders}}` and the `_one` / `_other` plural suffixes. Add other plural forms (`_few`, `_many`) if the language needs them.
3. Rebuild. Languages are discovered at build time (`import.meta.glob` in `src/shared/i18n/resources.ts`), so nothing needs registering. The language appears in Preferences > Language under its native name. "System" picks it automatically when macOS uses that language.

French placeholders already exist in `locales/fr/`, but they are empty: choosing Français currently shows English. When you add English keys later, run `npm run i18n:sync` to add them to every other language.

## Project layout

```
src/shared/      types and data shared by main, preload and renderer (IPC contract, key grammar, file kinds, menu model, locales)
src/main/        Electron main process: workspace, file system (atomic writes, path containment), watcher, wsasset:// protocol, menu, preferences, view state
src/preload/     window.api bridge (contextIsolation + sandbox)
src/renderer/src/
  core/          frozen contracts: types, shortcut registry, undo history, board format, palette
  canvas/        the canvas engine shared by every board kind (public API: canvas/index.ts)
  editors/       flowchart, board, wireframe, draw, mindmap (canvas plugins) and docs (TipTap)
  shell/         sidebar, tabs, title bar, command menu, search, preferences, export, editor host, autosave
  ui/            shared UI primitives (buttons, menus, tooltips, icons via lucide-react)
  app/           registries wiring editors and plugins together, plus integration tests
  i18n/ styles/  i18next setup, design tokens
```

The architecture, file formats, IPC contract, editor and canvas plugin contracts, shortcut registry design and scopes are in [`docs/SPEC.md`](docs/SPEC.md). The Whimsical research behind it is in `docs/research/`.

Conventions:
- TypeScript strict everywhere. Code, comments and docs are in English.
- Icons come only from `lucide-react`. They match Whimsical's icon placement and meaning, not its artwork.
- Shortcuts are data: each module declares them in its `shortcuts.ts`. `src/renderer/src/app/registries.test.ts` and `integration.test.ts` fail on duplicate ids, missing labels, unknown icons, or two commands bound to the same key in one scope.

## Testing

`npm test` runs about 620 tests:
- pure logic: geometry, layout, Markdown round trip, shortcut parsing, paths;
- jsdom component tests: canvas engine, mind-map keyboard flows, wireframe plugin, docs editor;
- integration tests (`src/renderer/src/app/integration.test.ts`): every file kind opens with its editor, every format survives the real autosave path byte-for-byte, and no shortcut is ambiguous.

The jsdom warning `HTMLCanvasElement's getContext() ... not implemented` is expected, because text measurement falls back to an estimate in tests.

## Status versus Whimsical

Implemented: everything listed under Features. Known gaps and differences:

- **Out of scope by design:** accounts, sharing, real-time collaboration, comments, mentions of people, cloud version history, AI, voting, timer, presentation mode, Mermaid import/export.
- **PNG/SVG export of boards:** not implemented. The shell's export dialog is ready, but the canvas does not register an image exporter yet, so boards export to PDF only.
- **Pen pressure:** pressure is recorded per point, but strokes render at constant width (a deliberate decision, see `docs/research/00-user-decisions.md`).
- **Embeds:** YouTube, Figma, Loom and other embeds show as link cards (the app is offline-first and its CSP forbids frames). Board embeds in docs are link cards with an "Open board" button, not live previews.
- **Markdown formatting:** opening a doc never rewrites it, but the first edit saves the whole file in canonical style (`-` bullets, `_italic_`, `**bold**`, fenced code). Content is preserved; only formatting may change.
- **Mind maps from other tools:** node positions are recomputed by the auto layout on open, so a hand-written `.wmind` file is re-saved with laid-out positions.
- **Nested files** map to a sibling folder (`Notes.md` -> `Notes/`). Whimsical's "show deleted nested files" has no equivalent; trashed files go to the macOS Trash.
- **Fonts:** Whimsical's own fonts are not bundled; the UI uses the macOS system font.
- **Accessibility details:** TipTap's checklist checkboxes announce an English label. The callout icon menu lists icon identifiers rather than translated names.
- **Bundle size:** the renderer is about 3.7 MB (plus 1.5 MB for the lazily loaded docs editor). That's fine for a desktop app but not code-split further.
- **Distribution:** unsigned builds only (see above).

