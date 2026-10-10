# Task 2: Surfaces & fasteners (Sonnet) — wave B

Read `00-overview.md`. Depends on T1. Wave B runs in parallel: touch ONLY the files below.

**Files:**
- Create: `src/model/surfaces.ts`, `src/model/surfaces.test.ts`, `src/view/surface.ts`
- Modify: `src/styles/board.css` (surface classes), `src/styles/items.css` (nail fastener + shadow vars ONLY — no other rules)

**Interfaces:**
- Consumes: `SurfaceId`, `FastenerId`, `SURFACES` (T1).
- Produces: `pickFastener(surface: SurfaceId, last: FastenerId): FastenerId`; `applySurface(el: HTMLElement, id: SurfaceId): void`; CSS classes `.surface-{cork,glass,brick,wood,archive}`; `.pin[data-kind=nail]`; item shadows read `--sx`/`--sy` (set by T4 on `#app`).

- [ ] **Step 1: Failing test** — `src/model/surfaces.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { pickFastener } from './surfaces';
describe('pickFastener', () => {
  it('keeps the last fastener when the surface allows it', () => expect(pickFastener('brick', 'nail')).toBe('nail'));
  it("falls back to the surface's first fastener", () => expect(pickFastener('glass', 'pin')).toBe('magnet'));
  it('cork allows tack', () => expect(pickFastener('cork', 'tack')).toBe('tack'));
});
```
Run: `npx vitest run src/model/surfaces.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 2: Implement**

```ts
// src/model/surfaces.ts
import { SURFACES, type FastenerId, type SurfaceId } from './types';
export function pickFastener(surface: SurfaceId, last: FastenerId): FastenerId {
  const ok = SURFACES[surface].fasteners;
  return ok.includes(last) ? last : ok[0];
}
// src/view/surface.ts
import { SURFACES, type SurfaceId } from '../model/types';
export function applySurface(el: HTMLElement, id: SurfaceId): void {
  el.className = `surface surface-${id}`;
  el.setAttribute('aria-label', SURFACES[id].name);
}
```
Run the test — Expected: PASS.

- [ ] **Step 3: Surface textures** — `src/styles/board.css`

Keep `.surface` and `.surface-cork` exactly. Add four classes using only gradients and inline SVG `feTurbulence` data URIs (same technique as cork — no image files). Each must keep ≥ 35% lightness under the default lamp and keep text on items readable:
- `.surface-glass` — pale blue-grey glass `#cfd8dc` with a subtle diagonal sheen (`linear-gradient(115deg, rgba(255,255,255,.35) 0 8%, transparent 8% 30%, rgba(255,255,255,.15) 30% 34%, transparent 34%)`), faint ghost marker smudges (low-frequency noise at 6% opacity), aluminium frame: override the frame shadow colours to `#9aa3a8 / #5f676b`.
- `.surface-brick` — brick pattern: `repeating-linear-gradient` mortar lines (horizontal every 70px, vertical offset per course via two layered backgrounds of 280px×140px) over `#8a4b37` with noise; whitewashed bottom-left fade so it isn't too dark.
- `.surface-wood` — vertical panels `#6b4a2f`/`#5c3f27` alternating every 400px with groove lines and fine grain noise (high `baseFrequency` in x only: `baseFrequency='.004 .25'`).
- `.surface-archive` — same structure as cork but desaturated sepia (`--cork` replaced by `#b49a73`, noise tinted brown-grey), plus a faint water-stain radial gradient.

- [ ] **Step 4: Nail fastener + light-aware shadows** — `src/styles/items.css`

Add after `.pin[data-kind=clip]::after`:
```css
.pin[data-kind=nail]::before {
  width: 14px; height: 14px; margin: -7px 0 0 -7px;
  background: radial-gradient(circle at 35% 30%, #f2f2f2 0 2px, #9ea3a8 3px, #5d6266 70%);
  box-shadow: calc(var(--sx, 1) * 2px) calc(var(--sy, 1) * 4px) 3px rgba(0, 0, 0, .55);
}
```
(Nails are always steel; they ignore `--pin`.) Then change the hard-coded drop-shadow offsets in `.item-body`'s `box-shadow` (the ones like `6px 14px 22px -6px`) and the pin `box-shadow`s to multiply by the vars, e.g. `calc(var(--sx, 1) * 6px) calc(var(--sy, 1) * 14px) 22px -6px rgba(0,0,0,.55)`. Defaults `1` keep today's look exactly. Also update the Move-mode hot rule (`#world[data-mode="move"] .item.hot .item-body`) the same way.

- [ ] **Step 5: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build`. In the report, include a note of how each surface looks if you can run `npx vite --host 127.0.0.1 --port 5175` and toggle `#surface`'s class in devtools; otherwise say it's unchecked.

Report: `.superpowers/sdd/phase-2-3/task-2-report.md`.
