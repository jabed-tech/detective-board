import { describe, it, expect } from 'vitest';
import { pinPoint, clamp, PIN_INSET, anchorPoint, toAnchor } from './geometry';

const base = { x: 100, y: 200, w: 200, h: 100, rot: 0 };

describe('pinPoint', () => {
  it('sits top-centre when unrotated', () => {
    expect(pinPoint(base)).toEqual({ x: 200, y: 200 + PIN_INSET });
  });
  it('rotates about the item centre', () => {
    const p = pinPoint({ ...base, rot: 90 });
    // centre (200,250); local offset (0,-50+14) rotated 90deg -> (36, 0)
    expect(p.x).toBeCloseTo(200 + 50 - PIN_INSET);
    expect(p.y).toBeCloseTo(250);
  });
});

describe('tape fastener', () => {
  it('lies on the top edge, rotated with the item', () => {
    expect(pinPoint({ ...base, attach: 'tape' })).toEqual({ x: 200, y: 200 });
    const p = pinPoint({ ...base, rot: 90, attach: 'tape' });
    expect(p.x).toBeCloseTo(250);
    expect(p.y).toBeCloseTo(250);
  });
  it('other kinds stay PIN_INSET inside', () => {
    for (const attach of ['pin', 'tack', 'magnet', 'clip', 'nail']) {
      expect(pinPoint({ ...base, attach })).toEqual({ x: 200, y: 200 + PIN_INSET });
    }
  });
  it('strings default to the tape centre', () => {
    const it = { ...base, rot: 37, attach: 'tape' };
    expect(anchorPoint(it)).toEqual(pinPoint(it));
  });
});

describe('clamp', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe('anchors', () => {
  it('no anchor means the main pin', () => {
    expect(anchorPoint(base)).toEqual(pinPoint(base));
  });
  it('(0.5, 0.5) is the bottom-right corner when unrotated', () => {
    expect(anchorPoint(base, { u: 0.5, v: 0.5 })).toEqual({ x: 300, y: 300 });
  });
  it('round-trips through toAnchor, rotated or not', () => {
    for (const rot of [0, 37]) {
      const it = { ...base, rot };
      const a = { u: 0.3, v: -0.2 };
      const p = anchorPoint(it, a);
      const back = toAnchor(it, p.x, p.y);
      expect(back.u).toBeCloseTo(a.u);
      expect(back.v).toBeCloseTo(a.v);
    }
  });
  it('clamps points outside the item', () => {
    expect(toAnchor(base, 9999, -9999)).toEqual({ u: 0.5, v: -0.5 });
  });
});
