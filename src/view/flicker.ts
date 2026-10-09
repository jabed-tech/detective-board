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
