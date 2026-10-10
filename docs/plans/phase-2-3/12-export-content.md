# Task 12: Export compositor — paperwork, sketch, stamps, objects (Sonnet) — wave D (parallel with T10)

Read `00-overview.md` and `11-export-compositor.md` (registry contract). Depends on T6, T7, T11. Touch ONLY the files below.

**Files:**
- Create: `src/export/draw-content.ts`, `src/export/svg-image.ts`, `src/export/svg-image.test.ts`
- Modify: `src/export/compose.ts` (one line: `import './draw-content';` next to `import './draw-core';`)

**Interfaces:**
- Consumes: `drawers`, `ItemDrawer`, `wrapLines` (T11); `formatMoney`, `receiptTotal` (T6); `objectSvg`, `stampSvg` (T7); `STAMPS`, `OBJECTS`, `SKETCH_VIEW` (T1).
- Produces: drawers registered for `mugshot`, `newspaper`, `receipt`, `casefile`, `sketch`, `stamp`, `object`; `svgDataUrl(markup: string): string` and `svgImage(markup: string): Promise<HTMLImageElement>` (cached by markup).

- [ ] **Step 1: Failing test** — `svg-image.test.ts`

`svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>')` starts with `data:image/svg+xml;charset=utf-8,` and decodes (via `decodeURIComponent`) back to the input; markup without `xmlns` gets it added on the root `<svg`. Run — FAIL; implement; run — PASS.
(Static SVG drawn through an `<img>` — no `foreignObject` — is safe for canvas export in Safari.)

- [ ] **Step 2: Drawers** — `draw-content.ts`

Match `content.css` (T7) at k = w / default width, text × `textScale`; all text via `fillText` + `wrapLines`, clipped to its box; fonts as T7 specifies:
- **mugshot**: height-chart background with rules every 10% and 4'–7' labels; photo `cover`-fitted into the photo box drawn greyscale (draw to an offscreen canvas, then `ctx.filter = 'grayscale(1) contrast(1.15)'` if supported, else per-pixel luminance via `getImageData` on the offscreen canvas only); silhouette if no image; placard with name + booking no. in Courier Prime.
- **newspaper**: paper `#efe9da` with torn top/bottom edges (same polygon as the CSS `clip-path`, via `ctx.clip`); masthead Playfair 700; date; headline Playfair 900 wrapped; body Courier Prime in two columns (split wrapped lines across columns, stop at the bottom).
- **receipt**: `#fbfbf6` with zig-zag bottom; store, time, lines (name left, `formatMoney` right-aligned), dashed rule (`setLineDash`), TOTAL.
- **casefile**: manila body + tab "CASE FILE" (Special Elite), label/value rows, notes, angled red status stamp.
- **sketch**: paper + faint rules; `ctx.scale(w / SKETCH_VIEW.w, h / SKETCH_VIEW.h)` (letterboxed like `xMidYMid meet`), then `ctx.fill(new Path2D(s.d))` with `fillStyle = s.color` per stroke.
- **stamp**: text stamps = red double border + Special Elite label, rotated −6°, `globalAlpha .85`, `multiply`; `question` = big red "?"; `red-x`/`coffee-ring` via `svgImage(stampSvg(id))` scaled to the item. No paper, no drop shadow.
- **object**: `svgImage(objectSvg(id))` scaled to fit with a soft drop shadow; tag (caption) Caveat on a small manila tag bottom-right.

- [ ] **Step 3: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build`. Manual check if you can (port 5175): compose a board with one of each type and open the PNG; describe what you saw or say unchecked. Report `.superpowers/sdd/phase-2-3/task-12-report.md`.
