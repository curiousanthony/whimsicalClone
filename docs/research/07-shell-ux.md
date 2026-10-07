# 07 - Whimsical app shell and global UX

Scope: the application shell (sidebar, file tree, create menu, tabs, command menu, search, export, templates, theme tokens, fonts, global shortcuts) as documented by Whimsical's public help center, release notes and public static assets (CSS and JS bundles served from whimsical.com). Board-tool specifics (flowcharts, mind maps, wireframes, sticky notes, freehand) are covered in other research files; this file only repeats the shortcuts needed to build the global keymap.

Mac key notation: `Cmd` = Command, `Opt` = Option, `Ctrl` = Control, `Shift`. In Whimsical's own bundle `defmod` means Cmd on macOS and Ctrl on Windows.

Confidence tags used below: **[H]** = stated on an official Whimsical help/release page; **[B]** = read from Whimsical's public JS/CSS bundle (strong but may be ahead of or behind the help text); **[M]** = inferred or from a lower-quality passage; **[P]** = my proposal for the clone, not a Whimsical fact.

Primary sources:
- https://whimsical.com/learn/shortcuts/mac (the official Mac shortcut page; help.whimsical.com/shortcuts/mac redirects to it)
- https://whimsical.com/learn/ (help center: get-started, faqs, files, imports-exports, settings, themes pages)
- https://whimsical.com/releases/year/2025 and /2026 (release notes)
- https://github.com/WhimsicalCode/fonts (Dinsical and Monsical, OFL)
- Public CSS (`bundle.css`, `fonts.css`) and the app JS bundles (`app.main-*.js`, `views-*.js`), mined for design tokens and the keymap registry.

---

## 1. Key findings (summary)

1. Whimsical's real fonts are open: **Dinsical** (main UI/board sans, variable weight 300-900 plus italic) and **Monsical** (monospace, 400/700 plus italics) are published under the **SIL Open Font License** at `github.com/WhimsicalCode/fonts` and "can be used and redistributed freely". The clone can legally bundle the exact fonts. [H]
2. The full design-token set of the app (`--us-*`) is recoverable, with light and dark values (section 6). The neutral ramp is a blue-grey slate (`#293744` text, `#f3f5f8` canvas, `#ffffff` panel); the accent is purple (`#8b30e4`, `#8013d9` hover), selection handles are lighter purple `#aa74f3`. [B]
3. The sidebar is organised as **Inbox, Recent, Favorites, Private, Teams, Shared with me, Trash, Templates and color themes**. For a local-first clone this collapses to Recent, Favorites, and the workspace folder tree (section 3). [H]
4. Creating files: 5 documented ways. The keyboard one is `Cmd+Opt+N`. The create menu offers Board, Doc, Folder and Template (plus "Ask agent" in the current app), with colour-coded icons (board purple `#8013d9`, doc blue `#2484d4`, folder grey `#738291`, template `#556575`). [H][B]
5. Two search surfaces: **Command menu `Cmd+K`** (context-aware command palette, shows top 3 recent commands, shortcuts displayed right-aligned) and a **Search sidebar** opening on the right (`Cmd+J` workspace, `Cmd+F` this file/folder). [H]
6. The official shortcut page and the live keymap in the JS bundle **disagree** in several places (hexagon, parallelogram vs trapezoid, bring-to-front, mind-map sibling). Section 8 lists each discrepancy with a recommendation. Shortcuts are **scoped by mode** (board default, Wireframe `W`, Card/Task `Shift+C`, freehand `H`, mind-map node selected, text editing). [H][B]
7. Export surface: PNG via Share > Export (Board or Frames, 1x/2x, selection only, transparent or background), PDF via Print > Save as PDF, SVG and Mermaid via right-click "Copy as...", Markdown for docs (download .md or copy). Free plan watermarks; the clone should not. [H]
8. The desktop app has **tabs** (`Cmd+T`, `Cmd+W`, `Cmd+1..9`, pin tab, `Shift+click` opens a new window) and is a native Electron-style shell; this is directly reproducible. [H]
9. Dark mode exists (release 2026.9) with System/Light/Dark, switchable from Preferences or the command menu ("Interface color mode"); PDF export always uses light. [H]
10. Interface is English-only in Whimsical (no i18n), so the clone's i18next structure is our own addition; keep Whimsical's exact English strings as the `en` locale. [H]

---

## 2. App shell layout

Reconstructed from the help center text (screenshots were not retrievable, so exact pixel metrics are in the Gaps section).

```
+--------------------------------------------------------------------------+
| [tabs: desktop app only]  tab | tab | tab(pinned) | +                      |
+----------+---------------------------------------------------------------+
| sidebar  | title bar:  [hamburger/pin] Name v (file actions)   Share  [?] |
|  (left)  |            breadcrumb parent > title    [search icon, top right]|
|          +---------------------------------------------------------------+
|          |                                                               |
|          |   board canvas / doc / folder view                            |
|          |   left vertical board toolbar, floating context toolbar       |
|          |                                                               |
|          |   bottom-right: pan(hand), zoom % menu, help "?", AI, Cmd menu|
+----------+---------------------------------------------------------------+
```

Facts:
- **Sidebar**: lockable (pin icon, top-left) so it is always visible; when unpinned it opens on hover of the hamburger icon (top-left) or `Cmd+E`; width is resizable by dragging its right edge. [H]
- **Title bar**: file name is click-to-rename; a dropdown chevron beside the name is the **file actions menu** (Move to, Copy to, Delete, theme, settings, Save as template, Add page, Ungroup pages, Show deleted pages...). **Share** button at top right (link, invite, Export tab, Print). A magnifying-glass icon at top right opens search. Avatars of other viewers appear top right (collaboration: omit in clone). [H]
- **Breadcrumb** at top-left of a doc: shows only two levels (parent > current). [H]
- **Bottom-right of a board**: pan-mode (hand) button, zoom percentage button opening the Zoom menu (zoom in/out, 100%, fit to content `1`, fit selection `2`), Version history button, help menu "?" (support, report issue, keyboard shortcuts, releases, help resources) next to the AI button, and a Command menu button. In 2026.7 the help "?" moved to the left navigation bar. [H]
- **Docs bottom-right**: "Text size and layout" button (text size and width), Focus mode. Defaults: Narrow width, Large text. `Cmd+-` / `Cmd+=` change doc text size. [H]
- **Board toolbar**: left side, vertical; top section = main objects (select/pan, sticky note, diagram shapes, text, ... plus Wireframe and Card modes), rest = supporting tools (connector, section, freehand, templates, AI, "All tools" searchable menu). 2026.7: "compact board toolbar". After picking a tool, a secondary option strip appears (e.g. freehand: marker, highlighter, eraser, selector). Selecting objects shows a **floating context menu** (colour, shape, text styling, align/distribute, group, lock, "..." overflow with "Wrap in section"). [H][M on exact order]
- **Multi-page files** (2026.12, replaced "tabbed folders"): page tabs sit in the file header like spreadsheet sheets; `+` after the last tab adds a page (Board, Doc, From template, Folder, Ask agent); double-click tab name to rename, double-click the tab icon to change icon, drag to reorder, right/actions menu for Delete; "Show deleted pages"; "Ungroup pages...". The first page keeps the file's original link; the multi-page file takes the original name, icon, colour and sharing. [H]
- **Grid view / list view** of a folder: toggled with `G` (grid with previews) and `L` (list with creator and modified info). Sort: Name, Date created, Created by, Date modified, Modified by, Manual (drag). Sort preference is remembered per folder; folders default to manual sort. In list view, clicking a column name sorts, click again toggles direction, an "x" returns to manual sort. [H]

---

## 3. Sidebar, file tree, create menu

### 3.1 Sidebar sections (cloud Whimsical) [H]

| Section | Meaning | Clone mapping [P] |
|---|---|---|
| Inbox | Notification centre | Omit (no collaboration) |
| Recent | Recently opened files | Keep; store recents list in app config |
| Favorites | Star-marked files/folders (US spelling "Favorites"; "Favourites" for non en-US locale) | Keep; stars stored in workspace metadata file |
| Private | User's personal files and folders | The picked workspace folder root |
| Teams | Team-shared files | Omit (single user) |
| Shared with me | Files shared by others | Omit |
| Trash | Deleted files; restore or delete permanently | Keep; implement as `.trash` folder inside workspace or macOS Trash |
| Templates & color themes | Custom templates and colour themes (bottom of sidebar) | Keep; store as templates folder + themes JSON |
| Workspace switcher ("Switch workspace", "Create new workspace") | Multiple workspaces | Optional: "Open workspace folder..." |

Each section/row has a `+` button (create board/doc/folder inside it). Rows: file icon (custom, coloured), name, nested children via disclosure arrow. Files and folders support **drag and drop** for reordering and nesting in the sidebar and in folder views. Docs can have nested boards/docs shown under them in the sidebar (nested files); drag out of the parent to un-nest. [H]

### 3.2 File and folder operations [H]

- Rename file: open it and click the name; rename folder: right-click in sidebar > "Rename file / folder".
- Delete: right-click > "Delete file / folder"; bulk delete by multi-select then Delete; `Delete`/`Backspace` also deletes the selected file(s). All go to Trash.
- Icon: click the default icon next to the name > icon picker (library icons only, with a colour choice; emojis not supported for file icons). The icon and colour apply everywhere (sidebar, embeds, browser tab/favicon).
- Move to / Copy to from the file actions menu. Move keeps the URL; copy omits comments and version history.
- Restore from Trash: select file(s) then "restore" in the pop-up; returned to the section it was deleted from.
- "Show deleted files" action on team rows; "Show deleted nested files" in docs.

### 3.3 Creating files: the 5 documented ways [H]

1. Go to `whimsical.new` (omit in clone).
2. Keyboard `Cmd+Opt+N` (Ctrl+Alt+N on PC).
3. "Create new board" button, top-left (command-menu label "Create new board").
4. `+` button in any sidebar section.
5. "+ New Board" in folder view.

Command-menu entries for creation (verbatim from bundle): "Create new board" (shortcut `alt-defmod-n`), "Create new doc", "Create new folder", "Create new from template...", "Create new workspace". [B]

Create menu colours (light / dark): Board `#8013d9` / `#5f00a4`; Doc `#2484d4` / `#004a81`; Folder `#738291` / `#232f3b`; Template `#556575` / `#3a4a59`; Ask agent `#019487` / `#00544c`. [B]

File types in the product: Board (infinite canvas: flowcharts, mind maps, wireframes, sticky notes, cards/tasks, freehand), Doc (Markdown-style rich text), Folder (plus multi-page file). Release 2025.6 notes "new file icons in create menu" (glyphs not documented).

---

## 4. Tabs, windows, navigation (desktop app) [H]

| Action | Mac shortcut |
|---|---|
| New tab | `Cmd+T` |
| Close tab | `Cmd+W` |
| Switch to tab 1-9 (pinned tabs included) | `Cmd+1` ... `Cmd+9` |
| Copy link to file (from tab context menu) | `Cmd+L` |
| Open file in new window | `Shift+click` a file, or "New Window" in file menu |

Tab right-click menu: Copy link, Duplicate tab, Pin tab (stays open), Close, Close all others (except pinned). New tab via the `+` button then create a file or browse existing files. Multiple windows supported. "If a keyboard shortcut exists in the desktop app, it will be displayed next to the action name when you hover over the action." Desktop app has no offline mode in Whimsical (the clone is fully local, which is a superset). Note that `Cmd+1`/`Cmd+2` conflict with board "zoom to content" `1` / "zoom to selection" `2` only when Cmd is held; plain `1`/`2` are board zoom keys.

Command-menu navigation entries: "Go to Private", "Go to Recent", "Go to Teams", "Go up", "Switch workspace", "Open in new tab", "Open in desktop app?" [B]

---

## 5. Command menu and search

### 5.1 Command menu (`Cmd+K`) [H]
- Opens from any screen; also a button in the bottom-right corner.
- On open: shows the **top 3 recently used commands**; type to search, or press `Enter` to browse all commands.
- **Context-aware**: more commands on a board than in workspace settings; if an object is selected, object-specific commands appear.
- Doubles as navigation. Commands have descriptive names; **keyboard shortcuts are shown right-aligned** on most rows.
- Colours: input bg `#0f171f` (light theme) / `#19232c` (dark); placeholder `#738291` / `#a2b0bd` [B].

Command labels observed in the bundle (not exhaustive, ~170 strings in the sample): Copy, Cut, Paste, Paste as, Copy as Markdown, Copy as Mermaid, Copy link, Copy link to block, Copy link to object, Print..., Move to..., Copy to..., Save as template, Insert template, Add page, Change icon..., Export file, Keyboard shortcuts, Preferences, Account settings, Workspace settings, Interface color mode, Cycle color mode, Text size, Text width, View, Tools, Shapes, Tables, Text, Image, Connector, Wireframe components, Wireframe frames, Spelling, Spelling language, Check spelling, Invite people, Manage people, Switch workspace, Create new board / doc / folder / from template, Go to Private / Recent / Teams, Go up, Upgrade, Help, Contact us, Report an issue, Releases, Learn Whimsical, Log out. [B] Also added by 2026.8: Pan and Select tools in the command menu.

### 5.2 Search sidebar [H]
- Opens on the **right**. `Cmd+J` (or `Cmd+Shift+F`) = workspace search; `Cmd+F` = search the open file/folder/section; magnifier icon top-right; or via command menu ("search").
- Shows most-recently-viewed files immediately; typing shows results. `Up/Down` navigates without losing place; `Enter` opens the highlighted result and closes search; `Esc` closes. `Cmd+Enter` (with the field open) switches to Workspace mode.
- Two tabs: **Workspace** (names plus content of everything accessible) and **This board / This doc / This folder / This section**. In a folder, searches names; in a board/doc, searches content.
- Whimsical's search is server-side semantic (Turbopuffer, 2026.10); for the clone use a local index (names plus extracted text) [P].
- Find-match highlight colour: `#f8db93` light / `#7b5f00` dark. [B]

---

## 6. Theme and design tokens

### 6.1 Fonts [H]
- **Dinsical**: main UI and board font. Variable `wght` 300-900, with italic. Files on whimsical.com: `/fonts/Dinsical[wght]-1025.woff2` and `/fonts/Dinsical-Italic[wght]-1025.woff2`. CSS stack observed: `Dinsical, system-ui, sans-serif`.
- **Monsical**: monospace (code blocks, code). 400, 400 italic, 700, 700 italic (`Monsical-Regular/Italic/Bold/BoldItalic-1002.woff2`).
- Source and licence: `https://github.com/WhimsicalCode/fonts`, **SIL OFL**, free to bundle and redistribute (not sellable by themselves). Vietnamese glyph support added in 2026.6. Prior to 2026.5 Whimsical used a different font (not identified; historic only).
- Marketing site (NOT the app): PP Agrandir (headings) and Manrope (body). Do not use for the app UI.
- Observed weights in the app CSS: 400, 500 (most used), 700, a few 600; sizes most used: 14px, 16px, 15px, 12px, 18px, 22px, 13px (so base UI size is about 14px; small labels 12px/11px). [B, M]
- Border radii seen most: 4px, 6px, 3px, 8px; 10-12px for large panels/modals. [B, M]
- Board/doc text sizes: boards have XS, S, M, L, XL, XXL text; docs have Normal/Large text sizes and Narrow/Wide width, defaulting Large and Narrow. [H]

### 6.2 App colour tokens: light vs dark [B]
Values are the hex fallbacks published in the app CSS (`--us-*` variables; the primary definitions are in oklch, e.g. `bg-base` light = `oklch(100% 0 248)`, dark = `oklch(25% .023373 248)`). Use these hex values directly.

**Surfaces**

| Token | Light | Dark |
|---|---|---|
| bg-base / bg-panel / bg-raised / bg-menu | `#ffffff` | `#19232c` (menu `#293744`, raised `#2e3c4a`) |
| bg-page | `#f7f9fa` | `#0f171f` |
| bg-canvas (board background) | `#f3f5f8` | `#0f171f` |
| bg-inset-1..5 | `#fbfcfc #f7f9fa #f3f5f8 #eff2f5 #ebeff3` | `#151e27 #0f171f #091017 #040a10 #02050a` |
| bg-hl-1..7 (hover/highlight steps) | `#fbfcfc #f7f9fa #f3f5f8 #eff2f5 #ebeff3 #d7dfe7 #c4cfda` | `#1d2832 #212d38 #25323e #293744 #303f4d #3a4a59 #475767` |
| bg-hl-gen-1 / -2 (translucent hover/selected) | `#293744` at 5% / 8% | `#738291` at 10% / 30% |
| bg-menu-hover / item-hover | `#ebeff3` | `#475767` / `#3a4a59` |
| bg-menu-item-selected | `#e3e9ee` | `#475767` |
| bg-scrim (modal overlay) | `#000000` at 30% | `#000000` at 40% |
| navbar (sidebar) bg, dark only | (white panel) | `#19232c`, 1px border in dark (`navbar-border-width: 0` light, `1px` dark), selected `#738291`/30%, hover `#738291`/10% |
| bg-titlebar | `#ffffff` | `#19232c` |
| bg-actionbar | `#ffffff` | `#293744` |

**Foreground (text and icons)**

| Token | Light | Dark |
|---|---|---|
| fg-base (primary text) | `#293744` | `#ffffff` |
| fg-secondary | `#50606f` | `#b3bfcc` |
| fg-subtle | `#3a4a59` | `#ebeff3` |
| fg-subtler | `#8291a0` | `#b3bfcc` |
| fg-subtlest (placeholder-ish) | `#a2b0bd` | `#8291a0` |
| board-text / board-placeholder | `#293744` / `#8291a0` | `#ffffff` / `#b3bfcc` |
| fg-accent-purple | `#8b30e4` | `#b182f4` |
| fg-accent-blue (links) | `#2484d4` | `#62a4e3` |
| fg-accent-pink / green / orange / danger | `#be36d3` / `#26aea0` / `#d58d25` / `#d5475b` | `#d173e0` / `#30b5a6` / `#eaa44a` / `#d5475b` |
| fg-icon-gray (default icon colour) | `#738291` | `#b3bfcc` |

**Borders**

| Token | Light | Dark |
|---|---|---|
| border-chrome (panels, toolbars) | `#d7dfe7` | `#324150` |
| border-strong / base / subtle / subtler | `#293744` at 32 / 18 / 8 / 3% | `#738291` at 70 / 50 / 30 / 15% |
| border-select (inputs) rest | `#c4cfda` | `#738291` (hover `#a2b0bd`) |
| border-danger | `#f86778` | `#b1223f` |
| focus-ring | n/a (not captured; use accent) | `#1075c2` |

**Buttons**: primary `#8b30e4` (hover `#8013d9`; dark `#8b30e4` / hover `#9952ec`), primary-alt green `#26aea0` (hover `#019487`), danger `#d5475b` (hover `#b1223f`), secondary white (dark `#232f3b`), text on colour `#ffffff`. Switch active `#26aea0` default (purple/blue/red/pink variants), track `#293744`/18%. Segmented button active white with `0 1px 2px 1px #0000000d` shadow. [B]

**Canvas interaction colours** (board editor)

| Token | Light | Dark |
|---|---|---|
| selection rect / handle border / hover rect | `#aa74f3` | `#b68bf5` |
| marquee fill | `#aa74f3` at 5% | `#b68bf5` at 5% |
| handle fill | `#ffffff` | `#293744` |
| handle hover fill / ring | `#9448ea` / `#9448ea`@20% | `#b68bf5` / `#b68bf5`@30% |
| active group rect | `#aa74f3` at 30% | `#b68bf5` at 30% |
| alignment guide (snap lines) | `#b1223f` | `#f86778` |
| text selection (focus/blur) | `#2484d4`@14% / `#293744`@8% | `#62a4e3`@24% / `#738291`@50% |
| comment accent | blue (`#2484d4`) | `#62a4e3` |
| wireframe frame fill / device chrome | screen `#ffffff`, frame `#a2b0bd`, mobile inset `#8291a0` | `#232f3b`, `#3a4a59`, `#475767` |
| table row alt | `#ebeff3` | `#19232c` |
| code block bg | `#ebeff3` (board `#dfe5ec`) | `#000000` |

**Shadows** (light): layered `0px 1px 2px -.5px #909ba40a, ...` up to larger blur steps (base/strong/strongest); dark uses `#0f1215` based layers (e.g. navbar: `0px 1px 2px -.5px #0f12150a, 0px 3px 4px -1px #0f121514, 0px 6px 8px -1.5px #0f121514, 0px 12px 16px -1.5px #0f12151f, 0px 24px 48px -1.5px #0f121529, 0px 28px 52px -2px #0f12153d`). Modal: `0 10px 30px 0 #0000004d`. [B]

### 6.3 Canvas colour palette (the "Whimsical" default colour theme) [B]
Tokens named `bg-theme-<hue>-{strong,base,subtle,subtler,subtlest}` (fill), with matching `fg-theme-*` and `border-theme-*`. Light values (dark mode remaps each shade, see source tokens; "strong" and "base" swap roles in dark):

| Hue | strong | base | subtle | subtler | subtlest |
|---|---|---|---|---|---|
| purple | `#8013d9` | `#9952ec` | `#c9aef8` | `#e3d7fc` | `#f1ebfd` |
| blue | `#0066ae` | `#2484d4` | `#98c2ed` | `#cbe1f7` | `#e6f0fa` |
| green (teal-green) | `#017369` | `#26aea0` | `#bee8e1` | `#def4f0` | - |
| violet | `#5539e8` | `#665bf3` | `#8d92f9` | `#d7dbfe` | `#ebedfe` |
| pink | `#9c00b0` | `#be36d3` | `#e2a4eb` | `#f1d2f5` | `#f8e9fa` |
| orange | `#b76a34` | `#e58138` | `#faa872` | `#fdeadf` | - |
| yellow | `#c0991f` | `#e6b725` | `#f8db93` | `#fceec9` | - |
| red | `#b1223f` | `#d5475b` | `#ff9ea4` | `#fad3d4` | - |
| crimson | `#8a5051` | `#aa6d6d` | `#ecaaa9` | `#fbd3d2` | - |
| dark-green | `#00544c`(strong fg) | `#017369` | - | `#30b5a6` | `#bee8e1` |
| brown | `#706147` | `#8e7e63` | `#ac9c80` | `#eddcbe` | - |
| gray | `#475767` | `#738291` | `#c4cfda` | `#d7dfe7` | `#f7f9fa` |
| smoke | - | `#c4cfda` | `#b3bfcc` | `#ebeff3` | - |
| slate | - | `#2e3c4a` | `#738291` | `#c4cfda` | - |
| white | `#ffffff` | | | | |

Sticky notes default to **purple** ("Sticky notes come in purple by default"); a note colour change applies to subsequently added notes. [H] Users can add custom colours (hex field, hue/saturation sliders, eyedropper) saved per board; the colour theme can be edited per workspace default or per file ("Edit color theme", "Save as custom theme"). A colour-blind-friendly theme exists in community templates. Objects with "toned down" colours exist (a help FAQ). [H]

Callout colours (docs) include: silver `#d7dfe7`, blue `#cbe1f7`, whimsy-blue `#d7dbfe`, dark-purple `#e3d7fc`, purple `#f1d2f5`, green `#def4f0`, brown `#eddcbe`, pale-red `#fbd3d2`, red `#fad3d4`, orange `#fdeadf`, yellow `#fceec9`. Syntax highlighting (light): comment `#738291`, punctuation `#475767`, symbol `#8013d9`, string `#019487`, operator `#8a5051`, keyword `#2484d4`, function `#d5475b`, variable `#c0991f`. [B]

### 6.4 Brand (marketing site only, not the app) [B]
Brand gradient: `#4e32fd` to `#f82de8` (logo gradient `display-p3` from `#4433ff` via `#aa33ff` to `#e36bff`). Marketing neutral `#f5f4f5`. Not needed for the clone except for an app icon.

### 6.5 Grid and spacing on boards [H]
- Board grid: dots, **12px** spacing, visible at zoom >= 100%; objects snap to it even when invisible. Wireframe mode: grid not visible, **1px** spacing.
- Hold `Cmd` while dragging = ignore object auto-snap (grid only); hold backtick `` ` `` = ignore grid and auto-snap. Snap guides show when centres/edges align.
- Zoom: trackpad pinch; `Cmd+scroll` (zooms towards cursor; invertible in Preferences > Advanced); `Z`+click/drag; keys `=`, `-`, `0` (100%), `1` (fit all), `2` (fit selection). Pan: `Space`+drag, `Shift`+scroll, two-finger swipe, or persistent pan mode (hand button).

---

## 7. Global keyboard shortcuts (Mac) [H unless noted]

### 7.1 File / folder / app level (official page "File/Folder Shortcuts")

| Action | Shortcut |
|---|---|
| Open command menu | `Cmd+K` |
| Select multiple items | `Shift+click` |
| Select all | `Cmd+A` |
| Deselect | `Esc` |
| Comment | `Cmd+Opt+M` |
| Show/hide comments in a file | `Shift+Opt+C` |
| Search the open file, folder or section | `Cmd+F` |
| Search the workspace | `Cmd+J` or `Cmd+Shift+F` |
| Switch to workspace search (field open) | `Cmd+Enter` |
| Open/hide sidebar | `Cmd+E` |
| Open Share menu (get link) | `Cmd+Shift+S` (`Cmd+Opt+S` in Firefox) |
| Open Export tab | `Cmd+Shift+E` |
| Print a board or doc | `Cmd+P` |
| Add new file or folder | `Cmd+Opt+N` |
| Folder list view | `L` |
| Folder grid view | `G` |
| Delete selected file(s) or folder(s) | `Delete` or `Backspace` |
| Open Keyboard shortcuts overlay | `Shift+/` (i.e. `?`) [B] |

Desktop tabs: see section 4. Inbox (omit in clone): `K`/`Up` previous, `J`/`Down` next, `Shift+U` unread, `Shift+I` read, `Cmd+Shift+U`/`Cmd+Shift+I` all unread/read, `Shift+Delete` delete.

### 7.2 Board general shortcuts

| Action | Shortcut |
|---|---|
| Zoom | `Z`+click/drag or `Cmd`+scroll |
| Zoom in / out | `=` / `-` |
| Zoom to 100% | `0` |
| Zoom to content / selection | `1` / `2` |
| Pan | `Space`+drag or `Shift`+scroll wheel |
| Undo / Redo | `Cmd+Z` / `Cmd+Shift+Z` (`Cmd+Y` also redo [B]) |
| Cut / Copy / Paste | `Cmd+X` / `Cmd+C` / `Cmd+V` |
| Copy style / Paste style | `Cmd+Opt+C` / `Cmd+V` (paste style applies when a style is copied; the help table lists plain `Cmd+V`) |
| Copy link to object | `Cmd+Opt+Shift+C` |
| Copy as image (PNG) | `Cmd+Shift+C` |
| Duplicate | `Cmd+D` or `Opt+drag` |
| Bring to front / forward | `]` / `Cmd+]` |
| Send to back / backward | `[` / `Cmd+[` |
| Select multiple | `Shift+click` |
| Select all (excluding locked) | `Cmd+A`; including locked: hold `Cmd`, double-press `A` |
| Deselect | `Esc` |
| Resize keeping aspect | `Shift+drag` handle |
| Resize from centre | `Opt+drag` handle |
| Edit text of selection | `Enter` (`Cmd+R` also [B]) |
| Group / Ungroup | `Cmd+G` / `Cmd+Shift+G` |
| Deep select (inside group) | `Cmd+click` |
| Ignore snap while moving | `Cmd+drag`; ignore grid and snap: `` ` ``+drag |
| Save as default style | `Cmd+Shift+D` |
| Increase / decrease font size | `Cmd+Opt+=` / `Cmd+Opt+-` |
| Animate connector | `Cmd+click` connector |
| Measure distance between objects | select object, hold `Opt`, hover others |
| Wireframe mode | `W` (exit with `Q`) |
| Lock object | `Cmd+Shift+L` |
| Nudge | arrows move; `Shift+arrow` large step; `Cmd+arrow` 1px [B] |
| Resize via keyboard | `Cmd+Shift+arrows` [B] |
| Open "add" menu | `/` [B] |
| Auto-layout top-to-bottom / left-to-right | `Shift+Opt+V` / `Shift+Opt+H` [B] |
| Toggle comment badges | `Shift+Opt+C` [B] |

### 7.3 Diagram / flowchart tool keys (official page)
`R` Rectangle, `U` Pill, `O` Oval, `D` Diamond, `A` Trapezoid, `G` Triangle, `H` Hexagon, `Y` Cylinder, `L` Line, `B` Bracket, `V` Star, `J` Cloud, `E` Table, `I` Image, `K` Link, `C` or `L` Connector, `T` Text, `X` Icon, `.` Section, `N` Sticky note, `M` Mind map root. **Quick add**: `Opt+Arrow` creates a connected shape in that direction; `Shift+hover` the quick-add button changes direction; `Q` hides quick-add.

### 7.4 Mind map keys
`M` add root; `Tab` child; `Enter` sibling; `Cmd+Enter` sibling above; `Opt+Enter` parent; `Cmd+/` collapse/expand; `Shift+Enter` line break in node; `Cmd+Shift+U` link; `Shift+X` icon; `Cmd+Ctrl+[` / `Cmd+Ctrl+]` decrease/increase text indent. Bundle adds: arrows navigate between nodes, `Shift+Tab` select parent, `Delete`/`Backspace` delete node, `Cmd+D` duplicate node, `Shift+F12` lay out mind map. Paste a text list on a selected root node (`Cmd+V`) creates a mind map; `Cmd+Shift+V` on a copied root exports as an indented list. `Cmd+.` AI generate (omit).

### 7.5 Sticky note keys
`N` add note (works in all modes); `Opt+Arrow` quick-add another note from a selected note; `Opt+drag` duplicate; `Cmd+Opt+=`/`-` text size; inside note text: `Cmd+\` paragraph, `*`/`-`+Space or `Cmd+Shift+8` bullets, `1.`+Space or `Cmd+Shift+7` numbered, `_`+Space checklist, `@` workspace link, `Cmd+Shift+U` external link. Grid distribution ("Distribute grid") is only for sticky notes. Notes auto-resize while typing unless a size is set manually.

### 7.6 Freehand keys
`H` marker (thin/thick), `Shift+H` highlighter, `E` eraser, `S` selector; "Detect Shapes" option snaps rectangles/circles/lines/diamonds. Best on desktop mouse, Wacom-style tablet or iPad with Apple Pencil (Whimsical's own recommendation). Highlighter excludes the lightest colours (white, smoke, gray).

### 7.7 Wireframe keys
`A` Annotation, `B` Button, `L` or `D` Line, `E` Component, `F` Frame, `G` Image, `K` Link, `O` Circle, `P` Input, `R` Rectangle, `V` Avatar, `C`/`L` Connector, `T` Text, `X` Icon, `Cmd+Shift+L` lock, `Enter` rename frame, hold `Shift` to change line direction, hold `Cmd` for full-width/height line. Grid is 1px in wireframe mode; auto-layout is hidden in wireframe mode.

### 7.8 Card / Task mode (`Shift+C`)
`A` or double-click: card/task; `S` stack; `C`/`L` connector; `I` image; `K` link; `T` text; `X` icon; `Cmd+Enter` expand task/card; `Shift+Enter` add card/task; `Cmd+Shift+L` lock stack.

### 7.9 Doc (Markdown) editing keys

| Action | Shortcut / markdown |
|---|---|
| Paragraph | `Cmd+\` |
| Heading 1/2/3 | `#`, `##`, `###` + Space at line start |
| Bulleted list | `*` or `-` + Space; `Cmd+Shift+8` |
| Numbered list | `1.` + Space; `Cmd+Shift+7` |
| Checklist | `_` + Space |
| Section divider / line divider | `***` / `---` at line start |
| Change block type | `/` at new line; `Cmd+/` |
| Bold / Italic | `Cmd+B` or wrap in `*` / `Cmd+I` or wrap in `_` |
| Code block | ``` ``` ``` ; open syntax highlighter in code block: `Cmd+Shift+K` |
| Inline code | `Cmd+Shift+K` or wrap in `` ` `` |
| Strikethrough | `Cmd+Shift+X` or wrap in `~` |
| Link | `Cmd+Shift+U` (external link also `Opt+K`) |
| Highlight text | `Cmd+Shift+H` |
| Quote | `>` + Space |
| Indent / outdent | `Tab` / `Shift+Tab` |
| Workspace link (mention) | `@` |
| Comment | `Cmd+Opt+M` |
| Select all (press again to widen: line, block, doc) | `Cmd+A` |
| Open nested file / go to parent | `Cmd+Enter` / `Cmd+Esc` |
| Table: insert row / column | `Cmd+Enter` / `Cmd+Opt+Enter` |
| Table: remove row / column | `Cmd+Delete` / `Cmd+Opt+Delete` |
| Copy link to block | `Cmd+Opt+Shift+C` |
| Toggle (collapsible) block incl. descendants | `Opt+click` toggle; siblings `Shift+click`; both `Opt+Shift+click` |
| Expand / collapse block | `Cmd+Opt+]` listed for BOTH on the help page (typo; see discrepancies) |
| Doc text size | `Cmd+=` larger, `Cmd+-` smaller |
| Focus mode | button bottom-right (options: Full screen, Paragraph focus, Typewriter mode) |

Docs facts: all headings are collapsible; toggle lists collapsed by default; slash block menu; embeds (Figma, Airtable, Loom, YouTube, Vimeo, Canva, Hex, CodePen, Whimsical boards); nested files shown under the doc in the sidebar; drag a block by the icon at left; paste Markdown to convert; drop `.md` to create a doc; 50 doc blocks/month limit on free plan (drop in clone).

---

## 8. Discrepancies: official help page vs live keymap bundle

The help page is hand-maintained; the bundle (`keymap` registry in `app.main-*.js`) is what the app actually runs. Keys are **scoped by mode**, which explains some clashes. Recommended resolution for the clone is in the last column.

| Item | Help page (current) | Bundle | Recommendation [P] |
|---|---|---|---|
| Hexagon | `H` | `F` (and global `H` = freehand pen, `Shift+H` = marker/highlighter) | Follow the bundle: `H` = freehand pen, `Shift+H` = highlighter/marker, hexagon on `F`. `H` cannot mean both hexagon and freehand in the same scope, and the help page itself lists `H` as Marker in its freehand table. Document the choice. |
| `A` / `P` | `A` = Trapezoid; (no `P`) | `A` = annotation, `P` = parallelogram; `S` = "new shape" | Follow bundle: `P` parallelogram, `A` annotation; trapezoid via shape menu. |
| Bring to front / send to back | `]` / `[` (forward/backward = `Cmd+]`/`Cmd+[`) | `Opt+]` / `Opt+[` (forward/backward = `Cmd+Opt+]`/`[`) | Use help page (`]`, `[`, `Cmd+]`, `Cmd+[`); also accept bundle variants. |
| Mind-map sibling | `Enter` sibling; `Cmd+Enter` sibling above | `Cmd+Enter` = add sibling node (bundle also lists `Enter`= Edit object in board scope) | Use help page: `Enter` sibling (while a node is selected/editing), `Cmd+Enter` sibling above, `Tab` child, `Opt+Enter` parent, `Shift+Tab` select parent, arrows navigate. |
| Docs expand/collapse | both listed `Cmd+Opt+]` | n/a | Almost certainly a typo: expand = `Cmd+Opt+]`, collapse = `Cmd+Opt+[` (flag as uncertain). |
| `C` | Connector tool (board) | `C` = connector tool and also "Comment tool" (context) | Connector in board; comments omitted. |
| `S` | Stack (card mode), Selector (freehand) | `S` = new shape (diagram), Stack, selector | Scope by mode; global `S` = shape menu. |
| `L` | Line/Connector in board; list view in folder views | `L` = new divider (line) | Scope: folder view `L` list; board `L` line/connector. |
| `E` | Table (board), Component (wireframe), Eraser (freehand) | `E` table | Scope by mode/sub-tool. |
| Paste style | `Cmd+V` (when style copied) | n/a | Implement as: after `Cmd+Opt+C`, `Cmd+V` onto a selection pastes style if clipboard holds a style. |
| Zoom keys | `=`, `-`, `0`, `1`, `2` | n/a | As help page. |

**Scope stack (resolution order, innermost first) [B/M, inferred]:** text editing (inside a text box/node, including doc editor) > mind-map node selected > freehand sub-tool active (`H` menu) > Card/Task mode (`Shift+C`) > Wireframe mode (`W`, exit `Q`) > board default (diagram shapes) > folder view > global app. Cross-mode: `N` (sticky note) works in all board modes; `Q` exits wireframe mode; `Esc` exits the current context (selection, tool, popup).

**Non-US keyboard layouts**: letter shortcuts are layout-independent; for punctuation shortcuts (`[`, `]`, `\`, `.`, `` ` ``, `=`, `-`, `/`) Whimsical uses the physical key position of the US layout. Implement with `event.code` for those keys [H].

---

## 9. Export, import, templates

### 9.1 Export [H]
- **PNG**: Share > Export. "Export as" Board (one image) or Frames (one PNG per frame; zip if more than one; zip export of multiple frames added 2025.9). Size 1x or 2x. "Selection only". Board mode: include canvas background or transparent. Frames mode: "Content only" strips the frame.
- **Copy as...** (right-click on selection): PNG (transparent, current colour mode; `Cmd+Shift+C`), PNG with background, PNG in dark mode, PNG in light mode; also Copy as SVG (2026.6), Copy as Mermaid (flowcharts and sequence diagrams; keeps styles, colours, grouping as subgraphs), Copy as Markdown (docs).
- **PDF**: Share > Print > "Save as PDF" (browser print dialog). PDFs are always light mode.
- **SVG by URL** (`/svg`, `?cm=dark`) and a **50,000-object limit** for Copy as...: lower confidence ([M]); this text sat next to a leftover "Reviewer note (remove before publish)" on the help page.
- **Markdown (docs)**: Share > Export shows a Markdown preview with Download (.md) and Copy buttons.
- **Share menu** (cloud): link, invite, Export tab; Export tab = `Cmd+Shift+E`. Free plan adds a "Made with Whimsical" watermark (omit).
- Bulk: right-click sidebar items etc. not documented.

### 9.2 Import [H]
Upload images (JPG, JPEG, GIF, PNG, WEBP, SVG, AVIF), PDFs, video, audio (file uploads, 2025.3); paste text into a selected mind-map root to build a mind map; paste Mermaid code to build flowcharts/sequence diagrams (via "Paste as" options); paste boards from Miro/FigJam/Lucid/Excalidraw/tldraw/Canva; import `.vsdx`; drop `.md` to create a doc. "Paste as" menu exists for text-to-object options; pasted text max 100,000 characters [B].

### 9.3 Templates [H]
- Create new file from template: Create menu > "From template" > own templates or the Whimsical template gallery (a new file inherits the template's colour theme).
- Insert into existing file: board toolbar template entry, doc `/` > Template, or command menu "Insert template".
- Custom templates: "Templates & Themes" in left nav > New template > choose file type; or copy/move a file into the Templates & Themes folder; or file actions > "Save as template".
- Gallery categories are not captured (see gaps). For the clone ship a small built-in set (blank board, flowchart starter, mind map starter, wireframe starter, doc) [P].

---

## 10. Preferences and appearance [H]
- Settings navigation moved to a sidebar layout (2026.4): Preferences, Account settings, Workspace settings, People, Billing, Security, Custom emojis, File uploads.
- **Appearance**: Light / Dark / System (default System). Command menu: "Interface color mode" and "Cycle color mode". Per-account preference; embeds default to System.
- **Preferences > Advanced**: invert zoom direction (default: `Cmd+scroll` down = zoom in, similar to Figma; inverted similar to Sketch); also "Open links in desktop app" behaviour.
- Spelling settings (Check spelling, Spelling language).
- Language: the interface is English only. Clone: all strings via i18next; seed `en` with Whimsical's wording.

---

## 11. Electron / macOS implementation implications [P]

1. **Menu roles steal keys**: the default Electron View menu binds `Cmd+=`/`Cmd+-`/`Cmd+0` to page zoom. Remove `zoomIn/zoomOut/resetZoom` roles; board zoom and doc text size use these keys (`=`, `-`, `0` unmodified on boards; `Cmd+=`/`Cmd+-` in docs).
2. **`Cmd+W`** must close the current tab (and only the window when the last tab closes) instead of the default `close` role.
3. **Tabs**: custom tab strip in the renderer; `Cmd+T` new tab, `Cmd+1..9` select, `Cmd+L` copy file path/link, pin/unpin, duplicate, close others, `Shift+click` opens a new BrowserWindow.
4. **`Cmd+P`**: use `webContents.printToPDF` or print dialog; `Cmd+Shift+E` opens an Export dialog.
5. **`Cmd+K`/`Cmd+J`/`Cmd+F`/`Cmd+E`**: register as menu accelerators or renderer-level handlers; avoid the OS "Find" role clash (`Cmd+F` is app-local).
6. **Right-click** and `Cmd+click` must reach the canvas (deep select, animate connector); do not let the native context menu eat them on canvas.
7. **Trackpad**: pinch zoom delivers `wheel` events with `ctrlKey=true`; two-finger swipe pans; `Cmd+scroll` zooms toward the cursor.
8. **Pointer Events for pen**: freehand marker should read `pressure`, `pointerType === 'pen'`; set `touch-action: none` on the canvas.
9. **Fonts**: bundle Dinsical (variable woff2, regular and italic) and Monsical locally; no network use.

Proposed native menu bar (File, Edit, View, Window, Help) [P]:

| Menu | Items |
|---|---|
| App ("Whimsical Clone") | About, Preferences... (`Cmd+,`), Hide, Quit |
| File | New Board (`Cmd+Opt+N`), New Doc, New Folder, New from Template..., New Tab (`Cmd+T`), Open Workspace..., Close Tab (`Cmd+W`), Export... (`Cmd+Shift+E`), Print... (`Cmd+P`), Move to..., Copy to..., Save as Template |
| Edit | Undo, Redo, Cut, Copy, Paste, Copy Style (`Cmd+Opt+C`), Duplicate (`Cmd+D`), Select All, Find in File (`Cmd+F`), Search Workspace (`Cmd+J`), Command Menu (`Cmd+K`), Delete |
| View | Toggle Sidebar (`Cmd+E`), Grid/List view (`G`/`L`), Zoom In/Out/100%/Fit content/Fit selection, Wireframe mode (`W`), Interface color mode > Light/Dark/System, Focus mode |
| Window | Minimize, Zoom, Next/previous tab, Tab 1-9 |
| Help | Keyboard Shortcuts (`Shift+/`), Release notes |

---

## 12. Local-first mapping of cloud features [P]

| Whimsical feature | Clone |
|---|---|
| Workspace / Sections / Teams / Private | One user-chosen workspace folder; folders = folders, boards/docs = files; sections collapse to root |
| Recent, Favorites | Local app config / sidecar metadata (e.g. `.whimsical/state.json`) |
| Trash | `.trash/` inside the workspace or macOS Trash (`shell.trashItem`) |
| Share menu | Export only (no link, no invites) |
| Version history | Omit, or local autosave snapshots |
| Inbox, comments, mentions of people, presence, AI/agent, MCP, voting/timer, presenting with others | Out of scope (no collaboration/cloud) |
| Multi-page files | Optional later; a `.whim` file with a `pages[]` array |
| Templates and colour themes | Local `templates/` and `themes.json` |
| File icons and colours | Per-file metadata field; Lucide icon name plus colour token |
| `whimsical.new` | Omit; native `Cmd+Opt+N` |
| Free-plan limits and watermarks | Omit |

---

## 13. Icon mapping: Whimsical meaning to Lucide icons [P]

Whimsical's own icon glyphs are proprietary and not documented; this is a proposal by meaning. Use `lucide-react`, 16-20px, stroke 1.5-2, colour `fg-icon-gray` (`#738291` light / `#b3bfcc` dark).

| Whimsical element | Lucide icon |
|---|---|
| Sidebar toggle (hamburger, top-left) | `PanelLeft` or `Menu` |
| Sidebar pin/lock | `Pin` / `PinOff` (or `Lock`) |
| Create new (+) | `Plus` |
| Board file | `LayoutDashboard` or `Shapes` (purple `#8013d9`) |
| Doc file | `FileText` (blue `#2484d4`) |
| Folder | `Folder` / `FolderOpen` (grey `#738291`) |
| Template | `LayoutTemplate` (`#556575`) |
| Search | `Search` |
| Command menu | `Command` |
| Favorites star | `Star` |
| Recent | `Clock` |
| Trash | `Trash2` |
| Inbox (omit) | `Inbox` |
| File actions chevron | `ChevronDown` |
| Pan (hand) | `Hand` |
| Select | `MousePointer2` |
| Zoom menu | `ZoomIn` / `ZoomOut` / `Maximize` |
| Sticky note | `StickyNote` |
| Diagram shapes | `Shapes` / `Square` |
| Text | `Type` |
| Connector | `Spline` / `MoveUpRight` |
| Mind map | `Network` / `GitFork` |
| Image | `Image` |
| Link | `Link` |
| Freehand pen / marker / highlighter / eraser | `Pencil` or `PenTool` / `Pen` / `Highlighter` / `Eraser` |
| Section | `Frame` / `Square` dashed |
| Table | `Table` |
| Icon tool | `Smile` / `Shapes` |
| Wireframe mode | `PanelsTopLeft` / `AppWindow` |
| Card/Task mode | `Kanban` / `SquareKanban` |
| Lock | `Lock` / `Unlock` |
| Group | `Group` / `Ungroup` |
| Align and distribute | `AlignStartVertical` ... `AlignHorizontalDistributeCenter` |
| Auto-layout | `Workflow` / `LayoutPanelTop` |
| Export / Share / Print | `Download` / `Share2` / `Printer` |
| Help | `CircleHelp` |
| Dark mode | `Moon` / `Sun` / `SunMoon` |
| Settings | `Settings` |
| Copy / Cut / Paste | `Copy` / `Scissors` / `ClipboardPaste` |
| Undo / Redo | `Undo2` / `Redo2` |
| Collapse / expand | `ChevronRight` / `ChevronDown` |
| Tab close / pin | `X` / `Pin` |

Whimsical file/folder icon picker is a library of icons plus a colour; clone: a Lucide picker (searchable grid) plus the canvas colour palette.

---

## 14. Gaps and uncertainties

- **Sidebar and chrome pixel metrics** (sidebar width, row height, title bar height, toolbar button size, floating context-bar height): not captured; screenshots of the logged-in app were unavailable. The CSS bundle I read is the help-centre/marketing CSS plus design tokens, not the logged-in app's layout CSS. Estimate: base UI font 14px, small 12px, radii 4-8px, sidebar roughly 240-280px [M, unverified].
- **Board toolbar order and exact grouping** (top section vs supporting tools): described but not enumerated with screenshots.
- **Command menu full inventory and grouping**: about 170 label strings sampled from the bundle, not grouped or paired with all shortcuts.
- **Exact icon glyphs** (create menu, toolbar): proprietary; only meanings known. Lucide mapping is a proposal.
- **Doc expand/collapse shortcut** (collapse likely `Cmd+Opt+[`): needs verification.
- **Hexagon/parallelogram/trapezoid/bring-to-front** conflicts between help page and bundle (section 8): need a final decision by the product owner.
- **`/svg` URL, 50k-object cap**: low-confidence source text.
- **Template gallery categories and thumbnails** not captured.
- **Preferences page full field list** not captured (only Appearance, Advanced zoom inversion, link-opening).
- **Dark-mode values for some tokens** are given only for the overlay `dark` selector; a few tokens show only one of the two values in the source.
- **Windows (Ctrl) and tablet gestures** not covered (macOS target).
- **Marketing hex values** are not app colours; do not use them in the app.
