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
