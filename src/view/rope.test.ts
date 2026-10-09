import { describe, it, expect } from 'vitest';
import { createRope, stepRope, ropePath, staticPath, restLength } from './rope';

const A = { x: 100, y: 100 };
const B = { x: 500, y: 100 };
function run(r: ReturnType<typeof createRope>, t: number, n: number, a = A, b = B) {
  let awake = true;
  for (let i = 0; i < n; i++) awake = stepRope(r, a.x, a.y, b.x, b.y, t);
  return awake;
}
const mid = (r: ReturnType<typeof createRope>) => { const i = Math.floor(r.n / 2); return { x: r.x[i], y: r.y[i] }; };

describe('rope', () => {
  it('restLength grows with tension and is the chord when taut', () => {
    expect(restLength(400, 0)).toBe(400);
    expect(restLength(400, 1)).toBeGreaterThan(500);
  });
  it('keeps endpoints pinned', () => {
    const r = createRope(A.x, A.y, B.x, B.y, 0.5);
    run(r, 0.5, 50);
    expect([r.x[0], r.y[0]]).toEqual([A.x, A.y]);
    expect([r.x[r.n - 1], r.y[r.n - 1]]).toEqual([B.x, B.y]);
  });
  it('droops when slack', () => {
    const r = createRope(A.x, A.y, B.x, B.y, 1);
    run(r, 1, 400);
    expect(mid(r).y).toBeGreaterThan(A.y + 60);
  });
  it('is nearly straight when taut', () => {
    const r = createRope(A.x, A.y, B.x, B.y, 0);
    run(r, 0, 400);
    expect(Math.abs(mid(r).y - A.y)).toBeLessThan(8);
  });
  it('falls asleep, then wakes when an endpoint moves', () => {
    const r = createRope(A.x, A.y, B.x, B.y, 0.6);
    expect(run(r, 0.6, 1500)).toBe(false);
    expect(stepRope(r, A.x, A.y, B.x + 50, B.y, 0.6)).toBe(true);
  });
  it('wakes when tension changes', () => {
    const r = createRope(A.x, A.y, B.x, B.y, 0.6);
    expect(run(r, 0.6, 1500)).toBe(false);
    expect(stepRope(r, A.x, A.y, B.x, B.y, 0.2)).toBe(true);
  });
  it('settle=true starts already hanging', () => {
    const r = createRope(A.x, A.y, B.x, B.y, 1, true);
    expect(mid(r).y).toBeGreaterThan(A.y + 60);
  });
  it('builds svg paths', () => {
    const r = createRope(A.x, A.y, B.x, B.y, 0.5);
    const d = ropePath(r);
    expect(d.startsWith('M100.0 100.0')).toBe(true);
    expect(d).toContain('Q');
    expect(d.endsWith('L500.0 100.0')).toBe(true);
    expect(staticPath(0, 0, 400, 0, 0)).toBe('M0.0 0.0 Q200.0 0.0 400.0 0.0');
    expect(staticPath(0, 0, 400, 0, 1)).toMatch(/^M0\.0 0\.0 Q200\.0 \d+\.\d 400\.0 0\.0$/);
  });
});
