# Task 4: Mood lighting & effects (Sonnet) — wave B

Read `00-overview.md` (especially the effects lines in Global Constraints and spec §5). Depends on T1. Touch ONLY the files below.

**Files:**
- Create: `src/view/effects.ts`, `src/view/effects.test.ts`, `src/view/mood.test.ts` (jsdom)
- Modify: `src/view/mood.ts`, `src/styles/mood.css`

**Interfaces:**
- Consumes: `MoodId`, `EffectId`, `LightId`, `Atmosphere`, `MOODS` (T1); existing `flicker.ts`.
- Produces:
  - `activeEffects(mood: MoodId, atmosphere: Atmosphere, reducedMotion: boolean, toggles: Record<EffectId, boolean>): { id: EffectId; animated: boolean }[]`
  - `Mood` = `{ setAtmosphere(a); setLightTarget(px, py?); setMood(id: MoodId); setEffects(t: Record<EffectId, boolean>) }` — `createMood(root, atmosphere)` signature unchanged; starts in `'noir-office'` with all effects on.
  - CSS vars `--sx`, `--sy` (unitless) on `document.documentElement` — consumed by T2's shadows.

## Rules for `activeEffects`
- Start from `MOODS[mood].effects`, drop any whose toggle is `false`.
- `still = reducedMotion || atmosphere === 'off'`.
- `flicker`: omitted entirely when `still` (the existing scheduler also stops).
- `rain`, `dust`: omitted when `still` (they only make sense moving).
- `blinds`: kept; `animated = !still && atmosphere === 'full'` (gentle = static blinds, no sweep).
- `grain`, `neon`: kept; `animated = !still`.
- Order of the result follows `MOODS[mood].effects`.

- [ ] **Step 1: Failing tests** — `src/view/effects.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { activeEffects } from './effects';
const ALL = { blinds: true, rain: true, grain: true, neon: true, dust: true, flicker: true };
describe('activeEffects', () => {
  it('noir full: blinds sweep, rain, flicker', () =>
    expect(activeEffects('noir-office', 'full', false, ALL)).toEqual([
      { id: 'blinds', animated: true }, { id: 'rain', animated: true }, { id: 'flicker', animated: true }]));
  it('gentle stops the blind sweep only', () =>
    expect(activeEffects('noir-office', 'gentle', false, ALL)).toEqual([
      { id: 'blinds', animated: false }, { id: 'rain', animated: true }, { id: 'flicker', animated: true }]));
  it('reduced motion: nothing animates, moving-only effects removed', () => {
    for (const m of ['noir-office', 'precinct', 'basement', 'motel', 'archive'] as const)
      for (const e of activeEffects(m, 'full', true, ALL)) {
        expect(e.animated).toBe(false);
        expect(['rain', 'dust', 'flicker']).not.toContain(e.id);
      }
  });
  it('atmosphere off behaves like reduced motion', () =>
    expect(activeEffects('archive', 'off', false, ALL)).toEqual([{ id: 'grain', animated: false }]));
  it('toggles remove effects', () =>
    expect(activeEffects('motel', 'full', false, { ...ALL, neon: false })).toEqual([{ id: 'grain', animated: true }]));
});
```
Run: `npx vitest run src/view/effects.test.ts` — Expected: FAIL. Implement `effects.ts`; run — PASS.

- [ ] **Step 2: Mood layers** — `src/view/mood.ts`

Static markup only (no user content): keep `.mood-warm`, `.mood-lamp`, `.mood-flicker`, `.mood-vignette`; add `.fx-blinds`, `.fx-rain`, `.fx-grain`, `.fx-neon`, `.fx-dust` (each `hidden` by default). `setMood(id)` sets `root.dataset.mood = id`, `root.dataset.light = MOODS[id].light`, sets `--sx/--sy` on `document.documentElement` from this table, then re-applies effects:

| light | --sx | --sy |
|---|---|---|
| lamp | 1 | 1 |
| fluorescent | 0 | 0.8 |
| bulb | 0.3 | 1.4 |
| neon | -1.2 | 0.6 |
| sepia | 1 | 1 |

Applying effects: compute `activeEffects(mood, atmosphere, rm.matches, toggles)`; each `.fx-*` layer is shown iff present; set `data-anim="on|off"` on it. The flicker scheduler runs only if `flicker` is present (replace the `effective() === 'off'` check). Re-apply on `setAtmosphere`, `setEffects`, `setMood` and the reduced-motion media change.

- [ ] **Step 3: CSS** — `src/styles/mood.css`

All layers `position:absolute; inset:0; pointer-events:none`; animate only `opacity`/`transform`; every animation wrapped so `[data-anim="off"]` sets `animation: none`.
- Lighting per `[data-light]` (replace the lamp layer's gradient per light; keep `--lx/--ly` targeting): `lamp` = today's warm pool. `fluorescent` = even cool light `rgba(220,240,255,.10)` top-down linear gradient, corners ≤ `.22` dark. `bulb` = smaller warm pool (ellipse 40% 45%), corners ≤ `.34` dark. `neon` = magenta `rgba(255,60,170,.16)` + teal `rgba(40,220,210,.10)` glow from the right edge, warm layer off. `sepia` = `.mood-warm` becomes `rgba(150,110,60,.18)` multiply. Keep the darkest overlay alpha ≤ .36 so nothing drops under ~35% lightness.
- `.fx-blinds`: `repeating-linear-gradient(170deg, rgba(0,0,0,.06) 0 26px, transparent 26px 64px)` (≤ 6%), animated = slow `translateY` sweep over 40 s, alternate.
- `.fx-rain`: two layers of thin diagonal streaks (`repeating-linear-gradient(100deg, rgba(200,220,255,.07) 0 1px, transparent 1px 14px)`) at 200%×200% size moving via `transform: translate()` 0.9 s / 1.4 s linear infinite; overall opacity .5.
- `.fx-grain`: inline SVG `feTurbulence` noise at opacity .05 (basement: .06 via `[data-mood=basement]`); animated = `transform` steps(6) jitter at 0.6 s.
- `.fx-neon`: soft magenta glow from the right; animated = rare buzz-flicker keyframes that never exceed 3 dips/s and never go below opacity .65.
- `.fx-dust`: ~20 motes from 3 `radial-gradient` dot layers drifting upward via `transform` over 30–50 s.

- [ ] **Step 4: jsdom test** — `src/view/mood.test.ts` (`// @vitest-environment jsdom`; stub `window.matchMedia` to return `{ matches: false, addEventListener() {} }`)

`createMood(root, 'full')`, `setMood('motel')` → `root.dataset.mood === 'motel'`, `.fx-neon` not hidden, `.fx-rain` hidden, `document.documentElement.style.getPropertyValue('--sx') === '-1.2'`; `setEffects({...ALL, neon:false})` → `.fx-neon` hidden; `setAtmosphere('off')` → `.fx-grain` has `data-anim="off"`.

Run all tests, `npx tsc --noEmit`, `npm run build`. Report: `.superpowers/sdd/phase-2-3/task-4-report.md`.
