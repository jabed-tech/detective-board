# Task 6: Viewport — pan, pinch, wheel zoom (Sonnet)

Read `00-overview.md` Global Constraints. Depends on Task 2. Parallel with Tasks 3–5, 7, 8.

**Files:**
- Create: `src/view/viewMath.ts`, `src/view/viewport.ts`, `src/styles/board.css`
- Test: `src/view/viewMath.test.ts`

**Consumes:** `BOARD_W`, `BOARD_H` from `src/model/types.ts`.

**Produces:**
```ts
// viewMath.ts
export interface View { x: number; y: number; scale: number } // screen = world * scale + (x, y)
export const MIN_SCALE = 0.08, MAX_SCALE = 3;
export function screenToWorld(v, sx, sy): {x,y}; export function worldToScreen(v, wx, wy): {x,y};
export function zoomAt(v, sx, sy, factor): View; export function clampView(v, vw, vh, bw, bh, margin?): View; export function fitView(vw, vh, bw, bh, pad?): View;
// viewport.ts
export interface Viewport {
  el: HTMLElement;
  get(): View; set(v: View): void; fit(): void; zoomBy(f: number): void;
  toWorld(clientX: number, clientY: number): { x: number; y: number };
  toScreen(wx: number, wy: number): { x: number; y: number }; // relative to el's top-left
  centerWorld(): { x: number; y: number };
  pinching(): boolean;
  onChange(fn: (v: View) => void): () => void;
  onTap(fn: () => void): () => void; // background tap without movement
}
export function createViewport(el: HTMLElement, world: HTMLElement): Viewport;
```
Side effects other tasks rely on:
- sets CSS var `--inv-scale` (= 1/scale) on `world` (used for constant-size hit areas).
- dispatches `CustomEvent('viewport:pinch')` on `el` when a second pointer goes down (items cancel drags).
- treats targets inside `[data-item-id]`, `[data-pin-for]`, `[data-link-id]` as non-background.

- [ ] **Step 1: Failing test** — `src/view/viewMath.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { screenToWorld, worldToScreen, zoomAt, clampView, fitView, MAX_SCALE, MIN_SCALE } from './viewMath';

const v = { x: 30, y: -40, scale: 0.5 };

describe('viewMath', () => {
  it('screen/world are inverses', () => {
    const w = screenToWorld(v, 200, 100);
    expect(worldToScreen(v, w.x, w.y)).toEqual({ x: 200, y: 100 });
  });
  it('zoomAt keeps the point under the cursor fixed', () => {
    const before = screenToWorld(v, 300, 200);
    const z = zoomAt(v, 300, 200, 2);
    const after = screenToWorld(z, 300, 200);
    expect(z.scale).toBe(1);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it('zoomAt clamps scale', () => {
    expect(zoomAt(v, 0, 0, 100).scale).toBe(MAX_SCALE);
    expect(zoomAt(v, 0, 0, 0.0001).scale).toBe(MIN_SCALE);
  });
  it('clampView keeps part of the board on screen', () => {
    const far = clampView({ x: 99999, y: 99999, scale: 1 }, 800, 600, 4000, 3000, 120);
    expect(far.x).toBe(800 - 120);
    expect(far.y).toBe(600 - 120);
    const neg = clampView({ x: -99999, y: -99999, scale: 1 }, 800, 600, 4000, 3000, 120);
    expect(neg.x).toBe(120 - 4000);
    expect(neg.y).toBe(120 - 3000);
  });
  it('fitView centres the whole board', () => {
    const f = fitView(1000, 800, 4000, 3000, 0);
    expect(f.scale).toBeCloseTo(0.25);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeCloseTo((800 - 750) / 2);
  });
});
```

Run → FAIL.

- [ ] **Step 2: viewMath.ts**

```ts
export interface View { x: number; y: number; scale: number }

export const MIN_SCALE = 0.08;
export const MAX_SCALE = 3;

export const screenToWorld = (v: View, sx: number, sy: number) => ({ x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale });
export const worldToScreen = (v: View, wx: number, wy: number) => ({ x: wx * v.scale + v.x, y: wy * v.scale + v.y });

export function zoomAt(v: View, sx: number, sy: number, factor: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  const w = screenToWorld(v, sx, sy);
  return { scale, x: sx - w.x * scale, y: sy - w.y * scale };
}

export function clampView(v: View, vw: number, vh: number, bw: number, bh: number, margin = 120): View {
  const sw = bw * v.scale;
  const sh = bh * v.scale;
  const mx = Math.min(margin, sw);
  const my = Math.min(margin, sh);
  return {
    ...v,
    x: Math.min(vw - mx, Math.max(mx - sw, v.x)),
    y: Math.min(vh - my, Math.max(my - sh, v.y)),
  };
}

export function fitView(vw: number, vh: number, bw: number, bh: number, pad = 24): View {
  const raw = Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
  return { scale, x: (vw - bw * scale) / 2, y: (vh - bh * scale) / 2 };
}
```

Run → PASS.

- [ ] **Step 3: viewport.ts**

```ts
import { BOARD_H, BOARD_W } from '../model/types';
import { clampView, fitView, screenToWorld, worldToScreen, zoomAt, type View } from './viewMath';

export interface Viewport {
  el: HTMLElement;
  get(): View;
  set(v: View): void;
  fit(): void;
  zoomBy(f: number): void;
  toWorld(clientX: number, clientY: number): { x: number; y: number };
  toScreen(wx: number, wy: number): { x: number; y: number };
  centerWorld(): { x: number; y: number };
  pinching(): boolean;
  onChange(fn: (v: View) => void): () => void;
  onTap(fn: () => void): () => void;
}

export function createViewport(el: HTMLElement, world: HTMLElement): Viewport {
  let v: View = { x: 0, y: 0, scale: 1 };
  let rect = el.getBoundingClientRect();
  const changeFns = new Set<(v: View) => void>();
  const tapFns = new Set<() => void>();
  const pts = new Map<number, { x: number; y: number }>();
  let mode: 'none' | 'pan' | 'pinch' = 'none';
  let panStart = { x: 0, y: 0 };
  let panMoved = false;
  let pinch = { dist: 1, mx: 0, my: 0 };

  function apply(next: View) {
    v = clampView(next, rect.width, rect.height, BOARD_W, BOARD_H);
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
    world.style.setProperty('--inv-scale', String(1 / v.scale));
    for (const fn of changeFns) fn(v);
  }
  const local = (cx: number, cy: number) => ({ x: cx - rect.left, y: cy - rect.top });
  const isBackground = (t: EventTarget | null) =>
    !(t instanceof Element) || !t.closest('[data-item-id], [data-pin-for], [data-link-id]');
  function pinchState() {
    const [a, b] = [...pts.values()];
    const pa = local(a.x, a.y);
    const pb = local(b.x, b.y);
    return { dist: Math.hypot(pa.x - pb.x, pa.y - pb.y) || 1, mx: (pa.x + pb.x) / 2, my: (pa.y + pb.y) / 2 };
  }

  // Capture phase: runs before item/pin/string handlers so the viewport always knows the pointer count.
  el.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      mode = 'pinch';
      pinch = pinchState();
      el.dispatchEvent(new CustomEvent('viewport:pinch'));
    } else if (pts.size === 1 && isBackground(e.target)) {
      mode = 'pan';
      panStart = { x: e.clientX, y: e.clientY };
      panMoved = false;
      el.setPointerCapture(e.pointerId);
    }
  }, { capture: true });

  el.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const prev = { x: p.x, y: p.y };
    p.x = e.clientX;
    p.y = e.clientY;
    if (mode === 'pan' && pts.size === 1) {
      if (Math.hypot(e.clientX - panStart.x, e.clientY - panStart.y) > 5) panMoved = true;
      apply({ ...v, x: v.x + (p.x - prev.x), y: v.y + (p.y - prev.y) });
    } else if (mode === 'pinch' && pts.size >= 2) {
      const s = pinchState();
      const z = zoomAt(v, s.mx, s.my, s.dist / pinch.dist);
      apply({ ...z, x: z.x + (s.mx - pinch.mx), y: z.y + (s.my - pinch.my) });
      pinch = s;
    }
  }, { capture: true });

  const end = (e: PointerEvent) => {
    if (!pts.delete(e.pointerId)) return;
    if (mode === 'pan' && pts.size === 0 && !panMoved && e.type === 'pointerup') for (const fn of tapFns) fn();
    if (pts.size === 0 || mode === 'pinch') mode = 'none'; // don't resume panning with the leftover finger
  };
  el.addEventListener('pointerup', end, { capture: true });
  el.addEventListener('pointercancel', end, { capture: true });

  el.addEventListener('wheel', e => {
    e.preventDefault();
    const p = local(e.clientX, e.clientY);
    if (e.ctrlKey || e.metaKey) apply(zoomAt(v, p.x, p.y, Math.exp(-e.deltaY * 0.01)));
    else apply({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
  }, { passive: false });

  el.addEventListener('contextmenu', e => e.preventDefault()); // no long-press callout on the board

  new ResizeObserver(() => { rect = el.getBoundingClientRect(); apply(v); }).observe(el);

  return {
    el,
    get: () => v,
    set: apply,
    fit() { rect = el.getBoundingClientRect(); apply(fitView(rect.width, rect.height, BOARD_W, BOARD_H)); },
    zoomBy(f) { apply(zoomAt(v, rect.width / 2, rect.height / 2, f)); },
    toWorld(cx, cy) { const p = local(cx, cy); return screenToWorld(v, p.x, p.y); },
    toScreen: (wx, wy) => worldToScreen(v, wx, wy),
    centerWorld: () => screenToWorld(v, rect.width / 2, rect.height / 2),
    pinching: () => mode === 'pinch',
    onChange(fn) { changeFns.add(fn); return () => { changeFns.delete(fn); }; },
    onTap(fn) { tapFns.add(fn); return () => { tapFns.delete(fn); }; },
  };
}
```

- [ ] **Step 4: board.css**

```css
.room { position: relative; overflow: hidden; min-height: 0; }
.viewport { position: absolute; inset: 0; overflow: hidden; touch-action: none; background: radial-gradient(ellipse at 50% 30%, #2a1f17, #0d0a08 70%); }
.world { position: absolute; left: 0; top: 0; width: 4000px; height: 3000px; transform-origin: 0 0; will-change: transform; }
.surface {
  position: absolute; inset: 0; border-radius: 4px;
  /* wooden frame + drop shadow onto the wall */
  box-shadow: 0 0 0 26px #5a3c25, 0 0 0 30px #2a1a10, 0 40px 90px 20px rgba(0, 0, 0, .75);
}
.surface-cork {
  background-color: var(--cork);
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .32 0 0 0 0 .2 0 0 0 0 .09 0 0 0 .6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='900'%3E%3Cfilter id='b'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.012' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .25 0 0 0 0 .15 0 0 0 0 .05 0 0 0 .35 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23b)'/%3E%3C/svg%3E");
  background-size: 300px 300px, 900px 900px;
}
```

- [ ] **Step 5: Verify** — `npm test` PASS; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit** (controller) — `feat(view): viewport pan/pinch/zoom + cork surface`
