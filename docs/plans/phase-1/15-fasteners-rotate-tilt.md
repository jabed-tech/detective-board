# Task 15: Fastener choice, rotate handle, optional tilt (Sonnet) — added mid-phase at user request

Read `00-overview.md` Global Constraints. Depends on Tasks 1–13 and fix wave B (all committed). Touch only the files listed.

User asks (2026-10-09): "what pins the item should be a choice, but not hard to use"; "being able to rotate items would be nice"; random tilt on new items "should be a choice".

**Files:** `src/model/types.ts`, `src/model/actions.ts`, `src/model/actions.test.ts`, `src/storage/transfer.ts`, `src/storage/transfer.test.ts`, `src/prefs.ts`, `src/prefs.test.ts`, `src/view/items.ts`, `src/styles/items.css`, `src/styles/strings.css`, `src/ui/drawer.ts`, `src/ui/settings.ts`, `src/ui/keys.ts`, `src/main.ts`

## 0. Bug fix first
`#string-hits` paths render as huge black filled shapes (computed `fill: rgb(0,0,0)`). Add `fill: none` for every path in the hit SVG (e.g. `.string-hits path { fill: none; }` in strings.css). Verify in code that the hit `<g>` gets the same stroke rules as before (transparent stroke, `pointer-events: stroke`, width `calc(28px * var(--inv-scale, 1))`).

## 1. Fastener choice
- types.ts: `export type FastenerId = 'pin' | 'tack' | 'tape' | 'magnet' | 'clip';` and `export const FASTENERS: { id: FastenerId; name: string }[] = [{id:'pin',name:'Push pin'},{id:'tack',name:'Thumbtack'},{id:'tape',name:'Tape'},{id:'magnet',name:'Magnet'},{id:'clip',name:'Binder clip'}];`
- transfer.ts `validateItem`: accept any of the five ids, default `'pin'`. Test: an item with `attach: 'tape'` survives; `attach: 'glue'` becomes `'pin'`.
- actions.ts `makeItem`: add an optional `opts?: { attach?: FastenerId; tilt?: boolean }` as the LAST parameter (keep existing params and their order so current callers/tests still compile). `attach` defaults to `'pin'`; `tilt` defaults to `true` (current ±4° behaviour); `tilt:false` → `rot = 0`. Tests: `tilt:false` gives rot 0; `attach:'magnet'` is kept.
- prefs.ts: add `tiltNew: boolean` (default `true`) and `lastFastener: FastenerId` (default `'pin'`), validated in `loadPrefs`. Tests for both defaults and invalid values.
- items.ts: set `e.pin.dataset.kind = it.attach` in `update()`; aria-label of the fastener button: `"<Name> — drag to another item to connect"`.
- items.css: one visual per kind on `.pin::before` using `[data-kind=…]`, all coloured by `--pin`, all world-sized like today's pin (hit area unchanged):
  - pin: current round head with highlight.
  - tack: flatter, wider disc (24px) with a centre dimple (radial gradient), small shadow.
  - tape: translucent strip 46×16px, `background: color-mix(in srgb, var(--pin) 25%, rgba(255,250,235,.55))`, slightly rotated (-6deg), ragged ends via `clip-path: polygon(...)`, faint shadow. Strings still attach at the same point.
  - magnet: 26px disc, glossy, stronger shadow (`0 3px 6px rgba(0,0,0,.6)`).
  - clip: black binder clip — 30×14px dark rect (`#1d1d1d`) with two silver handle loops via `::after` (border-only rounded rects), `--pin` ignored except as a thin band.
- drawer.ts item panel: a "Held by" group with five buttons (role radio, aria-checked, visible text name under a small icon span using the same CSS classes via `data-kind`), placed ABOVE "Pin colour" (rename that label to "Colour"). Picking commits `updateItem(..., { attach })` and calls a new dep `setLastFastener(id)`. Update `aria-checked` in place (don't rebuild — same pattern as swatches).
- main.ts: new items use `makeItem(type, x, y, data, size, Math.random, { attach: prefs.lastFastener, tilt: prefs.tiltNew })`; pass `setLastFastener: id => setPrefs({ lastFastener: id })` to the drawer.

## 2. Rotate handle
- items.ts: when an item is selected, show a rotate handle: a `<button class="rotate-handle" aria-label="Rotate — drag around">` appended to the **pins layer** (so it sits above strings), positioned at the item's top-right corner offset outward by 28 world px, rotated with the item (compute from centre + rot like `pinPoint`). Size uses the same constant-screen-size trick as `.pin` (44px × `--inv-scale`). Visual: small circular arrow ↻ glyph on a paper-coloured disc with the yellow focus outline colour.
- Drag on the handle (pointer capture, `pointercancel` handled): angle = `atan2(pointerWorld - centre)` minus the angle at pointerdown, added to the start rotation; live-update the item transform and `strings.override(id, {x, y})` each move so strings follow (add `rot` to the override: extend the override type to `{ x: number; y: number; rot?: number }` in both items.ts and strings.ts — strings.ts passes it into `pinPoint`). Hold Shift to snap to 15°. On release commit `updateItem(b, id, { rot: normalised })`, normalised to −180…180; one undo step; `sfx.rustle()` on start, nothing on end.
- Hide the handle when nothing is selected, during an item drag, and in reduced-motion? (No — rotation is user-driven; keep it.)
- keys.ts: `[` and `]` rotate the selected item by −5° / +5° (Shift: 15°).
- Drawer "Tilt" slider: widen to −180…180, label "Rotation".

## 3. Optional tilt on new items
- settings.ts: checkbox "Tilt new items slightly (more natural look)", bound to `tiltNew`.

## Verify
`npm test` (all pass), `npx tsc --noEmit` clean, `npm run build` OK. Report at `.superpowers/sdd/phase-1/task-15-report.md`: per section what changed (file:line), tests added.
