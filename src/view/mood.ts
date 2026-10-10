import { MOODS, type Atmosphere, type EffectId, type MoodId } from '../model/types';
import { activeEffects } from './effects';
import { flickerSequence, nextFlickerDelay } from './flicker';

export interface Mood {
  setAtmosphere(a: Atmosphere): void;
  setLightTarget(px: number | null, py?: number): void;
  setMood(id: MoodId): void;
  setEffects(t: Record<EffectId, boolean>): void;
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const FX: EffectId[] = ['blinds', 'rain', 'grain', 'neon', 'dust'];
const SHADOW = { lamp: [1, 1], fluorescent: [0, 0.8], bulb: [0.3, 1.4], neon: [-1.2, 0.6], sepia: [1, 1] } as const;

export function createMood(root: HTMLElement, initial: Atmosphere): Mood {
  // Static markup only — no user content.
  root.innerHTML = '<div class="mood-warm"></div><div class="mood-lamp"></div>'
    + FX.map(id => `<div class="fx-${id}" hidden></div>`).join('')
    + '<div class="mood-flicker"></div><div class="mood-vignette"></div>';
  const flick = root.querySelector<HTMLElement>('.mood-flicker')!;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  let atmos = initial;
  let mood: MoodId = 'noir-office';
  let toggles: Record<EffectId, boolean> = { blinds: true, rain: true, grain: true, neon: true, dust: true, flicker: true };
  let hasFlicker = true;
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
    if (!hasFlicker) return;
    const id = ++run;
    timer = window.setTimeout(() => void play(id), nextFlickerDelay());
  }
  function apply() {
    const active = activeEffects(mood, atmos, rm.matches, toggles);
    for (const id of FX) {
      const el = root.querySelector<HTMLElement>(`.fx-${id}`)!;
      const a = active.find(e => e.id === id);
      el.hidden = !a;
      el.dataset.anim = a?.animated ? 'on' : 'off';
    }
    hasFlicker = active.some(e => e.id === 'flicker');
    run++; flick.style.opacity = '0';
    schedule();
  }
  rm.addEventListener('change', apply);
  root.dataset.mood = mood;
  root.dataset.light = MOODS[mood].light;
  apply();

  const pct = (v: number) => `${Math.min(90, Math.max(10, v))}%`;
  return {
    setAtmosphere(a) { atmos = a; apply(); },
    setLightTarget(px, py = 35) {
      root.style.setProperty('--lx', px === null ? '50%' : pct(px));
      root.style.setProperty('--ly', px === null ? '35%' : pct(py));
    },
    setMood(id) {
      mood = id;
      const light = MOODS[id].light;
      root.dataset.mood = id;
      root.dataset.light = light;
      const [sx, sy] = SHADOW[light];
      document.documentElement.style.setProperty('--sx', String(sx));
      document.documentElement.style.setProperty('--sy', String(sy));
      apply();
    },
    setEffects(t) { toggles = { ...t }; apply(); },
  };
}
