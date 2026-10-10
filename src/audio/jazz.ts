import { MOODS } from '../model/types';
import type { AmbienceId, MoodId } from '../model/types';

export { rng } from '../model/random';
import { rng } from '../model/random';

export type Quality = 'maj7' | 'm7' | '7';
/** root = MIDI note 48..59 */
export interface Chord { root: number; quality: Quality }

const wrap = (n: number): number => 48 + (((n - 48) % 12) + 12) % 12;

/** ii–V–I cells (ii, V, I, I) in random keys, truncated to `bars`. */
export function progression(seed: number, bars: number): Chord[] {
  const r = rng(seed);
  const out: Chord[] = [];
  while (out.length < bars) {
    const ii = 48 + Math.floor(r() * 12);
    const v = wrap(ii + 5);
    const one = wrap(v + 5);
    out.push({ root: ii, quality: 'm7' }, { root: v, quality: '7' }, { root: one, quality: 'maj7' }, { root: one, quality: 'maj7' });
  }
  return out.slice(0, bars);
}

const THIRD: Record<Quality, number> = { maj7: 4, m7: 3, '7': 4 };
const SEVENTH: Record<Quality, number> = { maj7: 11, m7: 10, '7': 10 };

/** Four notes, root position, octave 4 (60..71 roots). */
export function chordNotes(c: Chord): number[] {
  const r = c.root + 12;
  return [r, r + THIRD[c.quality], r + 7, r + SEVENTH[c.quality]];
}

/** Four bass notes: root, two chord tones, then a step-wise approach to the next root. */
export function walkingBass(c: Chord, next: Chord, rand: () => number): number[] {
  const base = c.root - 12;
  const tones = [base + THIRD[c.quality], base + 7];
  const first = rand() < 0.5 ? 0 : 1;
  const target = next.root - 12;
  const steps = [-2, -1, 1, 2];
  return [base, tones[first], tones[1 - first], target + steps[Math.floor(rand() * steps.length) % steps.length]];
}

export function nextSirenDelay(rand: () => number): number {
  return 40_000 + Math.floor(rand() * 80_000);
}

export function layersFor(mood: MoodId, musicPlaying: boolean): AmbienceId[] {
  return MOODS[mood].ambience.filter(a => !(musicPlaying && a === 'jazz'));
}
