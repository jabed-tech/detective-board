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
