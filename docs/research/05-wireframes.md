# 05 - Whimsical Wireframes (and the shared Board toolset): research notes

Scope: Whimsical **Wireframes** (a mode of the Whimsical *Board*), the component library, frames/devices,
text and icon editing, low-fi styling, snapping/layout, keyboard shortcuts, and the **Lucide** equivalent of
Whimsical's icon picker. Shared Board tools (sticky notes, connectors, freehand, grid, sections) get one short
section each because they overlap with other research docs.

Research date: 2026-10-07. Mac key notation: `⌘` Command, `⌥` Option, `⇧` Shift, `⌃` Control, `⏎` Return.

## 0. How to read this document (confidence tags)

Every fact carries a source tier. Facts from different tiers MUST NOT be treated as equal.

| Tag | Meaning | Examples |
|---|---|---|
| **[OC]** | Official, current (2024-2026): `whimsical.com/learn/*`, the official Mac shortcut page, 2024-2026 release notes, MCP docs | Mac shortcut table, overlays FAQ, grid page |
| **[OH]** | Official, historical: Whimsical blog posts from 2018 and an old template image. Probably still roughly true, but can be outdated | "A fast, collaborative wireframing app" (2018), "left-handed shortcuts" blog, "Simple Wireframe Kit (25+ Elements)" |
| **[3P]** | Third party (reviews, SEO sites, other tools' clones). Weak evidence, not to be implemented from alone | Viget 2019 article, mockitt, whimsicalaireview.org |
| **[S]** | Sampled by me (pixel sampling of a 1200x630 antialiased preview image). Approximate, roughly plus or minus 10 per channel | Colours in section 5 |
| **[INF]** | My inference or recommendation for the clone, not a Whimsical fact | Data model, Lucide mapping |

Things deliberately NOT used as Whimsical facts: the GitHub project `flowsketch` PR #73 (a different clone with its
own 14 components and hexes `#9EADBA/#EAEFF4/#4B5C6B`), `whimsicalaireview.org` (SEO/AI content: its sm/md/lg variants,
375x812 / 1440x900 sizes and "modals, accordions, breadcrumbs, pagination" lists are unverified), and
`webdesignhot.com` design tokens (those describe the marketing site, not the canvas).

Access limits: `whimsical.com` is blocked in the in-app browser and the product itself is a logged-in canvas app,
so no live inspection was possible. Everything below comes from public pages and one public template preview image.

---

## 1. Product model: what a "Wireframe" is in Whimsical

* [OC] Since release 2023.22, "Wireframes, cards, and stacks of cards can now all be found under the file type **Board**".
  So Wireframes are not a separate file type any more: a **Board** is an infinite canvas, and **wireframe mode** is a
  toolbar mode inside it. Flowchart shapes, sticky notes, text, images, connectors, freehand drawing and wireframe
  components coexist in the same board.
* [OH] Originally (2018) Wireframes was a standalone product "unbundled" from Flowcharts, to be fast, simple and
  low-fi. Whimsical's own rationale: building wireframes inside a flowchart app means flowchart decisions leak in.
* [OC] Mode entry/exit (official getting-started page):
  1. click the wireframe icon in the toolbar, 2. press `W`, 3. open the **All tools** menu (the plus sign in the toolbar,
  also opened with `/`).
  `W` toggles wireframe mode; `Q` exits it (the grid/auto-layout page says "press Q to exit"; in diagram mode `Q`
  instead means "hide quick add").
* [OC] Release 2026.7: "Compact board toolbar for diagram/wireframe switching". Release 2026.4: wireframe "Elements"
  renamed **"Components"** (the `E` launcher is now "Component").
* [OC] The Frames option is in the toolbar (third item per a LinkedIn Learning transcript, [3P]) and opens with `F`.
  Components open with `E`.
* [OC] Each board has no sub-pages historically ([3P], Viget 2019: "boards cannot subdivide into pages"), but release
  2026.12 added **multi-page files with individual tabs**. [INF] Treat multi-page as optional/later for the clone.
* [OC] A board slows down above **10,000 items** (warning shown). [INF] Design the renderer to handle that count.
* [3P] The wireframes are static: "aren't interactive", no transitions. Connectors between frames build "wireflows".
* [OC] "Present your wireframes" (release 2024.6): click the present icon top-right, pick/arrange frames, full-screen
  slideshow, arrow keys navigate. Each slide is a **section or frame**; items outside the section edge are clipped;
  a section's background colour is used when presenting; `Esc` exits.

### 1.1 Guiding constraints (what makes it "Whimsical-looking")

[OH] from the 2018 design post, still visibly true:

* Almost everything is **grey or white** (shapes, icons, text). Colour is used only for **actionable items** (buttons,
  links) and for **meaning** (red = error/delete, orange = caution, green = success).
* **Text limited to t-shirt sizes**; buttons and inputs are **Small / Medium / Large** with height, text size, padding
  and icon placement set automatically (no manual line-height / padding).
* Built on a **4px grid**; **no 1px lines** anywhere (dividers, borders, input outlines, link underlines are thicker
  than 1px) so wireframes feel "basic"/sketchy. (See conflict note in section 6.)
* **Auto-sized buttons**: width follows label text.
* Wireframe colours are deliberately **toned down / more transparent** than the same palette colour on flowchart
  shapes [OC `faqs/colors-toned-down`]. Also applies to sections and sticky notes (per that page). Workaround
  documented: use flowchart shapes for fully saturated colour.
* "The only actions you see are the only actions you can take": **no persistent properties panel**; a floating
  **context bar** appears above the selection [3P Viget, OC "context bar"].

---

## 2. Component library

### 2.1 Component inventory

Source: the official "Simple Wireframe Kit & Template (25+ Elements)" preview image linked from the official
getting-started page [OH: the image is older than the 2026.4 rename, so the *current* list may have a few
more/fewer entries; treat as the baseline]. I read it visually; the labels are exact, the descriptions of looks are mine.

| # | Name (as labelled) | Look in the kit [OH/S] | Notes / states [source] |
|---|---|---|---|
| 1 | Rectangle | white box, thin pale-grey border | `R`. Generic container |
| 2 | Solid Button | filled accent-purple, white label "Press me" | `B`. S/M/L, auto width, states, optional icon [OH blog, OC doc "changing the state of a button"] |
| 3 | Outline Button | white fill, accent border + accent label | `B` family |
| 4 | Link | small accent-purple underlined text "Click me" | `K` (was `N`, see section 4.3). Underline is thick, not 1px [OH] |
| 5 | Divider | thin light-grey horizontal rule | Old `D`; now Line is `L`/`D` and "Divider" is a Line style (see 4.3) [INF] |
| 6 | Annotation | purple callout box with a leader line ending in a dot, "Point me" | `A`. Numbered markers, colour + icon options, arrow connector drag to target [OC `boards/annotation`] |
| 7 | Image | light blue-grey fill with a "picture" glyph | `G` |
| 8 | Text Input | white box with pale "Add placeholder" text | `P`. S/M/L, default and **focused** state, typing moves the caret [OH] |
| 9 | Avatar | small round light-grey disc with a person glyph | `V` |
| 10 | Circle | white circle | `O` |
| 11 | Checkbox | small square + label "Check me" | checked/unchecked [INF from the kit and Whimsical's "states"] |
| 12 | Radio Button | small circle + label "Select me" | selected/unselected [INF] |
| 13 | Dropdown | input with chevron + two option rows "Option 1/2" | selected value, alternate options, label, state editable [OH Viget/blog: "selected value, alternate options, a label, and state"] |
| 14 | Mobile Tabs | 3 icon+label tabs, active one underlined in accent | editable tab items + icons [OC "adding and editing menu options and tabs"] |
| 15 | Horizontal Tabs | "Tab A / Tab B / Tab C", active underlined accent | editable |
| 16 | Vertical Tabs | stacked "Tab 1/2/3", active has accent bar on the left | editable |
| 17 | Textarea | taller input, "Add placeholder" top-left | |
| 18 | Lorem Ipsum | 4 lines of small dark-grey Latin text | text size options (extra sizes added 2025.6); can be swapped to Block Font [OC] |
| 19 | Block Font | dark-grey rectangular "bricks" mimicking text lines | the "block text" variant of paragraph placeholder [OC "swapping Lorem ipsum with block text"] |
| 20 | Slider | track with accent filled part and a round handle | |
| 21 | Progress Bar | teal filled part over light-grey track | |
| 22 | Overlay | translucent dark slate rectangle over a white box. Caption "Used for transparent modal backgrounds etc." | see 2.3 |
| 23 | Table | 3 columns x 2 rows of white cells with pale borders | wireframe table (distinct from the Board table in section 8.4) |
| 24 | Toggle | teal pill with white knob | on/off |
| 25 | Tooltip | dark slate rounded box "Read me" with a small pointer notch | colour option added in release 2024.15 [OC] |
| 26 | Stars | row of 4 accent stars + 1 grey star | rating |
| 27 | Video | light blue-grey panel with a dark-grey circular play button | |
| 28 | Map | pale grid of rotated "street" lines | |
| 29 | Tag | small dark-grey (slate) pill with tiny label | |

Also exist in the product but not in this kit image [OC]: **Line** (straight only, solid/dashed, colour; see 4.1),
**Text**, **Icon** (`X`), **Connector** (`C`), **Link** (`K`), **Frame** (`F`).

Not confirmed anywhere official (do not implement as "Whimsical parity", only as optional extras): breadcrumbs,
pagination, accordions, modals as dedicated components (the Overlay is the modal backdrop), side/top nav drawers,
status bar / home indicator as free components (they are **frame options**, not components).

### 2.2 Per-component context bar options (known so far)

[OC unless noted] Official wording: "Most frames and components have their own options in the context bar that appears
when you select them. We've built in unique characteristics ... so you don't have to do additional work."

* Phone frames: toggle **status bar** on/off, toggle **on-screen keyboard** on/off; orientation (LinkedIn Learning [3P]).
* Button: change **state** (default/disabled/etc.; exact state list unknown), size S/M/L, icon [OH].
* Input: default / focused (and others) state; editable text [OH].
* Nav/tabs/menus: add/edit **menu options and tabs**.
* Paragraph placeholder: "Lorem ipsum" <-> block text.
* Annotation: numbering on/off ("auto-numbering"; to renumber toggle off and on again), colour, number/other icon,
  author name show/hide, new annotations inherit the previous colour, **outline mode** (release 2026.10), connector that
  attaches to objects and follows them (release 2024.13).
* Tooltip: colour.
* Overlay: full colour palette, **no opacity control**.
* Lines: colour, solid/dashed; hold `⇧` to change line direction, hold `⌘` for full-width/height line.

### 2.3 Overlay behaviour (exact) [OC `faqs/overlays`]

* Add: type `/` (or enter wireframe mode), open Components, type "overlay", Enter; then drag on the canvas to size.
* "Overlays will automatically **snap to fit within any frame** in your design, like the window, tablet or phone."
* Full colour palette; opacity cannot be changed.
* Z-order via the standard shortcuts: `]` front, `⌘]` forward, `[` back, `⌘[` backward.

### 2.4 Insert / resize / edit mechanics

* **Insert by launcher**: `E` opens a searchable vertical menu; the search field is **auto-focused**; each entry has an
  icon; the order is **fixed** (an earlier "most recently used first" order was dropped because it was disorienting)
  [OH left-handed blog]. Type, Enter, then drag on the canvas (click-drag to size) or click to drop at default size.
  The first design was a horizontal bar; changed to a **vertical** menu on the left to save space and handle overflow [OH].
* **Insert by direct key**: single-letter shortcuts place the tool (see section 4).
* **Drag-and-drop** components from the menu also works [OC wireframes landing page].
* **Resize**: handles on edges/corners; `⇧`+drag locks aspect ratio, `⌥`+drag resizes from the centre; text and padding
  inside elements scale automatically while labels remain aligned [3P Viget]. Size in px is shown while resizing
  [OC customize-shapes, boards].
* **Edit text**: `Enter` (or double-click) on a selected object edits its text; `Enter` on a selected **frame** renames
  it [OC shortcuts]. Font size `⌘⌥=` / `⌘⌥-` (text steps between t-shirt sizes).
* **Text sizes**: wireframe text has t-shirt sizes. 2018: six sizes [OH]; release 2026.10 added **XS, XL, XXL** "in
  addition to existing sizes" [OC]; release 2025.6 added more sizes for Lorem Ipsum. Likely current ladder:
  **XS, S, M, L, XL, XXL** [INF], exact px values unknown.
* **Paste text onto a selected object** adds/replaces its text (release 2026.1) [OC].
* **Rotation**: board shapes rotate only in 90 degree steps [OC customize-shapes]; images can be rotated (2023.48);
  text objects cannot be rotated. [INF] wireframe components: assume no free rotation.
* **Copy style / paste style**: `⌘⌥C` / `⌘V`... see the official table: paste style is listed as `⌘V` after "Copy style";
  [INF] implement paste-style as `⌘⌥V` and also accept `⌘V` when a style (not objects) is on the style clipboard.
* **Save as default style** (`⌘⇧D` or the "..." menu): board-local default for subsequent objects of that type.
  Saved: shapes (fill, outline, colour, text formatting), connectors (line look, endpoints), text (colour, size),
  sticky notes (colour, text style), wireframe components (most keep full styling; **dropdowns, inputs, tooltips,
  groups keep dimensions only**). Not saved: mixed formatting inside one object; per-board only [OC].

---

## 3. Frames / artboards / devices

* [OC] "Frames" are the wireframe artboards. Chosen via Frames toolbar item or `F`. Rename with `Enter`. A frame
  clips/anchors its contents, overlays snap inside it, and frames can be a **presentation slide** and are exported per
  frame (release 2025.9: multi-select frames and export as a single zip).
* [OH, from the public kit image, labels exact] Frames shown: **Plain**, **Window** (browser: slim slate title bar with
  three tiny dots), **iPhone X** (notch + rounded bezel), **iPhone** (home-button phone, 8 style), **Android**
  (punch-hole camera, bottom gesture bar), **iPad** (home button), **Watch** (Apple Watch). = 7 frames.
* [OC] MCP `generate_wireframe` / `wireframe_edit` `frame_type` enum (via scalekit connector page, [3P-hosted but it
  mirrors the official tool schema]): `plain`, `desktop`, `iphone-14`, `iphone-x`, `iphone-8`, `ipad`, `android`,
  `android-tablet`, `apple-watch` = 9 values. This is the best evidence of the **current** frame set.
* [OH] 2018 blog: the frame launcher lists **six** frames and "we assigned **numbers** to each frame so the menu is
  completely keyboard accessible (e.g. `F` then `1` = Window)". The current numbering/order is **unknown** (gap).
  [INF] clone: keep the numbered-launcher behaviour with order Plain, Window/Desktop, iPhone, Android, iPad, Watch
  as a default; make the list data-driven.
* [OC] Frame characteristics: phone frame has status bar and keyboard toggles; AI-generated frames cover "web:
  desktop dashboards, landing pages, app screens; mobile: phone, tablet, smartwatch frames for iOS and Android"
  (`ai/ai-wireframes`).
* Frame look [OH/S]: device chrome is a flat **slate blue-grey** (about `#9BAFBB`), screens are white, tiny status-bar
  glyphs (time, signal, wifi, battery) in dark text on iOS frames; Android has the same in the top right.
  Device pixel sizes are **not published** (gap). [INF] Suggested logical sizes for the clone (my choice, NOT Whimsical
  facts): iPhone 14 390x844, iPhone X 375x812, iPhone 8 375x667, Android 360x800, iPad 768x1024, Android tablet
  800x1280, Apple Watch 184x224, Desktop/Window 1280x800 (window title bar about 24px).
* Duplicate frames with `⌘D` (or `⌥`-drag) to show different states [3P mockitt].
* Connectors between frames (`C`) express the wireflow (user flow arrows) [OH, 3P].

---

## 4. Keyboard shortcuts (Mac) - official, mode-scoped

Source: [OC] `whimsical.com/learn/shortcuts/mac`, fetched 2026-10-07. Letter shortcuts are layout-independent;
character shortcuts (`-`, `=`, `` ` ``) are referenced to the US layout.

### 4.1 The same key does different things per mode (clone needs a **scoped keymap**)

| Key | Diagram (Board default) | Wireframe mode | Freehand mode (`H` menu) | Other contexts |
|---|---|---|---|---|
| `R` | Rectangle | Rectangle | - | |
| `O` | Oval/circle | Circle | - | |
| `D` | Diamond | **Line** (also `L`) | - | |
| `A` | Trapezoid | **Annotation** | - | `A` = Task in task mode |
| `G` | Triangle | **Image** | - | grid view in file list |
| `V` | Star | **Avatar** | - | |
| `H` | Hexagon | (not listed) | **Marker** (`⇧H` highlighter) | |
| `E` | Table | **Component** launcher | **Eraser** | |
| `S` | shapes menu (per "How to draw a line") | (n/a) | **Selector** | `S` = Stack in task mode |
| `B` | Bracket | **Button** | - | |
| `P` | - | **Input** | - | |
| `F` | - | **Frame** launcher | - | |
| `I` | Image | (G is Image) | - | |
| `K` | Link | Link | - | |
| `L` | Line / Connector | Line / Connector (**conflict**, see below) | - | list view in file list |
| `C` | Connector | Connector | - | |
| `T` | Text | Text | - | |
| `X` | Icon launcher | Icon launcher | - | |
| `U` | Pill | (omitted on purpose) | - | |
| `Y` | Cylinder | - | - | |
| `J` | Cloud | - | - | |
| `N` | Sticky note | Sticky note | Sticky note | "works in all board modes" |
| `.` | Section | Section | - | |
| `W` | enters wireframe mode | toggles | | |
| `Q` | hide quick add | **exit wireframe mode** | | |
| `M` | root mind-map node | | | |
| `/` | open All tools menu | same | | |

Uncertainty flags:
* The official wireframe table lists **`L` for both "Line" ("L or D") and "Connector" ("C or L")**. Whimsical itself is
  ambiguous. [INF] Recommended clone behaviour: `C` = connector, `L` = **line** in wireframe mode, `D` = line too;
  in diagram mode `L` = line element and `C` = connector. Mark the duplicate in the keymap docs.
* `S` in diagram mode opens the shapes menu per the lines FAQ but is not on the shortcut page. Medium confidence.

### 4.2 Wireframe-mode shortcuts (official table)

| Action | Shortcut |
|---|---|
| Enter wireframe mode | `W` |
| Exit wireframe mode | `Q` |
| Annotation | `A` |
| Button | `B` |
| Line | `L` or `D` |
| Component launcher (searchable) | `E` |
| Frame launcher | `F` |
| Image | `G` |
| Link | `K` |
| Circle | `O` |
| Input | `P` |
| Rectangle | `R` |
| Avatar | `V` |
| Connector | `C` or `L` |
| Text | `T` |
| Icon launcher | `X` |
| Lock object | `⌘⇧L` |
| Rename frame | `⏎` |
| Change line direction | hold `⇧` |
| Full-width/height line | hold `⌘` |
| Sticky note | `N` |
| Command menu | `⌘K` |
| All tools menu | `/` |
| Generate with AI | `⌘.` ; create `⌘⏎` ; examples `/` ; past prompts `⌘/` |
| Agent chat | `⌘\` |

### 4.3 What changed since 2018 (do NOT use the old blog's letters)

| Item | 2018 blog [OH] | Current Mac page [OC] |
|---|---|---|
| Avatar | `A` | **`V`** |
| Annotation | n/a | **`A`** (confirmed by release 2024.13: "Keyboard shortcut A enables quick creation") |
| Divider | `D` | `D` now = **Line** (together with `L`) |
| Link | `N` | **`K`** |
| `N` | link | **Sticky note** |
| `E` | "Elements" launcher | "Component" launcher (renamed 2026.4) |
| Rounded rectangle `U` | deliberately omitted in wireframes | still omitted from the wireframe list |
| Frame launcher | `F`, numbered 1..6 | `F` (numbering unverified) |
| Icons launcher | `X` | `X` |

Whimsical's own shortcut design principles [OH]: (1) **standard** letters from design apps (`T`, `R`, `O`, `Z`);
(2) **wireframe-specific** components on single letters (`B`, `V`, `P`, `G`, `A`); (3) **launchers** that open a menu with
auto-focused search (`E`, `F`, `X`). Core letters are clustered on the **left hand** (the right hand holds the mouse).

### 4.4 Global Board shortcuts relevant to wireframes (official)

| Action | Shortcut |
|---|---|
| Command menu | `⌘K` |
| Zoom (drag/click) | `Z`+click/drag, or `⌘`+scroll |
| Zoom in / out | `=` / `-` |
| Zoom to 100% | `0` |
| Zoom to content | `1` |
| Zoom to selection | `2` |
| Pan | `Space`+drag, or `⇧`+scroll; hand tool button bottom-right |
| Undo / Redo | `⌘Z` / `⌘⇧Z` |
| Copy / Paste | `⌘C` / `⌘V` |
| Copy style / Paste style | `⌘⌥C` / `⌘V` (as published) |
| Copy link to object | `⌘⌥⇧C` |
| Copy as image | `⌘⇧C` |
| Duplicate | `⌘D` or `⌥`+drag |
| Bring to front / forward | `]` / `⌘]` |
| Send to back / backward | `[` / `⌘[` |
| Select multiple | `⇧`+click |
| Select all (excl. locked) | `⌘A` |
| Select all (incl. locked) | hold `⌘`, double-press `A` |
| Deselect | `Esc` |
| Resize locking aspect | `⇧`+drag |
| Resize from centre | `⌥`+drag |
| Edit text | `⏎` |
| Group / Ungroup | `⌘G` / `⌘⇧G` |
| Deep select | `⌘`+click |
| Ignore auto-snapping (grid still applies) | `⌘`+drag |
| Ignore grid and auto-snapping | `` ` ``+drag |
| Save as default style | `⌘⇧D` |
| Increase / decrease font size | `⌘⌥=` / `⌘⌥-` |
| Animate connector | `⌘`+click |
| Jump to the other end of a connector | `⌘`+click on one end |
| Measure distance | select an object, hold `⌥`, hover the other |
| Lock object | `⌘⇧L` |
| Cancel a move/resize in progress | `Esc` (release 2026.12) |
| Comment | `⌘⌥M`; show/hide comments `⇧⌥C` |
| Search file / workspace | `⌘F` / `⌘J` |
| Toggle sidebar | `⌘E` |
| Print / Export tab | `⌘P` / `⌘⇧E` |

---

## 5. Look and feel of wireframe objects (sampled values)

All colours in this section are **[S] approximate** (from a 1200x630 antialiased PNG preview of the kit plus
UI-less reasoning). Real values live in the logged-in app. Use them as a starting palette only.

| Role | Sampled hex [S] | Note |
|---|---|---|
| Canvas background (kit) | `#F0F4F7` | very light cool grey |
| Frame screen | `#FFFFFF` | |
| Device bezel / chrome | `#9BAFBB`, window bar `#9AAEBB` | flat slate blue-grey, no gradients |
| Image / video placeholder fill | `#E2E8EE` | |
| Heading text in kit | `#253946` | dark slate |
| Tooltip fill | about `#7C8C97` (sample of a small antialiased area; real fill is probably a darker slate) | |
| Overlay fill | `#687C89` (translucent in app) | |
| Accent (buttons, links, tabs, stars, slider) | about `#8073FD` (slider core), lighter antialiased `#A399FD` | purple (hue only; exact value unknown) |
| Positive (progress, toggle) | `#00B19F` | teal |
| Tag pill | `#BDC7CD` area, label dark | |

Other facts:
* [OC] Default sticky note colour is **purple**; the board remembers the last colour used and applies it to the next
  new note (also: diagram shapes preserve the last colour, release 2024.10). Release 2026.12: sticky notes support the
  **full colour palette**.
* [OC] Themes: workspace-level palettes ("Whimsical" default theme, custom themes, colour-blind-friendly one).
  **Custom colours** are per-board: picker with hex input, hue/saturation sliders, eyedropper (release 2026.2).
  Default board palette hexes could not be retrieved (gap).
* [OH/S] Typography in the kit looks like a **DIN-style** geometric sans. Release 2026.5 added fonts named
  "Dinsical" and "Monsical". [INF] use an open DIN-like face (e.g. "DIN Next"-lookalike such as Barlow or
  "D-DIN") for labels; wireframe component text is small (about 8-10 px at default zoom in the kit).
* [OH/INF] Elements are flat (no shadows visible in the kit), hairlines are avoided per the 2018 blog; exact border
  widths and corner radii are not published and were not measurable from the low-res preview (small radii visible).
* [OC] Dark mode exists (release 2026.9) and SVG exports support dark mode.
* [OC] Hover highlighting of objects exists (release 2026.6).

---

## 6. Conflicts between sources (flagged, not silently resolved)

| Topic | Source A | Source B | Recommendation [INF] |
|---|---|---|---|
| Wireframe grid | Help `boards/grid` [OC]: board grid **12 px**, wireframe grid **1 px** | 2018 blog [OH]: built on a **4 px** grid, no 1 px lines | Use **1 px** snapping when dragging per current official, but keep default component sizes on multiples of **4** (4 px visual rhythm) |
| Text sizes | 2018: six t-shirt sizes | 2026.10 adds XS, XL, XXL "in addition" | Offer XS-XXL (6) |
| Number of frames | 2018 blog: six | kit image: seven; MCP schema: nine | Data-driven list of nine |
| `L` key in wireframe mode | "Line" | "Connector" | `L` = line, `C` = connector |
| Paste style | table lists `⌘V` | would clash with normal paste | Implement `⌘⌥V` (and note official oddity) |
| Auto-layout | `boards/tidy-boards` [OC]: unavailable in wireframe mode | MCP `generate_wireframe` uses automatic **flexbox** layout | Auto-layout command disabled inside wireframe mode; AI/MCP generation is a separate engine |
| Whimsical "elements" terminology | blog/kit say Elements | release 2026.4: Components | Use "Components" in UI, accept "elements" in search metadata |

---

## 7. Snapping, alignment, layout, auto-spacing [OC unless noted]

* **Auto-alignment** guidelines show when the moved object aligns with centre or edges of another object. Item
  alignment takes precedence over grid alignment when near misaligned objects.
* **Grid**: items snap to grid points; connectors also follow grid lines; resized items with fractional values (images
  keeping aspect ratio) may not align perfectly. Grid stays functional when invisible at far zoom.
  `⌘`+drag = grid only; `` ` ``+drag = no snapping at all; "Snap to grid" command snaps a multi-selection.
* **Measure**: select object A, hold `⌥`, hover object B: shows the vertical distance between top/bottom edges and the
  distance between the nearest sides.
* **Align** (>= 2 selected): left, right, top, bottom, centre horizontally, centre vertically.
* **Distribute** (>= 3 selected): horizontal, vertical, and grid (sticky notes only).
* **Auto-layout** (>= 2 non-connector objects): "Lay out vertically" / "Lay out horizontally"; works for diagram
  shapes, sticky notes, icons, images, links, text; reroutes connectors; **not available in wireframe mode**.
* **Table snapping**: borders/dividers snap while resizing and other objects snap to table column dividers (2026.1).
* **Filter selection**: by object type, shape or colour; selecting a section adds its contents.
* **Group / lock / z-order**: standard (section 4.4). Locked objects are skipped by `⌘A`.
* No true auto-layout / constraints engine for wireframe components is documented (Whimsical positions absolutely;
  only the MCP/AI path uses flexbox). [INF] Implement absolute positioning + alignment/distribute commands first.

---

## 8. Shared Board tools (short; overlaps other research docs)

### 8.1 Sticky notes [OC `boards/sticky-notes`, shortcuts page]

* Created by: left toolbar button (click or drag), `N`, the quick-add buttons next to an existing note (all four
  directions since release 2026.1), or `⌥`+Arrow key.
* Default colour purple, then remembers the last chosen; full palette (2026.12).
* **Auto-resize**: as you type, text and note grow; setting a size manually overrides auto-sizing.
* Text formatting: paragraph `⌘\`, bullet list `*`/`-`+Space or `⌘⇧8`, numbered `1.`+Space or `⌘⇧7`, checklist `_`+Space,
  workspace link `@`, external link `⌘⇧U`, font size `⌘⌥=` / `⌘⌥-`.
* `⌥`+drag duplicates a note. Distribute as grid (sticky notes only).
* Local-only relevant extras: **Voting** (type `/`, choose "Voting", max votes per person, thumbs-up; results on the
  notes), **Timer** (5 presets or custom up to 99:59, top-right). Both are multi-user oriented: **skip or reduce to a
  local timer** since collaboration is out of scope.
* "Paste as" sticky notes / cards / mind map / table / bulleted list from text (`⌘K` then "Paste as").
* AI: "Whimsical AI for sticky notes" generates ideas from a topic (cloud AI; out of scope).

### 8.2 Connectors [OC `boards/connectors`]

* **8 endpoint styles + none**, set independently per end; two routings: **Elbow** and **Curve**; per-connector choice;
  4 ERD endpoints added in 2024.26. Labels (double-click), draggable along the line, text colour and white background.
* Anchor feedback: a **purple box** appears around the target; release to attach. Connector handles move the line;
  shape handles are for resizing. Elbow connectors snap to nearby edges (2026.2) and find cleaner paths (2026.7).
* Connectors attach to whole tables or individual **cells** (purple guides).

### 8.3 Freehand / pen [OC `boards/freehand`]

* Pencil icon in toolbar or `H`. Tools: **Marker** (thin or thick), **Highlighter** (`⇧H`, excludes lightest colours
  white/smoke/gray), **Eraser** (`E`, keeps its size on zoom), **Selector** (`S`).
* Colours from the active theme. A drawing can be re-styled after the fact (select, change pen type/colour).
* **Detect shapes** option: recognises rectangle, circle, straight line, diamond; becomes a normal editable shape.
* Best with Apple Pencil in Safari or Wacom-style tablets; integrates with flowchart shapes and wireframe components.
  Pressure sensitivity itself is not documented (gap). [INF] Pointer Events `pressure` for stroke width.

### 8.4 Board tables [OC `boards/tables`]

`E` (diagram mode), shapes menu or `/ table`; paste from Sheets/Excel/Numbers/Markdown/CSV/Docs/Word/Notion; `+` handles
to add rows/columns (drag to add many); remove with `⌘⇧⌫`; reorder by handles; sort; header-row toggle; table styles
(alternating rows); background colours; images and `@` file mentions in cells; no formulas.

### 8.5 Sections [OC `boards/sections`]

`.` key, toolbar, or right-click "Wrap in section". Named, solid-colour or outline background (less saturated theme
colours), optional clipping of contents, slides for Presenting, "Copy as > Link to object". Sections are the canvas
equivalent of artboards for non-wireframe content; **wireframe frames and sections both act as slides/export units**.

### 8.6 Other toolbar items (for parity; flag priority)

Shapes (rect, pill, oval, diamond, parallelogram, trapezoid, triangle, hexagon, cylinder, cloud, star, cross [2026.4],
bracket, annotation, sequence-diagram actor), Text, Image (AVIF supported, captions, rotate), Link (`K`), Icon (`X`),
Section, Code block (2026.11), Cards/Stacks (task mode), All tools (`/`), AI.
Export: PNG, PDF, SVG, "Copy as SVG", "Copy as image", multi-frame zip (cloud/collab parts excluded).

---

## 9. Icons: Whimsical's icon tool and the Lucide equivalent

### 9.1 What Whimsical does [OC/OH]

* `X` opens an **icon launcher**; search field auto-focused; "extensive metadata" makes it keyboard-only fast; "thousands
  of high-quality icons"; shared between flowcharts and wireframes (`⇧X` adds an icon to a mind-map node).
* Icons can be used inside buttons, form fields, nav items, or standalone; after placing, an icon can be **swapped** from
  the context bar [3P mockitt]. Release 2026.10: icons can also live **inside flowchart shapes**; 2026.7: mind-map node icons.
* The library also has **cloud architecture** icons (AWS, Google Cloud, Azure; 2023.23) and **HashiCorp** icons
  (2024.12), under a Design/Development category. File/folder icons come only from the library (no emoji).
* Whimsical's own artwork is proprietary. User directive: **use Lucide**.

### 9.2 Lucide facts (verified locally 2026-10-07)

* `lucide-react` **1.52.0**, licence **ISC** (open, fine for a desktop app). `lucide-static` 1.52.0 ships **2130** SVGs and
  `tags.json` with **1866** entries (keywords per icon). Brand icons are **not** in this version (no github/aws/
  chrome/slack/figma): cloud/vendor logos from Whimsical's library have no Lucide equivalent; provide a generic
  `cloud`/`database`/`server` set or let users import SVG.
* Recommended picker implementation [INF]: auto-focused search input; index = icon name + tags from `tags.json`;
  fixed ordering; opened by `X`; store the **icon name string** (e.g. `"star"`) in the document, not SVG, and render via
  `lucide-react` (`import { icons } from 'lucide-react'` or dynamic imports; tree-shake in production). Prefer canonical
  names (`square-check`, `circle-play`, `circle-user`) over aliases (`check-square`, `play-circle`, `user-circle`).
  Bundle only `tags.json` keys that exist in the installed version.

### 9.3 Mapping: Whimsical tool/component -> Lucide icon (all names verified present in 1.52.0) [INF]

Toolbar / modes:

| Whimsical item | Lucide icon |
|---|---|
| Select / pointer | `mouse-pointer-2` |
| Hand / pan | `hand` |
| Wireframe mode | `app-window` (alt `layout-template`) |
| Frames | `frame` (alt `tablet-smartphone`) |
| Components | `component` (alt `shapes`) |
| Shapes (diagram) | `shapes` |
| Rectangle | `square` |
| Circle / Oval | `circle` |
| Diamond | `diamond` |
| Pill | `pill` |
| Triangle / Hexagon | `triangle` / `hexagon` |
| Cylinder | `cylinder` (alt `database`) |
| Cloud | `cloud` |
| Text | `type` |
| Image | `image` |
| Link | `link` |
| Icon tool | `smile-plus` (alt `lollipop`) |
| Connector | `spline` (alt `cable`, `route`, `arrow-up-right`) |
| Line | `minus` |
| Section | `section` (alt `square-dashed`) |
| Sticky note | `sticky-note` |
| Freehand / Marker | `pencil` or `pen-line` |
| Highlighter | `highlighter` |
| Eraser | `eraser` |
| Shape detect | `sparkles` / `wand-sparkles` |
| Annotation | `message-square-text` (alt `message-square-more`) |
| All tools (+) | `plus` |
| Command menu | `search` |
| AI | `sparkles` |
| Present | `presentation` |
| Timer | `timer` |
| Voting | `vote` |
| Lock / unlock | `lock` / `lock-open` |
| Group / Ungroup | `group` / `ungroup` |
| Bring to front / Send to back | `bring-to-front` / `send-to-back` |
| Align left/centre-h/right | `align-start-vertical`, `align-center-vertical`, `align-end-vertical` |
| Align top/centre-v/bottom | `align-start-horizontal`, `align-center-horizontal`, `align-end-horizontal` |
| Distribute horizontally / vertically | `align-horizontal-space-between` / `align-vertical-space-between` |
| Snap to grid | `grid-3x3` (alt `magnet`) |
| Measure | `ruler` |
| Zoom in / out / fit | `zoom-in` / `zoom-out` / `maximize` |
| Undo / Redo | `undo-2` / `redo-2` |
| Copy style / paste style | `paintbrush` / `paint-bucket` |
| Paste as... | `clipboard-paste` |
| Table | `table` |
| Code block | `code-xml` |

Wireframe components (kit inventory):

| Component | Lucide icon (for the Components launcher list) |
|---|---|
| Rectangle | `square` |
| Solid Button | `square-mouse-pointer` (alt `rectangle-horizontal`) |
| Outline Button | `rectangle-horizontal` |
| Link | `link` |
| Divider | `separator-horizontal` |
| Annotation | `message-square-text` |
| Image | `image` |
| Text Input | `text-cursor-input` |
| Avatar | `circle-user-round` |
| Circle | `circle` |
| Checkbox | `square-check` |
| Radio Button | `circle-dot` |
| Dropdown | `chevrons-up-down` (alt `square-menu`) |
| Mobile Tabs | `panel-bottom` (alt `notebook-tabs`) |
| Horizontal Tabs | `panel-top` |
| Vertical Tabs | `panel-left` |
| Textarea | `rectangle-ellipsis` (alt `text-select`) |
| Lorem Ipsum | `text-align-start` (alt `align-left`, `pilcrow`) |
| Block Font | `align-justify` |
| Slider | `sliders-horizontal` |
| Progress Bar | `loader` (alt `gauge`) |
| Overlay | `layers` (alt `panel-top-dashed`) |
| Table | `table` |
| Toggle | `toggle-right` |
| Tooltip | `message-square` |
| Stars | `star` |
| Video | `circle-play` (alt `square-play`) |
| Map | `map` (alt `map-pin`) |
| Tag | `tag` |

Frames:

| Frame | Lucide icon |
|---|---|
| Plain | `square-dashed` |
| Window / Desktop | `app-window` (alt `monitor`) |
| iPhone X / iPhone 14 / iPhone 8 / Android | `smartphone` |
| iPad / Android tablet | `tablet` |
| Apple Watch | `watch` |

Status-bar / keyboard glyph options inside frames: `wifi`, `signal`, `battery-full`, `keyboard`.

### 9.4 Icon placement/meaning rules to copy

* Every Components-launcher row has a leading icon (scannability).
* Context-bar items are icon buttons with tooltips showing the shortcut on the right (Whimsical shows shortcuts in
  tooltips and command menu rows).
* Use 1.5 px stroke Lucide default, 16-20 px in toolbars, `currentColor` so theme/dark mode work.

---

## 10. Implementation guidance for the clone [INF]

* **Document model**: a Board holds `objects[]` with `type` in {`shape`, `text`, `sticky`, `image`, `connector`,
  `stroke`, `section`, `table`, `icon`, `wire`}. A wireframe object is `{ type:'wire', component:'button', frame?:id,
  x,y,w,h, props:{ label, state, size('S'|'M'|'L'), icon?, color? }, z }`. Frames are `{ type:'wire', component:'frame',
  device:'iphone-14', props:{ statusBar:boolean, keyboard:boolean, orientation, title } }`.
* Component definitions should be **data-driven** (name, search aliases, default size, prop schema, context-bar
  controls, renderer) so the `E` launcher and the AI/export code share one registry.
* Scoped keymap: `mode` in {`diagram`,`wireframe`,`freehand`} resolves letters per section 4.1. Provide `W`/`Q`.
* i18n: component names, state labels, context-bar tooltips, frame names and the shortcut cheat-sheet all go through
  i18next. Keep search aliases (e.g. "input", "textfield", "field") per locale in the locale JSON.
* Rendering target: SVG or Canvas with Pointer Events; 1 px snap, `` ` `` disables snap, `⌘` disables guides.
* Overlay: constrain to the enclosing frame bounds when created inside one.
* Export: per-frame PNG/SVG/PDF plus multi-frame zip; copy as SVG/PNG.

---

## 11. Gaps (could not be verified without the logged-in app)

1. **Current** exact component list (post 2026.4) and the **per-component context-bar options and state lists**
   (what states exist for button/input/dropdown beyond default/focus/disabled).
2. Device frame **pixel dimensions**, status-bar content, current numbering of the `F` launcher.
3. True Whimsical palette hexes (board themes, wireframe toned-down transformation, sticky note colours).
4. Typography details (font families "Dinsical"/"Monsical", exact wireframe type scale px values).
5. Exact `L` vs connector behaviour in wireframe mode; `⌘V` as paste-style.
6. Default component sizes, corner radii, stroke widths (only approximated from a low-res preview image).
7. Whether pressure sensitivity is used for pen width (not documented).
8. Behaviour of wireframe text "block text" toggle (is it a property of Paragraph or a separate component?).

## 12. Sources

Official: `whimsical.com/learn/get-started/wireframes`, `/learn/shortcuts/mac`, `/learn/faqs/overlays`,
`/learn/faqs/colors-toned-down`, `/learn/faqs/lines`, `/learn/boards/{using-boards, sticky-notes, grid, tidy-boards,
customize-shapes, connectors, freehand, annotation, sections, tables, measuring, presenting, save-default-object-style,
links, paste-as, voting, timer, performance}`, `/learn/faqs/{icons,filter-objects,zoom-direction}`, `/learn/themes/custom-colors`,
`/learn/ai/{mcp-tools,whimsical-ai}`, `/releases` (2023-2026), `/blog/fast-collaborative-wireframing-app` (2018),
`/blog/why-we-optimized-left-handed-shortcuts-in-wireframes`, `/wireframes`, `/ai/ai-wireframes`,
`/wireframe-elements-Ft4RAtBFHfYFa8da1weDuV` (kit; read via its OG preview image), `/templates/{wireframes,
mobile-app-wireframe,website-mockup}`.
Third party: Viget (2019), mockitt, LinkedIn Learning transcript, hackdesign.org, scalekit MCP connector page.
Lucide: `lucide-static@1.52.0` package (`icons/`, `tags.json`), npm registry metadata.
