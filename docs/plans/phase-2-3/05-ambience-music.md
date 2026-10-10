# Task 5: Ambient sound & own music (Sonnet) — wave B

Read `00-overview.md`. Depends on T1. Touch ONLY the files below. Model the Web Audio style on `src/audio/sfx.ts` (lazy context, master gain, noise buffer).

**Files:**
- Create: `src/audio/jazz.ts`, `src/audio/jazz.test.ts`, `src/audio/ambience.ts`, `src/audio/ambience.test.ts`, `src/audio/music.ts`, `src/audio/music.test.ts`

**Interfaces:**
- Consumes: `MoodId`, `AmbienceId`, `MOODS` (T1).
- Produces:
```ts
// jazz.ts (pure)
export type Quality = 'maj7' | 'm7' | '7';
export interface Chord { root: number; quality: Quality }          // root = MIDI note 48..59
export { rng } from '../model/random';                              // T1, re-exported
export function progression(seed: number, bars: number): Chord[];   // ii–V–I cells in random keys
export function chordNotes(c: Chord): number[];                     // 4 MIDI notes, root position, octave 4
export function walkingBass(c: Chord, next: Chord, rand: () => number): number[]; // 4 MIDI notes, root − 12 range
export function nextSirenDelay(rand: () => number): number;         // ms, 40_000..120_000
export function layersFor(mood: MoodId, musicPlaying: boolean): AmbienceId[]; // MOODS[mood].ambience minus 'jazz' when music plays
// ambience.ts
export interface Ambience { unlock(): void; setMood(id: MoodId): void; setEnabled(on: boolean): void;
  setVolume(v: number): void; setMuted(m: boolean): void; setMusicPlaying(on: boolean): void }
export function createAmbience(makeCtx?: () => AudioContext): Ambience;
// music.ts
export interface Music { load(blob: Blob): Promise<boolean>; setOn(on: boolean): void; setVolume(v: number): void;
  setMuted(m: boolean): void; unlock(): void; clear(): void; playing(): boolean }
export function createMusic(makeAudio?: () => HTMLAudioElement): Music;
```
(T9 wires these. `setMusicPlaying` is how the jazz layer steps aside for the user's track.)

## Sound design (all synthesised, all quiet — ambience is background)
- **rain**: looped 2 s noise buffer → lowpass 1400 Hz → highpass 300 Hz, plus random droplet ticks (8–20/s, 3 ms highpassed noise at random gain .05–.15).
- **jazz**: 76 bpm swung eighths. Per bar: electric-piano chord (each note = sine + sine at 2× with 1.5 s decay, gentle FM index 0.3) on beats 1 and the "and" of 2 (swing ratio 2:1); walking bass = triangle through lowpass 600 Hz, one note per beat; brushes = bandpass noise swish (Q 0.7, 2.5 kHz) on 2 and 4. Look-ahead scheduler: `setInterval` 100 ms, schedule events within the next 300 ms; new 8-bar `progression` each loop with an incremented seed.
- **sirens**: after `nextSirenDelay`, a 7 s two-tone wail (sine 650↔850 Hz alternating every 0.5 s, plus a slow 500→900 Hz sweep variant chosen by rand) through lowpass 900 Hz, peak gain .06 with 2 s fades — sounds distant.
- **hum**: UK mains — sines at 50/100/150 Hz gains .04/.02/.01, slow 0.1 Hz gain wobble.
- **buzz**: neon — sawtooth 100 Hz → bandpass 1.2 kHz Q 4, gain .02, random crackle bursts (40 ms noise) every 3–9 s.
- **tick**: clock — every 1 s a 4 ms click (highpassed noise 3 kHz), alternating gain .08/.06 (tick/tock).
- Mood change: fade old layers out and new layers in over 1.5 s. Master gain = `muted || !enabled ? 0 : volume`, ramped over 0.3 s.
- **Gesture rule:** no `AudioContext` is created until `unlock()` has been called (T9 calls it from the first pointerdown/keydown). Before that, `setEnabled(true)` only records state. On `document.visibilitychange` to hidden → `ctx.suspend()`; visible → `resume()` if enabled and not muted.

- [ ] **Step 1: Failing tests** — `src/audio/jazz.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { chordNotes, layersFor, nextSirenDelay, progression, rng, walkingBass } from './jazz';
describe('jazz', () => {
  it('rng is deterministic', () => { const a = rng(5), b = rng(5); expect([a(), a()]).toEqual([b(), b()]); });
  it('progression has the requested length and valid roots', () => {
    const p = progression(1, 8);
    expect(p).toHaveLength(8);
    for (const c of p) { expect(c.root).toBeGreaterThanOrEqual(48); expect(c.root).toBeLessThanOrEqual(59); }
  });
  it('progression is built from ii–V–I: every m7 is followed by a 7 a fourth up', () => {
    const p = progression(3, 12);
    p.forEach((c, i) => { if (c.quality === 'm7' && p[i + 1]) { expect(p[i + 1].quality).toBe('7'); expect((p[i + 1].root - c.root + 12) % 12).toBe(5); } });
  });
  it('chord shapes', () => {
    expect(chordNotes({ root: 48, quality: 'maj7' }).map(n => n - 60)).toEqual([0, 4, 7, 11]);
    expect(chordNotes({ root: 50, quality: 'm7' }).map(n => n - 62)).toEqual([0, 3, 7, 10]);
    expect(chordNotes({ root: 55, quality: '7' }).map(n => n - 67)).toEqual([0, 4, 7, 10]);
  });
  it('walking bass starts on the root and approaches the next root by step', () => {
    const r = rng(9);
    const bass = walkingBass({ root: 50, quality: 'm7' }, { root: 55, quality: '7' }, r);
    expect(bass).toHaveLength(4);
    expect(bass[0] % 12).toBe(50 % 12);
    const nextRoot = 55 - 12; // bass sits one octave below the chord roots
    expect(Math.abs(bass[3] - nextRoot)).toBeLessThanOrEqual(2);
    expect(bass[3]).not.toBe(nextRoot);
  });
  it('siren delay range', () => { expect(nextSirenDelay(() => 0)).toBe(40_000); expect(nextSirenDelay(() => 0.999999)).toBeLessThanOrEqual(120_000); });
  it('jazz steps aside for the user music', () => {
    expect(layersFor('noir-office', false)).toEqual(['rain', 'jazz']);
    expect(layersFor('noir-office', true)).toEqual(['rain']);
  });
});
```
Note `chordNotes` returns octave 4 (root + 12 when root is in 48..59 → 60..71). Run: `npx vitest run src/audio/jazz.test.ts` — Expected: FAIL. Implement `jazz.ts` (`rng` re-exported from `../model/random`; progression: repeat cells `[ii m7, V 7, I maj7, I maj7]` from a random key; V = ii + 5 and I = V + 5 semitones, each wrapped into 48..59 (`48 + (n - 48) % 12`); truncated to `bars`; walking bass: beat 1 root−12, beats 2–3 chord tones (3rd/5th) −12, beat 4 = (next root − 12) ± 1 or 2 chosen by rand, never equal). Run — PASS.

- [ ] **Step 2: Failing tests** — `src/audio/ambience.test.ts`

With a fake `makeCtx` that counts calls and returns a minimal stub (createGain/createOscillator/createBiquadFilter/createBufferSource/createBuffer returning objects with `connect`, `start`, `stop`, `frequency`/`gain` params having `value`, `setValueAtTime`, `linearRampToValueAtTime`, `setTargetAtTime`; `currentTime: 0`; `destination: {}`; `suspend`/`resume` resolved promises; `state: 'running'`):
1. `setEnabled(true); setMood('archive')` before `unlock()` → `makeCtx` called 0 times.
2. after `unlock()` → called once; calling `unlock()` again → still once.
3. `setMuted(true)` after unlock sets the master gain target to 0 (inspect the stub's last `setTargetAtTime`/ramp value on the master gain).
Run — FAIL; implement `ambience.ts`; run — PASS. (Use `vi.useFakeTimers()` so schedulers don't leak.)

- [ ] **Step 3: Failing tests** — `src/audio/music.test.ts` (jsdom)

Fake audio = an `EventTarget` with `src`, `loop`, `volume`, `paused`, `play = vi.fn(async () => { paused = false })`, `pause = vi.fn(() => { paused = true })`, `load = vi.fn()`. Stub `URL.createObjectURL` (returns `blob:1`, `blob:2`, …) and `URL.revokeObjectURL`.
1. `load(blob)` resolves `true` when the fake dispatches `loadedmetadata`; `false` when it dispatches `error`; `false` after 8 s with no event (fake timers).
2. Second `load` revokes the first object URL.
3. `setOn(true)` before `unlock()` doesn't call `play`; after `unlock()` it does; `setMuted(true)` pauses; `setOn(true)` while muted doesn't play.
4. `clear()` pauses, revokes, and `playing()` is false.
Run — FAIL; implement (`loop = true`; `play()` rejection caught and ignored); run — PASS.

- [ ] **Step 4: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build`. Report: `.superpowers/sdd/phase-2-3/task-5-report.md`.
