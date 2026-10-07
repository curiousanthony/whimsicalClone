# 01 - Whimsical Flowcharts / Diagram Shapes (Boards): Research

Research date: 2026-10-07. Target: macOS clone. Confidence tags used throughout:

- **[P]** primary source (official Whimsical help center / release notes, fetched this session)
- **[S]** secondary (summarised from third-party text; treat as hint)
- **[?]** unverified or inferred; do NOT implement as fact without checking the real app

> IMPORTANT product-model finding: in current Whimsical (2026), **Flowcharts, Wireframes, Sticky notes, Cards and Stacks are all one file type: "Board"** (release 2023.22 "toolbar changes"). A flowchart is just a Board using the "Diagram shapes" tools. Wireframe mode is a **toggle inside the same board** (key `W`). Mind maps and Docs remain separate file types. The shortcut page is therefore *one keymap shared by the whole canvas*, with tool/mode-scoped collisions (section 3). The clone's "Flowchart" and "Board" should be the same canvas engine.

---

## 0. Mac key notation legend

| Symbol | Key | Notes |
|---|---|---|
| ⌘ | Command | Whimsical's "Command" |
| ⌥ | Option | "Alt" on PC; used for Quick add and for Duplicate-by-drag |
| ⇧ | Shift | |
| ⌃ | Control | Only used in mind-map indent shortcuts |
| ` | Backtick | Disables auto-alignment AND grid snapping while dragging |
| `[` `]` | Brackets | Layer ordering (send to back / bring to front) |
| ⌫ / Delete | Delete or Backspace | Both delete |
| Esc | Escape | Deselect; also leaves nested text toolbar |

---

## 1. Source list

| Tag | URL |
|---|---|
| Mac shortcuts (primary keymap) | https://whimsical.com/learn/shortcuts/mac |
| PC shortcuts | https://whimsical.com/learn/shortcuts/pc |
| Getting started with flowcharts | https://whimsical.com/learn/get-started/flowcharts |
| Customizing diagram shapes | https://whimsical.com/learn/boards/customize-shapes |
| Working with connectors | https://whimsical.com/learn/boards/connectors |
| Grid and auto-alignment | https://whimsical.com/learn/boards/grid |
| Tidy boards (align / distribute / auto-layout) | https://whimsical.com/learn/boards/tidy-boards |
| Using Whimsical Boards (UI map) | https://whimsical.com/learn/boards/using-boards |
| Infinite canvas | https://whimsical.com/learn/get-started/infinite-canvas |
| Command menu | https://whimsical.com/learn/get-started/command-menu |
| Save default object style | https://whimsical.com/learn/boards/save-default-object-style |
| Measuring | https://whimsical.com/learn/boards/measuring |
| Filter selection | https://whimsical.com/learn/faqs/filter-objects |
| Sections | https://whimsical.com/learn/boards/sections |
| Tables | https://whimsical.com/learn/boards/tables |
| Sticky notes | https://whimsical.com/learn/boards/sticky-notes |
| Freehand | https://whimsical.com/learn/boards/freehand |
| Lines FAQ | https://whimsical.com/learn/faqs/lines |
| Paste as | https://whimsical.com/learn/boards/paste-as |
| Mermaid | https://whimsical.com/learn/boards/mermaid |
| Markdown support | https://whimsical.com/learn/faqs/markdown-support |
| Zoom direction | https://whimsical.com/learn/faqs/zoom-direction |
| Custom colors/themes | https://whimsical.com/learn/themes/custom-colors |
| Colors toned down | https://whimsical.com/learn/faqs/colors-toned-down |
| Dark mode | https://whimsical.com/learn/settings/dark-mode |
| Blog: contextual toolbars deep dive | https://whimsical.com/blog/contextual-toolbars-deep-dive |
| Blog: designed for speed | https://whimsical.com/blog/how-we-designed-whimsical-for-speed |
| Release notes 2026 / 2025 / 2024 / 2023 | https://whimsical.com/releases/year/2026 (etc.) |
| Release 2026.2 command menu & colors | https://whimsical.com/releases/2026-2-command-menu-and-colors |
| Release 2026.7 elbow connectors | https://whimsical.com/releases/2026-7-connectors-and-claude |
| Release 2026.10 flowchart icons | https://whimsical.com/releases/2026-10-better-search-and-flowchart-icons |
| Product update ERD endpoints (2024.26) | https://whimsical.com/product-updates/erd-endpoints |
| Product update flowchart expand (2023.28) | https://whimsical.com/product-updates/more-consistent-flowcharts |

Caveat: some pages were read through a summarising fetcher, so wording is paraphrased; exact facts (key combos, numbers) were taken from the shortcut tables and help text, which were reproduced as lists.

---

## 2. Shapes (flowchart / diagram shapes)

Menu: toolbar icon **"Diagram shapes"**, key **S** opens it. **`/`** opens "All tools" search (also reachable via the "+" icon). Shapes can be swapped for one another while keeping colors/borders. [P]

Official list of 16 diagram shapes [P]: Rectangle (square), Pill, Oval (circle), Diamond, Parallelogram, Flipped Parallelogram, Trapezoid, Triangle, Hexagon, Cylinder, Sequence Diagram actor, Annotation, Line, Bracket, Cloud, Star.

| Shape | Direct key (Mac & PC) | Source | Notes |
|---|---|---|---|
| Rectangle | R | [P] shortcuts | "Rectangle (square)"; default rounded-corner look [S: "rounded corners, subtle shadows" from speed blog] |
| Pill | U | [P] | |
| Oval (circle) | O | [P] | |
| Diamond | D | [P] | decision node |
| Trapezoid | A | [P] | collides with Annotation/Task `A` in other modes |
| Triangle | G | [P] | collides with Image `G` in wireframe mode |
| Hexagon | H | [P] | collides with Marker `H` in freehand |
| Cylinder | Y | [P] | |
| Line | L | [P] | straight, solid/dashed, cannot curve; same key as Connector |
| Bracket | B | [P] | |
| Star | V | [P] | cloud/star outline is randomised ("splash of randomness") and regenerates on resize |
| Cloud | J | [P] | same randomised edge behaviour |
| Parallelogram / Flipped parallelogram | none listed | [P] list only | menu or `/` search |
| Sequence-diagram actor | none listed | [P] | menu or `/` |
| Annotation | `A` in wireframe mode | [P] | sequential numbering/icon, can point to any element via arrow connector |
| Table | E | [P] | also `/table` command; paste from Sheets/Numbers/Excel |
| Image | I | [P] | (G in wireframe mode) |
| Link | K | [P] | |
| Text | T | [P] | |
| Icon | X | [P] | searchable icon library ("thousands" of vector icons) [S speed blog] |
| Section | `.` | [P] | also canvas menu, or "Wrap in section" on a selection |
| Cross (✕) shape for rejections | none listed | [P] release 2026.4 | added in 2026.4 |
| Code block | none listed | [P] release 2026.11 | standalone code object |

Shape behaviours [P unless noted]:

- **Rotation**: only 90 degree increments. Text objects cannot be rotated.
- **Border/fill styles (three)**: (1) solid fill, (2) solid border with lighter fill, (3) dashed border. Shapes can also be fully transparent (outline only). *(Note: an earlier search summary mis-assigned "outline/fill/dash" to connectors; these are shape styles.)*
- **Color**: theme-based palette + custom colors (2026.2: "+" button in picker opens visual picker, hex entry and eyedropper; custom colors are reusable and editable via right-click, changing all objects using it; custom colors are per board). "Last used color sticks": once you set a shape's color, subsequent shapes of that type use the same color. Dark mode exists app-wide (system default).
- **Resize**: drag edges/corners; exact pixel size is shown while resizing. `⇧+drag` locks aspect ratio, `⌥+drag` resizes from center.
- **Growth direction**: flowchart shapes that expand to fit text grow **vertically, downward** (release 2023.28).
- **Icons inside shapes**: since 2026.10 icons can be placed inside flowchart shapes. [P] (exact placement/layout [?]).
- **Text**: sized with t-shirt sizes (XS, S, M, L, XL; wireframe text also XXL) rather than point sizes [S + P release 2026.10/2026.12]. Bold/italic available in the text toolbar [P]. Markdown typing shortcuts work in text (see appendix A.5).
- **Increase/decrease font size of text in object**: ⌘⌥= / ⌘⌥- [P].
- **Default style per board**: right-click > "Save as default style" (⌘⇧D). Saves color/fill/text format for shapes/text/stickies; line color/style/endpoints for connectors; frames/annotations style. Board-scoped only; per-word formatting not saved. "Paste style" (⌘⌥C copy style, then paste) applies to existing objects. [P]
- "Detect shapes" auto-straightening exists only for freehand (section A.3).

---

## 3. Keymap: general Board / diagram shortcuts (Mac)

All rows [P] from https://whimsical.com/learn/shortcuts/mac.

### 3.1 File / workspace-level (relevant to app chrome)

| Action | Keys |
|---|---|
| Open command menu | ⌘K |
| Select multiple items | ⇧+Click |
| Select all | ⌘A |
| Deselect | Esc |
| Comment | ⌘⌥M |
| Show/Hide comments | ⇧⌥C |
| Search within current file/folder | ⌘F |
| Search workspace | ⌘J or ⌘⇧F |
| Switch to workspace search (field open) | ⌘Enter |
| Open/Hide sidebar | ⌘E |
| Share menu | ⌘⇧S (⌘⌥S on Firefox) |
| Open Export tab | ⌘⇧E |
| Print board/doc | ⌘P |
| New file or folder | ⌘⌥N |
| Folder list view / grid view | L / G (in folder view) |
| Delete selected file(s)/folder(s) | Delete / Backspace |

### 3.2 Board canvas, general

| Action | Keys |
|---|---|
| Zoom | Z+Click/Drag; ⌘+Scroll |
| Zoom in / out | `=` / `-` |
| Zoom to 100% | 0 |
| Zoom to content (fit all) | 1 |
| Zoom to selection | 2 |
| Pan | Space+Drag; ⇧+Scroll; two-finger swipe; hand icon (bottom-right) for persistent pan |
| Undo / Redo | ⌘Z / ⌘⇧Z |
| Copy / Paste | ⌘C / ⌘V |
| Copy style | ⌘⌥C |
| Copy link to object | ⌘⌥⇧C |
| Copy as image | ⌘⇧C |
| Duplicate | ⌘D or ⌥+Drag |
| Bring to front | `]` |
| Bring forward | ⌘] |
| Send to back | `[` |
| Send backward | ⌘[ |
| Resize with locked aspect ratio | ⇧+Drag |
| Resize from center | ⌥+Drag |
| Edit text | Enter |
| Group / Ungroup | ⌘G / ⌘⇧G |
| Deep select (select inside group) | ⌘+Click |
| Ignore auto-snapping while moving | ⌘+Drag *(see conflict note below)* |
| Ignore grid AND auto-snapping while moving | ` (backtick) + Drag |
| Save as default style | ⌘⇧D |
| Increase / decrease text size in object | ⌘⌥= / ⌘⌥- |
| Animate connector | ⌘+Click |
| Measure distance between objects | select object, hold ⌥, hover other |
| Toggle wireframe mode | W |
| Zoom direction | ⌘+Scroll; default = scroll down zooms in (Figma-like); inverted option in Preferences > Advanced |
| Lock object | ⌘⇧L |

**Conflict note** [P, conflicting]: the shortcut table says ⌘+Drag = "ignore auto-snapping" while the grid help article says "⌘/Ctrl+Drag = skip auto-alignment and snap **only to the grid**", and "backtick = disable both". Implement the help-article semantics: ⌘ = grid only, ` = nothing.

**Conflict note 2**: "Animate connector" is ⌘+Click on a connector per the shortcut table, and the connectors help page says ⌘+Click on a connector **end** "takes you to the other end". A search snippet claimed ⇧⌥C animates connectors; no primary source confirms that. Recommend: ⌘+Click on connector body = animate toggle (flow animation), ⌘+Click on an end handle = jump selection/view to the other end.

### 3.3 Diagram / flowchart tool keys

| Action | Keys |
|---|---|
| Rectangle / Pill / Oval / Diamond / Trapezoid / Triangle / Hexagon / Cylinder | R / U / O / D / A / G / H / Y |
| Line / Bracket / Star / Cloud | L / B / V / J |
| Table / Image / Link / Text / Icon | E / I / K / T / X |
| Connector | C or L |
| Section | `.` |
| Diagram shapes menu | S |
| All tools search | `/` |
| **Quick add** (create connected shape from selected shape) | ⌥+Arrow key |
| Change quick-add direction | ⇧+Hover over quick-add button |
| Hide quick add buttons | Q |
| Lock object | ⌘⇧L |

### 3.4 Key collisions: the clone needs a tool/mode-scoped keymap

| Key | Meanings (context) |
|---|---|
| **L** | Line (diagram shapes) / Connector ("C or L") / Line (wireframe "L or D") / Folder list view (file view) |
| **H** | Hexagon (shapes) / Marker (freehand) |
| **E** | Table (shapes) / Eraser (freehand) / Component (wireframe) / sidebar toggle is ⌘E |
| **G** | Triangle (shapes) / Image (wireframe) / Folder grid view (file view) |
| **A** | Trapezoid (shapes) / Annotation (wireframe) / Task (task mode) |
| **S** | Diagram shapes menu / Selector (freehand) / Stack (task mode) |
| **D** | Diamond (shapes) / Line (wireframe, "L or D") |
| **R** | Rectangle (shapes and wireframe) |
| **O** | Oval (shapes) / Circle (wireframe) |
| **B** | Bracket (shapes) / Button (wireframe) |
| **F** | Frame (wireframe) |
| **P** | Input (wireframe) |
| **V** | Star (shapes) / Avatar (wireframe) |
| **N** | Sticky note |
| **M** | Add mind-map root node |
| **I** | Image (shapes) |
| **⌘+Click** | Deep select / animate connector / jump to opposite connector end |
| **⌘+Drag** | Grid-only snapping (duplicate is ⌥+Drag) |

Interpretation [?]: wireframe keys apply when W mode is on; freehand keys (H, ⇧H, E, S) per the freehand help page ("Press H to access freehand tools"). The Mac shortcut table lists H for BOTH Hexagon and Marker (and E for Table and Eraser) with no scoping statement. Unresolved; see Gaps.

---

## 4. Connectors [P unless marked]

- **Draw**: tool `C` (or `L`), drag from a shape/object to another. A **purple box** highlights the target; release to attach. A connector can attach to any item (shapes, text, sticky, tables). On tables a purple outline lets you choose the whole table or a single cell. Connectors can also be freestanding (2026.2: "freestanding connectors can move freely").
- **Quick add**: four buttons around a selected shape create a new connected shape (same style remembered). Keyboard: ⌥+Arrow. ⇧+hover on the quick-add button changes direction. `Q` hides the buttons.
- **Path styles**: **elbow** or **curved**, chosen per connector with one toolbar icon. A straight connector can have points added to bend it (lines FAQ). Straight connector also exists.
- **Handles**: selected connectors show attachment points (2026.2); elbow and curved connectors have draggable handles for edges and control points; elbow connectors snap to nearby edges while moved. 2026.7: elbow connectors find cleaner paths automatically and stay tidy when the diagram changes.
- **Endpoints**: "eight different types of endpoints or none", independently per end. Customised through the connector's toolbar (three-dots menu) [P]. 2024.26 added **four ERD endpoints** (crow's-foot style cardinality marks) [P that they exist; their names/artwork [?]]. Likely set includes plain arrow, and ERD one/many/zero marks [?].
- **Labels**: "When you first draw a connector, you'll see the option to add text." Double-click to edit; drag the label along the connector; label color customisable; optional white background; 2026.4: labels no longer overlap other connectors.
- **Move**: click and drag anywhere along the connector except the end handles to reposition. ⌘+Click on an end handle jumps to the other end.
- **Animation**: ⌘+Click animates a connector (flow animation shown in presentations) [P, mechanism light].
- **Style props** (saved by "Save as default style"): line color, line style, arrow endpoints. Dashed/solid line option exists for the Line element; for connectors dash options are [?].
- **Mermaid**: pasting Mermaid flowchart code (⌘V) builds a flowchart; supports rect `[]`, diamond `{}`, pill `([])`, circle `(())`, hexagon `{{}}`, cylinder `[()]`, TB/LR/RL/BT directions, subgraphs -> grouped shapes, dashed/bidirectional connectors; exportable back to Mermaid. [P]

---

## 5. Canvas behaviours

| Feature | Details | Src |
|---|---|---|
| Infinite canvas | Pan with Space+drag / two-finger swipe / hand tool; zoom pinch, ⌘+scroll, `=` `-` `0` `1` `2`; zoom % menu bottom-right | P |
| Grid | Dots visible at >=100% zoom; spacing **12px in boards, 1px in wireframe mode**; objects snap to grid lines even when dots hidden; "Snap to grid" command realigns selection | P |
| Smart guides | Guidelines appear when a moved item aligns with the **center or edges** of another; non-grid-aligned items can pull neighbours to snap to them | P |
| Modifier overrides | ⌘+drag: grid only; backtick+drag: no snapping | P |
| Measure | Select item, hold ⌥, hover another: shows distance between top/bottom edges and nearest sides gap | P |
| Multi-select | ⇧+click, marquee [?], ⌘A, "Filter selection" (by type, shape or color; selecting a section includes its contents) | P |
| Contextual toolbar | Appears next to the selection; only shows options valid for all selected objects (group, align, distribute...) | P |
| Align | Six: left, center horizontally, right, top, center vertically, bottom; leftmost/topmost object is the anchor; needs 2+ objects | P |
| Distribute | Horizontal / vertical, needs 3+ objects; "grid" distribution for sticky notes only | P |
| Auto-layout | 2+ connected non-connector objects (shapes, stickies, icons, images, text, links): "Lay out vertically" (top-to-bottom) or "Lay out horizontally" (left-to-right); re-routes connectors; one-click flowchart auto-layout released 2026.4; **not available in wireframe mode** | P |
| Group / ungroup | ⌘G / ⌘⇧G; ⌘+click deep-selects | P |
| Layers | `[` send to back, `]` bring to front, ⌘[ / ⌘] one step | P |
| Lock | ⌘⇧L | P |
| Sections | `.` key or toolbar; wrap selection; solid or outlined bg (muted theme colors); content can overflow or be clipped; sections double as presentation slides; copy link to section | P |
| Presenting | Sections as slides | P |
| Command menu | ⌘K, shows top 3 recent commands, context-aware, shows shortcuts; also bottom-right icon | P |
| Copy as SVG/image | ⌘⇧C copy as image; 2026.6 "Copy as SVG" | P |
| Paste as | right-click or ⌘K > "Paste as": sticky notes, mind map, bulleted list, table; tables from Sheets/Excel/Notion convert | P |
| Paste from other tools | 2026.13: paste from Miro, FigJam, Lucidchart, Lucidspark, Excalidraw, tldraw, Canva, Visio, Mural as editable objects | P |
| Performance guideline | >10,000 items slows | P |
| Multi-page files | 2026.12 | P |
| Undo/redo | ⌘Z / ⌘⇧Z | P |

Align/distribute/auto-layout have **no documented keyboard shortcuts**; the help page says "context menus, keyboard shortcuts, or the command menu" but the shortcut table lists none. Treat as menu/command-menu only [?].

---

## 6. UI chrome: toolbar, contextual toolbar, menus

### 6.1 Layout [P unless noted]

- **Main (left) toolbar**: "just 6 clickable items" in the older design (speed blog) [S]. Today: top section has flowchart elements (Diagram shapes), wireframe mode switch and cards, below that a searchable **"All tools"** menu (the "+" button, `/` key) with extras such as timer and voting for live sessions. A 2026 update made the toolbar "more compact with easier switching between diagramming and wireframing" and moved the "?" menu to the left navigation [S].
- **Per-board toolbar entries** (from the shortcut/learn pages): Sticky note (N), Diagram shapes (S), Text (T), Connector (C), Image (I), Link (K), Icon (X), Section (.), freehand pencil group (Marker H / Highlighter ⇧H / Eraser E / Selector S), wireframe toggle (W), Table (E), AI (⌘.).
- **File actions**: dropdown next to the file title (move, copy, delete, theme, settings). Search is in the sidebar; version history and spellcheck are in the file menu; export is in the Share menu (2024.34). Voting is in the toolbar below Timer.
- **Bottom-right cluster**: Help menu "?" (earlier) / zoom % menu / hand (persistent pan) icon / command-menu icon.
- **Sidebar** (⌘E toggles): workspace file tree; dark sidebar since 2024.28.

### 6.2 Contextual toolbar design rules (blog, [P/S])

- Floating toolbar adjacent to the selected object(s). Controls: **On/Off toggles**, **visible multi-select** (options shown inline), **popup multi-select** (used for 4+ options; the team limits these because they cost an extra click).
- Hierarchy: object-specific controls first (size, style, color, alignment), then global controls (duplicate, comment, deselect).
- **Text controls are a nested layer**: open with `Enter` or by clicking the "T" icon; leave with `Esc` or the back arrow.
- Visual detail: faint containers group inline multi-selects; two divider sizes (larger = category, smaller = within category); **purple indicator ticks** mark controls that open further menus.
- 7 distinct contextual toolbars for diagram objects (at the time of the blog); 15 more planned for wireframes.
- Defaults are visually "designed": rounded corners, subtle shadows, curated typography.

### 6.3 Text editing

- `Enter` on a selected object enters text edit; double-click also (connector labels confirmed). Typing on a selected shape probably starts editing [?].
- Markdown-style typing shortcuts (headings `#`, lists `-`/`*`/`1.`/`_ `, quotes `>`, `---`, code fence, `*bold*`, `_italic_`, backticks) [P for Docs/boards markdown page; applicability inside shapes [?]].
- ⇧+Enter line break (listed under mind map; likely general [?]).
- Link in text: ⌘⇧U.
- Mentions: `@` (workspace link).

### 6.4 Colors [mostly gap]

- Palette is theme-based; default theme applies to new boards; custom themes and per-board custom colors exist. Flowchart shapes render fully saturated; stickies, sections and wireframe components use "toned down" lighter versions of the theme colors by design. Sticky default color is **purple**.
- Marketing-site only (NOT canvas) tokens from a third-party design-token page, label as "marketing site": deep plum `#250835`, purple `#ba59ff`, magenta `#ff59f1`, aqua `#3ca1ff`, pale purple `#e9bded`, lilac `#efe3ed`, off-white `#f5f4f5`; fonts Agrandir (display) and Manrope (UI). The "purple box" connector highlight and purple UI accents suggest a violet accent for the app, but **exact in-app hex values were not found**.
- Miro sticky-note hex values encountered in search results are Miro's, not Whimsical's. Ignore.

---

## 7. Appendix A: shared key namespace for Boards (required modes)

### A.1 Sticky notes [P]

| Action | Keys |
|---|---|
| Add sticky note | N (or drag from left toolbar) |
| Quick add another note | ⌥+Arrow (with a note selected) |
| Duplicate note | ⌥+Drag |
| Increase / decrease text size | ⌘⌥= / ⌘⌥- |
| Paragraph | ⌘\ |
| Bulleted list | `*` or `-` + Space, or ⌘⇧8 |
| Numbered list | `1.` + Space, or ⌘⇧7 |
| Checklist | `_` + Space |
| Workspace link | `@` |
| External link | ⌘⇧U |

Notes auto-resize as you type unless a manual size is set. Default color purple, and the chosen color sticks for later notes. Distribute-as-grid works only for stickies. Voting (dot voting) and timer are board tools.

### A.2 Wireframe mode (toggle W) [P]

| Action | Keys |
|---|---|
| Annotation / Button / Component / Frame / Image | A / B / E / F / G |
| Line | L or D |
| Link / Circle / Input / Rectangle / Avatar | K / O / P / R / V |
| Connector / Text / Icon | C or L / T / X |
| Lock object | ⌘⇧L |
| Rename frame | Enter |
| Change line direction | hold ⇧ |
| Full-width/height line | hold ⌘ |

Grid is 1px in wireframe mode. Auto-layout unavailable. Components are muted (toned down) colors by design.

### A.3 Freehand [P]

Marker (thin/thick), Highlighter (theme colors minus lightest), Eraser, Selector. Keys: H, ⇧H, E, S. "Detect shapes" snaps strokes to rectangles, circles, straight lines, diamonds. Drawings are editable after creation (resize, move, recolor, change pen). Recommended hardware: Apple Pencil on iPad, Wacom-style tablets. (Pressure sensitivity not documented [?].)

### A.4 Mind-map keys (listed on the same page; for cross-reference with doc 02) [P]

M root; Tab child; Enter sibling; ⌘Enter sibling above; ⌥Enter parent; ⌘/ collapse/expand; ⇧Enter line break; ⌘⇧U link; ⇧X icon; ⌘⌃[ / ⌘⌃] decrease/increase text indent.

### A.5 AI / misc [P]

⌘. Generate with AI; ⌘Enter create; `/` example prompts; ⌘/ past prompts. Task mode keys (Task A/double-click, Stack S, Expand ⌘Enter, Lock stack ⌘⇧L) exist but are out of scope.

---

## 8. PROPOSED lucide-react icon mapping (proposal only, NOT researched)

Whimsical's own icons are proprietary; map by meaning. Verify names exist in the installed lucide-react version.

| Whimsical control | Proposed lucide icon |
|---|---|
| Select/cursor | `MousePointer2` |
| Diagram shapes menu | `Shapes` |
| Sticky note | `StickyNote` |
| Text | `Type` |
| Connector | `Spline` (curved) / `MoveUpRight` / `Workflow` |
| Line | `Minus` / `Slash` |
| Image | `Image` |
| Link | `Link` |
| Icon library | `Smile` / `Sparkles` |
| Table | `Table` |
| Section | `Frame` / `Square` dashed |
| Freehand pencil | `Pencil` / `PenTool` |
| Highlighter | `Highlighter` |
| Eraser | `Eraser` |
| Wireframe mode | `LayoutDashboard` / `PanelsTopLeft` |
| All tools "+" | `Plus` |
| Command menu | `Command` |
| Hand/pan | `Hand` |
| Zoom | `ZoomIn` / `ZoomOut` |
| Align left / center-h / right | `AlignStartVertical` / `AlignCenterVertical` / `AlignEndVertical` |
| Align top / center-v / bottom | `AlignStartHorizontal` / `AlignCenterHorizontal` / `AlignEndHorizontal` |
| Distribute H / V | `AlignHorizontalDistributeCenter` / `AlignVerticalDistributeCenter` |
| Auto-layout vertical / horizontal | `ArrowDownToLine`-style / `Network`, `GitFork` |
| Group | `Group` / `Ungroup` |
| Lock | `Lock` / `Unlock` |
| Duplicate | `Copy` |
| Comment | `MessageSquare` |
| Bring to front / back | `BringToFront` / `SendToBack` |
| Delete | `Trash2` |
| Dark mode | `Moon` |
| Text size, bold, italic | `Baseline`, `Bold`, `Italic` |
| Elbow / curved connector toggle | `CornerDownRight` / `Spline` |
| Endpoint picker | `ArrowRight`, `MoreHorizontal` |

---

## 9. Suggested implementation notes for the clone (derived, not from Whimsical)

1. One canvas engine = Board; "Flowchart" file type just opens a Board with the Diagram shapes tool group focused. Wireframe is a mode flag (W) that changes grid (1px vs 12px), palette saturation, and disables auto-layout.
2. Keymap module must be context-scoped (see 3.4). Keep a single declarative table `{key, scope, action}` to resolve collisions and expose shortcuts in the command menu (⌘K shows shortcuts next to commands).
3. Snapping: grid (12px) + smart guides (edges/centers) with modifier overrides (⌘ = grid-only, ` = off).
4. Quick add: four hover buttons around the selected object + ⌥+Arrow; new shape inherits style; direction override via ⇧-hover; Q toggles visibility.
5. Connector model: elbow | curved (+ straight/bendable), per-end endpoint enum (8 + none), label with position along path and optional white background, attachment points, freestanding ends.
6. Contextual toolbar with nested text layer (Enter / T in, Esc out).
7. Persist as one file per board in the workspace folder; "default style" and custom colors are per-board metadata.

---

## 10. GAPS / unverified (do not fill from memory)

1. **Keyboard navigation between shapes and arrow-key nudging**: no primary source documents Arrow keys (without ⌥) for navigating/moving objects. The user explicitly wants keyboard-only flowchart creation; this needs to be verified in the real app (or decided as a clone design choice).
2. **Quick add semantics**: exact spacing/offset of the new shape, whether ⌥+Arrow always creates a new shape or selects an existing neighbour, what happens after creation (does it enter text-edit immediately?), and how connector style/direction is inherited.
3. **Connector endpoint names/artwork** (8 + 4 ERD) and the exact toolbar placement.
4. **In-app palette hex values** (theme default colors, flowchart shape fills, sticky colors, dark mode colors) and exact typography in the app (marketing font Agrandir/Manrope noted separately).
5. **Connector dash/stroke-width options** and whether line thickness is configurable.
6. **Bold/italic/underline shortcuts** (presumably ⌘B / ⌘I; not in the shortcut table).
7. **Align/distribute/auto-layout shortcuts**: none documented; presumably menu/command-menu only.
8. **H, E, G, A, S, L mode scoping** (the shortcut page lists the same key under several tools without explaining scoping). Needs live-app check.
9. **Marquee selection, Tab to cycle selection, Delete behaviour on connected shapes**: undocumented.
10. **Rotate shortcut** (90 degrees) key or button: undocumented.
11. **Pressure/stylus** handling for the pen: only "works with Apple Pencil / Wacom" stated.
12. **Exact toolbar icon artwork and ordering**: only names and keys known; screenshots not accessible through the fetch tools used.
13. **Whimsical blog posts** (contextual toolbars, speed) were read via a summariser: facts (6 toolbar items, 7 diagram toolbars, nested text layer) are stated in paraphrase.
14. Items from third-party search summaries that were **rejected** as unsupported: FlowSketch's 15-shape list (a clone, not Whimsical), "outline/fill/dash connectors", "mind-map Tab/Enter navigates flowcharts", "⇧⌥C animates connector", Miro sticky hex colors.
