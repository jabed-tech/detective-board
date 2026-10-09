# Task 8: Noir Office mood + sound effects (Sonnet)

Read `00-overview.md` Global Constraints. Depends on Task 2. Parallel with Tasks 3–7.

**Files:**
- Create: `src/view/flicker.ts`, `src/view/mood.ts`, `src/styles/mood.css`, `src/audio/sfx.ts`
- Test: `src/view/flicker.test.ts`

**Consumes:** `Atmosphere` from `src/model/types.ts`.

**Produces:**
```ts
// flicker.ts
export interface Step { opacity: number; ms: number }      // opacity of the dark overlay
export function flickerSequence(mode: Atmosphere, rand?: () => number): Step[];
export function nextFlickerDelay(rand?: () => number): number; // 8000–40000 ms
export function maxDipsPerSecond(steps: Step[]): number;
// mood.ts
export interface Mood { setAtmosphere(a: Atmosphere): void; setLightTarget(px: number | null, py?: number): void } // px/py = % of viewport
export function createMood(root: HTMLElement, initial: Atmosphere): Mood;
// sfx.ts
export interface Sfx { thunk(): void; pluck(): void; rustle(): void; setEnabled(on: boolean): void; setVolume(v: number): void }
export function createSfx(opts: { enabled: boolean; volume: number }): Sfx;
```

Safety rules (spec §5): ≤ 3 dips per any 1000 ms window, dip opacity ≤ 0.35, `off` and `prefers-reduced-motion` ⇒ no flicker at all.

- [ ] **Step 1: Failing test** — `src/view/flicker.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { flickerSequence, nextFlickerDelay, maxDipsPerSecond } from './flicker';

describe('flicker safety', () => {
  it('full mode: ≤ 3 dips per second and shallow', () => {
    for (let i = 0; i < 500; i++) {
      const s = flickerSequence('full');
      expect(maxDipsPerSecond(s)).toBeLessThanOrEqual(3);
      for (const st of s) expect(st.opacity).toBeLessThanOrEqual(0.35);
      expect(s[s.length - 1].opacity).toBe(0);
    }
  });
  it('gentle mode is a single soft dip', () => {
    const s = flickerSequence('gentle');
    expect(s.filter(x => x.opacity > 0)).toHaveLength(1);
    expect(Math.max(...s.map(x => x.opacity))).toBeLessThanOrEqual(0.2);
  });
  it('off mode does nothing', () => expect(flickerSequence('off')).toEqual([]));
  it('delay is 8–40 s', () => {
    expect(nextFlickerDelay(() => 0)).toBe(8000);
    expect(nextFlickerDelay(() => 0.999999)).toBeLessThanOrEqual(40000);
  });
  it('maxDipsPerSecond counts dip starts in a sliding window', () => {
    const s = [{ opacity: .3, ms: 100 }, { opacity: 0, ms: 100 }, { opacity: .3, ms: 100 }, { opacity: 0, ms: 1000 }, { opacity: .3, ms: 100 }, { opacity: 0, ms: 0 }];
    expect(maxDipsPerSecond(s)).toBe(2);
  });
});
```

Run → FAIL.

- [ ] **Step 2: flicker.ts**

```ts
import type { Atmosphere } from '../model/types';

export interface Step { opacity: number; ms: number }

export function flickerSequence(mode: Atmosphere, rand: () => number = Math.random): Step[] {
  if (mode === 'off') return [];
  if (mode === 'gentle') return [{ opacity: 0.15, ms: 700 }, { opacity: 0, ms: 0 }];
  // full: two quick dips ~0.4–0.6 s apart, like a tired fluorescent tube
  return [
    { opacity: 0.25 + 0.1 * rand(), ms: 90 },
    { opacity: 0, ms: 300 + rand() * 250 },
    { opacity: 0.15 + 0.1 * rand(), ms: 70 },
    { opacity: 0, ms: 0 },
  ];
}

export function nextFlickerDelay(rand: () => number = Math.random): number {
  return 8000 + rand() * 32000;
}

export function maxDipsPerSecond(steps: Step[]): number {
  const starts: number[] = [];
  let t = 0;
  let prev = 0;
  for (const s of steps) {
    if (s.opacity > 0 && prev === 0) starts.push(t);
    prev = s.opacity;
    t += s.ms;
  }
  let best = 0;
  for (let i = 0; i < starts.length; i++) {
    let c = 0;
    for (let j = i; j < starts.length && starts[j] - starts[i] < 1000; j++) c++;
    best = Math.max(best, c);
  }
  return best;
}
```

Run → PASS.

- [ ] **Step 3: mood.ts**

```ts
import type { Atmosphere } from '../model/types';
import { flickerSequence, nextFlickerDelay } from './flicker';

export interface Mood { setAtmosphere(a: Atmosphere): void; setLightTarget(px: number | null, py?: number): void }

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export function createMood(root: HTMLElement, initial: Atmosphere): Mood {
  // Static markup only — no user content.
  root.innerHTML = '<div class="mood-warm"></div><div class="mood-lamp"></div><div class="mood-flicker"></div><div class="mood-vignette"></div>';
  const flick = root.querySelector<HTMLElement>('.mood-flicker')!;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  let atmos = initial;
  let timer = 0;
  let run = 0; // increments to abort an in-flight sequence

  const effective = (): Atmosphere => (rm.matches ? 'off' : atmos);

  async function play(id: number) {
    for (const s of flickerSequence(effective())) {
      if (id !== run) return;
      flick.style.opacity = String(s.opacity);
      await wait(s.ms);
    }
    flick.style.opacity = '0';
    if (id === run) schedule();
  }
  function schedule() {
    clearTimeout(timer);
    root.dataset.atmos = effective();
    if (effective() === 'off') return;
    const id = ++run;
    timer = window.setTimeout(() => void play(id), nextFlickerDelay());
  }
  rm.addEventListener('change', () => { run++; flick.style.opacity = '0'; schedule(); });
  schedule();

  const pct = (v: number) => `${Math.min(90, Math.max(10, v))}%`;
  return {
    setAtmosphere(a) { atmos = a; run++; flick.style.opacity = '0'; schedule(); },
    setLightTarget(px, py = 35) {
      root.style.setProperty('--lx', px === null ? '50%' : pct(px));
      root.style.setProperty('--ly', px === null ? '35%' : pct(py));
    },
  };
}
```

- [ ] **Step 4: mood.css**

Lighting floor: darkest overlay stack stays light enough to read items (spec §5). Overlays never cover chrome because `.mood` lives inside `.room` only.

```css
@property --lx { syntax: '<percentage>'; inherits: true; initial-value: 50%; }
@property --ly { syntax: '<percentage>'; inherits: true; initial-value: 35%; }

.mood { position: absolute; inset: 0; pointer-events: none; z-index: 3; transition: --lx 1.2s ease, --ly 1.2s ease; }
.mood > div { position: absolute; inset: 0; }
.mood-warm { background: rgba(255, 170, 90, .10); mix-blend-mode: multiply; }
.mood-lamp {
  background: radial-gradient(ellipse 60% 65% at var(--lx) var(--ly),
    rgba(255, 214, 150, .14) 0%, rgba(255, 214, 150, 0) 45%, rgba(8, 5, 3, .26) 78%, rgba(8, 5, 3, .36) 100%);
}
.mood-vignette { box-shadow: inset 0 0 140px rgba(0, 0, 0, .40); }
.mood-flicker { background: #050302; opacity: 0; transition: opacity 60ms linear; }
.mood[data-atmos="gentle"] .mood-flicker { transition-duration: 700ms; transition-timing-function: ease-in-out; }
.mood[data-atmos="off"] .mood-flicker { display: none; }
```

- [ ] **Step 5: sfx.ts** — synthesised, no audio files, created lazily on the first call (always inside a user gesture).

```ts
export interface Sfx { thunk(): void; pluck(): void; rustle(): void; setEnabled(on: boolean): void; setVolume(v: number): void }

export function createSfx(opts: { enabled: boolean; volume: number }): Sfx {
  let enabled = opts.enabled;
  let volume = opts.volume;
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let noise: AudioBuffer;

  function ac(): AudioContext | null {
    if (!enabled || volume <= 0) return null;
    if (!ctx) {
      try { ctx = new AudioContext(); } catch { return null; }
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }
  const vary = () => 1 + (Math.random() - 0.5) * 0.16;
  function env(c: AudioContext, peak: number, dur: number): GainNode {
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    return g;
  }
  function noiseSrc(c: AudioContext, dur: number, rate = 1): AudioBufferSourceNode {
    const s = c.createBufferSource();
    s.buffer = noise;
    s.playbackRate.value = rate;
    s.start(c.currentTime, Math.random() * 0.3, dur);
    return s;
  }

  return {
    thunk() {
      const c = ac(); if (!c) return;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500 * vary();
      noiseSrc(c, 0.08).connect(lp); lp.connect(env(c, 0.8, 0.08));
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(110 * vary(), c.currentTime);
      o.frequency.exponentialRampToValueAtTime(55, c.currentTime + 0.1);
      o.connect(env(c, 0.6, 0.12)); o.start(); o.stop(c.currentTime + 0.13);
    },
    pluck() {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(); o.type = 'triangle';
      const f = 220 * vary();
      o.frequency.setValueAtTime(f, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(f * 0.97, c.currentTime + 0.35);
      o.connect(env(c, 0.35, 0.35)); o.start(); o.stop(c.currentTime + 0.36);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      noiseSrc(c, 0.02).connect(hp); hp.connect(env(c, 0.15, 0.02));
    },
    rustle() {
      const c = ac(); if (!c) return;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3500 * vary(); bp.Q.value = 0.8;
      noiseSrc(c, 0.18, vary()).connect(bp); bp.connect(env(c, 0.25, 0.18));
    },
    setEnabled(on) { enabled = on; },
    setVolume(v) { volume = v; if (ctx) master.gain.value = v; },
  };
}
```

- [ ] **Step 6: Verify** — `npm test` PASS; `npx tsc --noEmit` clean. (Sound and flicker are checked by ear/eye in Task 14.)

- [ ] **Step 7: Commit** (controller) — `feat(mood): noir lamp, safe flicker, synthesised sfx`
