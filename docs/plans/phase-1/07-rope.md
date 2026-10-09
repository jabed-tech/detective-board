# Task 7: Rope simulation (Sonnet)

Read `00-overview.md` Global Constraints. Depends on Task 2. Parallel with Tasks 3–6, 8.

**Files:**
- Create: `src/view/rope.ts`
- Test: `src/view/rope.test.ts`

**Produces:** a pure verlet rope. Endpoints are pinned to the given points each step. Rope length follows the current endpoint distance (`restLength`), so tension = how much slack, not a physical length.
```ts
export interface Rope { n: number; x: Float64Array; y: Float64Array; px: Float64Array; py: Float64Array; still: number }
export function restLength(dist: number, tension: number): number;
export function createRope(ax: number, ay: number, bx: number, by: number, tension: number, settle?: boolean): Rope;
export function stepRope(r: Rope, ax: number, ay: number, bx: number, by: number, tension: number, dt?: number): boolean; // true = still awake
export function ropePath(r: Rope): string;                                   // SVG path d
export function staticPath(ax: number, ay: number, bx: number, by: number, tension: number): string; // reduced-motion curve
```

- [ ] **Step 1: Failing test** — `src/view/rope.test.ts`

```ts
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
```

Run → FAIL.

- [ ] **Step 2: rope.ts**

```ts
export const SEGMENTS = 14;
const GRAVITY = 1400; // px/s²
const DAMPING = 0.975;
const ITERATIONS = 8;
const STILL_EPS = 0.02;
const STILL_FRAMES = 30;

export interface Rope { n: number; x: Float64Array; y: Float64Array; px: Float64Array; py: Float64Array; still: number }

export function restLength(dist: number, tension: number): number {
  const t = Math.min(1, Math.max(0, tension));
  return dist * (1 + 0.3 * t) + 30 * t;
}

export function createRope(ax: number, ay: number, bx: number, by: number, tension: number, settle = false): Rope {
  const n = SEGMENTS + 1;
  const r: Rope = { n, x: new Float64Array(n), y: new Float64Array(n), px: new Float64Array(n), py: new Float64Array(n), still: 0 };
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    r.x[i] = r.px[i] = ax + (bx - ax) * f;
    r.y[i] = r.py[i] = ay + (by - ay) * f;
  }
  if (settle) for (let i = 0; i < 240; i++) stepRope(r, ax, ay, bx, by, tension);
  return r;
}

export function stepRope(r: Rope, ax: number, ay: number, bx: number, by: number, tension: number, dt = 1 / 60): boolean {
  const { n, x, y, px, py } = r;
  if (x[0] !== ax || y[0] !== ay || x[n - 1] !== bx || y[n - 1] !== by) r.still = 0;
  const seg = restLength(Math.hypot(bx - ax, by - ay), tension) / (n - 1);
  const ox = Float64Array.from(x);
  const oy = Float64Array.from(y);

  for (let i = 1; i < n - 1; i++) {
    const vx = (x[i] - px[i]) * DAMPING;
    const vy = (y[i] - py[i]) * DAMPING;
    px[i] = x[i];
    py[i] = y[i];
    x[i] += vx;
    y[i] += vy + GRAVITY * dt * dt;
  }
  x[0] = px[0] = ax; y[0] = py[0] = ay;
  x[n - 1] = px[n - 1] = bx; y[n - 1] = py[n - 1] = by;

  for (let k = 0; k < ITERATIONS; k++) {
    for (let i = 0; i < n - 1; i++) {
      const dx = x[i + 1] - x[i];
      const dy = y[i + 1] - y[i];
      const d = Math.hypot(dx, dy) || 1e-6;
      const diff = (d - seg) / d;
      const pinnedA = i === 0;
      const pinnedB = i + 1 === n - 1;
      if (pinnedA && pinnedB) continue;
      const wa = pinnedA ? 0 : pinnedB ? 1 : 0.5;
      const wb = pinnedB ? 0 : pinnedA ? 1 : 0.5;
      x[i] += dx * diff * wa; y[i] += dy * diff * wa;
      x[i + 1] -= dx * diff * wb; y[i + 1] -= dy * diff * wb;
    }
  }

  let moved = 0;
  for (let i = 1; i < n - 1; i++) moved = Math.max(moved, Math.abs(x[i] - ox[i]), Math.abs(y[i] - oy[i]));
  r.still = moved < STILL_EPS ? r.still + 1 : 0;
  return r.still < STILL_FRAMES;
}

const f = (v: number) => v.toFixed(1);

export function ropePath(r: Rope): string {
  const { n, x, y } = r;
  let d = `M${f(x[0])} ${f(y[0])}`;
  for (let i = 1; i < n - 1; i++) {
    const mx = (x[i] + x[i + 1]) / 2;
    const my = (y[i] + y[i + 1]) / 2;
    d += ` Q${f(x[i])} ${f(y[i])} ${f(mx)} ${f(my)}`;
  }
  return `${d} L${f(x[n - 1])} ${f(y[n - 1])}`;
}

export function staticPath(ax: number, ay: number, bx: number, by: number, tension: number): string {
  const dist = Math.hypot(bx - ax, by - ay);
  const depth = Math.sqrt(0.375 * dist * Math.max(0, restLength(dist, tension) - dist));
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2 + 2 * depth; // quadratic peak sits at half the control offset
  return `M${f(ax)} ${f(ay)} Q${f(mx)} ${f(my)} ${f(bx)} ${f(by)}`;
}
```

Run: `npx vitest run src/view/rope.test.ts` → PASS. If "falls asleep" fails, raise iteration count in the test to 3000 before touching constants, and report it.

- [ ] **Step 3: Commit** (controller) — `feat(view): verlet rope sim with sleep + svg paths`
