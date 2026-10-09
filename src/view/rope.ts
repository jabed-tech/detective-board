export const SEGMENTS = 14;
const GRAVITY = 1400; // px/s²
const DAMPING = 0.975;
const ITERATIONS = 40;
const STILL_EPS = 0.02;
const STILL_FRAMES = 30;

export interface Rope { n: number; x: Float64Array; y: Float64Array; px: Float64Array; py: Float64Array; still: number; t: number }

export function restLength(dist: number, tension: number): number {
  const t = Math.min(1, Math.max(0, tension));
  return dist * (1 + 0.3 * t) + 30 * t;
}

export function createRope(ax: number, ay: number, bx: number, by: number, tension: number, settle = false): Rope {
  const n = SEGMENTS + 1;
  const r: Rope = { n, x: new Float64Array(n), y: new Float64Array(n), px: new Float64Array(n), py: new Float64Array(n), still: 0, t: tension };
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
  if (tension !== r.t) { r.still = 0; r.t = tension; }
  const seg = restLength(Math.hypot(bx - ax, by - ay), tension) / (n - 1);
  const g = GRAVITY * (0.02 + 0.98 * Math.min(1, Math.max(0, tension)));
  const ox = Float64Array.from(x);
  const oy = Float64Array.from(y);

  for (let i = 1; i < n - 1; i++) {
    const vx = (x[i] - px[i]) * DAMPING;
    const vy = (y[i] - py[i]) * DAMPING;
    px[i] = x[i];
    py[i] = y[i];
    x[i] += vx;
    y[i] += vy + g * dt * dt;
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
