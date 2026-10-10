# Task 20: Text size per item (Sonnet) — user request 2026-10-10

Read `00-overview.md` Global Constraints. Depends on Tasks 1–19 (all committed). Read each file before editing and follow its existing patterns — Task 16's Size range and `--k` text scaling are the model to copy.

User ask: "make it so that we can edit the size of text as well."

Today text only grows with the card (`--k = w / defaultW`, Task 16). This task adds an independent per-item text size that multiplies on top of that, so a small note can hold big writing and a big card can hold small writing.

**Files:** `src/model/types.ts`, `src/model/actions.test.ts`, `src/storage/transfer.ts`, `src/storage/transfer.test.ts`, `src/view/items.ts`, `src/view/renderers.test.ts` (only if a DOM assertion fits there), `src/styles/items.css`, `src/ui/drawer.ts`, `src/ui/keys.ts`

## 1. Model + import
- types.ts: add `textScale?: number` to `ItemData` (absent = 1). Export `TEXT_SCALE_MIN = 0.5`, `TEXT_SCALE_MAX = 3`.
- transfer.ts `validateItem`: accept `textScale` only if it is a finite number; clamp to [MIN, MAX]; drop it when it equals 1 (keeps exports small). Tests: `"2"` (string) dropped, `NaN`/`Infinity` dropped, `10` → 3, `0.1` → 0.5, `1.5` kept.
- Existing boards and imports without the field render exactly as before (test: a board with no `textScale` round-trips unchanged).

## 2. Rendering
- items.ts: wherever `--k` is set (create + update paths, ~items.ts:205 and :238), also set `--ts` to `it.data.textScale ?? 1`. Live resize keeps working because `--k` and `--ts` are independent.
- items.css: introduce `--tk: calc(var(--k, 1) * var(--ts, 1))` on `.item` and use `var(--tk, 1)` instead of `var(--k, 1)` in **font sizes and line-heights only** for `.item-sticky .it-text`, `.item-index .it-text`, `.pol-cap`. Paddings/margins keep `--k` (the card's layout shouldn't change with text size). `.pol-unknown` keeps `--k` (it's a graphic, not text).
- Overflow: sticky/index already clip with `overflow: hidden`; polaroid caption already ellipsises. Keep that — no auto-fit in this task.

## 3. Controls
- drawer.ts item panel, for `sticky`, `index` and `polaroid` only (photos have no text): a **"Text size"** row placed directly under the text/caption field:
  - `A−` and `A+` buttons (≥ 44×44, `aria-label` "Smaller text" / "Larger text") stepping by ×1.15, clamped to [MIN, MAX], each click one commit.
  - a readout `"<n>%"` between them (`aria-live="polite"`), and a `Reset` text button shown only when scale ≠ 1 (sets the field to undefined).
  - Store values rounded to 2 dp. Use `patchData` (commit on click, not debounced).
- keys.ts: with an item selected, `Shift + .` / `Shift + ,` (i.e. `>` / `<`) change text size ×1.15 / ÷1.15 — `.`/`,` remain card resize. No-op for photos. Add to the drawer hint text alongside the resize keys.

## 4. Copy / duplicate
- Confirm `textScale` survives copy/paste/duplicate (it lives in `data`, so it should); add one test where these are unit-testable, otherwise note the browser check in the report.

## Verify
`npm test` all pass, `npx tsc --noEmit` clean, `npm run build` OK. Report `.superpowers/sdd/phase-1/task-20-report.md` (per section: changes with file:line, tests added, any choice made where the brief allowed one).

Browser check (controller, on `http://127.0.0.1:5174`): sticky A+ ×3 grows writing but not card; then resize card — text grows further; Reset returns to card-scaled size; undo steps once per click; export → import keeps the size.
