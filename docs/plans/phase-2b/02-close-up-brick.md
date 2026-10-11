# Task 2: Close-up brick — wave A (Sonnet)

Report to: `.superpowers/sdd/phase-2b/task-2-report.md`

**Files:**
- Create: `src/view/brickTile.ts`, `src/view/brickTile.test.ts`
- Modify: `src/view/surface.ts`, `src/styles/board.css` (only the `.surface-brick` block), `src/export/backdrop.ts` (`drawBackground` brick branch + signature), `src/export/compose.ts` (preload the tile), `src/export/compose.test.ts`

**Interfaces:**
- Consumes: `rng` from `src/model/random.ts`; `svgDataUrl`, `svgImage` from `src/export/svg-image.ts`.
- Produces: `BRICK`, `BRICK_TILE`, `BRICK_TONES`, `brickTileSvg(seed?)`. `drawBackground(ctx, r, surface, tiles?: { brick?: CanvasImageSource | null })`. `applySurface` sets `--brick-tile` on the surface element.

**Goal:** bricks ≈ 3× bigger (406 × 116 + 14 px mortar, running bond), each with its own tone, a lit top edge, a shadow under the joint, a few chips and fine noise. One tile of 3 bricks × 6 courses = 1260 × 780 px. The same SVG is used on screen and in export.

## Steps

- [ ] **Step 1: Write `src/view/brickTile.test.ts` (failing)**

```ts
import { describe, expect, it } from 'vitest';
import { BRICK, BRICK_TILE, BRICK_TONES, brickTileSvg } from './brickTile';

const hslL = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => v / 255);
  return (Math.max(...c) + Math.min(...c)) / 2;
};

describe('brickTileSvg', () => {
  it('is deterministic', () => expect(brickTileSvg()).toBe(brickTileSvg()));
  it('is one 1260 × 780 tile (3 bricks × 6 courses)', () => {
    expect(BRICK_TILE).toEqual({ w: 1260, h: 780 });
    expect(brickTileSvg()).toContain('width="1260" height="780"');
  });
  it('every brick tone keeps the 35% lighting floor under the basement bulb (×0.82)', () => {
    for (const t of BRICK_TONES) expect(hslL(t) * 0.82).toBeGreaterThanOrEqual(0.35);
  });
  it('offset courses wrap: the brick crossing the right edge is repeated at the left', () => {
    const svg = brickTileSvg();
    const crossX = 2 * (BRICK.w + BRICK.mortar) + (BRICK.w + BRICK.mortar) / 2 + BRICK.mortar / 2; // 1057
    expect(svg).toContain(`translate(${crossX} `);
    expect(svg).toContain(`translate(${crossX - BRICK_TILE.w} `);
  });
  it('contains no user content or external references', () => expect(brickTileSvg()).not.toMatch(/https?:|<script|href=/));
});
```
Run: `npx vitest run src/view/brickTile.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 2: Create `src/view/brickTile.ts`**

```ts
import { rng } from '../model/random';

/** A close-up brick wall: ~3× the old module so a brick is about one and a half photos wide. */
export const BRICK = { w: 406, h: 116, mortar: 14, cols: 3, rows: 6 } as const;
export const BRICK_TILE = { w: (BRICK.w + BRICK.mortar) * BRICK.cols, h: (BRICK.h + BRICK.mortar) * BRICK.rows };
/** All ≥ 43% HSL lightness so the basement bulb's outer overlay (×0.82) stays above the 35% floor. */
export const BRICK_TONES = ['#a35a3f', '#ad6346', '#9e5a42', '#b16a4b', '#a8603f', '#b87455'];
const MORTAR = '#b3a794';

/** One brick drawn at the origin: base tone, lit top arris, shadow into the bed joint, a few chips, a soft patch. */
function brick(tone: string, r: () => number): string {
  const { w, h } = BRICK;
  let s = `<rect width="${w}" height="${h}" rx="3" fill="${tone}"/>`;
  s += `<rect width="${w}" height="3" fill="#fff" fill-opacity=".14"/>`;
  s += `<rect y="${h - 4}" width="${w}" height="4" fill="#000" fill-opacity=".22"/>`;
  const chips = Math.floor(r() * 3);
  for (let i = 0; i < chips; i++) {
    const cx = Math.round(r() * (w - 40)), cw = 10 + Math.round(r() * 22), depth = 6 + Math.round(r() * 6);
    s += r() < 0.5
      ? `<path d="M${cx} 0h${cw}l${-Math.round(cw / 2)} ${depth}z" fill="${MORTAR}" fill-opacity=".9"/>`
      : `<path d="M${cx} ${h}h${cw}l${-Math.round(cw / 2)} ${-depth}z" fill="${MORTAR}" fill-opacity=".9"/>`;
  }
  const px = Math.round(r() * w * 0.6), pw = Math.round(w * 0.3 + r() * w * 0.3);
  s += `<rect x="${px}" y="${Math.round(r() * h * 0.4)}" width="${pw}" height="${Math.round(h * 0.45)}" rx="24" fill="#000" fill-opacity="${(0.03 + r() * 0.05).toFixed(3)}"/>`;
  return s;
}

/** Deterministic seamless tile (static markup, no user content). Offset courses wrap the edge brick to the left. */
export function brickTileSvg(seed = 7): string {
  const r = rng(seed);
  const mw = BRICK.w + BRICK.mortar, mh = BRICK.h + BRICK.mortar, half = BRICK.mortar / 2;
  const out: string[] = [];
  for (let row = 0; row < BRICK.rows; row++) {
    const y = row * mh + half;
    const off = row % 2 ? mw / 2 : 0;
    for (let col = 0; col < BRICK.cols; col++) {
      const x = col * mw + off + half;
      const tone = BRICK_TONES[Math.floor(r() * BRICK_TONES.length)];
      const body = brick(tone, r);
      out.push(`<g transform="translate(${x} ${y})">${body}</g>`);
      if (x + BRICK.w > BRICK_TILE.w) out.push(`<g transform="translate(${x - BRICK_TILE.w} ${y})">${body}</g>`);
    }
  }
  const { w, h } = BRICK_TILE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/>`
    + `<feColorMatrix values="0 0 0 0 .2 0 0 0 0 .1 0 0 0 0 .06 0 0 0 .35 0"/></filter>`
    + `<rect width="${w}" height="${h}" fill="${MORTAR}"/>${out.join('')}`
    + `<rect width="${w}" height="${h}" filter="url(#n)"/></svg>`;
}
```
Run the test. Expected: PASS.

- [ ] **Step 3: Screen — `src/view/surface.ts`**

```ts
import { SURFACES, type SurfaceId } from '../model/types';
import { brickTileSvg } from './brickTile';
import { svgDataUrl } from '../export/svg-image';

let brickUrl: string | null = null;
export function applySurface(el: HTMLElement, id: SurfaceId): void {
  el.className = `surface surface-${id}`;
  el.setAttribute('aria-label', SURFACES[id].name);
  if (id === 'brick') el.style.setProperty('--brick-tile', `url("${(brickUrl ??= svgDataUrl(brickTileSvg()))}")`);
  else el.style.removeProperty('--brick-tile');
}
```

- [ ] **Step 4: Screen — `src/styles/board.css` `.surface-brick` block** (replace the whole block and its comment)

```css
/* Brick: a close-up of the wall — big running-bond bricks (tile from view/brickTile.ts), whitewashed bottom-left */
.surface-brick {
  background-color: #b3a794;
  background-image: radial-gradient(ellipse at 0% 100%, rgba(240, 232, 220, .45), transparent 55%), var(--brick-tile, none);
  background-size: 100% 100%, 1260px 780px;
  background-repeat: no-repeat, repeat;
}
```

- [ ] **Step 5: Export — failing test in `src/export/compose.test.ts`**

Use the file's existing `fakeCtx`/spy patterns. Add:
```ts
it('brick board: draws the tile pattern when the tile decodes, falls back to plain colour when it does not', async () => {
  // case A: pass tiles: { brick: fakeImage } to drawBackground(ctx, rect, 'brick', …) → createPattern called with it
  // case B: drawBackground(ctx, rect, 'brick', { brick: null }) → no createPattern for the tile, fillRect with BASE colour still called, no throw
});
it('composeBoard on a brick board still succeeds when the tile image fails to decode', async () => {
  // vi.mock / spy svgImage to reject → composeBoard resolves to a canvas
});
```
Write the bodies fully. Run: `npx vitest run src/export/compose.test.ts`. Expected: FAIL.

- [ ] **Step 6: Export — `src/export/backdrop.ts`**

1. `BASE.brick = '#b3a794'` (mortar; the tile covers it).
2. The signature becomes `drawBackground(ctx, r, surface, tiles: { brick?: CanvasImageSource | null } = {})`.
3. Replace the old brick line-drawing branch with:
```ts
  if (surface === 'brick') {
    const pat = tiles.brick ? ctx.createPattern(tiles.brick, 'repeat') : null;
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(r.x, r.y, r.w, r.h); }   // pattern anchored at world 0,0 like the CSS tile
    else { ctx.fillStyle = BRICK_TONES[0]; ctx.fillRect(r.x, r.y, r.w, r.h); }  // decode failed: plain brick
    glowWhitewash(ctx, r);
  }
```
   `paint()` has already applied `scale` + `translate(-r.x, -r.y)`, so world coordinates are the canvas coordinates and the pattern lines up with the screen.
4. Add `glowWhitewash`: a radial gradient from the world point (0, 3000), radius ≈ 0.55 × the board diagonal, from `rgba(240,232,220,.45)` to transparent. This matches the CSS `ellipse at 0% 100%`. Reuse the existing `glow` helper: `glow(ctx, r, 0, 3000, 4000 * 0.55 * 1.414, 3000 * 0.55 * 1.414, [[0, 'rgba(240,232,220,.45)'], [1, 'rgba(240,232,220,0)']])`. The constants are in world px because the board is 4000 × 3000.
5. Skip the generic noise tile for brick (the SVG already carries noise).

- [ ] **Step 7: Export — `src/export/compose.ts`**

Before `drawBackground`, preload only for brick boards:
```ts
  const brick = b.surface === 'brick' ? await svgImage(brickTileSvg()).catch(() => null) : null;
  if (o.background || o.scope.kind !== 'item') drawBackground(ctx, r, b.surface, { brick });
```
Run: `npx vitest run src/export src/view/brickTile.test.ts`. Expected: PASS.

- [ ] **Step 8: Look at it**

Start `npx vite --host 127.0.0.1 --port 5175`. Open a Basement case: a photo should be about one and a half bricks wide, with no visible tile seams. Export the whole board and compare. Stop the server.

- [ ] **Step 9: Verify**

`npm test`, `npx tsc --noEmit`, `npm run build`. In the report, include the lighting-floor arithmetic for the darkest tone under the bulb's outer overlay: `L·0.82 + 0.0216·0.18`.
