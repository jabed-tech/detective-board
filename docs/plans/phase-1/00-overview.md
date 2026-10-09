# Phase 1 — Core Board: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task lives in its own file in this folder; read this overview first, then only your task file.

**Goal:** A playable evidence board on GitHub Pages: cork board under a noir desk lamp, add photos/polaroids/sticky notes/index cards, pin them, drag strings from pins, drag items while strings sag and follow, undo/redo, autosave, multiple cases, JSON import/export, desk-object UI that works on phone and desktop.

**Architecture:** Vite + TypeScript, no UI framework. Canonical state is a plain `Board` object in a store with snapshot undo. Items are DOM nodes inside one CSS-transformed world container; strings are SVG paths driven by a small verlet rope sim; pins are DOM in a layer above strings. Storage is IndexedDB (idb-keyval) with an in-memory fallback.

**Tech Stack:** Vite, TypeScript (strict), Vitest (+ jsdom for one test file), idb-keyval, @fontsource (Courier Prime, Special Elite, Caveat, Patrick Hand). Sound is synthesised with Web Audio (no audio files).

**Spec:** `docs/specs/2026-10-09-detective-board-design.md`

## Global Constraints

- Node 22+; `npm test` = `vitest run`; `npm run build` = `tsc --noEmit && vite build`.
- Vite `base: './'` (deploys under any GitHub Pages path).
- Dependencies are exactly those installed in Task 1. Do not add others.
- **Never put user-supplied text into `innerHTML`.** Use `textContent` / `createElement`. Colours from data must pass the `#rrggbb` check before reaching CSS.
- No network requests with user content; no CDN fonts (fonts are self-hosted via @fontsource).
- Touch targets ≥ 44×44 px on screen.
- Every animation respects `prefers-reduced-motion: reduce` and the Atmosphere pref (`full | gentle | off`, default `gentle`). Flicker never exceeds 3 dips/second; dip opacity ≤ 0.35.
- Fonts: Courier Prime = UI; Special Elite = headings/tabs/stamps only at ≥ 18 px; Caveat = handwriting (Patrick Hand when "Neat handwriting" is on).
- Copy voice: flavour headline + plain explanation. Destructive confirmations use plain literal wording.
- Board world is 4000 × 3000. Scale range 0.08–3 (lower than the spec's 0.2 so a phone can see the whole board).
- Deviation from spec §4, intentional: no long-press menu; tapping an item opens the drawer, which is the item menu.
- **Parallel waves:** implementers must NOT run `git commit`; the controller commits each task after its review passes (avoids index.lock races).

## Review Focus

Failure modes the spec implies that are most likely to bite users; each has a test or check in the owning task:

1. Note/caption text containing HTML (typed or from an imported file) must render as literal text — test in Task 9 (`renderers.test.ts`).
2. Imported files with hostile values (`__proto__` asset keys, CSS-injection colour strings, links to missing items, non-image data URLs) must be sanitised or rejected without touching current data — tests in Task 4.
3. Deleting an item with strings attached removes those strings, and updating/removing a missing id is a no-op (protects undo-during-drag) — tests in Task 2.
4. Browser without IndexedDB (some private modes) keeps working in memory; failed saves are reported, not thrown — tests in Task 3.
5. A two-finger pinch that starts on an item zooms the board and does not move the item — manual check in Task 14.

## Execution waves & models

| Wave | Tasks (parallel within a wave) | Model |
|---|---|---|
| 1 | T1 Scaffold | Haiku |
| 2 | T2 Model & store | Sonnet |
| 3 | T3 Prefs/DB/autosave · T4 Transfer · T5 Images · T6 Viewport · T7 Rope · T8 Mood+SFX | Sonnet (T5 Haiku) |
| 4 | T9 Items view · T10 Strings view | Sonnet |
| 5 | T11 Connect tool · T12 UI chrome | Sonnet |
| 6 | T13 Demo case, keys, main wiring | Sonnet |
| 7 | T14 Deploy workflow + browser verification + phase review | Haiku (workflow) + Opus (verify/review) |

Per-task review: one Sonnet spec-compliance reviewer per task. Opus does the end-of-phase review only.

## File map

```
index.html                    app shell (T1)
vite.config.ts, tsconfig.json, package.json (T1)
.github/workflows/deploy.yml  (T14)
src/main.ts                   wiring (T13; stub in T1)
src/demo.ts                   demo case (T13)
src/prefs.ts                  (T3)
src/model/types.ts geometry.ts actions.ts store.ts   (T2)
src/storage/db.ts autosave.ts (T3) · transfer.ts (T4)
src/images/process.ts urls.ts (T5)
src/view/viewMath.ts viewport.ts (T6) · rope.ts (T7) · flicker.ts mood.ts (T8)
src/view/renderers.ts items.ts (T9) · strings.ts (T10) · connect.ts (T11)
src/audio/sfx.ts (T8)
src/ui/dom.ts toast.ts confirm.ts memo.ts desk.ts drawer.ts tabs.ts settings.ts (T12) · keys.ts (T13)
src/styles/fonts.ts base.css (T1) · board.css (T6) · mood.css (T8) · items.css (T9) · strings.css (T10) · chrome.css (T12)
tests: colocated *.test.ts next to the module
```

## Shared interfaces (authoritative — every task uses these names)

```ts
// model/types.ts
type ItemType = 'photo'|'polaroid'|'sticky'|'index'; type LineStyle = 'solid'|'dashed'|'dotted';
type Atmosphere = 'full'|'gentle'|'off';
interface Item { id; type; x; y; w; h; rot; z; attach: 'pin'; attachColor; data: { imageId?; text?; caption? } }
interface Link { id; from; to; color; tension; style?: LineStyle; label?: string }
interface Board { id; name; caseNo; surface: 'cork'; mood: 'noir-office'; items; links; version: 1; updatedAt }
// model/geometry.ts   pinPoint(it) -> {x,y}; clamp(v,lo,hi)
// model/actions.ts    newId, newBoard, makeItem, addItem, updateItem, removeItem, bringToFront, connect, updateLink, removeLink
// model/store.ts      createStore(board) -> Store {get, commit, load, undo, redo, canUndo, canRedo, subscribe}
// prefs.ts            Prefs, DEFAULT_PREFS, loadPrefs, savePrefs, clearPrefs
// storage/db.ts       openDb() -> Db {persistent, listBoards, loadBoard, saveBoard, deleteBoard, putBlob, getBlob, clearAll}; BoardMeta
// storage/autosave.ts createAutosave(save, onError, delay) -> {schedule, flush}
// storage/transfer.ts exportBoard, parseImport, validateBoard, IMPORT_MESSAGES
// images/process.ts   processImage(file) -> {blob,w,h}; fitWithin; ImageReadError
// images/urls.ts      imageUrl(id, getBlob); revokeAllImageUrls()
// view/viewport.ts    createViewport(el, world) -> Viewport {el, get, set, fit, zoomBy, toWorld, toScreen, centerWorld, pinching, onChange, onTap}
// view/rope.ts        createRope, stepRope, ropePath, staticPath, restLength
// view/strings.ts     createStrings(svg, deps) -> StringsView {sync, override, preview, setSelected}
// view/items.ts       createItems(layer, pinsLayer, deps) -> ItemsView {sync, select, markFresh, setConnectFrom}
// view/connect.ts     createConnect(deps) -> ConnectTool {pinDrag, mode, setMode, tap, begin, complete, cancel, pending}
// view/mood.ts        createMood(root, atmosphere) -> Mood {setAtmosphere, setLightTarget}
// audio/sfx.ts        createSfx({enabled, volume}) -> Sfx {thunk, pluck, rustle, setEnabled, setVolume}
// ui/drawer.ts        Selection type; createDrawer(el, deps) -> {render(force?)}
```
Exact signatures are in each task file.
