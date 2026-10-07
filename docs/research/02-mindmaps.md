# 02 - Whimsical Mind Maps: behaviour, keyboard model, styling

Research for the local-first Whimsical clone. Scope: Mind Maps (keyboard model, auto-layout, styling,
toolbar, collapse, drag and drop, import/export). Written for the implementer, not for marketing.

**Confidence legend** used throughout:

- **[OFFICIAL]** stated verbatim on whimsical.com/learn (help centre, shortcut pages, release notes).
- **[BUNDLE]** read from Whimsical's own publicly served web-app JavaScript (compiled ClojureScript;
  keymap tables, tooltip strings, icon keys, event/state names). Strong evidence of *what exists*, weaker
  evidence of *exact runtime behaviour* because the logic is minified.
- **[INFERRED]** deduced from the two sources above or from common mind-map conventions. Verify against
  the real app if pixel/behaviour accuracy matters.
- **[UNKNOWN]** not found; see "Gaps" at the end.

Mac key notation: `Cmd` = Command, `Opt` = Option, `Ctrl` = Control, `Shift`. (The bundle calls Cmd
`defmod`; on Windows it is Ctrl.)

---

## 0. Big structural fact: mind maps now live inside Boards

[OFFICIAL + BUNDLE] In today's Whimsical a mind map is an **object inside a Board** (the infinite canvas),
not a stand-alone file type. Evidence:

- The official shortcut page lists "Mind Map Shortcuts" next to Diagram/Flowchart, Sticky Note, Wireframe and
  Freehand shortcuts, all under "Board Shortcuts". `M` is a board tool ("New mindmap").
- The MCP/agent docs say "Mindmaps are compound shapes built via `mindmap_create`".
- Bundle keys: `board/mindmap`, `kb-mode/mindmap` (a keyboard *mode* that becomes active when mind-map
  nodes are selected), `tool-mindmap`, `g.mindmap` (group kind).
- Legacy files created as "Mind Maps" in 2019 (blog "Introducing: Whimsical mind maps", 17 June 2019)
  still exist, but the editor is the board editor.

**Clone implication:** implement mind maps as a *compound board object* (a tree of nodes with automatic
layout) living on the infinite canvas, so a Board can contain several mind maps plus stickies, shapes,
connectors etc. A "new Mind Map" file in the sidebar simply creates a Board pre-seeded with one root node and
the mind-map tool selected. This matches the user's requirement that Boards expose the same tool set.

Mind maps can also be **mixed with other objects**: bundle drop-target kinds include `non-mindmap-parent`
(dropping a node onto a non-mind-map object) and connectors can attach to nodes (link arrows are
colour-coded to the line colour, per the 2019 blog).

---

## 1. Creating a mind map

| Way | Detail | Source |
|---|---|---|
| Toolbar | Click or drag the Mind map tool out of the toolbar | OFFICIAL |
| Shortcut | `M` (tool "New mindmap"), then click on canvas | OFFICIAL |
| Paste list | Copy a bulleted/indented list, select a mind map's **starting (root) node**, paste (`Cmd+V`) -> list becomes child nodes | OFFICIAL |
| Paste as... | Right-click canvas or `Cmd+K` -> "Paste as" -> **Mind maps** (also Sticky notes, Bulleted lists, Tables). Default board paste is Markdown | OFFICIAL |
| Paste Mermaid/other | Not for mind maps (Mermaid import is flowchart/sequence only) | OFFICIAL |
| AI | Select a node, click the sparkle icon in the context bar -> generates 5 child ideas per click, uses prior nodes as context. `Cmd+.` "Generate with AI" also works with mind-map nodes. Out of scope for the clone (no cloud) but keep the toolbar slot optional | OFFICIAL |
| MCP | `mindmap_create` / `mindmap_edit` / `mindmap_read`; supports vertical mind maps (2026.11) and node icons (2026.7) | OFFICIAL |

**Export:** select the main node, copy, then **paste special** (`Cmd+Shift+V`) elsewhere -> indented
plain-text/Markdown list. [OFFICIAL] Also whole-board export (PNG/SVG/PDF) is a separate board feature.

---

## 2. Keyboard model

### 2.1 Official mind-map shortcut table (Mac)

[OFFICIAL, whimsical.com/learn/shortcuts/mac]

| Action | Mac shortcut | Notes |
|---|---|---|
| Add root node | `M` | Tool shortcut; click canvas to place |
| Add child | `Tab` | New node as **last** child of selection, immediately in edit mode |
| Add sibling | `Enter` | New node after selection (below/right in sibling order), in edit mode |
| Add sibling above | `Cmd+Enter` | Inserts **before** selection. Bundle: `defmod-enter` "Add sibling node", called with a `:before`-style flag |
| Add parent | `Opt+Enter` | Inserts a new node **between** selection and its current parent; selection becomes its child |
| Collapse / Expand | `Cmd+/` | Toggle on selected node |
| Add line break | `Shift+Enter` | Soft newline inside node text (plain `Enter` would add sibling) |
| Add link | `Cmd+Shift+U` | Link to text (also "External link" in stickies) |
| Add icon | `Shift+X` | Opens icon picker for the node. (`X` alone = Icon *tool* on canvas) |
| Decrease **text** indent | `Cmd+Ctrl+[` | Official label is "Decrease text indent" (the summarised fetch said "indent"). Most likely indentation *of the text inside a node*, NOT a tree re-parent. [UNKNOWN semantics - the 12-entry mind-map keymap in the app has no indent binding] |
| Increase **text** indent | `Cmd+Ctrl+]` | Same caveat |

Windows equivalents replace Cmd -> Ctrl and Opt -> Alt (e.g. Collapse `Ctrl+/`, Add parent `Alt+Enter`).

### 2.2 Additional mind-map keymap found in the app (kb-mode "mindmap")

[BUNDLE] The mind-map keyboard mode registers exactly these keys (verbatim labels in quotes):

| Key | Label in app | Notes |
|---|---|---|
| `Tab` | "Add mindmap child node" | |
| `Shift+Tab` | "Select mindmap parent" | **Not** "add child on the left" as in Visio. It just moves selection to the parent |
| `Cmd+Enter` | "Add sibling node" | with before/above flag (see table above) |
| `Cmd+D` | "Duplicate node" | Handlers `duplicate-selected-node` and `duplicate-child-node` exist (subtree duplication INFERRED) |
| `Opt+Enter` | "Add parent node" | |
| `Up` / `Down` / `Left` / `Right` | "Navigate up/down/left/right" | See 2.3 |
| `Delete` / `Backspace` | "Delete mindmap node" | Whether the subtree is removed or promoted is UNKNOWN (assume subtree removed, as in most tools; Whimsical's interaction is `delete-node`) |
| `Shift+F12` | "Layout mindmap" | Hidden "re-run auto-layout" command. There is also a JS API `app.js_api.layoutMindmaps` |

Note plain `Enter` is **absent** from the mode keymap although it adds a sibling: it is handled by the
node's text-editor plugin (`board.mindmap.state.editor/plugin`) while editing. See 2.4.

### 2.3 Arrow-key navigation (selection mode, not editing)

[BUNDLE + INFERRED] The arrow handler is a single function parameterised by direction; read from the
minified source it does, in order:

1. If the pressed arrow points in the **growth direction of the selected node's branch** (e.g. `Right` on a
   node on the right-hand side of a horizontal map; `Down` in a vertical map): go to the **first child or nearest
   node** in that direction (unconfirmed which; state fns `expand-and-scroll-into-view`, `first-child`, `select-closest-node` exist, so collapsed children are probably expanded first).
2. If the arrow is along the growth axis but pointing **back toward the root**: select the **parent**
   (same as `Shift+Tab`).
3. If the arrow is on the **perpendicular axis** (Up/Down in horizontal maps; Left/Right in vertical maps):
   select the **previous/next sibling**.
4. Fallback: `select-closest-node` in that direction (geometric nearest node) - used e.g. to jump from one
   side of the root to the other and between cousins.

For the **root** node: Left/Right (horizontal) go to the first child on that side; Up/Down move among
root children on the current side (INFERRED).
Arrow keys with nothing mind-map-related selected still do "Move / pan canvas" (general keymap);
`Shift+arrow` = large move, `Cmd+arrow` = 1px nudge, `Cmd+Shift+arrow` resize (general board keymap, BUNDLE).

### 2.4 Editing flow (the "keyboard-only" loop)

[OFFICIAL + INFERRED]

```
M, click       -> root node created, caret in text
type "Topic"   -> Enter
               -> (Enter while editing) commits and creates a SIBLING below, caret in it
Tab            -> commits and creates a CHILD, caret in it
Shift+Enter    -> newline inside the same node
Esc            -> stop editing, node stays SELECTED (kb-mode mindmap active: Tab/arrows/Delete work)
Tab on selection (not editing) -> new child, in edit mode
Enter on a selected non-editing node -> INFERRED: start editing its text ("Enter = Edit object"
                                         in the general board keymap; F2 is not documented)
Cmd+R          -> also "Edit object" (BUNDLE, general keymap `defmod-r`)
Backspace on empty new node -> INFERRED: deletes it (typical; not confirmed)
```

Recommended clone behaviour: pressing Enter while editing a node with **text** creates a sibling; pressing
Enter in an **empty root** just exits editing. Root has no siblings, so for the root node `Enter` should
create a first child (INFERRED; Whimsical behaviour on root sibling not documented).

### 2.5 Collapse / expand (mouse + keyboard)

[BUNDLE tooltip strings, high confidence]

The collapse button is a small circular affordance at the outer end of a node that has children, shown on hover
(`show-collapse-button?`) and always visible when collapsed, with a **collapsed-descendant count**
(`collapsed-count`) while folded. Tooltip logic reads the modifier keys:

| Interaction | Effect | Tooltip text |
|---|---|---|
| Click | Collapse / expand this node | "Collapse" / "Expand" |
| `Opt+Click` | All descendants (recursive) | "Collapse all" / "Expand all" |
| `Shift+Click` | All **siblings** of this node | "Collapse siblings" / "Expand siblings" |
| `Opt+Shift+Click` | Whole **level** | "Collapse level" / "Expand level" |
| Keyboard (tooltip hint) | `Cmd+Opt+[` collapse, `Cmd+Opt+]` expand | shortcut chips in the tooltip |
| Keyboard (official page) | `Cmd+/` toggle | |

Both keyboard bindings appear to exist (the tooltip combo may be legacy/alias; treat `Cmd+/` as primary).
The 2019 blog also confirms "collapse a branch" is in the contextual toolbar. A relayout animation runs on
collapse (`did-expand-collapse-hook`), and collapsed state is persisted per board (`board.embed.state/mindmap-expand-collapse`
shows it is also honoured in embeds).

### 2.6 Moving/reordering branches by keyboard

- Official table: **no keyboard binding that re-parents or reorders** was found. (`Cmd+Ctrl+[`/`]` are labelled "text indent" and are not confirmed to change the tree.)
- No `Opt+Up/Down` or `Cmd+Shift+Up/Down` reorder binding was found in the mind-map keymap [BUNDLE]. In the
  general board keymap `Opt+Arrow` means "New shape above/below/left/right" (quick-add for diagrams),
  and in stickies "Quick add another". For mind maps the equivalent is Tab/Enter.
- Reordering/re-parenting is therefore done by **drag and drop**, or by deleting and re-inserting with Tab/Enter/`Cmd+Enter`/`Opt+Enter` (add parent).
  **Clone recommendation:** add `Cmd+Shift+Up/Down` (reorder) and `Cmd+Shift+Left/Right` (outdent/indent, re-parent) as clearly marked extensions that are not in Whimsical, so they do not conflict with its keymap.

### 2.7 General board shortcuts that apply while a mind map is selected

[OFFICIAL] `Cmd+Z`/`Cmd+Shift+Z` undo/redo; `Cmd+C/V` copy/paste; `Cmd+Opt+C` copy style, `Cmd+V` onto another
object pastes style; `Cmd+Shift+D` save default style; `Cmd+D` duplicate; `Cmd+A` select all; `Esc` deselect;
`Cmd+G`/`Cmd+Shift+G` group/ungroup; `Cmd+Shift+L` lock; `Cmd+Opt+=` / `Cmd+Opt+-` font size up/down;
`Delete`/`Backspace` delete; `Cmd+K` command menu; `/` open add menu; `Cmd+F` search.

Zoom/pan (board-wide): `=` zoom in, `-` zoom out, `0` 100%, `1` zoom to content (fit), `2` zoom to selection,
`Z`+click/drag or `Cmd`+scroll zoom, `Space`+drag or `Shift`+scroll pan, trackpad pinch/two-finger swipe,
hand icon bottom-right = persistent pan mode. [OFFICIAL] Default: with `Cmd` held, scroll down zooms in, scroll up zooms out; Whimsical has an "Invert zoom direction" preference (Preferences > Advanced), clone should offer it too.

Text formatting inside a node: bold/italic (`Cmd+B`, `Cmd+I` - standard, OFFICIAL toolbar says bold/italic
exist), inline link (`Cmd+Shift+U`), lists/markdown shortcuts do **not** apply in mind-map nodes (agent docs:
"Mindmaps: plain text or hiccup content", i.e. inline marks only: bold, italic, strike, code, highlight, links).

---

## 3. Structure and auto-layout

[BUNDLE + OFFICIAL]

- Whimsical lays out mind maps **automatically and continuously**; the user never positions nodes freely.
  Dragging changes the *tree* (parent/order/side), not coordinates. The layout is recomputed on every edit
  with an animation. `Shift+F12` "Layout mindmap" forces a relayout.
- **Orientation** is a toolbar setting with two axes, evidenced by four icon keys:
  `obj-mind-map-horz-curvy-20`, `obj-mind-map-horz-elbow-20`, `obj-mind-map-vert-curvy-20`,
  `obj-mind-map-vert-elbow-20`.
  - `horz` = classic mind map: root in centre, children to the left and/or right ("both" / "side").
  - `vert` = top-down tree (organisation-chart style); added to MCP in 2026.11, UI exists earlier.
- **Sides:** bundle keys `side`, `side-offset`, `max-side`, `both`, `quickadd-branch-left-20`,
  `quickadd-branch-right-20`, and an interaction `move-to-side`. Meaning: each first-level branch has a side
  (left or right of the root). Quick-add buttons let you add a root-child on the left or the right. Dropping
  a node on the far left/right of the root moves its branch to that side.
  Inferred rule for keyboard `Tab` on the root: new child goes to the **side with fewer children (right on tie)**
  [INFERRED - verify].
- Sub-branches always grow in the same direction as their first-level ancestor (right side branches grow
  right; left side grow left).
- **Line style** (`curvy` vs `elbow`/"angular"): per-map (2019 blog: "overall layout and line styles"). Toolbar
  wording in help: "Curved or straight lines". Bundle icons `quickadd-mindmap-sibling-{horiz,vert}-{curvy,angular}-20`
  show quick-add buttons adapt their glyph to orientation and line style.
- **Quick add buttons:** hovering a node shows small "+" handles: sibling (`quickadd-mindmap-sibling-*`) and
  child (`quickadd-mindmap-child-horiz/vert-20`), so mouse users can build without the keyboard. For the root
  there are the left/right "branch" variants.
- Node text wraps at a maximum width (exact value UNKNOWN); `Shift+Enter` adds manual breaks.
- **Lines:** colour-coded **per branch** and settable ("Changing line colour"). Link arrows are colour-matched
  to the line colour (2019 blog). Line width per depth level: UNKNOWN.
- Context-bar (toolbar) adapts to the selection (bundle keys `root-ids`, `branch-ids`, `with-children`,
  `lines`): for a root it shows map-wide settings (orientation/line style); for a node it can apply the colour to
  "this branch" / with children.

### Layout algorithm to implement (clone)

Recommended: a tidy-tree (Reingold-Tilford / Buchheim) laid out per side.

1. Measure every node (text size + icon + padding).
2. Horizontal map: split root children into `left[]` and `right[]` by each node's stored `side`; run a tidy tree
   for each half growing outward; vertically centre each subtree on its parent; centre the root between halves
   (parent y = mean of first/last child centre).
3. Vertical map: same, rotated 90 degrees; branches likely grow on top and/or bottom sides of the root (the bundle's side logic handles `top`/`bottom` as well as `left`/`right`), default top-down. Verify.
4. Constant gaps: level gap about 40-60px, sibling gap about 12-20px (UNKNOWN exact; tune visually).
5. Draw connector from parent edge to child's **near edge** (curvy: cubic Bezier with horizontal tangents,
   `M x1,y1 C xm,y1 xm,y2 x2,y2`; elbow: orthogonal polyline with rounded corner radius about 8-12px).
6. Animate node positions (150-250 ms ease) on relayout; collapse animates children into the parent.

---

## 4. Node styling and toolbar

### 4.1 Contextual toolbar contents (official help + bundle)

[OFFICIAL "Getting started with mind maps"; BUNDLE contextbar keys]

| Control | Detail | Lucide suggestion |
|---|---|---|
| Line style | Curved vs straight/elbow (4 icons combined with orientation) | `Spline` / `CornerDownRight` |
| Orientation | Horizontal (both sides) / Vertical | `AlignHorizontalSpaceAround` / `AlignVerticalSpaceAround` |
| Line / branch colour | Palette from theme + custom (hex via picker + eyedropper) | circle swatch (custom), `Palette` |
| Text style | **Bold**, *Italic* | `Bold`, `Italic` |
| Link | Add link to node text; inline-link option (`show-inline-link-opt?`) | `Link` |
| Icon | Add icon to node (root and any child). Placement **left** or **right** of text (`icon-placement-left/right`: "Icon left", "Icon right"). Picker search defaults to the node text (`default-icon-search-text`) | `Smile` or `Shapes` |
| Collapse | Collapse/expand branch | `ChevronsDownUp` / `ChevronsUpDown` |
| AI | Sparkle - generate 5 ideas (optional / drop in clone) | `Sparkles` |
| More (...) | Copy/paste style, duplicate, delete etc. | `Ellipsis` |

### 4.2 Colours

[BUNDLE] The app bundle contains a mapping of **14 legacy hex colours to their current oklch equivalents** (it
is used to migrate old stored colours to the present palette). So the hex values are the *older stored form*;
the oklch column is the current rendering. Descriptive names are mine (stored key names are obfuscated).
Use the oklch values in the clone.

| Legacy hex | Current oklch | Appearance |
|---|---|---|
| `#207868` | `oklch(52% 0.092082 184)` | deep teal green |
| `#F7C325` | `oklch(84% 0.141306 89)` | yellow |
| `#6558F5` | `oklch(57% 0.220195 280)` | indigo / violet |
| `#EFA544` | `oklch(78% 0.131957 70)` | light orange |
| `#293845` | `oklch(33% 0.029558 248)` | very dark navy |
| `#4B5C6B` | `oklch(47% 0.032202 248)` | dark slate |
| `#D3455B` | `oklch(60% 0.1775 16)` | raspberry red |
| `#AC6363` | `oklch(58% 0.078269 20)` | muted brown-rose |
| `#C3CFD9` | `oklch(85% 0.019119 248)` | light blue-grey |
| `#BD34D1` | `oklch(60% 0.2423 322)` | magenta / orchid |
| `#1AAE9F` | `oklch(68% 0.112508 184)` | bright teal |
| `#E8833A` | `oklch(71% 0.149045 53)` | orange |
| `#2C88D9` | `oklch(61% 0.148288 249)` | blue |
| `#788896` | `oklch(62% 0.028346 248)` | mid grey |

Each palette colour renders three surfaces (agent docs): **Base Fill** (saturated), **Outline Fill** (lighter
tint) and **Outline Stroke** (border). Neutral greys have explicit triples:
`#F2F5F7 / #BECDD7`, `#E3E8ED / #697DA0`, `#CED8E0 / #0A3C64` (fill / stroke). Themes are per workspace/
file, custom colours per board (hex picker + eyedropper; right-click a swatch to edit/delete).
Neutrals/UI tokens (`bg-canvas #f3f5f8`, panel `#ffffff`, dark `#19232c`, `#0f171f`) are covered by the
design-token research file, not here.

How branch colours are **assigned** by default is UNKNOWN: per the third-party review "colors are assigned
automatically by depth level" which conflicts with the usual "per first-level branch" convention. Plan:
assign each root-child branch the next palette colour (cycling a curated subset, e.g.
`#2C88D9, #1AAE9F, #E8833A, #BD34D1, #D3455B, #F7C325, #6558F5, #207868`) and let descendants inherit it;
root gets dark navy `#293845` fill. Make it configurable.

### 4.3 Fonts / sizes

Board text scale [BUNDLE]: xs 13px, s 15px, **m 18px (default)**, l0 21px, l1 27px, l2 36px, l3 60px, l4 90px.
Mind-map nodes use this same scale (root typically larger; exact defaults UNKNOWN). `Cmd+Opt+=` / `-` change size.
Whimsical's UI font is a geometric sans (Agrandir/Avenir/Montserrat-like stack in marketing); in-canvas text
uses the board font. Icons in nodes come from Whimsical's own **icon library: 4,840 icons in 41 categories**
(User Interface 394, Arrows 353, AWS/Azure clouds, Flags, Food, etc.). Proprietary: use **Lucide** (about 1,500
icons) as the node-icon set, plus emoji, per the user's decision.

### 4.4 Node content

- Plain text with inline marks (bold, italic, strikethrough, inline code, highlight, link) [BUNDLE].
- One optional icon per node, left or right of text.
- Links: external URL or **internal reference to a Whimsical file/object** (`@` mentions in text exist in stickies;
  for mind maps only the link action is documented). Clone: external URLs + links to other local files.
- **No documented per-node notes field and no per-node images** in Whimsical mind maps. (Images and notes are
  board objects; the user can place them next to a map. Do **not** invent a notes panel; treat as UNKNOWN/absent.)
- Comments (collaboration) are out of scope.

---

## 5. Drag and drop re-parenting

[BUNDLE state names `board.mindmap.state.move`: `dragged-ids`, `drop-target`, `placeholder`, `fade?`,
`hide-delta-ids`; helper `move-to-side`; fn classification `child | sibling | root-child | non-mindmap-parent`;
log string "Rejected stale mind map drop target"]

Behaviour reconstructed:

1. Mouse-down + drag on a node (or multi-selection) lifts it: the dragged subtree follows the cursor, the original
   position fades (`fade?`) and the rest of the map **relays out live** with the dragged nodes excluded
   (`hide-delta-ids`).
2. While hovering, a **drop target** is computed and a **placeholder** (ghost slot / line) shows where the node will
   land. Target kinds:
   - `child` - dropped onto a node's body: becomes its (last) child.
   - `sibling` - dropped in the gap between two siblings: inserted at that index.
   - `root-child` - dropped near the root: becomes a first-level branch on the left or right (`move-to-side`).
   - `non-mindmap-parent` - dropped on another board object: detaches/does nothing special (INFERRED: becomes
     a free-standing root or is rejected).
3. Drop targets are validated asynchronously; stale ones are rejected (clone: just recompute on pointer move).
4. Cannot drop a node into its own subtree (cycle check).
5. `Opt+drag` duplicates for board objects generally; for nodes `Cmd+D` is the documented duplicate. (Option-drag
   duplicate for nodes UNKNOWN.)
6. Dragging the **root** moves the whole map (it's a compound object with a position); dragging a non-root node
   never leaves free coordinates.

---

## 6. Import / export summary

| Direction | How | Format |
|---|---|---|
| Import | Select root node -> `Cmd+V` after copying list (also from Docs/Notes) | indented text, Markdown bullets (nested by indentation) |
| Import | `Cmd+K` / right-click -> Paste as -> Mind maps | same |
| Export | Select root -> `Cmd+C` -> `Cmd+Shift+V` (paste special) | indented bullet list |
| Export | Board-level export (PNG, SVG, PDF; also "Copy as image" `Cmd+Shift+C`) | image |

For the clone's file format, store the tree as JSON (nodes with `id, parentId, order, side, text(marks), icon,
iconPlacement, color, collapsed`, map-level `orientation, lineStyle`), and also provide Markdown-list
copy/paste to match Whimsical.

---

## 7. Mapping Whimsical -> clone work items

1. Mind-map compound object in the Board model with auto-layout (section 3) and `Shift+F12`-equivalent command.
2. Keyboard mode `mindmap` with the keymap in 2.1-2.5; text editor plugin that maps Enter/Tab/Shift+Enter
   while editing.
3. Collapse button with count, modifier-click semantics (2.5), persisted `collapsed`.
4. Drag/drop with placeholder and three target kinds (section 5).
5. Context bar: line style, orientation, colour, bold/italic, link, icon, collapse (4.1).
6. Paste list -> subtree; copy subtree -> Markdown list (section 6).
7. i18n: every label above (tooltips "Collapse all", "Expand level", "Add icon", etc.) as keys.
8. Lucide icon mapping table in 4.1. (Quick-add "+" handles can use `Plus`.)

---

## 8. Gaps / things to verify against the real app

1. Exact **default colours per depth/branch**, root node fill/size/radius, node padding, line widths per level,
   level/sibling gaps, max node text width.
2. Whether plain **Enter on a selected (non-editing)** node edits or adds a sibling; `F2` not documented.
3. **Delete** semantics for nodes with children (cascade vs promote) and Backspace on empty node.
4. Which side a new root child goes to with `Tab` on the root, and how Left/Right/Up/Down behave from the root.
5. Whether `Shift+Tab` while **editing** does anything else (outdent?) - only "select parent" confirmed for selection mode.
6. Real behaviour of `Cmd+Ctrl+[`/`]` (indent/outdent) with children and with collapsed nodes.
7. Tooltip combo `Cmd+Opt+[` / `]` vs official `Cmd+/` for collapse - confirm both work.
8. Multi-node selection rules (Shift+click range, select branch) specific to mind maps.
9. Node shape variants (pill, boxed, underlined text) - not documented; only line style and colour are.
10. Dark-theme mind-map colour mapping.
11. No YouTube-transcript or Reddit evidence was retrievable with the available tools (search returned mostly other
    vendors); everything here comes from whimsical.com pages, release notes and the shipped web-app bundle.

## Sources

- https://whimsical.com/learn/shortcuts/mac (and /pc) - official shortcut tables
- https://whimsical.com/learn/get-started/mind-maps - getting started
- https://whimsical.com/learn/get-started/ai-mind-maps - AI mind mapping
- https://whimsical.com/blog/introducing-whimsical-mind-maps - 2019 launch post (quick-add buttons, contextual toolbars, icon library)
- https://whimsical.com/releases/year/2026 - 2026 release notes (2026.7 node icons via MCP, 2026.11 vertical mind maps)
- https://whimsical.com/learn/imports-exports/importing, https://whimsical.com/learn/boards/paste-as - paste/export
- https://whimsical.com/learn/get-started/infinite-canvas - zoom/pan
- Whimsical web-app JavaScript bundle (publicly served; keymap, tooltip strings, icon keys, state names) - BUNDLE items
- Third-party mentions: Figma forum "Figma vs Whimsical mindmaps" (Enter adds leaf node)
