# Task 21: Cards grow to fit their text (Sonnet) — user request 2026-10-10

Read `00-overview.md` Global Constraints. Depends on Tasks 1–20 (all committed). Read each file before editing.

User report: after A+ (Task 20) the writing is cut off at the card edge; it only looks right once the card is resized. User decision: **the card grows to fit** (never shrinks on its own).

**Files:** `src/view/items.ts`, `src/styles/items.css`, `src/ui/drawer.ts`, `src/ui/keys.ts`, `src/main.ts` (only if a dep must be wired), tests next to whatever pure helper you add.

## 1. Measuring
- items.ts: export from the ItemsView a method `fitHeight(id: string, data: ItemData): number | null` — returns the card height (world px) needed for the text to fit with the proposed `data` (text/caption/textScale), or `null` if the current `h` is already enough or the item isn't sticky/index/polaroid. Measure with an off-screen clone (same classes, same `width`, `--k`, `--ts`, content rendered via `renderItemContent`) appended to the items layer with `visibility:hidden; position:absolute`, read `scrollHeight` vs `clientHeight` of the text element, remove the clone. Layout px = world px (the world transform doesn't affect scrollHeight). Clamp to the existing max 1200.
- Sticky/index: needed h = current h + (text.scrollHeight − text.clientHeight), rounded up.
- Polaroid caption: change `.pol-cap` from one-line ellipsis to wrapping (`white-space: normal; overflow-wrap: anywhere`), and make the polaroid grow in **height only** so the photo window keeps its size and the caption area gets taller. Check the polaroid CSS: if the window's height is derived from the card height, change it to derive from width (keep today's look at default size — 240×290 must render pixel-identical with a one-line caption).

## 2. Growing, in the same undo step
- Every place that changes text or text size must include the grown `h` in the **same** `updateItem` commit (one Ctrl+Z undoes both): drawer A−/A+/Reset, drawer Writing textarea and Caption input (debounced patch), keys `<`/`>`. Pattern: `const h2 = items.fitHeight(id, newData); updateItem(b, id, { data: newData, ...(h2 ? { h: h2 } : {}) })`. Pass `fitHeight` into drawer/keys deps from main.ts.
- Never shrink: A− and deleting text leave `h` alone.
- Grow keeps the top-left fixed in the item's rotated frame (same maths as the resize handle — reuse it, e.g. the helper behind `scaledGeom`, or factor a small `growHeight(it, h)` pure helper and unit-test it: rot 0 → x,y unchanged; rot 90 → top-left corner world position unchanged within 0.01).
- Strings/pins follow automatically via the normal sync.

## 3. Existing boards
- No migration. An item already overflowing stays as-is until its text or text size is next edited.

## Verify
`npm test` all pass, `npx tsc --noEmit` clean, `npm run build` OK. Report `.superpowers/sdd/phase-1/task-21-report.md`.

Browser check (controller, `http://127.0.0.1:5174`): sticky with 3 lines, A+ ×4 → card taller, all text visible, one Ctrl+Z restores both size and height; polaroid long caption wraps and card grows, photo window unchanged; rotated sticky grows from its top-left.
