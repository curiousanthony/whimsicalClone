# 06 - Whimsical Boards (sticky notes, canvas toolset, wireframes, freehand)

Research date: 2026-10. Scope: the Whimsical **Board** canvas (the unified file type that hosts flowcharts, mind maps, sticky notes, wireframes, cards, freehand), its toolbar, every shortcut found, and exact behaviours. Comments, voting, timer, presenting-live, AI and collaboration are noted only where they shape the data model; they are out of scope for the clone.

Confidence tags used throughout:

- **[OFFICIAL]** stated on a whimsical.com/learn page, shortcuts page, release note or Whimsical blog.
- **[INFERRED]** deduced from two or more official statements.
- **[UNKNOWN]** could not be verified from public text; a proposal is given for the clone.

Mac key notation: `⌘` Command, `⌥` Option, `⇧` Shift, `⌃` Control, `⌫` Delete, `↩` Return, `⎋` Esc. Whimsical PC docs swap `⌘` for `Ctrl` and `⌥` for `Alt`.

Sources (all fetched): whimsical.com/learn/shortcuts/mac (+ /pc), /learn/boards/{using-boards, sticky-notes, freehand, sections, connectors, customize-shapes, tables, links, annotation, grid, measuring, tidy-boards, save-default-object-style, paste-as, performance, voting, presenting, sections-and-objects}, /learn/faqs/{lines, filter-objects, markdown-support, overlays, colors-toned-down, external-embeds}, /learn/get-started/{flowcharts, mind-maps, wireframes, infinite-canvas, command-menu}, /learn/workspaces/uploads, /learn/themes/custom-colors, whimsical.com/releases (all pages), blog posts "Sticky notes and new improved boards", "Why we optimized left-handed shortcuts in Whimsical wireframes" (2018), "Fast, collaborative wireframing app" (2018), Viget and LinkedIn-Learning write-ups.

---

## 1. Big picture: one canvas, mode-dependent toolbar

- **[OFFICIAL]** Since 2023 ("Toolbar changes", release 2023.29) *wireframes, cards and stacks of cards live under the single file type "Board"*. Flowcharts, mind maps and sticky notes were merged into one board earlier ("Sticky notes and new improved boards" blog): "a new board mode that puts flowchart shapes, mind maps, and sticky notes at your fingertips without having to switch modes".
- **[OFFICIAL]** Every Board is an infinite canvas. Wireframe components, flowchart shapes, sticky notes, freehand, mind maps, tables, images all coexist on the same canvas and can be connected by the same connectors.
- **[OFFICIAL]** Two keyboard "modes" matter for shortcuts:
  - **Board / diagram mode** (default): shape keys R, O, D..., sticky `N`, mind map `M`.
  - **Wireframe mode**: toggle with `W`, leave with `Q`. Re-maps several letters (B button, P input, G image, F frame, E component, V avatar, A annotation...). Auto-layout is unavailable in wireframe mode ("press Q to exit").
  - (Older docs also mention "Projects/Tasks" mode with its own keys: Task `A`, Stack `S`; this is the cards feature, treated as out of scope.)
- **[OFFICIAL]** Multi-page files (release 2026.12): each file may have several pages shown as tabs; replaces "tabbed folders". Not needed for MVP.
- **[OFFICIAL]** Release 2026.7 (and 2026.8): "A more compact board toolbar with easier switching between diagramming and wireframing"; **Pan and Select tools** were added to the toolbar and the command menu (so a persistent hand/pan mode exists in addition to Space-drag).
- **[OFFICIAL]** Performance guidance: "over 10,000 items" may slow a board; use as a soft target (virtualise rendering).

### 1.1 Toolbar layout

Official descriptions (using-boards page + blog): the toolbar is a vertical bar on the left.

1. **Top section (most used):** a **Wireframes mode** entry and **Cards** entry, then **Flowchart shapes (Diagram shapes, `S`)**, **Sticky note (`N`)**, **Mind map (`M`)**. The blog says "Flowchart shapes, sticky notes and mind maps are at the top". Elements can be *dragged out of the toolbar* onto the canvas as well as clicked.
2. **Rest of toolbar:** "tools for connecting ideas" (connector `C`, text `T`, line), "adding structure" (section `.`, table `E`, image `I`, link `K`, icon `X`), "getting creative" (freehand pencil `H`, AI). Plus **All tools** (a `+` button, searchable; same menu is opened with `/`) listing every object and action, including timer/voting.
3. Pan and Select tools (2026.8).
4. **Bottom-right**: help `?` menu (moved to left nav in 2026.7), command-menu button, AI action, zoom controls (+, -, reset).
5. **[INFERRED]** Exact top-to-bottom icon order is not published as text. Proposed clone order (matching the hierarchy described above):
   `Select, Pan | Wireframe mode, Cards(omit) | Shapes(S), Sticky(N), Mind map(M) | Connector(C), Text(T), Section(.), Table(E), Image(I), Link(K), Icon(X) | Pencil/freehand(H) | + All tools(/)`.
6. A **context bar** (floating toolbar) appears near any selected object(s) with only the options that apply to the selection; with a mixed selection only the common options (group, align, distribute, filter) are shown. Contains colour, shape type, outline style, text size/format, link, align, and a `...` overflow menu (layering, copy as, lock, save default style...). Sticky notes got "a single, unified context bar" (2026.11).
7. Contextual **right-click menu** mirrors the context bar and adds: *Wrap in section*, *Copy as > Link to object / Image / SVG / Mermaid*, *Paste as > sticky notes / mind map / bulleted list / table*, *Save default style*, *Snap to grid*, *Filter selection*, *Group/Ungroup*, *Lock*.

**Same toolbar for flowcharts and wireframes:** one toolbar, one context-bar pattern. In wireframe mode the "shapes" slot becomes **Components** (renamed from "Elements" in 2026.4) and a **Frames** slot appears; sticky notes (`N`) still work in "all board modes". The connector, text, icon, image, link, section/frame and freehand tools are shared.

---

## 2. Sticky notes (the headline feature)

### 2.1 Creation (4 ways, [OFFICIAL])

1. Click or drag the sticky note button from the toolbar.
2. Press `N` (works in **all** board modes).
3. Click a **quick-add button** on an existing sticky note (buttons appear on the sides of a selected note; added "extra easy for creating additional notes on the fly").
4. With a note selected press `⌥` + Arrow key: a new note is created in that direction, linked visually by adjacency. (Direction of quick-add can be changed with `⇧` while hovering the button; quick-add can be hidden with `Q` in diagram mode.)

Keyboard-only flow (derived): `N` -> click/press to place note, type text immediately (note enters edit mode) -> `Esc` -> `⌥→` / `⌥↓` etc. creates neighbour notes with the same colour/size, each opens ready to type.

### 2.2 Appearance and behaviour

| Property | Fact | Confidence |
|---|---|---|
| Shape | Square coloured note ("colorful squares" per blog); corner radius/shadow not documented | [OFFICIAL: square; rest UNKNOWN] |
| Default colour | **Purple** (Whimsical's sticky default) | [OFFICIAL] |
| Colour memory | Changing a note's colour makes **new notes follow suit** (last-used colour carries forward) | [OFFICIAL] |
| Palette | Notes support the **full colour palette** of the board theme (2026.12; before that a restricted subset); custom hex colours also supported (2026.7+) | [OFFICIAL] |
| Saturation | Sticky notes use "a less saturated version of your theme colours" (same as sections and wireframe components) | [OFFICIAL] |
| Sizing | Auto-grow: "As you type, the text and the sticky note itself will automatically resize". Setting a manual size (drag a handle) turns off auto-resize for that note | [OFFICIAL] |
| Text size | t-shirt text sizes; **XS** was added for every text-capable object (2026.12). Increase/decrease with `⌘⌥=` / `⌘⌥-` | [OFFICIAL] |
| Rich text | Bold, italic, highlight, indent, headings, paragraph styles, bullet/numbered/check lists, `@` file mention, external link, code blocks via ``` | [OFFICIAL] |
| Author | Author name + avatar shown on the note; can be hidden via the note's context menu | [OFFICIAL] (collab; clone: optional/omit) |
| Duplicate | `⌥`-drag, or `⌘D` | [OFFICIAL] |
| Align/distribute | Sticky notes (only) also get **Distribute grid** (arrange into evenly spaced grid) | [OFFICIAL] |
| Paste as | Copy multi-line text, right-click > *Paste as > sticky notes* creates one note per item | [OFFICIAL] (one-per-line rule [INFERRED]) |
| Connectors | Notes accept connectors like any object; included in auto-layout | [OFFICIAL] |
| Frame/section | Notes can be dropped into sections and move with them | [OFFICIAL] |
| Exact note sizes | A single default square size; no S/M/L preset list found. Text size, not note size, is the preset (XS...). **[UNKNOWN]** default px; proposal: 160 x 160 px at 12px grid (~13 cells), min 96 | [UNKNOWN] |
| Hex of palette | Not published (see section 9). Notes use the theme palette | [UNKNOWN] |

### 2.3 Sticky-note text shortcuts (Mac, [OFFICIAL])

| Action | Shortcut |
|---|---|
| Add sticky note | `N` |
| Quick-add another note (note selected) | `⌥` + Arrow |
| Duplicate note | `⌥` + drag |
| Increase / decrease text size | `⌘⌥=` / `⌘⌥-` |
| Paragraph | `⌘\` |
| Bulleted list | `*` or `-` then Space, or `⌘⇧8` |
| Numbered list | `1.` then Space, or `⌘⇧7` |
| Checklist | `_` then Space |
| Workspace-file mention | `@` |
| External link on selected text | `⌘⇧U` |
| Voting (out of scope) | `/` > Voting |

Markdown block shorthands at start of line (docs + boards, [OFFICIAL]): `#`/`##`/`###` heading, `-`/`*` bullet, `1.` numbered, `_` checklist, `>` quote, `---` or `***` divider, ``` code block. Inline: `*bold*`, `_italic_`, `` `code` ``. Also typing `->`-style arrows converts to arrow characters (2026.7: "Type arrow characters").

---

## 3. Canvas toolset (everything that can be placed on a Board)

### 3.1 Object catalogue

| Object | Shortcut (board mode) | Notes |
|---|---|---|
| Sticky note | `N` | see section 2 |
| Text | `T` | Free text object; cannot be rotated [OFFICIAL] |
| Shapes (16) | `S` opens menu | Rectangle `R`, Pill `U`, Oval `O`, Diamond `D`, Parallelogram, Flipped parallelogram, Trapezoid `A`, Triangle `G`, Hexagon `H`*, Cylinder `Y`, Sequence-diagram actor, Annotation `A` (wireframe/annotation key), Line `L`, Bracket `B`, Cloud `J`, Star `V`; plus **Cross (x)** added 2026.4 |
| Table | `E` | drag to size rows/cols; also `/table`, paste from Sheets/Numbers/Excel/Markdown |
| Image | `I` | file picker, drag & drop, paste |
| File / video / PDF | via `/` All tools > File, drag & drop | |
| Link | `K` | external or internal (other Whimsical file) |
| Icon | `X` | searchable icon library (thousands); icons may also sit inside shapes (2026.10) |
| Connector | `C` (or `L`) | see 3.4 |
| Mind map | `M` root node | out of detail here (see 03-mindmaps doc); keyboard Tab/Enter |
| Section | `.` | see 3.5 |
| Freehand | `H` pencil menu | see section 4 |
| Code block | Shapes menu or ⌘K | 2026.11, syntax highlighted |
| Frame / wireframe components | `W` mode | see section 5 |

*Hexagon `H` conflicts with freehand `H` in the official table; see 3.9.

### 3.2 Shapes in detail ([OFFICIAL], customize-shapes)

- 16 diagram shapes from the toolbar menu or `/`.
- **Convert shape type** while keeping colour/border.
- Resize by sides or corners; pixel dimensions shown while resizing; resizing **clouds and stars regenerates their edges** (random wobble), copy after resizing to keep twins identical. Flowchart shapes expand **downward** when text grows (2023). Text padding is the same for every shape size (2025). Min height reachable in one drag.
- Colour from the theme palette or custom colour (`+` in picker: hex input, hue/sat sliders, eyedropper; saved **per board**; right-click a swatch to edit/delete). New shapes of a type reuse the last colour used (and "Save as default style" `⌘⇧D`).
- **Border styles (3):** *Fill* (solid colour), *Border* (solid outline with lighter fill), *Dashed border*. Can be fully transparent (outline only).
- **Rotation: only 90-degree steps** (no free rotate). Text objects cannot rotate. Images can be rotated (90) (2024).
- Text inside shapes: size presets, bold/italic, horizontal alignment (left/centre/right), vertical position; icons inside shape (2026.10).

### 3.3 Text sizes ([OFFICIAL], inferred set)

"T-shirt sizes only": the 2018 wireframe post says 6 sizes; later releases add XS, XL, XXL to wireframe text and XS to all board objects. Clone set: **XS, S, M, L, XL, XXL** (proposed px: 10, 12, 14, 18, 24, 32 wireframe; boards 12/14/16/20/28/40). Fonts: **Dinsical** and **Monsical** (Whimsical's own, freely redistributable; fallback system font).

### 3.4 Connectors ([OFFICIAL], learn/boards/connectors + releases)

- Draw from the Connector tool, or drag from an object's connection handles/quick-add; first draw offers to type a label.
- **Routing:** *Elbow* or *Curve* (one toolbar toggle), plus **straight** connectors whose control points can be dragged into a curve (lines FAQ). Release 2023.20 introduced "three connector modes" for consistent style across a board (names not published; [INFERRED]: straight / curved / elbow).
- **Endpoints:** **8 endpoint types or none**, set independently per end (arrow, dot, etc.; ERD "crow's foot" family added 2024: 4 new endpoints => about 12 total in current app).
- **Label:** double-click to edit; drag along the connector; label colour customisable; optional **white background** toggle; other connectors no longer overlap labels (2026.4).
- **Attach:** while dragging over a target a **purple box** highlights it; release to attach. Anchoring sticks to the object's edge point and shows the exact attached point when selected (2025). Connectors may attach to table cells (purple outline on whole table or cell) and to annotations.
- Freestanding connectors (unattached) can be moved freely; elbow edges snap to nearby edges; handles for edges and control points always visible (2025.x). Elbows auto-route cleaner paths (2026.7).
- Move a connector by dragging anywhere along its length except handles.
- `⌘`+click on one end **jumps to the other end** (navigation). (Shortcut table also lists `⌘`+click = *Animate connector*; ambiguity, see 3.9.)
- Colour: line colour and text colour independent. Dashed lines: only via Line element, not documented for connectors [UNKNOWN].

### 3.5 Sections (the board "frames", [OFFICIAL])

- Create: toolbar, `.` key, or select objects > right-click > **Wrap in section**.
- Needs a name (editable inline). Appearance: **solid colour fill** or default **outline**; toggle whether content **clips** at section edge or overflows.
- Colours are a less saturated variant of the theme.
- Objects dragged in keep their layer order; right-clicking inside a selected section opens the context menu instead of selecting a child; deleting a section **keeps its contents** (2023).
- Sections are the slide units for *Present* (reorder, skip) and each can be exported as an image and linked to ("Copy as > Link to object").
- Nesting: not stated [UNKNOWN]; wireframe frames likely behave the same. Proposal: allow one level of nesting for MVP.
- Objects extending beyond a section are clipped when presenting.

### 3.6 Images, files, embeds ([OFFICIAL])

- `I` opens the OS file picker; drag-drop files; paste image from clipboard. Pasting an image while a section/frame is selected centres it inside.
- Formats incl. PNG/JPG/GIF/SVG (SVG stays vector), **AVIF** (2024). Max 32,000 px per side. Image **rotate** (90), **captions** (toggle), download at full resolution. Aspect ratio locked on resize with `⇧`... (Whimsical locks by default for images; fractional sizes allowed so grid alignment is not guaranteed for images).
- Video files play inline on boards; PDFs show as attachment cards with preview; other files attach as icon cards. `.exe`/`.mpkg` rejected.
- Embeds on boards: **video embeds** (YouTube, Vimeo, Loom) only; richer embeds (Figma, Airtable, Canva, Hex) are Docs-only.
- Links (`K`): external link -> favicon + title (plus website snapshots); internal Whimsical link -> thumbnail card; `⌘Z` immediately reverts to a plain link. Link on text: `⌘⇧U`.
- Clone (local-first): copy imported files into `<board>.assets/` next to the board file; keep original names; show attachments as cards; embed only local video files + YouTube/Vimeo URL cards (no remote fetch needed offline except favicon fallback).

### 3.7 Alignment, grid, snapping, layering, grouping, locking

| Feature | Behaviour | Confidence |
|---|---|---|
| Grid | Dot grid visible at >= 100% zoom. **12 px** in boards, **1 px** in wireframes (2018 launch used 4 px) | [OFFICIAL] |
| Snap | Items snap to grid; edges of fractional-size items (images) may be off-grid | [OFFICIAL] |
| Auto-alignment | Smart guides to neighbours; takes precedence over grid | [OFFICIAL] |
| Grid-only | Hold `⌘` while dragging (skip item alignment) | [OFFICIAL] |
| No snapping | Hold `` ` `` (backtick) while dragging disables grid + guides | [OFFICIAL] |
| Snap to grid command | right-click > Snap to grid | [OFFICIAL] |
| Measure | Select object, hold `⌥`, hover another: shows horizontal + vertical gap | [OFFICIAL] |
| Align | left/right/top/bottom to outermost edge; centre horizontally/vertically (2+ objects) | [OFFICIAL] |
| Distribute | horizontal / vertical (3+ objects); **grid distribute** for sticky notes only | [OFFICIAL] |
| Auto-layout | Select 2+ non-connector objects: *Lay out vertically / horizontally*; re-routes connectors; works with shapes, sticky notes, icons, images, links, text; not in wireframe mode | [OFFICIAL] |
| Filter selection | From a multi-selection, narrow by object type, shape, or colour; selecting a section includes its children | [OFFICIAL] |
| Layering | `]` bring to front, `⌘]` forward, `[` send to back, `⌘[` backward (changed in 2025 to match standards) | [OFFICIAL] |
| Group / ungroup | `⌘G` / `⌘⇧G`; **Deep select** `⌘`+click; double-click enters group | [OFFICIAL] |
| Auto-group | Small objects dropped onto a larger one move with it (older LinkedIn-Learning course) | [INFERRED] (likely the section/shape containment, not explicit group) |
| Lock | `⌘⇧L`; locked objects excluded from Select all (`⌘A`); `⌘` + double-press `A` selects locked too; locked tables cannot move | [OFFICIAL] |
| Cancel gesture | `⎋` while moving/resizing/dragging restores original state | [OFFICIAL] (2026.12) |
| Hover highlight | Objects highlight on hover (2026.6) | [OFFICIAL] |
| Copy/paste text onto selection | Pasting text with an object selected adds/replaces its text | [OFFICIAL] |
| Copy as | Image (`⌘⇧C`), SVG, Mermaid (diagrams), Link to object (`⌘⌥⇧C`) | [OFFICIAL] |

### 3.8 Paste intelligence ("Paste as", [OFFICIAL])

Default board paste = Markdown-aware (headings, lists, tables, images). Right-click or `⌘K` > *Paste as*: **sticky notes**, **mind map**, **bulleted list**, **table**. Markdown/Sheets/Docs/Word/Notion tables paste as Whimsical tables. Mermaid text pastes as a flowchart. Content from Miro/FigJam/etc. is import only in the cloud app; skip.

### 3.9 Shortcut table - Board (Mac, verbatim from whimsical.com/learn/shortcuts/mac)

**General board**

| Action | Shortcut |
|---|---|
| Command menu | `⌘K` |
| All tools menu | `/` |
| Zoom (drag/click) | `Z` + click/drag, or `⌘` + scroll / pinch |
| Zoom in / out / 100% | `=` / `-` / `0` |
| Zoom to content / selection | `1` / `2` |
| Pan | `Space` + drag, or `⇧` + scroll wheel, two-finger scroll; arrow keys scroll canvas (natural direction, 2026.4) |
| Undo / Redo | `⌘Z` / `⌘⇧Z` |
| Copy / Paste | `⌘C` / `⌘V` |
| Copy style / Paste style | `⌘⌥C` / `⌘V` (official table prints `⌘V`; almost certainly `⌘⌥V`, **flag**) |
| Duplicate | `⌘D` or `⌥`-drag |
| Copy link to object | `⌘⌥⇧C` |
| Copy as image | `⌘⇧C` |
| Bring to front / forward | `]` / `⌘]` |
| Send to back / backward | `[` / `⌘[` |
| Select multiple | `⇧`-click (also marquee drag) |
| Select all (excl. locked) | `⌘A` |
| Select all incl. locked | hold `⌘`, press `A` twice |
| Deselect | `⎋` |
| Resize keeping ratio | `⇧` + drag |
| Resize from centre | `⌥` + drag |
| Edit text | `↩` |
| Group / Ungroup | `⌘G` / `⌘⇧G` |
| Deep select | `⌘`-click |
| Ignore auto-snap | `⌘` + drag |
| Ignore grid and auto-snap | `` ` `` + drag |
| Save as default style | `⌘⇧D` |
| Font size up / down | `⌘⌥=` / `⌘⌥-` |
| Animate connector | `⌘`-click |
| Measure distance | select + hold `⌥` + hover other object |
| Wireframe mode | `W` (exit `Q`) |
| Delete | `⌫` |
| Comment (out of scope) | `⌘⌥M` |

**Diagram / flowchart creation keys**

| Object | Key | Object | Key |
|---|---|---|---|
| Rectangle | `R` | Bracket | `B` |
| Pill | `U` | Star | `V` |
| Oval/circle | `O` | Cloud | `J` |
| Diamond | `D` | Table | `E` |
| Trapezoid | `A` | Image | `I` |
| Triangle | `G` | Link | `K` |
| Hexagon | `H` | Connector | `C` or `L` |
| Cylinder | `Y` | Text | `T` |
| Line | `L` | Icon | `X` |
| Section | `.` | Shapes menu | `S` |
| Quick add | `⌥` + Arrow | Quick-add direction | `⇧` + hover button |
| Hide quick add | `Q` | Lock | `⌘⇧L` |

**Known contradictions in the official table (resolve in clone):** `H` is listed for both Hexagon and Marker (freehand page says `H` = freehand, `⇧H` = highlighter; pick freehand); `L` for both Line and Connector (docs: `L` adds a line element, `C` connector); `E` = Table in board mode but Eraser in the freehand menu and Component in wireframe mode (context-dependent: freehand menu open -> eraser); `S` = Shapes menu in board mode vs Selector inside the freehand menu vs Stack in cards mode. `⌘`-click is both *Animate connector* and *jump to other end* (treat as the same gesture: jump/animate on connector end). `A` is Trapezoid in diagram table but Annotation (2024 release says "`A` to quickly create a new annotation"); recommended: board mode `A` = annotation, trapezoid via menu.

**Window/file-level shortcuts relevant to Board:** `⌘K` command menu, `⌘E` toggle sidebar, `⌘⇧E` export tab, `⌘P` print, `⌘F` find in file, `⌘J` workspace search, `⌘⌥N` new file/folder, `⌘⇧S` share (replace with Reveal in Finder in clone), `⇧⌥C` show/hide comments (skip).

---

## 4. Freehand drawing ([OFFICIAL], learn/boards/freehand)

- Toolbar: **pencil icon**; press **`H`** for the marker; **`⇧H`** jumps straight to the highlighter.
- Freehand menu = **Marker**, **Highlighter**, **Eraser** (`E`), **Selector** (`S`).
- **Marker**: two sizes **thin / thick**. Colour = any theme colour. **Highlighter**: translucent wide stroke; same colours except the lightest (white, smoke, gray are unavailable).
- **Eraser**: keeps constant on-screen size when you zoom out (zoom out to erase more). Single dots can be erased (2026.5), which suggests erase-by-stroke hit testing [INFERRED]; partial-stroke erase not documented [UNKNOWN] (proposal: whole-stroke erase, matching marker "object" semantics).
- **Detect Shapes** toggle: rectangle, circle, straight line, diamond are recognised and made uniform ("straightens wobbles"). Clone: implement rect/ellipse/line/diamond recogniser (e.g. $1-style or fit-error heuristics) on pen-up.
- Drawings are **objects**: select, move, resize, delete, recolour, and switch pen type (marker <-> highlighter, thin <-> thick) after the fact.
- Draw over any object (shapes, wireframes).
- Input: "best results with Safari on iPad with Apple Pencil, or desktop with mouse / Wacom-style pen tablet". Whimsical does **not** document pressure-sensitive width [UNKNOWN]; strokes appear uniform per size preset. Clone: use Pointer Events (`pointerType === 'pen'`, `pressure`, `tiltX/Y`), with a **setting** "Pressure-sensitive width" (default on for pen, off for mouse) and `getCoalescedEvents()` + Catmull-Rom/quad smoothing; store raw points with pressure so it is lossless. Palm rejection: ignore `pointerType==='touch'` while a pen is in range.
- Persisted as paths with color/size/tool; export as SVG paths.

---

## 5. Wireframes ([OFFICIAL] unless marked)

### 5.1 Entering and toolbar

- Enter wireframe mode: toolbar wireframe icon, `W`, or All tools (`/`). Exit with `Q`.
- Wireframe toolbar (older docs: 7 buttons) = **Frame** (`F`), **Component** (`E`; "Element" before 2026.4), shapes (rectangle `R`, circle `O`), line (`L` or `D`), text (`T`), image (`G`), icon (`X`), link (`K`), connector (`C` or `L`), annotation (`A`), button (`B`), input (`P`), avatar (`V`), freehand still works.
- Context bar per element exposes **states and variants** (no panels).

### 5.2 Wireframe shortcuts (Mac)

| Action | Key | Action | Key |
|---|---|---|---|
| Annotation | `A` | Text | `T` |
| Button | `B` | Icon | `X` |
| Line | `L` or `D` | Lock object | `⌘⇧L` |
| Component menu | `E` | Rename frame | `↩` |
| Frame menu | `F` | Change line direction | hold `⇧` |
| Image | `G` | Full-width/height line | hold `⌘` |
| Link | `K` | Connector | `C` or `L` |
| Circle | `O` | Rectangle | `R` |
| Input | `P` | Avatar | `V` |

Design rationale (2018 blog): shortcuts are clustered on the **left hand** (B, A, D, G, E, F, R, P, V); "U" (rounded rectangle) intentionally omitted from wireframes.

### 5.3 Frames

- **Frame launcher `F`**: six frames, each with a number so `F` then `1`...`6` works hand-free ("F -> 1 for a Window frame"). Official list: **Window** (browser), **Phone X** (iPhone X), **Phone** (iPhone), **Android**, **Tablet**, **Plain** (generic canvas frame). Numbering follows that order [INFERRED]. Newer app may have refreshed devices; keep the six.
- Frames can be resized, duplicated (contents copy), renamed (`↩`), exported (multi-frame zip export, 2025), presented as slideshow.
- **Phone frames**: toggles for *status bar* and *keyboard*; **Navigation** components: add/edit menu items and tabs.

### 5.4 Components ("Elements", 22+ in 2018)

Searchable launcher (`E`): search field auto-focused, vertical list, **fixed order** (not recency), each with an icon. Official examples: buttons, form fields (input, dropdown), sliders, avatar, divider, image placeholder, text/heading/lorem ipsum block text, link, navigation/tabs, **overlay**, annotation, checkbox/radio/switch-type controls. The full 22-item list is **[UNKNOWN]**; proposed clone catalogue:

`Button, Input, Text area, Dropdown, Checkbox, Radio, Switch, Slider, Avatar, Badge, Divider, Image placeholder, Video, Map, Lorem ipsum (text block), Heading, Link, Tabs, Navigation bar, Menu, Table, List, Card, Tooltip, Overlay (modal), Browser bar, Status bar, Keyboard, Annotation`.

Behaviours worth copying:
- **Buttons**: sizes Small/Medium/Large, auto-sized to label text, states (default, hover, disabled, ...), optional icons; buttons and links share a component (switch type in context bar).
- **Inputs**: states default/focused/etc.; typing text moves the cursor automatically.
- **Dropdowns**: selected value, alternate options, label, state, auto-size.
- **Text**: six t-shirt sizes (XS, S, M, L, XL, XXL); swap placeholder lines with block text.
- **Overlay**: modal/alert layer; resizable; snaps to window/tablet/phone frames; all colours (2026.11) but **no opacity control**; z-order with `]`/`[`.
- **Annotation**: numbered callouts with an arrow attached to an object; auto-numbering (re-toggle to reorder), colour + icon options, author names toggle, outline mode (2026.10); new annotation inherits previous colour; works on any board type; connector re-attaches on move.
- Colour rule: wireframes are **toned down** (grayscale, desaturated); colour only for actionable items and semantic colours (red error/delete, orange caution, green success). Wireframe text/icons render dark for contrast (2026.7). Flowchart shapes remain fully saturated.
- Visual rules: no 1 px hairlines (borders/dividers are chunkier), built on a small grid (4 px originally; 1 px grid now), "six colours" philosophy, shapes limited to square, pill, circle.
- Shortcut-driven placement: pressing a component key then clicking/dragging on canvas or into a frame; things dropped into a frame belong to it.
- Components with limited "Save default style": dropdowns, inputs, tooltips, groups keep only dimensions.

### 5.5 Lines in wireframes

Line element: `L` or `D`; `⇧` toggles horizontal/vertical direction; `⌘` makes it span full frame width/height; colour + solid/dashed; straight only.

---

## 6. Other canvas objects

- **Tables** ([OFFICIAL]): `E`; drag to choose cols x rows; `+` handles on edges to add; drag side handles to reorder; remove row/col (`⌘⇧⌫`); sort asc/desc via toolbar; header row, table styles (alternating rows), cell/row/col background colour; cells hold rich text, images, mentions; no formulas; connectors attach to table or cell; borders snap to nearby objects.
- **Annotations**: see 5.4.
- **Code blocks** (2026.11): standalone object or ``` inside text/shape/note; language auto-detect + highlighting.
- **Icons**: `X`, searchable library (Whimsical icon set + cloud architecture AWS/GCP/Azure + brand logos). **Clone: use lucide-react for UI chrome and as the user-insertable icon set (searchable by name/tags)**.
- **Mermaid** copy/paste: optional, post-MVP.

---

## 7. Colour and theming

- Boards use a **colour theme** ("Whimsical OG" default; custom themes per workspace). A theme is a list of named colours each with light/dark text. Objects pick from the palette; palette = same for sticky notes, shapes, sections (de-saturated variants), connectors, text.
- Custom colours: `+` in picker (hex, sliders, eyedropper), saved **per board**, editable by right-click.
- Dark mode (2026.9): canvas colours remapped per theme; SVG export supports dark mode.
- **[UNKNOWN] exact hex values of the default palette.** Known names/hints: "white, smoke, gray" are the lightest neutrals; sticky default is purple; MCP accepts "palette keywords". Proposal: define 12 named hues (white, smoke, gray, red, orange, yellow, green, teal, blue, purple, pink, black) with a `base` and a `soft` (desaturated, used by sticky notes/sections/wireframe) value; store theme as JSON so the French/other themes and hex tweaks are easy. Suggested sticky `soft` default purple ~ `#D9C8F5`-ish (own choice, not Whimsical's).

---

## 8. Data-model implications for the clone

```
Board {
  version, theme, grid:{board:12, wireframe:1},
  pages? (post-MVP),
  objects: [ ... ] // z-ordered array, ids stable
}
BaseObject { id, type, x, y, w, h, rotation(0|90|180|270), locked, parentId?(section|frame|group), z }
Types: sticky{color, textSize, richText, authorHidden, autoSize}
       text{richText, textSize, align}
       shape{kind(16+cross), fill|border|dashed|transparent, color, richText, icon?}
       connector{from:{id,anchor}|point, to, route:straight|curve|elbow, points[], startHead,endHead(8+ERD), color, label{richText,bg,t}}
       image{assetId, caption?, rotation} | file{assetId} | video | link{url|fileRef,mode}
       section{name, fillMode(solid|outline), clip}
       table{rows[],cols[],cells,style,headerRow}
       freehand{tool(marker|highlighter), size(thin|thick), color, points[{x,y,p}]}
       icon{name(lucide), color,size}
       code{lang, text}
       wf.frame{device(window|phoneX|phone|android|tablet|plain), statusBar, keyboard}
       wf.component{kind, size, state, props, richText}
       annotation{number|icon, color, targetId, text}
       group{childIds}
```

- Persist as one JSON file per board (e.g. `Name.wbd.json` or `.board`) + sibling assets folder; undo/redo via command stack; copy/paste with a custom clipboard MIME (`application/x-whimsicalclone+json`) plus plain text/markdown fallback; "Paste as sticky notes" from plain text lines.
- Mode-dependent keymap resolver (`board`, `wireframe`, `freehand-menu`, `text-edit`) to resolve the key collisions listed in 3.9.

### 8.1 Suggested lucide-react icon mapping (match meaning, not artwork)

Select `MousePointer2`; Pan `Hand`; Wireframe mode `LayoutTemplate` (or `PanelsTopLeft`); Shapes `Shapes`; Sticky note `StickyNote`; Mind map `Network`; Connector `MoveUpRight` (the official course describes the "diagonal arrow pointing to the upper right"); Text `Type`; Section `Frame` or `SquareDashed`; Table `Table`; Image `Image`; Link `Link`; Icon `Smile`; Freehand `Pencil`/`PenLine`; Marker `Pen`; Highlighter `Highlighter`; Eraser `Eraser`; All tools `Plus`; Command menu `Command`; AI (omit or `Sparkles`); Lock `Lock`/`LockOpen`; Group `Group`/`Ungroup`; Layering `BringToFront`/`SendToBack`/`ArrowUpToLine`/`ArrowDownToLine`; Align `AlignStartVertical`/`AlignCenterVertical`/`AlignEndVertical`/`AlignStartHorizontal`/`AlignCenterHorizontal`/`AlignEndHorizontal`; Distribute `AlignHorizontalDistributeCenter`/`AlignVerticalDistributeCenter`; Zoom `ZoomIn`/`ZoomOut`/`Maximize`; Undo `Undo2`/`Redo2`; Duplicate `Copy`; Delete `Trash2`; Colour `Palette`; Bold/Italic `Bold`/`Italic`; Lists `List`/`ListOrdered`/`ListChecks`; Heading `Heading`; Quote `Quote`; Code `Code`; Frame devices `Monitor`/`Smartphone`/`Tablet`; Annotation `MessageSquareText`; Button component `RectangleHorizontal`; Input `TextCursorInput`; Avatar `CircleUser`; Divider `Minus`; Checkbox `SquareCheck`; Radio `CircleDot`; Switch `ToggleLeft`; Slider `SlidersHorizontal`; Dropdown `ChevronsUpDown`; Cross shape `X`; Cloud `Cloud`; Star `Star`; Triangle `Triangle`; Diamond `Diamond`; Hexagon `Hexagon`; Cylinder `Cylinder`; Oval `Circle`; Rectangle `Square`; Pill `RectangleHorizontal`; Quick-add buttons `Plus`. (Verify each name exists in the installed lucide-react version; fall back to composing with SVG.)

---

## 9. Remaining gaps / uncertainties

1. Exact hex values of Whimsical's default palette and theme colour names (only learned: palette contains white/smoke/gray neutrals; text colour light/dark per colour).
2. Exact default sticky-note px size, corner radius, shadow; whether notes have preset size steps beyond text size.
3. Exact toolbar icon order and the artwork/tooltips (partial from blog/course; proposed order in 1.1).
4. Full list of the ~22 wireframe components, their variants/states and sizes; the exact number order of the six frames beyond "Window = 1".
5. Official shortcut table contradictions (`H`, `L`, `E`, `S`, `A`, `⌘`-click, Paste style key) - resolved by proposal in 3.9, not by Whimsical.
6. Names of the "three connector modes" (2023.20); the full list of 8 (+4 ERD) endpoint shapes; dashed connector styles.
7. Pressure sensitivity: Whimsical does not document it; behaviour of eraser (whole-stroke vs partial) and the Detect-Shapes algorithm thresholds are unknown.
8. Section nesting rules and exact auto-group semantics.
9. Left-hand shortcut blog (2018) details: only the three categories (Standard, Wireframe-specific, Launchers) are described, the standard key list is shown as an image; mapping above comes from the 2026 shortcuts page.
10. Windows page not diffed; assumed `⌘ -> Ctrl`, `⌥ -> Alt` (note: Mac `⌘J` search vs PC `Opt/Alt-J` wording discrepancy in 2024 release notes).
