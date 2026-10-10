# Task 3: String materials, thickness, arrows & labels (Sonnet) — wave B

Read `00-overview.md`. Depends on T1. Touch ONLY the files below.

**Files:**
- Create: `src/view/linePaths.ts`, `src/view/linePaths.test.ts`, `src/view/strings.test.ts` (jsdom)
- Modify: `src/view/strings.ts`, `src/styles/strings.css`

**Interfaces:**
- Consumes: `Link.material`, `Link.thickness`, `Link.arrow`, `Link.label`, `StringMaterial` (T1); existing `rope.ts` (`createRope`, `stepRope`, `ropePath`, `staticPath`).
- Produces: `markerPath(a: Pt, b: Pt, seed: number): string`; `hashSeed(s: string): number`; `pathMidpoint(p: SVGPathElement): Pt | null`; `arrowHead(tip: Pt, from: Pt, size: number): string` (closed triangle path). `StringsView` API unchanged — it now draws each link by material and shows its label.

## Behaviour
- **yarn** (default, absent): exactly today's rope.
- **twine**: rope physics with half the sag (`effective tension = link.tension * 0.5`), thinner (`stroke-width: 2.2`), with a fibre texture: `.str-main` gets `stroke-dasharray: 7 1.2` unless the link has its own dashed/dotted pattern. Halo stays.
- **marker**: no rope; drawn straight with a slight hand-drawn bow via `markerPath`, `stroke-width: 4`, `stroke-linecap: round`, no shadow path (it's ink on glass — hide `.str-shadow`), halo at 35% opacity. The tension drag and droop slider have no effect on marker lines (still stored). Reduced motion irrelevant (static).
- **Thickness** (`link.thickness`, default 1): set `--sw: <thickness>` on the link's `<g>`; every stroke width in `strings.css` (`.str-main`, `.str-halo`, `.str-shadow`, material overrides, `.str.hot`/`.selected` halos) becomes `calc(<base> * var(--sw, 1))`. The hit path stays at its constant 28 screen px but never thinner than the visible string: `max(calc(28px * var(--inv-scale, 1)), calc(8px * var(--sw, 1)))`. The live preview line uses the thickness the next string will get (T9 passes it; add an optional `thickness` param to `preview(from, to, color, snapped, thickness = 1)`).
- **Arrows** (`link.arrow`): `'end'` draws a filled arrowhead at the `to` end, `'both'` at both ends, coloured with the link colour, size `14 * thickness` world px, with the halo colour as a 1.5px outline so it reads on any surface. The tip sits on the attach point; direction = from the point at 92% of the path length (8% for the start arrow) to the tip, via `getPointAtLength` (skip in jsdom). Two `<path class="str-arrow">` per entry, hidden when not needed, updated after each `draw()`.
- **Label** (`link.label`, ≤ 80 chars): an SVG `<g class="str-label">` in the visible strings SVG holding a `<rect>` (paper tag, `#f4eedd`, 1px dark stroke, rx 3) and `<text>` (Caveat 22px world, `#22201a`, centred). Text set with `textContent` only. Positioned at `pathMidpoint(main)` after each draw (and once after sync for settled/static lines); rect sized from `text.getBBox()` + 8px padding; if `getBBox`/`getPointAtLength` are unavailable (jsdom) skip positioning. Label `pointer-events: none`. Removed when the label is cleared or the link is removed.

- [ ] **Step 1: Failing tests** — `src/view/linePaths.test.ts`

```ts
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
```
Run: `npx vitest run src/view/linePaths.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement** — `src/view/linePaths.ts`

```ts
type Pt = { x: number; y: number };
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const f1 = (v: number) => Math.round(v * 10) / 10;
/** Straight-ish ink line: one quadratic with a small seeded bow (≤ 6px visible) and a seeded control-point slide. */
export function markerPath(a: Pt, b: Pt, seed: number): string {
  const r1 = ((seed * 9301 + 49297) % 233280) / 233280;
  const r2 = ((seed * 4096 + 150889) % 714025) / 714025;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const t = 0.35 + r1 * 0.3, bow = (r2 * 2 - 1) * 12; // control offset 12 ⇒ visible bow 6
  const cx = a.x + dx * t + nx * bow, cy = a.y + dy * t + ny * bow;
  return `M${f1(a.x)} ${f1(a.y)} Q${f1(cx)} ${f1(cy)} ${f1(b.x)} ${f1(b.y)}`;
}
/** Triangle with its tip at `tip`, pointing away from `from`; half-width = size * 0.45. */
export function arrowHead(tip: Pt, from: Pt, size: number): string {
  const dx = tip.x - from.x, dy = tip.y - from.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, bx = tip.x - ux * size, by = tip.y - uy * size, hw = size * 0.45;
  return `M${f1(tip.x)} ${f1(tip.y)} L${f1(bx - uy * hw)} ${f1(by + ux * hw)} L${f1(bx + uy * hw)} ${f1(by - ux * hw)} Z`;
}
export function pathMidpoint(p: SVGPathElement): Pt | null {
  if (typeof p.getTotalLength !== 'function') return null;
  try { const L = p.getTotalLength(); if (!L) return null; const m = p.getPointAtLength(L / 2); return { x: m.x, y: m.y }; } catch { return null; }
}
```
Run — Expected: PASS.

- [ ] **Step 3: Failing jsdom test** — `src/view/strings.test.ts` (first line `// @vitest-environment jsdom`)

Build two `<svg>`s, `createStrings(svg, hitSvg, { reducedMotion: () => true, scale: () => 1, onSelect() {}, erasing: () => false, onErase() {}, onTensionCommit() {} })`, `sync` a board with two items and one link `{ label: '<img src=x onerror=alert(1)>', material: 'marker' }` (use `newBoard`/`makeItem`/`connect`+`updateLink` from actions). Assert:
- `svg.querySelector('.str-label text')!.textContent` equals the label string and `svg.querySelector('img')` is `null`;
- the link's `<g class="str …">` has class `mat-marker`;
- with `thickness: 2.4` the `<g>` has `style` `--sw: 2.4`; with `arrow: 'both'` there are two visible `.str-arrow` paths, with `'end'` one, with none zero visible;
- after `sync` with the label removed (`updateLink(b, id, { label: undefined })`), `.str-label` is gone;
- after `sync` with the link removed, no `.str` remains.
Run — Expected: FAIL.

- [ ] **Step 4: Implement in `strings.ts`**

- In `style(e)`: toggle classes `mat-yarn|mat-twine|mat-marker` on `e.g`; keep the per-link dash handling but for twine with solid style use `'7 1.2'`.
- In `tick()`: per entry, `if (material === 'marker') { draw(e, markerPath(a, b, hashSeed(e.link.id))); e.awake = false; continue; }`; for twine pass `e.tension * 0.5` to `stepRope`/`staticPath`.
- Tension drag (`hitSvg` pointermove): ignore when the dragged link's material is `marker` (a tap still selects/erases).
- Thickness: set `--sw` in `style(e)`. Arrows: create the two `.str-arrow` paths with the entry; toggle `hidden` from `link.arrow`; set `fill` to the link colour; reposition after each `draw()` using `arrowHead`.
- Labels: on sync create/update/remove the `.str-label` group per entry; after `draw()` reposition it via `pathMidpoint(e.main)`.
- `strings.css`: `.mat-twine .str-main { stroke-width: 2.2; }` `.mat-marker .str-main { stroke-width: 4; }` `.mat-marker .str-shadow { display: none; }` `.mat-marker .str-halo { opacity: .35; }` `.str-arrow { stroke: rgba(12,8,4,.6); stroke-width: 1.5; paint-order: stroke; pointer-events: none; }` `.str-label { pointer-events: none; }` `.str-label rect { fill: #f4eedd; stroke: rgba(0,0,0,.45); stroke-width: 1; }` `.str-label text { font: 22px var(--font-hand); fill: #22201a; text-anchor: middle; dominant-baseline: central; }`.

Run all tests — Expected: PASS. Then `npx tsc --noEmit`, `npm run build`.

Report: `.superpowers/sdd/phase-2-3/task-3-report.md`.
