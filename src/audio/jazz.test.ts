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
