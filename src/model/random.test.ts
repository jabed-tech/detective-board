import { describe, it, expect } from 'vitest';
import { rng } from './random';

describe('rng', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = rng(42), b = rng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('differs between seeds', () => expect(rng(1)()).not.toBe(rng(2)()));
});
