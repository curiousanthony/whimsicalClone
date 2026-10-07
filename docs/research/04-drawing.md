# 04 - Freehand drawing / pen tool (Whimsical) and pressure-stroke implementation

Scope: Whimsical's freehand drawing ("Sketch on the canvas with freehand drawing"), how it coexists with Boards, and how to implement pressure-sensitive strokes in Electron/Chromium on macOS (Wacom, Apple-Pencil-like input).

Mac key notation: `Cmd` = Command, `Opt` = Option, `Ctrl` = Control, `Shift`.

## 0. Provenance legend

Every claim is tagged:

- **[W]** = stated by Whimsical documentation (source URL given). Treat as fact.
- **[W-shortcut]** = Whimsical Mac shortcut sheet, https://whimsical.com/learn/shortcuts/mac (fetched, via summarising fetcher; keys read back as tables).
- **[X]** = external technical source (spec, library source, tldraw docs).
- **[REC]** = recommendation for the clone (our design decision, not Whimsical fact).
- **[GUESS]** = plausible but NOT confirmed by any source. Do not treat as fact.

The official freehand help article is very short. Most "exact" behaviour (stroke widths, opacity, smoothing curve) is NOT documented and must be calibrated by eye against the live app (see Gaps).

---

## 1. What Whimsical documents about freehand drawing

Source: https://whimsical.com/learn/boards/freehand (old URL help.whimsical.com/article/679-... 301-redirects here).

### 1.1 Facts [W]

| Topic | Fact |
|---|---|
| Where | Freehand lives inside **Boards** (the canvas that also hosts flowcharts, wireframes, sticky notes, mind maps). Not a separate file type. |
| Entry | Click the **pencil icon in the toolbar**, or press `H`. `Shift+H` jumps directly to the highlighter. |
| Tools | "Two markers, a highlighter, and an eraser" (+ a **selector** in the freehand menu). Menu choices: marker, highlighter, eraser, selector. |
| Marker | Two sizes: **thin** or **thick**. Available in all colours of the board's **theme**. |
| Highlighter | Theme colours, **except the lightest ones: white, smoke and gray** (these are not offered). Direct key `Shift+H`. |
| Eraser | Keeps a **consistent (screen) size when zooming out**, so you can clear large areas efficiently. |
| Selector | Select / manipulate drawn elements. Drawings "can be resized, moved, or erased". |
| Restyle after the fact | Select a drawing and choose a different **pen type or colour** from the theme options. |
| Detect Shapes | A toggle. When ON, drawn **rectangle, circle, straight line, or diamond** are recognised and made uniform ("clean"). Detected shapes can still be resized/moved/erased and restyled (pen type, colour). |
| Coexistence | You can draw "on and around other objects like flowchart shapes or wireframe elements, or create quick designs entirely with the marker". |
| Recommended hardware | "Safari on iPad with an Apple Pencil", or a desktop with a mouse or **Wacom-style pen tablet**. |
| Lines FAQ | https://whimsical.com/learn/faqs/lines: the freehand tool is "under the pencil icon in the toolbar"; enable **Detect shapes** to automatically straighten wobbly lines. Three ways to draw a line: connector, Line element (`L` in Diagram shapes), freehand. |
| Release note | Release "2026.5 - Whiteboard in ChatGPT" (https://whimsical.com/releases/2026-5-whiteboard-in-chatgpt): "Single dots made with the marker or highlighter can now be erased." => a tap/click without movement creates a **dot stroke**, and it must be erasable. |
| Context menu | When objects of different types are selected, the context menu shows only options that apply to all (https://whimsical.com/learn/boards/using-boards). Applies to selected drawings mixed with other objects. |

### 1.2 Shortcuts for freehand [W-shortcut]

| Action | Mac shortcut |
|---|---|
| Marker | `H` |
| Highlighter | `Shift` + `H` |
| Eraser | `E` |
| Selector | `S` |

### 1.3 Mode-dependent keys: COLLISION TABLE (important for the shortcut dispatcher)

The same letters are reused by other modes in Whimsical's sheet. This means the keys are **modal**: the meaning depends on the active context. The exact entry/exit rules are NOT documented ([GUESS] below).

| Key | Freehand | Diagram/Flowchart (board default) | Wireframe mode | Task mode |
|---|---|---|---|---|
| `H` | Marker | Hexagon | (not listed) | (not listed) |
| `Shift+H` | Highlighter | (not listed) | (not listed) | - |
| `E` | Eraser | Table | Component | - |
| `S` | Selector | Opens "Diagram shapes" palette (per lines FAQ) | (not listed) | Stack |
| `A` | - | Trapezoid | Annotation | Task |
| `D` | - | Diamond | Line (alt) | - |
| `G` | - | Triangle | Image | - |
| `B` | - | Bracket | Button | - |
| `L` | - | Line / Connector | Line / Connector | Connector |

Sources: [W-shortcut] rows for Diagram, Wireframe, Task mode, Freehand; `S` opening Diagram shapes from https://whimsical.com/learn/faqs/lines.

Unverified [GUESS]:
- After pressing `H`, the board enters a "freehand tool group" in which `H`, `Shift+H`, `E`, `S` select the four sub-tools (marker, highlighter, eraser, selector). Whether `E`/`S` ALSO work from the normal select state to jump into eraser/selector is unconfirmed.
- Exit is probably `Esc` and/or choosing the pointer/another tool. Not documented.
- `W` toggles wireframe mode and `Q` exits it ([W-shortcut] says "Change to Wireframe mode: W"; https://whimsical.com/learn/boards/tidy-boards says press `Q` to exit wireframe mode). Freehand is available in both.

[REC] Implement the dispatcher as a tool-state machine: `activeToolGroup` in {select, diagram-shapes, freehand, wireframe, ...}; a key is looked up in the table of the active group first, then in the global table. Keep the default shortcut map in one file so the user can re-map later.

### 1.4 General board shortcuts that also matter to drawing [W-shortcut]

| Action | Mac |
|---|---|
| Undo / Redo | `Cmd+Z` / `Cmd+Shift+Z` |
| Pan | `Space`+drag, or `Shift`+scroll |
| Zoom | `Z`+click/drag, `Cmd`+scroll, `=` in, `-` out, `0` = 100%, `1` = fit content, `2` = fit selection |
| Select all (excl. locked) | `Cmd+A` |
| Duplicate | `Cmd+D` or `Opt`+drag |
| Group / Ungroup | `Cmd+G` / `Cmd+Shift+G` |
| Bring to front / forward | `]` / `Cmd+]` |
| Send to back / backward | `[` / `Cmd+[` |
| Copy / paste style | `Cmd+Opt+C` / `Cmd+V` (per sheet) |
| Save as default style | `Cmd+Shift+D` (board-specific, per object type; https://whimsical.com/learn/boards/save-default-object-style - not documented for freehand) |
| Resize keeping aspect | `Shift`+drag; from center `Opt`+drag |
| Lock object | `Cmd+Shift+L` |
| Ignore snapping | `Cmd`+drag; ignore grid and snapping: `` ` ``+drag |

---

## 2. How drawings coexist with other board objects

Facts [W]: freehand is part of the same Board canvas; you can draw over flowchart shapes and wireframe frames; the toolbar groups shape tools, wireframe mode, freehand, etc. under an "All tools" searchable menu (opened with `/` or the plus button; https://whimsical.com/learn/get-started/wireframes).

Facts NOT documented (all [GUESS] unless marked):
- Strokes are free-standing objects (not attached to shapes, not connectable by connectors).
- Z-order: new strokes are placed on top; highlighter possibly blended/translucent. Normal bring-to-front/send-to-back (`]`, `[`) probably applies.
- Strokes can be selected, moved, resized, restyled, deleted, copied, grouped, put into sections, exported to PNG/PDF with the rest of the board.
- Snapping to grid/auto-alignment probably does not apply to individual strokes while drawing.
- Wireframe-mode colour toning ("toned down, more transparent colors by design": https://whimsical.com/learn/faqs/colors-toned-down) applies to wireframe components, sections and sticky notes. Whether it affects strokes is unknown.

[REC] data model: one `stroke` element type in the same flat element list as shapes, stickies, text, images, connectors (id, z-index, bbox, locked, groupId). No special container.

---

## 3. Colours

[W] Marker/highlighter colours come from the board **theme**; custom colours can be added per board via a "+" in the colour picker (hex entry, hue/saturation, eyedropper) and custom themes via "Templates and color themes" (https://whimsical.com/learn/themes/custom-colors). Custom colours are saved per board, not per workspace.

**No hex values were found** for Whimsical's default theme palette in any public source. I did not invent any. Only the palette *role names* leak from the docs: white, smoke, gray are "lightest colours" (excluded from highlighter); sticky notes default to purple (https://whimsical.com/learn/boards/sticky-notes).

[REC] to get real hex values: open a board in the live app, inspect computed styles / SVG `fill` of a stroke in the browser devtools (colour swatch buttons), and record them in a shared `theme.ts` consumed by the stroke tool, shapes and stickies. Until then use a placeholder palette and keep it in one file.

Interface rule [W]: the highlighter palette = theme palette minus {white, smoke, gray}.

---

## 4. Stroke widths and styles

Documented: marker thin / thick; highlighter (width not stated). **Pixel widths and highlighter opacity are NOT documented.**

[REC] starting values (calibrate against the live app):

| Tool | World-space size (before zoom) | Notes |
|---|---|---|
| Marker thin | `size` ~ 3 | pressure range via `thinning` |
| Marker thick | `size` ~ 7 | |
| Highlighter | `size` ~ 20-24, constant (thinning 0), flat/square caps | colour alpha ~ 0.35-0.4, composite below text if possible, `mix-blend-mode: multiply` in SVG/canvas [GUESS for Whimsical's own look] |
| Eraser radius | ~ 10-12 **screen** px (divide by zoom for world space) | [W] constant on-screen size when zooming out |

Sizes are in world units stored per stroke, so zoom scales them naturally (standard behaviour in infinite-canvas apps).

---

## 5. Pressure sensitivity: what Whimsical does

**Unknown.** Whimsical's docs recommend "Wacom-style pen tablet" and Apple Pencil but never say that stroke width varies with pressure. Two readings:
1. [GUESS] Whimsical strokes have constant thin/thick width (only the two documented sizes), i.e. no pressure variation. The "thin or thick" choice and the "two markers" phrasing strongly suggest fixed widths.
2. Tablet support just means pen input is accepted via Pointer Events (smooth, low latency, no hover issues).

The user's explicit requirement for this clone ("graphics tablet / Apple Pencil-style pressure") therefore goes **beyond** what Whimsical documents; implement pressure as an option layered on top. [REC]: marker uses real pressure when `pointerType === 'pen'`, constant width otherwise; highlighter ignores pressure (thinning 0); provide a "Pressure sensitivity" toggle in settings (i18n key `drawing.pressure`) defaulting ON for pen.

---

## 6. Libraries and approach for pressure-sensitive strokes

### 6.1 perfect-freehand (recommended) [X]

- Repo https://github.com/steveruizok/perfect-freehand, npm `perfect-freehand` 1.2.3, **MIT**, TypeScript. Used by tldraw and Excalidraw (per tldraw docs). Pure function: input points in, outline polygon out.
- Input: `[x, y, pressure?]` or `{x, y, pressure?}`; pressure 0-1 (default 0.5).
- Output: polygon outline points `[x,y][]` to be **filled** (not stroked).

Defaults (verified from source `src/getStrokePoints.ts` / `getStrokeOutlinePoints.ts`, v1.2.3; the README summary that says size=8 is WRONG):

| Option | Default | Meaning |
|---|---|---|
| `size` | **16** | base diameter |
| `thinning` | 0.5 | pressure effect on width; 0 = constant width; negative = inverse |
| `smoothing` | 0.5 | edge softening; min outline point spacing = (size*smoothing)^2 |
| `streamline` | 0.5 | input low-pass: new point = lerp(prev, input, t), t = MIN_T + (1-streamline)*RANGE; higher = smoother/laggier |
| `simulatePressure` | true | derive pressure from velocity (RATE_OF_PRESSURE_CHANGE 0.275) |
| `easing` | `t => t` | pressure curve |
| `last` | **false** | set true on the final render of a finished stroke (uses the real last point) |
| `start.cap` / `end.cap` | true / true | round cap (start 13 segments, end 29 segments) |
| `start.taper` / `end.taper` | 0 (false) | `true` = full-length taper, number = taper distance |
| `start.easing` | `t*(2-t)` | |
| `end.easing` | `--t*t*t+1` | |

Other facts from source: strokes shorter than `size` at the start are skipped as noise; a 1-point stroke gets a 1 pt offset and renders as a dot (good for the "single dot" case); 2-point strokes are expanded to 5 points; end-noise threshold 3 px; invalid/negative pressure falls back to defaults.

API: `getStroke(points, options)`; lower-level `getStrokePoints` + `getStrokeOutlinePoints` (cache the first for incremental drawing).

Path conversion (from README) turns the outline into an SVG path of quadratic curves:

```ts
const average = (a: number, b: number) => (a + b) / 2;
export function getSvgPathFromStroke(points: number[][], closed = true) {
  const len = points.length;
  if (len < 4) return '';
  let a = points[0], b = points[1];
  const c = points[2];
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ` +
          `${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i]; b = points[i + 1];
    d += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
  }
  if (closed) d += 'Z';
  return d;
}
```

Canvas: `ctx.fill(new Path2D(getSvgPathFromStroke(outline)))`.

### 6.2 Alternatives (not recommended unless needed)

- Own implementation: polyline + simplify-js (Ramer-Douglas-Peucker) + Catmull-Rom/quadratic smoothing, variable-width via offset curves. More work, worse feel. Only useful for the highlighter (constant width) where a plain SVG `stroke` with `stroke-linecap: round/butt` + `stroke-linejoin: round` over a smoothed path is enough.
- tldraw's draw shape [X] (https://tldraw.dev/sdk-features/draw-shape): good reference for data model. Stores `segments` of type `free` | `straight`, base64 delta-encoded points (Float32 first point, Float16 deltas), `isPen`, `isComplete`, `isClosed`, `size`, `color`, `dash`; `Shift` while drawing = straight line segments snapped to 15 degree steps; Shift+click after a stroke extends with a straight segment. tldraw is not MIT (custom licence) so do not copy code; copy ideas only.

### 6.3 Recommended rendering pipeline [REC]

- Interaction layer: on `pointerdown`, create a transient stroke; on each coalesced `pointermove` push `[x, y, pressure]` (world coords) and re-run `getStroke` for the live preview (`last: false`); on `pointerup` run once with `last: true`, then commit to the store (one undo step).
- Render finished strokes as `<path d=...>` in the board SVG (or draw to canvas); memoise the path string per stroke id + zoom-independent data (world-space outline does not depend on zoom).
- **Store raw input points, not outline polygons**: `{ id, tool: 'marker'|'highlighter', color, size: 'thin'|'thick' (+ numeric), points: [x,y,p][] (world coords, rounded to 2 decimals), isPen, isClosed? }`. Recompute the outline on load/render. Transforms (move/resize) apply to points or a matrix; do not bake into stored outline.
- For large boards: quantise pressure to 0-255 and delta-encode or store as flat number arrays in JSON (e.g. `[x0,y0,p0,x1,y1,p1,...]`) to keep files small; optionally simplify points with a 0.1-0.3 px tolerance on commit.
- Draw order: strokes are normal elements in z-order. Highlighter uses `mix-blend-mode: multiply` or alpha ~0.35-0.4 [REC/GUESS].

---

## 7. Pointer Events in Electron on macOS (Wacom, Apple Pencil via Sidecar/iPad-as-tablet etc.)

Sources: W3C Pointer Events L3 https://www.w3.org/TR/pointerevents3/, MDN getCoalescedEvents, Chromium code reviews, tldraw docs.

### 7.1 Event handling checklist

| Topic | Rule |
|---|---|
| Event model | Use **Pointer Events** only (`pointerdown/move/up/cancel`), never mouse+touch+tablet separately. |
| CSS | `touch-action: none` on the canvas element (otherwise pen/touch triggers scrolling/pan gestures and `pointercancel`). Also `user-select: none`. |
| Capture | `el.setPointerCapture(e.pointerId)` on `pointerdown` so the stroke keeps receiving events outside the element/window. Release on up/cancel. |
| Device type | `e.pointerType`: `'mouse' | 'pen' | 'touch'`. |
| Pressure | `e.pressure` in [0,1]. Spec: if hardware has no pressure the value is **0.5 while a button is down and 0 otherwise**. So mouse always gives 0.5. |
| Pen detection | Primary: `pointerType === 'pen'`. Additional heuristic used by tldraw: a pressure value strictly between 0 and 0.5 or between 0.5 and 1 means real pressure hardware. Use real pressure only when `pointerType === 'pen'` (or pressure != 0.5); otherwise let perfect-freehand `simulatePressure: true` (mouse/trackpad) or constant width. |
| Pen eraser end | Stylus eraser: `e.button === 5` on transitions, `e.buttons & 32` while active. Auto-switch to the eraser tool while the eraser end is down [REC]. |
| Barrel button | `e.button === 2` / `e.buttons & 2` (also context-menu trigger: suppress `contextmenu` while drawing). [REC] map to temporary Eraser or Selector (configurable). |
| Tilt/twist | `tiltX`, `tiltY` (-90..90 deg), `altitudeAngle`/`azimuthAngle`, `twist`. Optional; ignore in v1. |
| Hover | Pen hover reports `pointermove` with `buttons === 0` and pressure 0; use it to show the brush cursor. Do not draw when `buttons === 0`. |
| High-rate input | `e.getCoalescedEvents()` returns all samples merged into one `pointermove`; use them to avoid polygonal strokes at fast speed. Feature-detect (`typeof e.getCoalescedEvents === 'function'`) and fall back to `[e]`. MDN lists it as requiring a **secure context**; in dev (`http://localhost`) this is fine, but whether a packaged Electron app on `file://` or a custom `app://` protocol counts as secure is **unverified**: test it, and register the custom scheme as privileged/secure (`protocol.registerSchemesAsPrivileged({ scheme, privileges: { secure: true, standard: true } })`) if it does not. |
| Latency | `e.getPredictedEvents()` can draw a short predicted tail (render predicted points only in the live preview, never commit them). Optional. `pointerrawupdate` bypasses coalescing; not needed for v1. |
| Palm rejection | When a pen is in use, ignore `pointerType === 'touch'` for drawing (for iPad/Sidecar-style use). Optional [REC]. |
| Trackpad | macOS trackpad gives `pointerType: 'mouse'`; pinch gestures arrive as `wheel` with `ctrlKey` (handle for zoom; do not mix with drawing). Force Touch pressure is NOT exposed through Pointer Events. |

### 7.2 macOS/Wacom/Chromium specifics

- Chromium's Mac backend only sets pressure for Cocoa events with subtype `NSTabletPointEventSubtype` (i.e. a real tablet driver event). Wacom's macOS driver (and Apple's Sidecar/Universal Control paths for iPad) produce such events, so `pointerType: 'pen'` with real pressure works in Chromium-based apps on macOS [X: Chromium code reviews; behaviour verified only at source level, not on hardware].
- Chromium sends `pointerenter/pointerleave` for a stylus entering/leaving proximity on Mac.
- Known risk [unverified]: reports exist of Wacom tablets not delivering pressure in some Electron/Chromium builds or when the Wacom driver is not installed / "Windows Ink"-style settings differ (mostly Windows). **Must be validated on real Wacom hardware.** Add a hidden diagnostics overlay (pointerType, pressure, tilt, buttons) in dev builds to debug quickly. [REC]
- Electron has no extra API needed for pressure; it is a web-platform feature of the renderer. Nothing to enable in `webPreferences`.
- Avoid wrapping the canvas in elements with `-webkit-app-region: drag`, which eats pointer events.

---

## 8. Eraser

### 8.1 Whimsical behaviour [W]
- Constant on-screen size regardless of zoom; usable to clear big areas.
- Single marker/highlighter dots are erasable (release 2026.5).
- Not documented: whether it erases whole strokes (object eraser) or pixels (partial). Whimsical stores strokes as selectable objects that are "resized, moved, or erased", and "Detect Shapes" outputs clean shapes that are erased "as a unit" -> almost certainly an **object eraser** (whole-stroke) [GUESS, strong]. Whether the eraser also deletes other board objects (shapes, stickies) is unknown; [REC] erase only strokes.

### 8.2 Recommended algorithm [REC, based on tldraw https://tldraw.dev/blog/erasing]
1. Treat the eraser path as **line segments** between consecutive (coalesced) pointer samples, not as points, to prevent "tunneling" at high speed.
2. Broad phase: bbox of the segment expanded by margin -> query spatial index (R-tree/uniform grid, e.g. `rbush`) for strokes.
3. Narrow phase: distance from the segment to the stroke polyline (point-to-segment distances) <= `eraserRadiusScreen / zoom + strokeHalfWidth`.
4. Accumulate hits during the gesture; render hit strokes at ~0.35 opacity as feedback; delete them all in **one undo step** on `pointerup`. `Esc` cancels the gesture.
5. Single-point strokes (dots) are a degenerate polyline; handle by point distance.
6. Optional later: partial erase (split a stroke's point array at the erased segments) - not needed for parity.

Cursor: circle of the eraser's screen diameter.

---

## 9. Selector tool in freehand mode

[W] The freehand menu includes "selector" to select and manipulate drawings. [REC]: Selector = normal select/marquee that is restricted (or prioritised) to strokes; selected strokes get the standard bounding-box handles with resize/move; the floating context menu offers: Pen (marker thin / thick / highlighter), colour (theme palette; highlighter hides white/smoke/gray), more `...` (duplicate, delete, bring to front, lock, group). Changing "pen type" on a selected stroke swaps tool/size and re-renders from the same stored points.

Resize of a stroke: scale point coordinates; keep stroke `size` constant (visual weight) or scale it? Not documented. [REC] scale the points only and keep `size` fixed so resized drawings keep the same marker width.

---

## 10. Detect Shapes (shape recognition)

[W] Toggle named "Detect Shapes" (also "Detect shapes" in the lines FAQ). Recognises exactly: **rectangle, circle, straight line, diamond**. Recognised shapes become uniform and remain a freehand drawing (resizable, movable, erasable, restylable by pen type/colour). Recognition applies on stroke completion (pointer up) [GUESS]: Whimsical straightens a wobbly line after you lift. Where the toggle lives in the UI is not documented [GUESS: inside the freehand sub-menu, next to the marker/highlighter/eraser/selector choices]. Whether it persists across sessions or per board is unknown.

Notably absent: triangle, arrow, star, ellipse (ovals are probably "circle" with aspect ratio normalised) [GUESS].

### Recommended implementation [REC]
Heuristics first (deterministic, cheap, testable with Vitest), no ML:
1. Resample/simplify the stroke (RDP with tolerance ~ 2-3% of bbox diagonal).
2. If the stroke is open (start-end distance > ~20% of path length or > 0.25*bbox diagonal): straight line if the max perpendicular deviation from the chord < ~5% of the length (optionally snap to horizontal/vertical when within ~5 degrees). Otherwise: leave as freehand.
3. If closed (start near end, closure gap < ~20% of perimeter): compute convex-hull/simplified polygon:
   - ~4 vertices with roughly right angles: **rectangle** if edges are near axis-aligned (<~15 degrees); **diamond** if the bbox-aligned vertices sit near the midpoints of the bbox sides (i.e. the polygon is a 45-degree-rotated rect); otherwise a rotated rectangle -> leave freehand or fit to nearest.
   - Low radial variance around the centroid (<~10-15%) -> **circle** (or ellipse using bbox).
4. Replace the stroke's point list with the idealised polyline (e.g. 4 corners + closing point; circle sampled at 48 points; line = 2 points) while keeping `tool`, `color`, `size`; set `isClosed`, `shape: 'rect'|'circle'|'line'|'diamond'` as metadata so resizing stays exact.
5. Provide undo that restores the raw stroke (hold-to-undo of snapping: first `Cmd+Z` reverts to the raw stroke [GUESS for Whimsical]).

Library option: $1 Unistroke recognizer family (https://depts.washington.edu/acelab/proj/dollar/index.html, JS ports `shape-detector`, `OneDollar.js`, `unistroke`) recognises circle/rectangle/line/triangle by template matching, invariant to rotation/scale; fine for a v2, but a rotation-invariant matcher cannot distinguish rectangle vs. diamond (they are the same shape rotated), so use geometric heuristics for that distinction anyway.

---

## 11. UI and icons (lucide-react) [REC]

Whimsical's own icons are proprietary; use Lucide with the same placement/meaning. Pencil icon in the left toolbar opens the freehand flyout.

| Element | lucide-react icon | Note |
|---|---|---|
| Freehand entry (toolbar) | `Pencil` (alt `PenLine`) | [W] "pencil icon in the toolbar" |
| Marker thin | `Pen` / `PenLine` | thin = small stroke preview |
| Marker thick | `PenTool`/`Brush` or a custom SVG preview | |
| Highlighter | `Highlighter` | |
| Eraser | `Eraser` | |
| Selector | `MousePointer2` | |
| Detect shapes toggle | `Shapes` (or `Wand2`/`Sparkles`) | label i18n `drawing.detectShapes` |
| Colour swatch | custom circle buttons | theme palette |

Flyout layout [GUESS]: a small floating panel above/next to the toolbar with: marker thin, marker thick, highlighter, eraser, selector, Detect Shapes toggle, then a colour row. Cursor: crosshair or a round brush preview; eraser cursor = circle outline.

i18n keys (all user-visible strings through i18next) [REC]: `drawing.marker`, `drawing.markerThin`, `drawing.markerThick`, `drawing.highlighter`, `drawing.eraser`, `drawing.selector`, `drawing.detectShapes`, `drawing.pressure`, `shortcuts.drawing.*`.

---

## 12. Persistence format (local files) [REC]

```jsonc
{
  "type": "stroke",
  "id": "…",
  "tool": "marker",          // "marker" | "highlighter"
  "size": "thin",            // "thin" | "thick" (resolves to numeric via theme/config)
  "color": "theme:blue",     // theme token or custom hex
  "points": [x0,y0,p0, x1,y1,p1, …],  // flat, world coords, 2-decimal, p in 0..1 (255 steps)
  "isPen": true,
  "shape": null,             // set by Detect Shapes: "rect" | "circle" | "line" | "diamond"
  "z": 12, "locked": false, "groupId": null
}
```

Compute `bbox` from points on load (cache in memory). Keep the tool/size enums so changing the board theme or "pen type" re-renders without data migration.

---

## 13. Test plan hints (Vitest) [REC]

- Shape detection: synthetic wobbly rect/circle/line/diamond point sets -> expected `shape`.
- Eraser: segment vs. polyline distance, tunneling case (two samples 500 px apart crossing a stroke), zoom scaling of the margin.
- Serialisation round trip of the flat points array; pressure quantisation.
- Pointer pipeline: mock `PointerEvent` objects with `pointerType: 'pen'`, `pressure: 0.3`, `buttons: 32` (eraser), absent `getCoalescedEvents`.
- Dispatcher: key `H` => Hexagon in diagram group, Marker in freehand group.

---

## 14. Gaps / unverified (summary)

1. **Hex colours** of Whimsical's default theme palette (and sticky colours): not found in any public document; must be sampled from the live app.
2. **Stroke widths** (thin/thick px) and **highlighter opacity/width/blend/z-order**: not documented.
3. **Whether Whimsical uses real pen pressure at all** (no source says so); smoothing amount unknown.
4. **Location/persistence of the Detect Shapes toggle**, whether detection occurs on pointer-up or after a hold, and exact thresholds.
5. **Modal key behaviour**: exact entry/exit rules for the freehand tool group (H/Shift+H/E/S), whether Esc/V exits, and whether E/S work outside freehand mode.
6. **Eraser semantics**: object vs. partial erase; whether it erases non-stroke objects.
7. Resize behaviour of strokes (scale stroke width or not), grid snapping, behaviour inside sections.
8. Chromium `getCoalescedEvents` availability under `file://` / custom protocol in packaged Electron; Wacom pressure on macOS Electron must be tested on real hardware.
9. Official Whimsical help pages were read through a summarising fetcher; exact wording and any images/GIFs (which may show the toolbar layout) were not seen.

## 15. Sources

- https://whimsical.com/learn/boards/freehand
- https://whimsical.com/learn/shortcuts/mac
- https://whimsical.com/learn/faqs/lines
- https://whimsical.com/learn/boards/using-boards
- https://whimsical.com/learn/boards/sticky-notes
- https://whimsical.com/learn/boards/customize-shapes
- https://whimsical.com/learn/boards/save-default-object-style
- https://whimsical.com/learn/boards/tidy-boards
- https://whimsical.com/learn/faqs/colors-toned-down
- https://whimsical.com/learn/themes/custom-colors
- https://whimsical.com/learn/get-started/wireframes
- https://whimsical.com/releases (2026.5 note on erasing dots)
- https://github.com/steveruizok/perfect-freehand (source read from raw.githubusercontent.com, v1.2.3)
- https://tldraw.dev/sdk-features/draw-shape, https://tldraw.dev/blog/erasing
- https://www.w3.org/TR/pointerevents3/, https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents
- https://depts.washington.edu/acelab/proj/dollar/index.html
