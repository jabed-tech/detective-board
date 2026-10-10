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
