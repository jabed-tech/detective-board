import { describe, expect, it } from 'vitest';
import { arrowHead, hashSeed, markerPath } from './linePaths';
const nums = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);
describe('markerPath', () => {
  it('starts at a and ends at b', () => {
    const n = nums(markerPath({ x: 10, y: 20 }, { x: 410, y: 20 }, 7));
    expect(n.slice(0, 2)).toEqual([10, 20]);
    expect(n.slice(-2)).toEqual([410, 20]);
  });
  it('is deterministic per seed and differs between seeds', () => {
    const a = markerPath({ x: 0, y: 0 }, { x: 300, y: 100 }, 1);
    expect(markerPath({ x: 0, y: 0 }, { x: 300, y: 100 }, 1)).toBe(a);
    expect(markerPath({ x: 0, y: 0 }, { x: 300, y: 100 }, 2)).not.toBe(a);
  });
  it('bows at most 6px off the straight line', () => {
    const [, , cx, cy] = nums(markerPath({ x: 0, y: 0 }, { x: 400, y: 0 }, 99));
    expect(Math.abs(cy)).toBeLessThanOrEqual(6 * 2); // quadratic control point is 2× the visible bow
    expect(cx).toBeGreaterThan(100); expect(cx).toBeLessThan(300);
  });
});
describe('arrowHead', () => {
  it('has its tip at the given point and points away from `from`', () => {
    const n = nums(arrowHead({ x: 100, y: 0 }, { x: 0, y: 0 }, 14));
    expect(n.slice(0, 2)).toEqual([100, 0]);          // M tip
    expect(n[2]).toBeCloseTo(86); expect(n[4]).toBeCloseTo(86); // both base corners 14px back
    expect(n[3]).toBeCloseTo(-n[5]);                 // symmetric
  });
});
describe('hashSeed', () => {
  it('is stable and non-negative', () => { expect(hashSeed('abc')).toBe(hashSeed('abc')); expect(hashSeed('abc')).toBeGreaterThanOrEqual(0); });
});
