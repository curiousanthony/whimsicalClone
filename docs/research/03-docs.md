# Whimsical Docs: research notes for the clone

Scope: the Docs editor (Markdown-style notes), its input rules, slash/block menu, shortcuts, embeds, layout, typography and colors, and what this means for a local-first clone. Boards (flowcharts, mind maps, wireframes, sticky notes) are covered by other research files; cross-references are noted where Docs and Boards share an editor.

Research date: 2026-10-07. Mac key notation: ⌘ Cmd, ⌥ Option, ⇧ Shift, ⌃ Control, ⏎ Return, ⌫ Delete, ⎋ Esc.

---

## 0. Source and confidence legend

Every fact below carries one of these tags. Implementers should trust them in this order.

| Tag | Meaning | Reliability |
|---|---|---|
| **[help]** | Official help pages: `whimsical.com/learn/docs/docs`, `/docs/toggles`, `/docs/text-size`, `/docs/code-blocks`, `/faqs/markdown-support`, `/faqs/external-embeds`, `/boards/tables`, `/get-started/command-menu`, `/shortcuts/mac` | High, but pages contain typos (see section 11) |
| **[rel]** | Release notes at `whimsical.com/releases` | High for existence/behaviour. Release IDs such as 2026.12 or 2026.13 are sequence numbers within a year (13 exists), NOT months. Do not treat them as dates. |
| **[bundle]** | Read from the publicly served web-app JS/CSS (`/s/app/assets/*.js`, `/s/css/bundle.min_*.css`): block-menu builder, command labels, MCP doc-format help text, CSS design tokens | High for labels, shortcut keys, token values. Behaviour is inferred from labels, not executed. |
| **[blog]** | Whimsical engineering/design blog posts (2023) | High for design intent, low for specifics |
| **[inferred]** | My deduction, not stated anywhere | Treat as a proposal and verify against the real app if possible |

Not accessible: the real app (login required, browser pane blocked whimsical.com), the 1-minute docs YouTube video (no transcript retrieved), and screenshots in the help pages (no alt text). All pixel/spacing values and toolbar icon order are therefore gaps (section 13).

---

## 1. What Docs is (product shape)

- Docs launched 2021-02-16 (Product Hunt, Golden Kitty 2021). [external]
- A doc is a **flat list of blocks**; a block is a paragraph, heading, list item, image, embed, etc. [help] (The Free plan counts blocks, 50/month; irrelevant for a local clone.)
- The first block is a **Title**, synthesized from file metadata, not a real block. [bundle] In the clone: title = file name (or front-matter), not a block in the body.
- Nesting of content is by an **indent level** per block (0-based), not a tree. [bundle] Lists, paragraphs and checklists all use `indent`.
- Docs live in the same file tree as boards and can **contain nested boards/docs/folders** (shown as previews inside the doc). Multiple pages per file (tabs) exist since 2026 (`files/multipage-files`). [help][rel]
- Whimsical wrote its own text editor (replacing Slate) in 2020. It uses a CRDT-like chain data model with "anti-formatting" ranges for conflict resolution. Not needed for a single-user local app. [blog]
- The same editor powers text in boards (sticky notes, flowchart shapes, mind map nodes, annotations, comments), so Docs shortcuts work there too. [blog][rel] Boards get a *restricted* block set: paragraph, H1-H3, bullet/numbered/checklist (+ inline marks). [bundle]

---

## 2. Block types and the `/` (block type) menu

### 2.1 Block types in the data model [bundle]

From the app's own "Document Hiccup Format" reference (MCP help text):

| Block | Model name | Attributes |
|---|---|---|
| Title | `:title` | synthesized first entry; never a body block |
| Paragraph | `:p` | `indent` |
| Heading 1/2/3 | `:h1` `:h2` `:h3` | `indent` |
| Bulleted list item | `:ul` | `indent` |
| Numbered list item | `:ol` | `indent` |
| Checklist item | `:checklist` | `indent`, `checked?` |
| Toggle list | `:togglelist` | collapsible container |
| Code block | `:code` | `language` (auto-detected by default), multi-line |
| Blockquote | any text block + `quote-level` | level 1..n (a "Quote"/"Unquote" command raises/lowers it) |
| Callout | any text block + `callout-level` | `callout-color`, `callout-icon`; consecutive blocks with the same color group into one callout; a different color starts a new one |
| Divider | `:divider` | `deco`: `:line` (default) or `:diamonds` |
| Table | table block | rows/columns, header row, style, background colors |
| Image | image block | crop supported [rel] |
| Embed | `:embed` | `url` or `ref` (Whimsical item), `fit` = `:text` (default) or `:page` (full width), `height` px (default 525), `presentation?` |
| Nested file | nested Doc / Board / Folder | shown as an expandable preview, up to 3 levels deep [rel] |

Inline marks [bundle]: bold, italic, strikethrough, inline code, highlight, link (external `href`), internal reference (`ref` to a Whimsical item), soft return (line break inside a block). Marks nest.

Screen-reader labels reveal list glyph cycling: bullet level 1 = "Bullet" (●), level 2 = "White Bullet" (○), level 3 = "Black Square" (■), repeating every 3 levels. [bundle] Numbered items are read as "N. text". Numbering style per level (1./a./i.) is unknown.

### 2.2 Menu order (block menu builder) [bundle]

The command list built for the doc editor (what `/`, ⌘/ and the left block-handle menu show), in order:

| # | Command label | Markdown trigger (start of line) | Hotkey | Notes |
|---|---|---|---|---|
| 1 | Paragraph | (none) | ⌘\ | |
| 2 | Heading 1 | `# ` | none | |
| 3 | Heading 2 | `## ` | none | |
| 4 | Heading 3 | `### ` | none | |
| 5 | Bulleted list | `* ` or `- ` | ⌘⇧8 | |
| 6 | Numbered list | `1. ` | ⌘⇧7 | |
| 7 | Checklist | `_ ` | none | NOT `[ ]`/`- [ ]` |
| 8 | Toggle list | (menu only) | none | |
| 9 | Table | `/table` | none | |
| 10 | Code block | ```` ``` ```` | none | language picker ⌘⇧K inside the block |
| 11 | Callout | (menu only) | none | |
| 12 | Quote | `> ` | none | |
| 13 | Unquote | (menu only) | none | lowers quote level |
| 14 | Nested Doc | menu / `/doc` [inferred] | none | creates a child doc |
| 15 | Nested Board | menu / `/board` | none | `/board` documented in blog [blog] |
| 16 | Nested Folder | menu | none | |
| 17 | Workspace link | `@` | `@` | file mention |
| 18 | Link | | ⌘⇧U | |
| 19 | Embed | `/embed` | none | |
| 20 | Section divider | `***` | none | |
| 21 | Line divider | `---` | none | |
| 22 | Emoji | `:name:` | none | |
| 23-27 | Bold, Italic, Strikethrough, Code, Highlight | marks | see section 4 | shown after block types |

The menu is context-filtered: items are disabled when they don't apply (e.g. some block types inside a toggle/table cell). [inferred]

Opening: type `/` at the start of a new (empty) line, press ⌘/ to change the type of the current block, click the left-hand block icon, or use the selection toolbar. [help] The `+` ("Add block") button appears to the left of an empty line. [help]

### 2.3 Dividers [help][bundle]
- `---` creates a **Line divider** (plain line). `***` creates a **Section divider**. [help][bundle]
- The model has two decorations: `line` and `diamonds` (line with diamond ornaments). Mapping Section divider = `diamonds` is **[inferred]** (the labels and the two decos both exist; the mapping is the natural pairing but not verified).

### 2.4 Quotes [bundle]
Three quote-bar colors by level: level 1 `#2484d4` (blue), level 2 `#26aea0` (teal), level 3 `#665bf3` (violet). Dark-mode values: `#0066ae`, `#019487`, `#5539e8`.

### 2.5 Callouts [bundle]
- Default callout: blue with icon `alert-circle-i` (info). Other documented presets: red + `flag` (error), green + `thumb-up` (tip), yellow + `alert` (warning).
- 12 callout colors, with background / foreground (light mode; dark-mode values in section 9):

| Color | BG | Icon/accent FG |
|---|---|---|
| blue | `#cbe1f7` | `#2484d4` |
| red | `#fad3d4` | `#d5475b` |
| pale-red | `#fbd3d2` | `#aa6d6d` |
| orange | `#fdeadf` | `#e58138` |
| yellow | `#fceec9` | `#e6b725` |
| brown | `#eddcbe` | `#8e7e63` |
| green | `#def4f0` | `#26aea0` |
| dark-green | `#30b5a6` | `#017369` |
| purple | `#f1d2f5` | `#be36d3` |
| dark-purple | `#e3d7fc` | `#9952ec` |
| whimsy-blue | `#d7dbfe` | `#665bf3` |
| silver | `#d7dfe7` | `#738291` |

- Callout icons come from Whimsical's (Nucleo) icon library; use Lucide equivalents (Info, Flag, ThumbsUp, TriangleAlert, etc.).
- Importing a `.md` file with YAML front matter turns the front matter into callout blocks at the top of the doc. [help]

---

## 3. Markdown input rules (type-as-you-go)

IMPORTANT, non-CommonMark behaviour [help]:

| You type | Result | Notes |
|---|---|---|
| `*text*` (single asterisks) | **bold** | NOT italic. Single `*` = bold in Whimsical. |
| `_text_` | *italic* | |
| `` `text` `` | inline code | |
| `~text~` | ~~strikethrough~~ | from the shortcuts table ("~ at start and end of text") |
| `# ` / `## ` / `### ` | Heading 1/2/3 | at start of line |
| `- ` or `* ` | bulleted list | at start of line |
| `1. ` | numbered list | at start of line |
| `_ ` | checklist | underscore + space, at start of line (not `[ ]`) |
| `> ` | quote | at start of line |
| `---` | line divider | |
| `***` | section divider | |
| ```` ``` ```` | code block | also works in board text/shapes/stickies [rel] |
| `:name:` | emoji (e.g. `:bulb:`) | default skin tone yellow, configurable [help] |
| `@` | file/people mention menu | |
| `/` | block menu | start of a new line |

Notes:
- **No heading hotkey exists** in the app's shortcut list; headings come only from `#`/`##`/`###`, the menu, or the toolbar. [bundle] (Do not invent ⌘⌥1.)
- Bold and italic in the "Docs shortcuts" table are listed as "⌘B, or `*` at start and end" and "⌘I, or `_` at start and end". [help]
- Markdown **paste** is converted into formatted blocks; content copied with hidden HTML is parsed as HTML instead (workaround: paste via plain text). [help] Pasting from Google Docs/Word keeps rich content including tables and images. [rel]
- Pasting a table from Sheets/Excel/Numbers/Notion becomes an editable table. [help][rel]
- Surrounding text: select text and type an opening quote/bracket/paren to wrap the selection with the matching pair. [blog]
- "Paste as" (right-click or command menu) offers sticky notes, mind map, bulleted list, table. [help]
- Copy as Markdown exists in the command list (⌘⇧C in docs context). [bundle]

---

## 4. Shortcuts (Mac)

Primary source: the Docs shortcut table in "Getting started with docs" [help], cross-checked with the app's key bindings [bundle].

### 4.1 Text and block formatting

| Action | Shortcut | Source |
|---|---|---|
| Paragraph | ⌘\ | [help][bundle] |
| Bold | ⌘B (or `*...*`) | [help][bundle] |
| Italic | ⌘I (or `_..._`) | [help][bundle] |
| Strikethrough | ⌘⇧X (or `~...~`) | [help][bundle] |
| Inline code | ⌘⇧K (or `` `...` ``) | [help][bundle] |
| Highlight | ⌘⇧H | [help][bundle] |
| Add/edit link | ⌘⇧U | [help][bundle] |
| External link | ⌥K (docs table) / ⌘⇧U (board pages, bundle): see section 11 | [help] |
| Workspace link (mention) | `@` | [help] |
| Bulleted list | ⌘⇧8 or `- `/`* ` | [help] |
| Numbered list | ⌘⇧7 or `1. ` | [help] |
| Checklist | `_ ` | [help] |
| Heading 1/2/3 | `#`/`##`/`###` + Space only | [help] |
| Quote | `> ` | [help] |
| Line divider / Section divider | `---` / `***` | [help] |
| Change block type | `/` at line start, or ⌘/ | [help] |
| Increase indent | ⇥ | [help] |
| Decrease indent | ⇧⇥ | [help] |
| Open code-block language picker (inside a code block) | ⌘⇧K | [help] |
| Increase / decrease text size (view) | ⌘= / ⌘- | [help] |
| Select text | ⇧+arrows | [help] |
| Select all | ⌘A, press again to widen: line, then block, then whole doc | [help] |
| Copy link to block | ⌘⌥⇧C | [help] |
| Comment | ⌘⌥M | [help] |
| Open command menu | ⌘K | [help] |
| Search this file / workspace | ⌘F / ⌘J or ⌘⇧F | [help] |
| Print doc | ⌘P | [help] |
| Share / Export | ⌘⇧S / ⌘⇧E | [help] |
| Undo / Redo | ⌘Z / ⌘⇧Z (also ⌘Y) | [help][bundle] |
| Copy as Markdown | ⌘⇧C | [bundle] |

### 4.2 Navigation, nesting, tables, toggles

| Action | Shortcut | Source |
|---|---|---|
| Open nested file | ⌘⏎ | [help] |
| Go to parent file | ⌘⎋ (release notes also mention ⌥⎋ for returning from an embedded board) | [help][rel] |
| Insert table row (row selected) | ⌘⏎ | [help] |
| Insert table column (column selected) | ⌘⌥⏎ | [help] |
| Remove table row | ⌘⌫ | [help] |
| Remove table column | ⌘⌥⌫ (docs page) / ⌘⇧⌫ (tables page) | [help] |
| Toggle block and descendants | ⌥+click on toggle | [help][bundle] |
| Toggle block and siblings | ⇧+click on toggle | [help][bundle] |
| Toggle block, siblings and descendants | ⌥⇧+click on toggle | [help][bundle] |
| Expand block (one level at a time) | ⌘⌥] | [help] |
| Collapse block (hides all levels below) | ⌘⌥[ **[inferred]**, official pages print ⌘⌥] for both | [help] |
| Exit toggle list | ⏎ on an empty new line inside it | [help] |

The bundle's click tooltips confirm the modifier mapping: ⌥-click = "Collapse all / Expand all", ⇧-click = "Collapse siblings / Expand siblings", ⌥⇧-click = both. [bundle]

### 4.3 Context-dependent keys (do not bind globally)
- ⌘⇧K: inline code in normal text; opens the language dropdown when the caret is in a code block.
- ⌘⏎: opens a nested file normally; inserts a row when a table row is selected.
- Esc: leaves Focus Mode full screen. [help]
- ⌘A: progressive selection (line, block, document).

### 4.4 Non-QWERTY note [help]
Letter shortcuts are layout-independent; punctuation shortcuts (`-`, `=`, `\`, `[`, `]`) refer to US-keyboard positions.

---

## 5. Toggles and collapsible headings [help][rel][bundle]

- **Every heading is collapsible.** An arrow beside the heading collapses everything beneath it (until the next heading of equal or higher level, [inferred]). Headings are expanded by default.
- **Toggle list**: collapsible block anywhere. Create via `/` then "Toggle list", or select existing content and choose Toggle list from the context bar. ⏎ inside adds content on a new line; ⏎ on an empty new line exits the toggle.
- Collapse/expand is **per viewer** and remembered per doc: it does not change what others see. Toggle lists are collapsed by default for everyone except their creator. Toggle behaviour survives copy/paste between docs.
- Expanding reveals one level at a time; collapsing hides all nested levels at once.
- Released 2025 (sequence 10). [rel]

Local-first implication: collapse state is view state, keep it out of the document file (see section 12).

---

## 6. Embeds, nested files, links, mentions

### 6.1 Embeds [help][bundle]
- Supported: Figma, Airtable, Loom, YouTube, Vimeo, Canva, Hex, CodePen, Whimsical files. Video embeds also work in boards.
- Three ways: (1) paste a link, then choose Embed from the link context bar; (2) type `/embed` and paste the URL; (3) on an empty line click `+` (Add block), choose Embed, paste, ⏎.
- Embed block can be resized from corners; keeps aspect ratio; some embeds support zoom/reposition. Attributes: width fit `text` (default) or `page` (full width); default height 525 px. [bundle]
- **Whimsical board embeds**: select content on a board, copy, paste into the doc; this creates a **live embed** (no iframe, loads fast) fitted to the selection and kept in sync. Double-clicking opens the board; the doc remains reachable from the title bar (⌥⎋ returns, scroll position preserved). Embeds can show in presentation mode. [help][rel][blog]
- `/board` creates a brand-new board and embeds it. [blog]
- Dark-mode support in embeds (system by default, overridable). [rel][help]

Local clone approach: board embed = reference to a board file + optional viewport/selection rectangle; render a read-only live view. External embeds (YouTube etc.) need network, offline = placeholder card with link. [inferred]

### 6.2 Nested files [help][rel]
- Create via `+` next to the doc title in the sidebar, the block menu (Nested Doc/Board/Folder), or by dragging an existing file under the doc in the sidebar.
- Nested boards show as previews inside the doc, expandable/collapsible via an arrow in the title row; inline expansion up to 3 levels deep. Breadcrumb at top-left shows parent > current (two levels). Nested file backgrounds step through three tints by depth (tokens in section 9).
- A doc's "three dots" menu lets you show/hide deleted nested files and restore or delete them permanently. "Show deleted files"/"Hide deleted files" label exists. [bundle]
- ⌘⏎ opens a nested file; ⌘⎋ goes to the parent.
- Linking without nesting: `@` plus file name inserts a mention that shows only the name; pasting a Whimsical link converts to a mention with a hover thumbnail. [help][rel]

### 6.3 Mentions and comments [help]
- `@` menu lists people and recent files together; in-line mentions don't notify; comment mentions do. Not applicable to a no-collaboration clone beyond file links.
- Comments (⌘⌥M) can be inline (attached to a text selection or block) and are rich text. Out of scope for the clone unless desired as local annotations.

### 6.4 Images [rel][help]
Upload via drag/drop or toolbar; JPG, JPEG, GIF, PNG, WEBP, SVG, AVIF supported. Crop directly in docs (2026). Images narrower than the text width align left rather than stretch. Images are blocks.

---

## 7. Tables [help][rel][bundle]

- Create with `/table` (or E on boards). Paste from Sheets/Excel/Numbers/Notion/AI chats converts to a table. Markdown tables paste as tables.
- `+` handles on the edges add a row/column; **dragging the `+` adds/removes many at once**; inline `+` between rows inserts. Reorder via drag handles on the top and left edges. Sort ascending/descending from the toolbar (boards).
- Selecting a table/row/column/cell shows a toolbar with background color, header row on/off, table style (e.g. alternating row colors), add/remove row/column.
- 2024.11 (docs table improvements): new rows/columns inherit the style of the previous ones, horizontal text alignment, icons inside cells. Tables hold images and `@` file mentions. No formulas. [rel][help]
- Table selection color: `#2484d4` (light) / `#62a4e3` (dark). [bundle]
- Screen-reader label: "Table N columns, M rows". [bundle]

---

## 8. Code blocks [help][rel]

- Triple backticks creates a code block (also inline in sticky/shapes on boards).
- **Language auto-detected** by default; user can override via a dropdown shown when clicking inside the block, or ⌘⇧K (Ctrl+Shift+K on PC).
- Highlighting for "several dozen" languages (exact list not published). Multi-line context aware. Line numbers exist in the token set. [rel][bundle]
- Code block colors: bg `#ebeff3` light / `#000000` dark. Inline code bg: `#d7dfe7` at 50% alpha light / `#000000` at 40% dark. [bundle]
- Cursor gets a visual cue when it crosses an inline-code boundary and you can easily escape the code span. [blog]

---

## 9. Page layout, focus mode, view options

### 9.1 Text size and width (per viewer) [help][bundle]
- Button "Text size and layout" at the bottom-right of the doc, also in the doc actions menu.
- **Text size**: Large (default), Medium, Small. Shortcuts ⌘- (smaller) and ⌘= (larger) (Ctrl on PC).
- **Text width / page width**: Narrow (default), Wide.
- These are the **viewer's own** settings, remembered as "last used" across docs; they cannot be set for other people. The doc footer shows **block count** and **word count**. [bundle]
- Pixel values: unknown (section 13).

### 9.2 Focus Mode [help]
Toggle at the bottom-right. Options: Full Screen (exit with Esc), Paragraph Focus (highlights the paragraph containing the caret, dims the rest), Typewriter Mode (keeps the caret's paragraph vertically centered).

### 9.3 Other doc chrome [help][bundle][rel]
- Doc title in the title bar; breadcrumbs for nesting; Share button; avatars of viewers (not needed locally).
- Doc actions menu items found: Text size (Large/Medium/Small), Layout (Narrow/Wide), Show/Hide deleted files, Undo, Redo, Copy, Copy as Markdown, Cut, Paste, Delete doc.
- Version history (bottom right): play-through timeline with Restore and Fork (Free 7 days, Pro 90, Business unlimited). For the clone: snapshots/undo history on disk is a stretch goal. [help]
- Spellcheck settings reachable from the command menu ("Spelling"): on/off, personal dictionary, language. [help]
- Dark mode: system by default, Light/Dark/System in preferences; docs and tables included. [help]
- Export: Share > Export shows a Markdown preview with Download (.md) and Copy; Print > Save as PDF. Docs no longer print with gray background. [help][rel]
- Import: drag `.md`/`.markdown` files onto a folder/section; file name = doc title; YAML front matter becomes callouts at the top; files over 1 MB skipped. [help]
- The command menu (⌘K) is context-aware: shows 3 recent commands, searchable, with shortcuts displayed on the right. [help]

---

## 10. Typography and color tokens

### 10.1 Fonts [bundle]
- Primary UI/doc font family: **Dinsical**, a proprietary variable font (weights 300-900, plus italic). Fallback stack `system-ui, sans-serif` (full: `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Noto Sans, Arial`). A community post attributes the product to "DIN Next"-like lettering. [bundle][inferred]
- Monospace: **Monsical** (regular, italic, bold, bold italic), proprietary. Fallback `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`.
- Marketing/learn site only: Agrandir, Manrope.
- **Clone action**: Dinsical/Monsical are not redistributable. Choose open substitutes (a DIN-like face such as Barlow or a neutral grotesque such as Inter for UI/body; JetBrains Mono or SF Mono/Menlo for code). Same issue as Nucleo icons (use Lucide).
- App UI type scale present in the CSS: 12, 14, 15, 16, 18, 22, 26, 32, 40 px; weights 400/500/700; line-height 1 (compact), 1.2 (headings), 1.3 (18/22 px), 1.4 (12-16 px body UI). Heading element defaults seen: h1 1.4em, h2 1.2em, h3 1.17em/1em, bold, margins 4px/.3em. These are generic stylesheet values; the actual doc heading sizes are not confirmed. [bundle][inferred]
- Board text sizes use t-shirt sizes XS 13, S 15, M 18, L0 21, L1 27, L2 36, L3 60 px; Docs use Large/Medium/Small instead. [bundle]

### 10.2 Color tokens (OKLCH in source; hex converted by me, approximate) [bundle]

| Token | Light | Dark |
|---|---|---|
| Page/base background | `#ffffff` | `#19232c` |
| Inset backgrounds 1..5 | `#fbfcfc`, `#f7f9fa`, `#f3f5f8`, `#eff2f5`, `#ebeff3` | `#151e27`, `#0f171f`, `#091017`, `#040a10`, `#02050a` |
| Default text (fg-base) | `#293744` | `#ffffff` |
| Subtle text | `#3a4a59` | `#ebeff3` |
| Subtler / subtlest text | `#8291a0` / `#a2b0bd` | `#b3bfcc` / `#8291a0` |
| Border base / subtle / strong | `#293744` @18% / @8% / @32% | `#738291` @50% / @30% / @70% |
| Menu background / hover | `#ffffff` / `#ebeff3` | `#293744` / `#475767` |
| Link color (board text) | `#2484d4` | `#62a4e3` |
| Link underline | `#98c2ed` (hover `#2484d4`) | `#2484d4` (hover bg `#0066ae`) |
| Text selection (focused) | `#2484d4` @14% | `#62a4e3` @24% |
| Selection in callout | `#2484d4` @30% | `#62a4e3` @40% |
| Selection (blurred) | `#293744` @8% | `#738291` @50% |
| Code block bg | `#ebeff3` | `#000000` |
| Inline code bg | `#d7dfe7` @50% | `#000000` @40% |
| Nested doc bg depth 1/2/3 | `#f9fbfb`, `#fbfcfd`, `#fdfefe` | `#161e26`, `#1d252c`, `#252c33` |
| Brand purple (accent fg) | `#8b30e4` | `#b182f4` |
| Purple primary hover | `#8013d9` | `#9952ec` |
| Block handle ring/border | `#aa74f3` | `#b68bf5` |
| Block handle hover | `#9448ea` | `#b68bf5` |
| Blue accent / teal accent / red accent | `#2484d4` / `#26aea0` / `#f86778` (btn danger `#d5475b`) | `#62a4e3` / `#30b5a6` / `#d5475b` |
| Highlight mark bg | not found | `#f0c54f` (dark only found) |
| Elevation shadow (base) | `0 1px 2px -.5px #909ba40a, 0 3px 4px -1px #909ba414, 0 6px 8px -1px #909ba414, 0 12px 16px -1.5px #909ba41f` | same with `#0f1215` |
| Menu radius | 8px (snacks menu) | |

Callout colors: see section 2.5 (dark-mode backgrounds: blue `#002f56`, red `#5b0018`, pale-red `#4e1a1d`, orange `#412615`, yellow `#594500`, brown `#392b13`, green `#013631`, dark-green `#013631`, purple `#4c0056`, dark-purple `#3e006e`, whimsy-blue `#280084`, silver `#475767`).

Overall look: very light, neutral blue-grey ink (`#293744`) on white, one purple brand accent, soft layered shadows, rounded 8px menus, sidebar slightly darker than content (2024 update). [bundle][rel]

---

## 11. Discrepancies in Whimsical's own docs (decide explicitly)

| Item | Conflict | Recommendation |
|---|---|---|
| Collapse block | "Getting started with docs" and "Collapsing text with toggles" both print ⌘⌥] for Expand AND Collapse | Obvious typo. Use ⌘⌥] expand, ⌘⌥[ collapse **[inferred]**. Not found in the app bundle either. |
| External link | Docs table: ⌥K. Board shortcuts and the bundle: ⌘⇧U. ⌘K is the command menu | Bind ⌘⇧U as primary; optionally also ⌥K in docs. |
| Remove table column | Docs article: ⌘⌥⌫. Tables article: ⌘⇧⌫ | Pick ⌘⌥⌫ in docs (symmetrical with ⌘⌥⏎ for insert). |
| Return from an embedded board | Help: ⌘⎋ (parent file). Release notes: ⌥⎋ (back to the doc) | Treat ⌘⎋ = go to parent; ⌥⎋ = back to the originating doc. |
| Context overloads | ⌘⇧K (inline code vs language picker); ⌘⏎ (open nested file vs add table row) | Route by caret/selection context. |
| Code in sticky notes | MCP help says `:code` is unsupported in sticky notes; release 2026.11 says triple backticks work in text, shapes and sticky notes | Cross-reference for the Boards researcher. Verify. |
| Bold syntax | Markdown FAQ says `*` bold; most Markdown uses `**` for bold | Follow Whimsical on input (`*text*` = bold). Export format unknown (gap). |
| Export page | Contains an internal "Reviewer note (remove before publish)" | Ignored; not a fact. |

---

## 12. Implications for the local-first clone

### 12.1 Storage model
- A doc is a file in the user's workspace folder. Suggested format: Markdown text (`.md`) for portability, with a documented extension syntax for non-standard blocks, OR a JSON block list with an `.md` export. Because several Whimsical blocks have no Markdown form, a JSON/sidecar is safer for fidelity.
- Per-user view state must NOT live in the doc: collapse state of headings/toggles, text size, width, Focus Mode settings, spellcheck dictionary. Store in app preferences or a sidecar `.whimsical-view.json` (keyed by doc path/block id).
- Local-first translations: sharing, comments, presence, mentions of people, version-history cloud retention, Free-plan block quotas are all dropped. Keep: file mentions, nested files, embeds, version history as local snapshots (optional).

### 12.2 Round-trip table (which blocks need a chosen serialization)

| Block / feature | Standard Markdown? | Proposed serialization |
|---|---|---|
| Heading, paragraph, bullet/number list, code fence, table (GFM), link, image | Yes | Native |
| Bold / italic / strike / inline code | Yes (note Whimsical input differs: `*x*` = bold, so export `**x**`) | Native on export; accept both on import |
| Checklist | GFM `- [ ]` / `- [x]` | GFM task list (editor trigger stays `_ `) |
| Quote with level | `>`, `>>`, `>>>` | Nested blockquote |
| Callout (12 colors, icon) | No | e.g. GitHub-style `> [!NOTE]` plus a color/icon attribute, or fenced `:::callout {color=red icon=flag}` |
| Toggle list | No | HTML `<details><summary>` or `:::toggle` |
| Highlight mark | No | `==text==` or `<mark>` |
| Line vs section divider | `---` and `***` both are thematic breaks | Keep both literal forms (`---` line, `***` diamonds) |
| Embed (external) | No | Bare link on its own line plus `<!-- embed -->`, or a directive `::embed[url]` |
| Embed / nested board, doc, folder | No | Relative path link with directive, e.g. `::board[path/to/file.wb]{fit=text height=525}` |
| Indent levels on non-list blocks | No | Prefer dropping or using nested lists only |
| Emoji `:name:` | Shortcodes | Unicode on save |
| YAML front matter | Yes (convention) | Import maps to callouts per Whimsical; clone may keep as metadata instead |

Import rules from Whimsical to mirror: file name becomes title; skip files over 1 MB; front matter becomes top callouts.

### 12.3 UI/behaviour checklist for a faithful clone
1. Block handle (left of line): `+` to add block, drag icon to reorder, click for block-type menu.
2. Selection toolbar with marks (bold, italic, strikethrough, code, highlight, link, comment) and block-type dropdown; floating, appears on selection.
3. `/` menu with the 22-item order in section 2.2, searchable, keyboard navigable.
4. Markdown triggers exactly as section 3, including single-star bold and `_ ` checklist.
5. Per-viewer text size (Large/Medium/Small) and width (Narrow/Wide), ⌘- / ⌘=; footer with block and word counts.
6. Focus Mode (full screen, paragraph focus, typewriter).
7. Collapsible headings and toggle lists with ⌥/⇧-click modifier behaviour.
8. Synthetic caret that changes angle/width inside italic/bold text (nice-to-have). [blog]
9. Light and dark themes via CSS variables using the tokens in section 10.
10. All strings via i18next (the real app is English-only; French can be dropped in later).

### 12.4 Icons (Lucide mapping proposal, [inferred])
Whimsical uses Nucleo (proprietary). Suggested Lucide equivalents: Bold, Italic, Strikethrough, Code, Highlighter, Link, MessageSquare (comment), Plus (add block), GripVertical (block handle), Heading1/2/3, List, ListOrdered, ListTodo (checklist), ChevronRight/ChevronDown (toggle), Table, SquareCode or FileCode (code block), Info/Flag/ThumbsUp/TriangleAlert (callouts), Quote, Minus (line divider), Sparkles or Diamond-based custom for section divider, Image, Smile (emoji), AtSign (mention), FileText / LayoutDashboard / Folder (nested doc / board / folder), Maximize (focus/full screen), ALargeSmall (text size), Columns/PanelLeft (width). Placement and meaning should match Whimsical; artwork will differ.

---

## 13. Remaining gaps (not found)

- Pixel widths for Narrow/Wide, and the three text sizes (body size, line height, paragraph spacing, heading sizes in docs).
- Toolbar button order/icons and exact block-handle/`+` appearance (screenshots have no alt text; real app inaccessible).
- Light-mode color of the highlight mark; the text-color palette if any (only highlight appears in marks).
- Markdown export serialization of bold, callouts, toggles, highlight, embeds, nested files.
- Whether Section divider = diamonds (inferred) and exact visual of dividers.
- Numbered-list marker style per indent level; checklist checkbox visuals.
- Syntax-highlight language list.
- Exact collapse shortcut (⌘⌥[ inferred).
- Whether `/doc`, `/folder` slash aliases exist (only `/board`, `/table`, `/embed` confirmed in prose).
- Whether a table of contents / outline block exists: nothing found in help, releases or bundle; assume **no TOC feature**. Collapsible headings are the navigation aid. (Open question: breadcrumbs only show two levels.)
- Hex color of text selection highlight in code blocks, caret color, placeholder text copy ("Type / for commands" or similar) not captured.

## 14. Primary sources

- https://whimsical.com/learn/docs/docs (Getting started with docs, with the Docs shortcut table)
- https://whimsical.com/learn/faqs/markdown-support
- https://whimsical.com/learn/docs/toggles
- https://whimsical.com/learn/docs/text-size
- https://whimsical.com/learn/docs/code-blocks
- https://whimsical.com/learn/faqs/external-embeds, https://whimsical.com/learn/integrations/embed-files
- https://whimsical.com/learn/boards/tables
- https://whimsical.com/learn/shortcuts/mac
- https://whimsical.com/learn/get-started/command-menu, /mentions, /learn/faqs/emoji, /files/multipage-files, /imports-exports/importing and /exporting-from-whimsical, /faqs/version-history, /settings/dark-mode
- https://whimsical.com/learn/ai/mcp-tools (doc block vocabulary)
- Release notes: https://whimsical.com/releases/year/2025 and /2026
- Blog: https://whimsical.com/blog/creating-a-fast-familiar-writing-experience-in-whimsical, /building-the-whimsical-text-editor-part-1 and part-2, /design-details-that-help-our-users-move-faster, /contextual-toolbars-deep-dive
- App bundle: https://whimsical.com/s/app/assets/ (editor/app.main chunks) and https://whimsical.com/s/css/ (bundle and fonts CSS). Used only to read labels, shortcut keys and design tokens; no code was copied.
