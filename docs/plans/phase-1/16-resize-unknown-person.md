# Task 16: Resize handle + "Unknown person" card (Sonnet) — added mid-phase at user request

Read `00-overview.md` Global Constraints. Depends on Tasks 1–15 (all committed). Read each file before changing it and follow its existing patterns — Task 15's rotate handle in `src/view/items.ts` is the model to copy.

User asks (2026-10-09): "change the size of an image we upload (the entire frame around it)"; "let someone add a blank (unknown) person — a ? silhouette, Cluedo style".

**Files:** `src/model/types.ts`, `src/model/actions.ts`, `src/model/actions.test.ts`, `src/storage/transfer.ts`, `src/storage/transfer.test.ts`, `src/view/items.ts`, `src/view/renderers.ts`, `src/view/renderers.test.ts`, `src/view/viewport.ts`, `src/styles/items.css`, `src/ui/desk.ts`, `src/ui/drawer.ts`, `src/ui/keys.ts`, `src/main.ts`

## 1. Resize handle (live)
- When an item is selected, show a second handle `<button class="resize-handle" aria-label="Resize — drag the corner">` in the pins layer at the item's **bottom-right corner** (rotated with the item, same maths as the rotate handle but corner `(+w/2, +h/2)` with no outward offset). Same constant-screen-size trick (44px × `--inv-scale`). Visual: small paper-coloured square with a diagonal ⤡ glyph.
- Add `.resize-handle` to the viewport `isBackground` selector (same fix the rotate handle needed, otherwise the board pans).
- Drag (pointer capture, handle `pointercancel`/`lostpointercapture`): project the pointer's world delta onto the item's rotated axes; new size keeps the **aspect ratio** for `photo` and `polaroid` (scale factor from the larger relative change), free for `sticky`/`index`. Keep the item's **top-left corner fixed in its rotated frame** — i.e. recompute `x,y` so the opposite (top-left) corner stays put. Min 80×80, max 1200×1200. Live update item size/position, pin, both handles, and `strings.override(id, {x, y, rot})` each move; commit once on release with `updateItem(..., { x, y, w, h })` (one undo step). Hide handles during an item drag (as rotate does).
- Text scales with the card: set CSS var `--k` on the item element to `w / defaultW` (from `ITEM_SIZES[type].w`) and use `calc(<base> * var(--k, 1))` for font sizes, line-heights and paddings in items.css for sticky/index/polaroid caption, so a bigger note has bigger writing.
- Drawer item panel: add a "Size" range (50%–300% of the type's default width, step 5%) that scales w/h around the current top-left; commit on `change`.
- keys.ts: `Shift` + `+`/`-` (i.e. `+`/`_` or `=` with shift) resize the selected item by ±10% — only if it doesn't conflict with existing zoom keys; otherwise use `.` and `,`. Pick one and document it in the drawer hint text.
- actions.ts: add `resizeItem(b, id, w, h)` that keeps the aspect rule? No — keep logic in items.ts; reducers stay generic (`updateItem` already clamps position). Add a test that `updateItem` with w/h keeps the item inside the board.

## 2. Unknown person card
- New item type is NOT needed: it's a polaroid with `data.unknown: true`. Add `unknown?: boolean` to `ItemData` (types.ts) and accept it in `validateItem` (boolean only) with a transfer test.
- renderers.ts: for a polaroid with no `imageId`, render the silhouette; if `data.unknown`, also render a big `<span class="pol-unknown" aria-hidden="true">?</span>` over the silhouette (Special Elite, ≥ 72px, off-white with a slight dark shadow). `itemLabel` for unknown: `"Unknown person: <caption>"` (or just "Unknown person"). Tests: unknown polaroid contains `.pol-unknown` with text "?", and label text.
- Default caption "Unknown suspect"; random tilt/fastener rules as other items.
- desk.ts Add menu: new entry "Unknown person" (after Polaroid). main.ts: creates `makeItem('polaroid', c.x, c.y, { unknown: true, caption: 'Unknown suspect' }, undefined, Math.random, { attach: prefs.lastFastener, tilt: prefs.tiltNew })` — no file picker. Extend the `DeskDeps.addItem` parameter to `ItemType | 'unknown'` (or add a separate `addUnknown()` dep — pick the simpler).
- Drawer for a polaroid: add "Add photo" / "Replace photo" button (file picker → `processImage` → store blob → set `imageId`, clear `unknown`), and a checkbox "Unknown (show ?)" bound to `data.unknown`. The drawer gets a new dep `pickPhoto(itemId)` implemented in main.ts reusing the existing upload code (factor it into a helper).

## Verify
`npm test` all pass, `npx tsc --noEmit` clean, `npm run build` OK. Report to `.superpowers/sdd/phase-1/task-16-report.md` (per section: changes with file:line, tests added, any choice you made where the brief offered two).
