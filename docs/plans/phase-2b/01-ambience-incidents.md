# Task 1: Calmer ambience, incidents engine, table changes — wave A (Sonnet)

Report to: `.superpowers/sdd/phase-2b/task-1-report.md`

**Files:**
- Create: `src/audio/incidents.ts`, `src/audio/incidents.test.ts`
- Modify: `src/model/types.ts` (AmbienceId, MOODS, SURFACES.glass), `src/audio/jazz.ts` (`layersFor`), `src/audio/jazz.test.ts`, `src/audio/ambience.ts`, `src/audio/ambience.test.ts`, `src/prefs.ts`, `src/prefs.test.ts`, `src/model/surfaces.test.ts`

**Interfaces:**
- Consumes: existing `createAmbience`, `Env`, `Builder`, `filter`, `between` in `ambience.ts`; `MOODS`, `MoodId` from `types.ts`.
- Produces: `AmbienceId` without `'rain'` and with `'incidents'`; the `incidents.ts` exports listed in the overview; `SURFACES.glass` = `{ name: 'Acrylic panel', fasteners: ['tape', 'magnet'], material: 'marker' }`.

## Steps

- [ ] **Step 1: Table changes in `src/model/types.ts`**

```ts
export type AmbienceId = 'jazz' | 'sirens' | 'hum' | 'buzz' | 'tick' | 'incidents';
```
`glass` row in `SURFACES`:
```ts
  glass:   { name: 'Acrylic panel',   fasteners: ['tape', 'magnet'], material: 'marker' },
```
`MOODS` rows (only `blurb` and `ambience` change):
```ts
  'noir-office': { …, blurb: 'Desk lamp, venetian blinds, rain on the window, a little jazz.', …, ambience: ['jazz'] },
  precinct: { …, blurb: 'Cold fluorescent tubes, an acrylic evidence board, sirens far off.', …, ambience: ['sirens'] },
  basement: { …, ambience: ['hum'] },
  motel: { …, ambience: ['buzz'] },
  archive: { …, ambience: ['tick'] },
```

- [ ] **Step 2: Update the surface and layer tests first (they will fail)**

`src/model/surfaces.test.ts`: replace the glass fallback test with:
```ts
  it("falls back to the surface's first fastener", () => expect(pickFastener('glass', 'pin')).toBe('tape'));
  it('keeps magnet on acrylic for boards that already use it', () => expect(pickFastener('glass', 'magnet')).toBe('magnet'));
```
`src/audio/jazz.test.ts` lines ~30–31 become:
```ts
    expect(layersFor('noir-office', false)).toEqual(['jazz', 'incidents']);
    expect(layersFor('noir-office', true)).toEqual(['incidents']);
    expect(layersFor('precinct', false)).toEqual(['sirens', 'incidents']);
```
`src/prefs.test.ts` line ~56: `ambienceVolume: 0.2`.

Run: `npx vitest run src/model/surfaces.test.ts src/audio/jazz.test.ts src/prefs.test.ts`. Expected: the layersFor and ambienceVolume tests FAIL. The surfaces test passes now, after Step 1.

- [ ] **Step 3: `layersFor` and the default volume**

`src/audio/jazz.ts`:
```ts
/** The mood's one signature sound (jazz drops out under the user's own music), plus the rare phone/voice incidents. */
export function layersFor(mood: MoodId, musicPlaying: boolean): AmbienceId[] {
  return [...MOODS[mood].ambience.filter(a => !(musicPlaying && a === 'jazz')), 'incidents'];
}
```
`src/prefs.ts`: in `DEFAULT_PREFS`, `ambienceVolume: 0.2`. Only the default changes; saved values are still read as before.

Run the three test files again. Expected: PASS.

- [ ] **Step 4: Write `src/audio/incidents.test.ts` (failing)**

```ts
import { describe, expect, it } from 'vitest';
import { FIRST_MIN, INCIDENT_GAP, nextIncidentDelay, pickClip, type Clip } from './incidents';
import { rng } from '../model/random';

const clips: Clip[] = [
  { id: 'ring1', file: 'ring1.mp3', kind: 'ring', moods: ['precinct', 'noir-office'] },
  { id: 'talk1', file: 'talk1.mp3', kind: 'talk', moods: ['precinct'] },
  { id: 'tv1', file: 'tv1.mp3', kind: 'tv', moods: ['motel'] },
];

describe('nextIncidentDelay', () => {
  it('stays inside the mood gap', () => {
    const r = rng(1);
    for (let i = 0; i < 200; i++) {
      const d = nextIncidentDelay('precinct', r, false);
      expect(d).toBeGreaterThanOrEqual(INCIDENT_GAP.precinct[0]);
      expect(d).toBeLessThan(INCIDENT_GAP.precinct[1]);
    }
  });
  it('first incident waits at least 30 s but no longer than the usual minimum', () => {
    const r = rng(2);
    for (let i = 0; i < 200; i++) {
      const d = nextIncidentDelay('basement', r, true);
      expect(d).toBeGreaterThanOrEqual(FIRST_MIN);
      expect(d).toBeLessThan(INCIDENT_GAP.basement[0]);
    }
  });
});

describe('pickClip', () => {
  it('only picks clips for the mood', () => {
    const r = rng(3);
    for (let i = 0; i < 50; i++) expect(pickClip(clips, 'motel', null, r)?.id).toBe('tv1');
  });
  it('never repeats the last clip when there is a choice', () => {
    const r = rng(4);
    for (let i = 0; i < 50; i++) expect(pickClip(clips, 'precinct', 'ring1', r)?.id).toBe('talk1');
  });
  it('repeats when it is the only clip for the mood', () => expect(pickClip(clips, 'motel', 'tv1', rng(5))?.id).toBe('tv1'));
  it('returns null when the mood has no clips', () => expect(pickClip(clips, 'archive', null, rng(6))).toBeNull());
  it('returns null for an empty manifest', () => expect(pickClip([], 'precinct', null, rng(7))).toBeNull());
});
```
Run: `npx vitest run src/audio/incidents.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 5: Create `src/audio/incidents.ts`**

```ts
import type { MoodId } from '../model/types';

export type IncidentKind = 'ring' | 'talk' | 'call' | 'tv';
export interface Clip { id: string; file: string; kind: IncidentKind; moods: MoodId[] }

/** Recorded CC0 clips in public/audio/incidents/. Empty until the user approves clips — the layer is then silent. */
export const CLIPS: Clip[] = [];

/** Gap between incidents per mood, in ms [min, max). Very sporadic on purpose. */
export const INCIDENT_GAP: Record<MoodId, [number, number]> = {
  precinct: [60_000, 180_000],
  'noir-office': [120_000, 300_000],
  motel: [120_000, 300_000],
  basement: [240_000, 480_000],
  archive: [240_000, 480_000],
};
/** Low-pass range per mood (Hz): "through a wall"; basement/archive are further away. */
export const MUFFLE: Record<MoodId, [number, number]> = {
  precinct: [900, 1600], 'noir-office': [900, 1600], motel: [900, 1600], basement: [400, 700], archive: [500, 800],
};
export const FIRST_MIN = 30_000;

export function nextIncidentDelay(mood: MoodId, rand: () => number, first: boolean): number {
  const [lo, hi] = INCIDENT_GAP[mood];
  return first ? FIRST_MIN + Math.floor(rand() * (lo - FIRST_MIN)) : lo + Math.floor(rand() * (hi - lo));
}

export function pickClip(clips: Clip[], mood: MoodId, lastId: string | null, rand: () => number): Clip | null {
  const pool = clips.filter(c => c.moods.includes(mood));
  const choices = pool.length > 1 ? pool.filter(c => c.id !== lastId) : pool;
  return choices[Math.floor(rand() * choices.length)] ?? null;
}
```
Run the test. Expected: PASS.

- [ ] **Step 6: Ambience engine changes in `src/audio/ambience.ts`**

1. Delete the `rain` builder.
2. `hum`: change the partial gains to `[[50, 0.028], [100, 0.014], [150, 0.007]]` (−30%).
3. Extend `Env`:
```ts
interface Env {
  c: AudioContext; out: GainNode; noise: AudioBuffer; mood: MoodId;
  later: (fn: () => void, ms: number) => void; every: (fn: () => void, ms: number) => void;
  alive: () => boolean;                                   // false once this layer is stopped or silent
  clip: (file: string) => Promise<AudioBuffer | null>;    // cached fetch+decode; null on any failure
}
```
4. Add the builder (imports: `CLIPS, MUFFLE, nextIncidentDelay, pickClip` from `./incidents`):
```ts
/** Rare recorded phone calls / voices, one at a time, muffled as if through a wall. */
const incidents: Builder = e => {
  const { c } = e;
  let last: string | null = null;
  let playing: AudioBufferSourceNode | null = null;
  let first = true;
  const bad = new Set<string>();
  const arm = (): void => { e.later(fire, nextIncidentDelay(e.mood, Math.random, first)); first = false; };
  const fire = (): void => {
    const clip = playing ? null : pickClip(CLIPS.filter(k => !bad.has(k.id)), e.mood, last, Math.random);
    if (!clip) { arm(); return; }
    void e.clip(clip.file).then(buf => {
      if (!e.alive()) return;
      if (!buf) { bad.add(clip.id); arm(); return; }
      last = clip.id;
      const s = c.createBufferSource(); s.buffer = buf;
      const [lo, hi] = MUFFLE[e.mood];
      const lp = filter(c, 'lowpass', between(lo, hi));
      const g = c.createGain(); g.gain.value = 0.35;
      const d = c.createDelay(0.5); d.delayTime.value = 0.07;
      const dg = c.createGain(); dg.gain.value = 0.25;
      s.connect(lp); lp.connect(g); lp.connect(d); d.connect(dg); dg.connect(g);
      const pan = typeof c.createStereoPanner === 'function' ? c.createStereoPanner() : null;
      if (pan) { pan.pan.value = between(-0.6, 0.6); g.connect(pan); pan.connect(e.out); } else g.connect(e.out);
      playing = s;
      s.onended = () => { if (playing === s) { playing = null; if (e.alive()) arm(); } };
      s.start();
    });
  };
  arm();
  return () => { const p = playing; playing = null; if (p) { try { p.stop(); } catch { /* ended */ } } };
};

const BUILDERS: Record<AmbienceId, Builder> = { jazz, sirens, hum, buzz, tick, incidents };
```
5. In `createAmbience`:
   - add a clip cache shared by all layers of this instance:
```ts
  const clipCache = new Map<string, Promise<AudioBuffer | null>>();
  function loadClip(file: string): Promise<AudioBuffer | null> {
    let p = clipCache.get(file);
    if (!p) {
      const c = ctx!;
      p = fetch(`${import.meta.env.BASE_URL}audio/incidents/${file}`)
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then(b => c.decodeAudioData(b))
        .catch(() => null);
      clipCache.set(file, p);   // failures stay cached as null: never re-fetched this session
    }
    return p;
  }
```
   - in `startLayer`, build `env` with `mood: mood!`, `alive: () => !dead && audible()` and `clip: loadClip`.
   - `setMood(id)`: restart incidents so the pool and gaps follow the new mood:
```ts
    setMood(id) { if (id !== mood) fadeOut('incidents'); mood = id; applyLayers(); },
```
   (`fadeOut` is a no-op when the layer isn't running.)

- [ ] **Step 7: Ambience lifecycle tests in `src/audio/ambience.test.ts`**

Read the existing fake AudioContext in this file and extend it as needed: `createBufferSource`, `createDelay`, `createStereoPanner`, `decodeAudioData` returning a fake buffer. Stub `fetch` with `vi.stubGlobal`. Temporarily push test clips into `CLIPS` with `CLIPS.push(...)` and restore it with `CLIPS.length = 0` in `afterEach`. Use `vi.useFakeTimers()`.

Add:
```ts
it('incidents: nothing before unlock, then one clip after the first gap', async () => {
  // enable + mood precinct, NO unlock → advance 10 min → fetch not called
  // unlock → advance FIRST_MIN..INCIDENT_GAP.precinct[0] → fetch called once, one buffer source started
});
it('incidents: a failed fetch is skipped silently and never fetched again', async () => {
  // fetch rejects for 'bad.mp3' (only clip) → advance through 3 gaps → fetch called exactly once, no throw
});
it('incidents: mood change restarts with the new pool and the old timer does not fire', async () => {
  // precinct running, switch to archive before the first gap → advance past precinct's gap → no precinct clip fetched
});
it('incidents: muting stops the playing clip and no new one is scheduled', async () => {
  // a clip is playing → setMuted(true) → source.stop called; advance 20 min → no further start()
});
it('incidents: never two at once', async () => {
  // clip still playing (onended not fired) when the next fire happens → only one started
});
```
Write each test body fully against the fake context; the comments above are the assertions to implement. Run: `npx vitest run src/audio`. Expected: PASS.

- [ ] **Step 8: Verify**

`npm test`, `npx tsc --noEmit`, `npm run build`. `tsc` will flag any leftover `'rain'` ambience reference; fix it in your files. Effects still have a **visual** `rain` (`EffectId`), so leave `EffectId`, `prefs.effects.rain`, `mood.ts` and `effects.ts` untouched.

Write the report: changes, the test output summary, and any changes to the given code with the reason.
