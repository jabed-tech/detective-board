# Task 17: Move / String modes + multiple pins per item (Sonnet) — added mid-phase at user request

Read `00-overview.md` Global Constraints. Depends on Tasks 1–16 (committed). Read each file before changing it; follow existing patterns (Task 15/16 handles in `src/view/items.ts`).

User decisions (2026-10-09):
- "Drag and drop mode" as an explicit **Move / String toggle** on the desk. Move is the default. Contextual pin-dragging caused mistakes on small items.
- **Multiple pins per item, now:** each string end attaches where it was dropped on the item, with its own small pin. Old links (no anchor) keep using the item's main fastener.

**Files:** `src/model/types.ts`, `src/model/geometry.ts`, `src/model/geometry.test.ts`, `src/model/actions.ts`, `src/model/actions.test.ts`, `src/storage/transfer.ts`, `src/storage/transfer.test.ts`, `src/view/items.ts`, `src/view/strings.ts`, `src/view/connect.ts`, `src/view/connect.test.ts`, `src/styles/items.css`, `src/ui/desk.ts`, `src/ui/keys.ts`, `src/main.ts`, `src/demo.ts`, `src/demo.test.ts`, `src/styles/chrome.css`

## 1. Anchors (model)
- types.ts: `export interface Anchor { u: number; v: number }` — position on the item in its own unrotated frame as fractions of size, relative to the centre: `u ∈ [-0.5, 0.5]` across, `v ∈ [-0.5, 0.5]` down. Link gains optional `fromAt?: Anchor; toAt?: Anchor`. Fractions mean resize and rotation keep anchors in place.
- geometry.ts: `anchorPoint(it, at?: Anchor): {x, y}` — world position; with no anchor return `pinPoint(it)` (unchanged behaviour). And `toAnchor(it, wx, wy): Anchor` — inverse (un-rotate the world point about the centre, divide by w/h, clamp to ±0.5). Tests: round trip `toAnchor(anchorPoint(a))` ≈ a for rot 0 and 37°; `anchorPoint(it)` === `pinPoint(it)`; `{u:0.5,v:0.5}` at rot 0 is the bottom-right corner.
- actions.ts `connect(b, from, to, opts)`: opts gains optional `fromAt`, `toAt`, stored on the link. Duplicate rule unchanged (same pair = duplicate regardless of anchors). Test: anchors are stored.
- transfer.ts `validateLink`: accept `fromAt/toAt` only if both `u` and `v` are finite numbers; clamp to ±0.5; otherwise drop the field. Test.

## 2. Rendering anchors
- strings.ts: link ends use `anchorPoint({ ...item, ...override }, link.fromAt / toAt)`. (The override already carries x, y, rot; resize overrides must carry w/h too — extend the override type to `{ x; y; rot?; w?; h? }` and make Task 16's resize live-update pass w/h.)
- items.ts: for every link end that has an anchor, render a small pin `<span class="anchor-pin" data-pin-for="<itemId>">` in the pins layer (decorative, `aria-hidden`), 12px world-size head in the **link's colour** with a highlight, positioned via `anchorPoint` and kept in sync during item drag/rotate/resize (same place() path as the main pin). `sync(board)` therefore also diffs anchor pins (key: `${linkId}:from|to`). Anchor pins have `pointer-events: none` always.

## 3. Modes
- `ConnectTool.mode()` keeps meaning "String mode on". main.ts holds the mode; default **Move**. Put `data-mode="move|string"` on `#world` whenever it changes.
- desk.ts: add a "Move" button (`obj-hand`: a simple CSS glove/hand or ✋ glyph; label "Move", aria-label "Move mode: drag items around") immediately before the String spool. The two behave as a radio pair (`aria-pressed` on both; exactly one pressed). `DeskDeps` gains `setMode(m: 'move' | 'string')`; `DeskState` gains `mode`. Remove `toggleConnect` (String button calls `setMode('string')`, Move calls `setMode('move')`). Keyboard: `M` = Move, `S` = String in keys.ts (only when no input is focused — existing guard).
- **Move mode:** pressing anywhere on an item — including its main pin — drags the item. CSS: `#world[data-mode="move"] .pin { pointer-events: none; }` so presses fall through to the item. Tap selects. Rotate/resize handles work.
- **String mode:** pressing anywhere on an item starts a string drag from **that point** (not item drag): items.ts calls a new dep `onStringPointerDown(itemId, e)` instead of starting an item drag when `deps.mode() === 'string'` (add `mode(): 'move' | 'string'` to ItemsDeps). Main pins are also start points (their anchor = undefined → default pin). Rotate/resize handles hidden in String mode. Selected-item drawer still opens on tap? No — in String mode a tap is part of tap-tap connecting (existing `tap()` flow). Add a `cursor: crosshair` on items in String mode.
- connect.ts: rename `pinDrag` → `stringDrag(fromId, e, fromAt?: Anchor)`; on drop, find the target item under the pointer and compute `toAt = toAnchor(target, worldDropPoint)`; if dropped on a main pin (`.pin`), `toAt` = undefined. Start anchor: main.ts computes `fromAt = toAnchor(item, viewport.toWorld(e))` unless the press began on the main pin. Tap-tap: record the tap point's anchor for each tapped item (extend `tap(id, at?)` and `begin/complete` to carry optional anchors; keyboard path passes none). Preview string starts at the start anchor. Update connect.test.ts: tap-tap with anchors stores them; keyboard connect stores none.
- Strings view tension-drag on string hit areas works in both modes (unchanged).

## 4. Copy
- demo.ts: tip2 text → `"Tap the String spool below, then drag from me to another note."`; tip1 stays "Drag me around!". demo.test.ts already checks words 'drag', 'pin'?? — update the test: it should check 'drag', 'string', 'zoom' instead of 'pin'.
- On entering String mode show toast: `String mode.` / `Drag from one item to another — the string sticks where you let go.`; entering Move mode: no toast.

## Verify
`npm test` all pass, `npx tsc --noEmit` clean, `npm run build` OK. Report `.superpowers/sdd/phase-1/task-17-report.md`: per section changes (file:line), tests added, anything you decided where the brief was silent.
