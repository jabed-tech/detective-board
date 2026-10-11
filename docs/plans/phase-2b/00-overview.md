# Phase 2b — Close-up brick, mood-themed frame, acrylic precinct, voices & phones, calmer ambience: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each task lives in its own file in this folder; read this overview first, then only your task file. Steps use checkbox (`- [ ]`) syntax.

**Goal:**
- Brick reads as a close-up of a wall.
- The whole outer frame follows the case's mood.
- Precinct becomes a clear acrylic panel in front of a blurred squad room.
- Each mood plays one signature ambience sound plus rare, muffled recorded phone calls and voices.

**Architecture:** Same app (Vite + TS, no framework).
- **Frame themes:** a TS table (`src/view/themes.ts`) written as CSS variables on `<html>` by `mood.ts`. `chrome.css` only reads `var(--…)`.
- **Brick:** one deterministic SVG tile from `src/view/brickTile.ts`, used both by the screen (CSS variable set in `applySurface`) and by export (decoded image pattern).
- **Acrylic:** pure CSS layers on `.surface-glass`, mirrored in the export backdrop.
- **Incidents:** a new ambience layer (`'incidents'`) inside the existing `createAmbience` lifecycle. Pure scheduling and picking live in `src/audio/incidents.ts`.

**Tech Stack:** existing (Vite 8, TypeScript 7, Vitest 5). **No new dependencies.** Recorded clips are static files in `public/audio/incidents/`, added in T5 after the user approves each one.

**Spec:** `docs/specs/2026-10-11-phase-2b-design.md`

**Runs locally only.**
- Branch `phase-2b`.
- Controller browser checks use `http://127.0.0.1:5174`. The user plays on `http://localhost:5173`.

## Global Constraints

Everything in `docs/plans/phase-1/00-overview.md` and `docs/plans/phase-2-3/00-overview.md` → Global Constraints still applies. Key ones:
- No user text in `innerHTML`.
- No network calls with user content.
- ≥ 44 px targets on coarse pointers.
- Reduced motion and Atmosphere respected.
- Never a CSS `filter` on the whole world.
- Implementers never `git commit`.

In addition:

- Chrome (frame) text contrast **≥ 4.5:1** in every mood theme.
- `--focus` (#ffd23f) is **not** themed. The focus ring looks identical in every mood.
- Lighting floor: no large board area darker than **~35% HSL lightness** after the mood's light overlay. Each task that changes a surface reports its arithmetic.
- Surface id `glass` stays `glass` (saved boards and imports unchanged). Board format stays `version: 1`; nothing is added to the board model.
- Ambience stays **off by default** and silent before the first gesture. Incidents obey the same lifecycle: mute, ambience off and a hidden tab stop them.
- Clip files are static app assets fetched from the app's own origin (`import.meta.env.BASE_URL + 'audio/incidents/…'`). A missing or undecodable clip is skipped silently, with no toast.
- Exports match the screen (brick tile and acrylic layers are mirrored in `src/export/backdrop.ts`).

## Review Focus

1. **Rapid mood switching / undo across moods while ambience is on:** the incidents layer restarts with the new mood's pool, no two clips overlap, and no timers from the old mood keep firing. Test in T1.
2. **Clip files missing (404), undecodable, or the manifest empty:** silent, no toast, no fetch storm (a failed clip is not fetched again). Test in T1.
3. **Old precinct boards and imported boards with `surface: 'glass'` and magnet items:** they load unchanged and magnets still render; only *new* items default to tape. Test in T1.
4. **Every theme's text pairs, including closed tabs and each desk gradient stop, meet 4.5:1, and `base.css` fallbacks equal the Noir theme** (no brown flash, no drift). Tests in T4.
5. **Export of a brick board when the tile image fails to decode:** it falls back to the plain brick colour and the export still succeeds. Test in T2.

## Execution waves & models

| Wave | Tasks (parallel within a wave) | Model |
|---|---|---|
| A | T1 Calmer ambience + incidents engine + table changes · T2 Close-up brick · T4 Mood-themed frame | Sonnet |
| B | T3 Acrylic precinct panel (after T1: needs the new `SURFACES.glass`; after T2: shares `board.css`, `backdrop.ts`, `surface.ts`) | Sonnet |
| C | T5 Clip sourcing with the user, browser verification, whole-branch review, fix wave | Opus (controller) |

Tasks within a wave touch **disjoint files**. Wave A file ownership:
- **T1:** `src/model/types.ts`, `src/model/surfaces.test.ts`, `src/audio/*`, `src/prefs.ts`, `src/prefs.test.ts`
- **T2:** `src/view/brickTile.ts(+test)`, `src/view/surface.ts`, `src/styles/board.css`, `src/export/backdrop.ts`, `src/export/compose.ts`, `src/export/compose.test.ts`
- **T4:** `src/view/themes.ts(+test)`, `src/view/mood.ts`, `src/view/mood.test.ts`, `src/styles/chrome.css`, `src/styles/base.css`

## Shared interfaces

```ts
// T1 — src/model/types.ts
export type AmbienceId = 'jazz' | 'sirens' | 'hum' | 'buzz' | 'tick' | 'incidents';   // 'rain' removed
// MOODS[*].ambience: exactly one AmbienceId each (never 'incidents'; layersFor appends it)
// SURFACES.glass = { name: 'Acrylic panel', fasteners: ['tape', 'magnet'], material: 'marker' }

// T1 — src/audio/incidents.ts
export type IncidentKind = 'ring' | 'talk' | 'call' | 'tv';
export interface Clip { id: string; file: string; kind: IncidentKind; moods: MoodId[] }
export const CLIPS: Clip[];                                   // [] until T5
export const INCIDENT_GAP: Record<MoodId, [number, number]>;  // ms
export const MUFFLE: Record<MoodId, [number, number]>;        // low-pass Hz range
export const FIRST_MIN: number;                               // 30_000
export function nextIncidentDelay(mood: MoodId, rand: () => number, first: boolean): number;
export function pickClip(clips: Clip[], mood: MoodId, lastId: string | null, rand: () => number): Clip | null;

// T2 — src/view/brickTile.ts
export const BRICK: { w: 406; h: 116; mortar: 14; cols: 3; rows: 6 };
export const BRICK_TILE: { w: number; h: number };            // 1260 × 780
export const BRICK_TONES: string[];
export function brickTileSvg(seed?: number): string;
// src/export/backdrop.ts
export function drawBackground(ctx, r: Rect, surface: SurfaceId, tiles?: { brick?: CanvasImageSource | null }): void;

// T2 + T3 — src/view/surface.ts
export function applySurface(el: HTMLElement, id: SurfaceId): void;  // also sets --brick-tile (T2) and parent data-surface (T3)

// T4 — src/view/themes.ts
export interface FrameTokens { /* see T4 */ }
export const THEMES: Record<MoodId, FrameTokens>;
export function applyTheme(el: HTMLElement, mood: MoodId): void;
export function contrast(a: string, b: string): number;
```

## File map

```
src/audio/incidents.ts        (T1, new) clip manifest + pure scheduling
src/audio/ambience.ts         (T1) incidents layer, rain builder removed, hum −30%, clip loader
src/audio/jazz.ts             (T1) layersFor appends 'incidents'
src/model/types.ts            (T1) AmbienceId, MOODS ambience + blurbs, SURFACES.glass
src/prefs.ts                  (T1) ambienceVolume default 0.2
src/view/brickTile.ts         (T2, new) SVG brick tile
src/view/surface.ts           (T2, T3) --brick-tile var; data-surface on world
src/styles/board.css          (T2 brick block; T3 glass block)
src/export/backdrop.ts        (T2 brick; T3 glass)
src/export/compose.ts         (T2) preload brick tile
src/view/themes.ts            (T4, new) frame theme table + applyTheme + contrast
src/view/mood.ts              (T4) apply theme on create + setMood
src/styles/chrome.css         (T4) hard-coded frame colours → var(--…)
src/styles/base.css           (T4) :root fallbacks = Noir theme
src/styles/items.css, content.css (T3) far shadows on acrylic
public/audio/incidents/*      (T5) approved CC0 clips
README.md                     (T5) Sound credits
```

Implementer rules: `.superpowers/sdd/phase-2b/implementer-rules.md` (copied from phase 2+3, branch name changed).
