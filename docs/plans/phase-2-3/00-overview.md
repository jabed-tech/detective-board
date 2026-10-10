# Phases 2 + 3 — Looks, Sound, Case Content & Export: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each task lives in its own file in this folder; read this overview first, then only your task file. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the single cork/noir board into five moods (each with its own surface, lighting, effects and ambient sound, plus the user's own music), and add case content: paperwork generators (mugshot, newspaper, receipt, case file), a sketch pad, stamps, small objects, string labels, an aged look, cross-outs and a CASE CLOSED archive. Strings gain materials, thickness presets, arrowheads and swap-direction (user request 2026-10-10). Export to PNG/JPEG/WebP/PDF of the whole board, the current view or one item (user request 2026-10-10; spec had PNG export in phase 4).

**Architecture:** Same as phase 1 (Vite + TS, no framework, plain `Board` model with snapshot undo, DOM items in a CSS-transformed world, SVG strings). New look/sound data lives in pure tables in `model/` so views stay dumb. One foundation task lands every shared type first; then view/audio/content modules are built in parallel in new files; then two wiring tasks plug them into `main.ts`/drawer/desk/settings one after the other. Export is a canvas compositor that redraws the model (no DOM screenshotting — Safari taints `foreignObject` canvases), plus a hand-written single-image PDF writer (no PDF dependency).

**Tech Stack:** existing (Vite 8, TypeScript 7, Vitest 5, idb-keyval, @fontsource) **plus exactly two new dependencies installed in T1:** `perfect-freehand` (MIT, sketch strokes) and `@fontsource/playfair-display` (newspaper masthead). Sound stays synthesised with Web Audio — no audio files.

**Spec:** `docs/specs/2026-10-09-detective-board-design.md` (§2 Boards, Moods, Items, Templates, Strings, Sound; §5; §9 rows 2–3).

**Runs locally only.** Nothing is pushed or published in these phases (user decision 2026-10-10). Controller browser checks use `http://127.0.0.1:5174`; the user plays on `http://localhost:5173`.

## Global Constraints

Everything in `docs/plans/phase-1/00-overview.md` → Global Constraints still applies (no user text in `innerHTML`, `#rrggbb` colour check, no network, ≥ 44 px targets, reduced motion + Atmosphere respected, flicker ≤ 3 dips/s and dip opacity ≤ 0.35, font rules, copy voice, 4000×3000 world, implementers never `git commit`). In addition:

- Dependencies: phase-1 set + `perfect-freehand` + `@fontsource/playfair-display`. Nothing else.
- Effects are CSS overlay layers with `pointer-events: none` that animate only `opacity`/`transform`. Never a CSS `filter` on the whole world.
- `prefers-reduced-motion: reduce` ⇒ flicker, rain, grain animation, blind sweep, dust drift and neon flicker all off (static versions allowed). Atmosphere `off` ⇒ same as reduced motion. Atmosphere `gentle` ⇒ also no blind sweep.
- Grain/blinds ≤ 6% opacity over items; no board area darker than ~35% lightness; overlays never cover chrome; the focus ring looks identical in every mood.
- Item drop shadows fall away from the mood's light source (CSS vars `--sx`, `--sy`).
- Ambience is **off by default**. No sound plays before the user's first gesture. Own music is picked from a local file, stored in IndexedDB, played via object URL, never uploaded, never included in exports.
- Distressed/marker/display fonts never used for inputs or text < 18 px. Playfair Display = newspaper masthead/headline only.
- Generators use seeded randomness (`data.seed`); every generated field is plain editable text afterwards.
- Board format stays `version: 1`; all new fields are optional and additive. Boards saved before this phase must load unchanged.

## Review Focus

1. Imported files with hostile values in the new fields (sketch path data containing letters/`url(`, unknown stamp/object ids, 10 000 receipt lines, `NaN` prices, unknown mood/surface/material) are sanitised or dropped — tests in T1.
2. User text in every new field (headline, name, receipt line, case-file notes, string label) renders as literal text, never markup — tests in T7 (renderers) and T3 (labels).
3. Reduced motion / Atmosphere off turns off every animated effect in every mood — test in T4 (`activeEffects`).
4. A sketch with no strokes, a single tap (one point), or a huge scribble does not create a broken item; strokes are capped — tests in T8.
5. Music file that can't be decoded (e.g. a renamed .txt) shows a toast and stores nothing; ambience never starts before a gesture and stops when muted or the tab is hidden — tests in T5, browser check in T14.

## Execution waves & models

| Wave | Tasks (parallel within a wave) | Model |
|---|---|---|
| A | T1 Foundation: types, tables, transfer, prefs, deps | Sonnet |
| B | T2 Surfaces & fasteners · T3 String materials & labels · T4 Mood lighting & effects · T5 Ambience & music · T6 Generators · T7 Content renderers · T8 Sketch pad | Sonnet (T6 Haiku) |
| C | T9 Wire phase 2 (moods, surfaces, string controls, sound, new-case picker) · T11 Export compositor core | Sonnet |
| D | T10 Wire phase 3 (add menu, item panels, archive) · T12 Export compositor content types | Sonnet |
| E | T13 Export dialog, formats & PDF | Sonnet |
| F | T14 Browser verification + phase review | Opus (controller) |

Tasks within a wave touch **disjoint files** (each owns the files it lists). Review is batched per wave (one reviewer for wave B), as in phase 1.

## File map

```
src/model/types.ts            (T1) all shared types + tables
src/model/surfaces.ts         (T2) pickFastener
src/model/random.ts           (T1) rng(seed) mulberry32 — shared
src/model/generators.ts       (T6) seeded generators
src/prefs.ts                  (T1) new sound/effect prefs
src/storage/transfer.ts       (T1) validation for every new field
src/view/surface.ts           (T2) applySurface
src/view/linePaths.ts         (T3) markerPath, pathMidpoint
src/view/strings.ts           (T3) materials + labels
src/view/effects.ts           (T4) activeEffects (pure)
src/view/mood.ts              (T4) setMood, setEffects, light/shadow vars
src/audio/ambience.ts         (T5) procedural ambience per mood
src/audio/music.ts            (T5) own-music player
src/audio/jazz.ts             (T5) pure progression/scheduling helpers
src/view/renderers.ts         (T7) new item types, aged, crossed
src/view/art.ts               (T7) static SVG art for objects/stamps
src/ui/sketchpad.ts           (T8) sketch dialog; src/view/strokes.ts (T8) pure
src/ui/newcase.ts             (T9) mood picker dialog
src/main.ts, ui/drawer.ts, ui/settings.ts, ui/desk.ts (T9 then T10)
src/ui/tabs.ts                (T10) archive group
styles: board.css (T2) · items.css (T2: fastener + shadow vars only) · strings.css (T3) · mood.css (T4)
        content.css (T7, new) · sketch.css (T8, new) · chrome.css (T9, T10)
index.html                    (T8) sketch dialog; (T9) new-case dialog; (T13) export dialog
src/export/*                  (T11, T12, T13) region, compose, drawers, text wrap, svg images, pdf, save
src/ui/exportdialog.ts        (T13)
```

## Shared interfaces (authoritative — produced by T1, every task uses these names)

```ts
// model/types.ts
export type SurfaceId = 'cork' | 'glass' | 'brick' | 'wood' | 'archive';
export type MoodId = 'noir-office' | 'precinct' | 'basement' | 'motel' | 'archive';
export type FastenerId = 'pin' | 'tack' | 'tape' | 'magnet' | 'clip' | 'nail';
export type StringMaterial = 'yarn' | 'twine' | 'marker';
export type EffectId = 'blinds' | 'rain' | 'grain' | 'neon' | 'dust' | 'flicker';
export type AmbienceId = 'rain' | 'jazz' | 'sirens' | 'hum' | 'buzz' | 'tick';
export type LightId = 'lamp' | 'fluorescent' | 'bulb' | 'neon' | 'sepia';
export type ItemType = 'photo' | 'polaroid' | 'sticky' | 'index'
  | 'mugshot' | 'newspaper' | 'receipt' | 'casefile' | 'sketch' | 'stamp' | 'object';
export type StampId = 'classified' | 'evidence' | 'case-closed' | 'question' | 'red-x' | 'coffee-ring';
export type ObjectId = 'keys' | 'matchbook' | 'cassette' | 'casing' | 'evidence-bag' | 'ticket' | 'burner-phone';
export interface ReceiptLine { name: string; price: number }        // price in pence, integer 0..999_999
export interface SketchStroke { d: string; color: string; width: number } // d in SKETCH_VIEW coords
export const SKETCH_VIEW = { w: 400, h: 300 } as const;

export interface ItemData {
  imageId?: string; text?: string; caption?: string; unknown?: boolean; textScale?: number;   // phase 1
  aged?: boolean; crossed?: boolean; seed?: number;
  name?: string; bookingNo?: string;                         // mugshot (+ imageId optional)
  masthead?: string; date?: string; headline?: string;      // newspaper (+ text = body); casefile uses date too
  store?: string; lines?: ReceiptLine[]; time?: string;      // receipt
  subject?: string; officer?: string; status?: string;       // casefile (+ text = notes)
  strokes?: SketchStroke[];                                  // sketch
  stamp?: StampId; object?: ObjectId;
}
export type LinkArrow = 'end' | 'both';
export interface Link { /* phase 1 fields */ material?: StringMaterial; thickness?: number; arrow?: LinkArrow } // absent = yarn / 1 / none
export const THICKNESSES: { value: number; name: string }[];   // Thread .6, Yarn 1, Cord 1.6, Rope 2.4
export interface Board { /* phase 1 fields */ surface: SurfaceId; mood: MoodId; closed?: boolean }

export const SURFACES: Record<SurfaceId, { name: string; fasteners: FastenerId[]; material: StringMaterial }>;
export const MOODS: Record<MoodId, { name: string; blurb: string; surface: SurfaceId; light: LightId;
  effects: EffectId[]; ambience: AmbienceId[] }>;
export const STAMPS: { id: StampId; label: string }[];
export const OBJECTS: { id: ObjectId; name: string }[];
export const ITEM_SIZES: Record<ItemType, { w: number; h: number }>;  // extended
export const FASTENERS: { id: FastenerId; name: string }[];           // + nail
export const MATERIALS: { id: StringMaterial; name: string }[];

// model/actions.ts — connect opts gains material?, thickness?, arrow? (stored only when not default); reverseLink(b, id)

// prefs.ts — Prefs gains
//   muted: boolean (false)            master mute: SFX + ambience + music
//   ambience: boolean (false)         ambient sound on/off
//   ambienceVolume: number (0.3)
//   musicId?: string                  blob id of the user's track
//   musicName?: string                file name shown in Settings (≤ 80 chars)
//   musicOn: boolean (false)
//   effects: Record<EffectId, boolean> (all true)
//   lastThickness: number (1)         thickness for new strings

// model/surfaces.ts (T2)  pickFastener(surface: SurfaceId, last: FastenerId): FastenerId
// view/surface.ts (T2)    applySurface(el: HTMLElement, id: SurfaceId): void
// view/linePaths.ts (T3)  markerPath(a: Pt, b: Pt, seed: number): string; pathMidpoint(p: SVGPathElement): Pt | null
// view/strings.ts (T3)    StringsView unchanged; renders link.material, thickness, arrow and label
// view/effects.ts (T4)    activeEffects(mood, atmosphere, reducedMotion, toggles): { id: EffectId; animated: boolean }[]
// view/mood.ts (T4)       Mood gains setMood(id: MoodId): void; setEffects(t: Record<EffectId, boolean>): void
// audio/ambience.ts (T5)  createAmbience(): Ambience { unlock(); setMood(id); setEnabled(on); setVolume(v); setMuted(m); setMusicPlaying(on) }
// audio/music.ts (T5)     createMusic(): Music { load(blob): Promise<boolean>; setOn(on); setVolume(v); setMuted(m); clear() }
// model/random.ts (T1)   rng(seed): () => number
// model/generators.ts (T6) genMugshot(seed); genNewspaper(seed, now); genReceipt(seed, now); genCaseFile(seed, now);
//                          receiptTotal(lines); formatMoney(pence)
// view/renderers.ts (T7)  renderItemContent / itemLabel handle every ItemType
// ui/sketchpad.ts (T8)    openSketchPad(dialog: HTMLDialogElement, init?: SketchStroke[]): Promise<SketchStroke[] | null>
// ui/newcase.ts (T9)      pickMood(dialog: HTMLDialogElement): Promise<MoodId | null>
// export/region.ts (T11)  Scope, regionFor(board, scope, margin?), fitScale(rect, want, maxSide?, maxPixels?)
// export/compose.ts (T11) composeBoard(board, { scope, scale, mood, strings, background, getBlob }): Promise<HTMLCanvasElement | null>
// export/registry.ts (T11) drawers: Partial<Record<ItemType, ItemDrawer>> — T11 core types, T12 the rest
// export/pdf.ts (T13)     jpegToPdf(jpeg, wPx, hPx, 'fit' | 'a4'): Uint8Array
// export/save.ts (T13)    exportName(...), canvasToFile(canvas, format, page, name)
```

Exact behaviour and tests are in each task file.
