# Task 19: Mode feedback — hover/press highlight + "empty" string preview (Sonnet) — user request 2026-10-09

Read `00-overview.md` Global Constraints. Depends on everything committed so far. Read each file before editing.

User ask: "eraser and move should highlight an item so you know what you're deleting — string should show you an 'empty' path first too."

**Files:** `src/view/items.ts`, `src/view/strings.ts`, `src/view/connect.ts`, `src/view/connect.test.ts`, `src/styles/items.css`, `src/styles/strings.css`, `src/main.ts`

## 1. Highlight under the pointer
- items.ts: track a `hoverId` from `pointerenter`/`pointerleave` on item elements (mouse/pen), and set it on `pointerdown` for touch too (cleared on `pointerup`/`pointercancel`). Toggle a `.hot` class on that item.
- Strings: same for link hit paths in Erase mode → `.hot` on the link's `<g>` in the visible SVG (strings.ts: expose `setHot(linkId | null)` or handle internally via the hit `<g>` events).
- CSS by mode (`#world[data-mode]`):
  - move: `.item.hot .item-body` soft yellow glow `box-shadow: 0 0 0 3px rgba(255,210,63,.55), <existing shadows>` + `cursor: grab`.
  - erase: `.item.hot .item-body` red dashed outline `outline: 3px dashed #c0392b; outline-offset: 4px` + a faint red tint overlay (`::before` with `background: rgba(192,57,43,.12)`); `.str.hot .str-halo { stroke: #c0392b; stroke-width: 9; }` `.str.hot .str-main { stroke-dasharray: 10 6; }`. Cursor on items/strings in erase mode: crosshair.
  - string: `.item.hot .item-body` thin focus-yellow outline (shows which item a string will start from / land on).
  - Reduced motion irrelevant (no animation); keep transitions ≤ 120ms.
- **Touch erase safety:** in Erase mode, delete happens on `pointerup` only if the pointer is still over the same item/string it went down on (sliding off cancels). Same rule for mouse.

## 2. "Empty" string preview
- connect.ts: whenever a string source is pending — during a String-mode drag (already) AND after the first tap of tap-tap or keyboard `begin()` — show the preview path from the source's attach point to the pointer: listen to `pointermove` on `window` while pending (mouse/pen hover; touch shows it while the finger is down). When the pointer is over a valid target item, snap the preview end to that item's attach point (main pin, or the anchor if free anchors are on) and mark the target `.hot`. Clear the preview on complete/cancel/mode change/Escape.
- strings.css: preview style = the "empty" look: `stroke-dasharray: 6 6; opacity: .7`, colour = current yarn colour; when snapped to a target, solid with `opacity: .9`.
- Add a pure helper in connect.ts `previewEnd(pointerWorld, target?: { point })` if useful and test: preview snaps to the target point when a target is given, else follows the pointer. Add a connect.test.ts case: after `tap(a)` in string mode, `strings.preview` was called with a non-null start (use the existing stub); after `cancel()` it was called with `null`.

## Verify
`npm test` all pass, `npx tsc --noEmit` clean, `npm run build` OK. Report `.superpowers/sdd/phase-1/task-19-report.md`.
