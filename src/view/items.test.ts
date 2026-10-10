import { describe, it, expect } from 'vitest';
import { growHeight, withFit } from './items';
import { makeItem } from '../model/actions';

const corner = (it: { x: number; y: number; w: number; h: number; rot: number }) => {
  const r = (it.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return {
    x: it.x + it.w / 2 + (-it.w / 2) * c - (-it.h / 2) * s,
    y: it.y + it.h / 2 + (-it.w / 2) * s + (-it.h / 2) * c,
  };
};

describe('growHeight', () => {
  it('keeps x,y at rot 0', () => {
    const m = { ...makeItem('sticky', 100, 200), rot: 0 };
    expect(growHeight(m, m.h + 80)).toEqual({ x: m.x, y: m.y, h: m.h + 80 });
  });
  it('keeps the top-left corner in place when rotated', () => {
    const m = { ...makeItem('sticky', 500, 400), rot: 90 };
    const g = growHeight(m, m.h + 120);
    const a = corner(m), b = corner({ ...m, ...g });
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.01);
    expect(Math.abs(a.y - b.y)).toBeLessThan(0.01);
  });
});

describe('withFit', () => {
  const base = makeItem('sticky', 10, 20);
  it('adds nothing when it fits', () => {
    expect(withFit(base, { text: 'hi' }, () => null)).toEqual({ data: { text: 'hi' } });
  });
  it('adds the grown geometry in the same patch', () => {
    const p = withFit(base, { text: 'hi' }, () => base.h + 50);
    expect(p.h).toBe(base.h + 50);
    expect(p.data).toEqual({ text: 'hi' });
  });
});
