# Task 3: Acrylic precinct panel — wave B (Sonnet, after T1 + T2 are committed)

Report to: `.superpowers/sdd/phase-2b/task-3-report.md`

**Files:**
- Modify: `src/styles/board.css` (only the glass block and its comment), `src/view/surface.ts`, `src/styles/items.css` (append at end), `src/styles/content.css` (append at end), `src/export/backdrop.ts` (glass branch + `BASE.glass`)
- Test: `src/view/surface.test.ts` (new), `src/export/compose.test.ts` (one test)

**Interfaces:**
- Consumes (T1, already committed): `SURFACES.glass = { name: 'Acrylic panel', fasteners: ['tape', 'magnet'], material: 'marker' }`. Consumes (T2): `applySurface` with the `--brick-tile` logic, and the `drawBackground(ctx, r, surface, tiles)` signature with its `glow` helper.
- Produces: `#world[data-surface="<id>"]`, set by `applySurface` on the surface's parent.

**Goal:** the precinct board is a clear perspex sheet on 4 chrome standoffs, with a dim, out-of-focus squad room behind it:
- blurred ceiling strips
- bokeh dots
- desk and partition bands

It also has diagonal reflections and a faint cyan-green cut edge. Items cast larger, softer, further shadows because the wall is far behind.

## Steps

- [ ] **Step 1: Failing test `src/view/surface.test.ts`** (jsdom)

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applySurface } from './surface';

describe('applySurface', () => {
  const setup = () => { const world = document.createElement('div'); const s = document.createElement('div'); world.append(s); return { world, s }; };
  it('marks the world with the surface so item shadows can adapt', () => {
    const { world, s } = setup();
    applySurface(s, 'glass');
    expect(world.dataset.surface).toBe('glass');
    expect(s.getAttribute('aria-label')).toBe('Acrylic panel');
    applySurface(s, 'cork');
    expect(world.dataset.surface).toBe('cork');
  });
  it('sets the brick tile only on brick', () => {
    const { s } = setup();
    applySurface(s, 'brick');
    expect(s.style.getPropertyValue('--brick-tile')).toMatch(/^url\("data:image\/svg\+xml/);
    applySurface(s, 'glass');
    expect(s.style.getPropertyValue('--brick-tile')).toBe('');
  });
});
```
Run: `npx vitest run src/view/surface.test.ts`. Expected: the first test FAILS.

- [ ] **Step 2: `src/view/surface.ts`** — add one line at the end of `applySurface`:
```ts
  if (el.parentElement) el.parentElement.dataset.surface = id;
```
Run the test. Expected: PASS.

- [ ] **Step 3: Replace the glass block in `src/styles/board.css`**

```css
/* Acrylic: clear perspex panel on chrome standoffs; the squad room is out of focus behind it.
   Room base stays ≥ ~40% lightness so the fluorescent overlay (−22% at the bottom) keeps the 35% floor. */
.surface-glass {
  --bolt: radial-gradient(circle, #f4f6f7 0 5px, #b9c1c6 7px, #6b747b 14px, rgba(0, 0, 0, .35) 17px, transparent 20px);
  box-shadow: inset 0 0 0 2px rgba(190, 255, 240, .35), inset 0 0 26px rgba(160, 240, 230, .16), 0 30px 80px rgba(0, 0, 0, .5);
  background-color: #6a7682;
  background-image:
    var(--bolt), var(--bolt), var(--bolt), var(--bolt),
    linear-gradient(115deg, transparent 0 18%, rgba(255, 255, 255, .10) 18% 24%, transparent 24% 58%, rgba(255, 255, 255, .06) 58% 61%, transparent 61%),
    radial-gradient(ellipse 640px 70px at 22% 6%, rgba(235, 245, 255, .5), transparent 70%),
    radial-gradient(ellipse 640px 70px at 70% 4%, rgba(235, 245, 255, .4), transparent 70%),
    radial-gradient(circle 80px at 14% 58%, rgba(255, 200, 120, .26), transparent 70%),
    radial-gradient(circle 55px at 36% 66%, rgba(140, 220, 255, .22), transparent 70%),
    radial-gradient(circle 100px at 63% 60%, rgba(140, 200, 255, .2), transparent 70%),
    radial-gradient(circle 65px at 86% 70%, rgba(255, 210, 140, .22), transparent 70%),
    radial-gradient(circle 45px at 48% 52%, rgba(160, 255, 200, .16), transparent 70%),
    linear-gradient(180deg, transparent 0 62%, rgba(24, 30, 36, .18) 62% 64%, rgba(40, 48, 56, .12) 64% 78%, rgba(24, 30, 36, .18) 78% 80%, rgba(34, 40, 48, .1) 80%),
    linear-gradient(180deg, #7d8996 0%, #717d89 40%, #6a7682 100%);
  background-size: 40px 40px, 40px 40px, 40px 40px, 40px 40px, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%;
  background-position: 40px 40px, calc(100% - 40px) 40px, 40px calc(100% - 40px), calc(100% - 40px) calc(100% - 40px), 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0;
  background-repeat: no-repeat;
}
```
Lighting floor: `#6a7682` → L = (106+130)/2/255 = 0.463. Under the fluorescent bottom overlay `rgba(8,10,14,.22)`: 0.463·0.78 + 0.04·0.22 ≈ 0.37. The thin desk bands (≤ 0.18) are excluded like noise. Recompute in the report if you change any value.

- [ ] **Step 4: Far shadows** — append to `src/styles/items.css`:
```css
/* Acrylic panel: the wall is far behind the sheet, so shadows land further away and softer. */
.world[data-surface="glass"] .item-body { box-shadow: 0 1px 2px rgba(0, 0, 0, .3), calc(var(--sx, 1) * 18px) calc(var(--sy, 1) * 34px) 40px -6px rgba(0, 0, 0, .45); }
.world[data-surface="glass"] .item.lifted .item-body { box-shadow: 0 2px 4px rgba(0, 0, 0, .3), calc(var(--sx, 1) * 26px) calc(var(--sy, 1) * 48px) 56px -8px rgba(0, 0, 0, .45); }
```
Append to `src/styles/content.css`:
```css
.world[data-surface="glass"] :is(.item-newspaper, .item-receipt) .item-body { box-shadow: none;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .3)) drop-shadow(calc(var(--sx, 1) * 18px) calc(var(--sy, 1) * 34px) 18px rgba(0, 0, 0, .4)); }
.world[data-surface="glass"] .item-object .item-body { box-shadow: none; }
```
Check in the browser (Step 7) that the Move-mode hot glow (`#world[data-mode="move"] .item.hot .item-body`, id selector) still wins.

- [ ] **Step 5: Export test** in `src/export/compose.test.ts`:
```ts
it('acrylic board draws the room, bokeh, sheen and four bolts', () => {
  // drawBackground(fakeCtx(calls), { x: 0, y: 0, w: 4000, h: 3000 }, 'glass') →
  // expect ≥ 1 createLinearGradient (room), ≥ 5 createRadialGradient (bokeh/strips/bolts), and arc called ≥ 4 times (bolts)
});
```
Write the body fully. Run: expected FAIL.

- [ ] **Step 6: `src/export/backdrop.ts` glass branch**

- Set `BASE.glass = '#6a7682'`.
- In `drawBackground`, add `else if (surface === 'glass') drawAcrylic(ctx, r);` and skip the generic noise tile for glass.
- Implement `drawAcrylic` in world coordinates (board 4000 × 3000), mirroring the CSS layers in the same order from bottom to top:
  1. vertical room gradient `#7d8996 → #717d89 (40%) → #6a7682`
  2. desk bands as `fillRect`s at 62–64% (`rgba(24,30,36,.18)`), 64–78% (`rgba(40,48,56,.12)`), 78–80% (`.18`) and 80–100% (`rgba(34,40,48,.1)`) of 3000
  3. the 5 bokeh circles via the existing `glow` helper (centre % → world px, radius as given)
  4. the 2 ceiling strips via `glow` with rx 640, ry 70
  5. the two 115° sheen bands as rotated rects or a linear gradient along the 115° direction
  6. the cut edge: `strokeRect` inset by 1 px, `rgba(190,255,240,.35)`, lineWidth 2
  7. bolts at (60,60), (3940,60), (60,2940) and (3940,2940): a radial gradient `#f4f6f7 → #b9c1c6 → #6b747b` with radius 14, plus a soft shadow ring of radius 20 (`arc` + `fill`)

  Clip to `r` as the existing branches do. Run the export tests. Expected: PASS.

- [ ] **Step 7: Look at it**

Run `npx vite --host 127.0.0.1 --port 5175` and open a new Precinct case. Add a photo, a sticky note, a newspaper clipping and an object. Check these:
- The board reads as clear plastic in front of a blurred room.
- New items default to tape.
- Shadows look far and soft.
- Strings (marker) are readable.
- The board export matches the screen.
- At 390 px width it looks fine.

Stop the server.

- [ ] **Step 8: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build`. Report with the lightness arithmetic.
