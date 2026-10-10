# Task 11: Export compositor — board, strings, core items (Sonnet) — wave C (parallel with T9)

User request 2026-10-10: "an export button (to image formats and PDF — allowing the whole board or elements)". Spec §2 Persistence: "PNG export: own compositor redraws model to `<canvas>` with mood baked in" (pulled forward from phase 4). Why a compositor and not DOM screenshotting: Safari taints canvases that draw SVG `foreignObject`, which would break export on iPhones.

Read `00-overview.md`. Depends on T1, T3 (`linePaths.ts`), T7 (`art.ts`). Touch ONLY new files under `src/export/`.

**Files:**
- Create: `src/export/region.ts`, `src/export/region.test.ts`, `src/export/compose.ts`, `src/export/draw-core.ts`, `src/export/text.ts`, `src/export/text.test.ts`, `src/export/registry.ts`

**Interfaces:**
- Consumes: `Board`, `Item`, `Link`, `SURFACES`, `MOODS`, `pinPoint`/`anchorPoint` (geometry), `staticPath`/`restLength` (rope), `markerPath`/`hashSeed`/`arrowHead` (T3), `objectSvg`/`stampSvg` (T7).
- Produces:
```ts
// region.ts (pure)
export interface Rect { x: number; y: number; w: number; h: number }
export type Scope = { kind: 'board' } | { kind: 'view'; rect: Rect } | { kind: 'item'; id: string };
export function regionFor(b: Board, scope: Scope, margin?: number): Rect | null;   // item: rotated bounding box + margin (default 24), clamped to the board
export function fitScale(r: Rect, want: number, maxSide?: number, maxPixels?: number): number; // defaults 8192, 16_777_216
// text.ts (pure given a measure fn)
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[];
// registry.ts
export type ItemDrawer = (ctx: CanvasRenderingContext2D, it: Item, img: (id: string) => Promise<CanvasImageSource | null>) => Promise<void>;
export const drawers: Partial<Record<ItemType, ItemDrawer>>;   // T11 registers photo/polaroid/sticky/index; T12 the rest
// compose.ts
export interface ComposeOpts { scope: Scope; scale: number; mood: boolean; strings: boolean; background: boolean;
  getBlob(id: string): Promise<Blob | undefined> }
export async function composeBoard(b: Board, o: ComposeOpts): Promise<HTMLCanvasElement | null>; // null if scope empty/missing
```

- [ ] **Step 1: Failing tests** — `region.test.ts`, `text.test.ts`
- `regionFor(b, {kind:'board'})` → `{0,0,4000,3000}`; `view` rect is clamped to the board; `item` with rot 0 at (100,100,200×100) → `{76,76,248,148}`; rot 90 → width/height swap around the centre (+ margin); missing id → `null`; item near the edge → clamped to ≥ 0 and ≤ board.
- `fitScale(r, want)` = the largest scale ≤ `want` with `r.w*s * r.h*s ≤ maxPixels` and `max(r.w, r.h)*s ≤ maxSide`. `fitScale({w:4000,h:3000}, 2)` ≈ `1.1824` (√(16 777 216 / 12 000 000)) — assert `4000*s*3000*s <= 16_777_216` and `s > 1.18`; `fitScale({w:300,h:200}, 2)` → `2`; `fitScale({w:9000,h:100}, 1)` → `8192/9000`.
- `wrapLines('aa bb cc', 5, s => s.length)` → `['aa bb', 'cc']`; explicit `\n` breaks are kept; a single word longer than `maxWidth` is hard-broken; empty string → `['']`.
Run — FAIL; implement; run — PASS.

- [ ] **Step 2: Compose pipeline** — `compose.ts`

1. `r = regionFor(...)`; `null` ⇒ return `null`. Canvas `w = round(r.w * scale)`, `h = round(r.h * scale)`; `ctx.scale(scale, scale); ctx.translate(-r.x, -r.y)`.
2. `await document.fonts.ready` and `document.fonts.load()` for each font the drawers use (`22px Caveat`, `26px Caveat`, `18px "Courier Prime"`, `20px "Special Elite"`, `30px "Playfair Display"`, plus `"Patrick Hand"` when `html.neat-hand`).
3. **Background** (if `background`, or always for `board`/`view`): surface base colour per `SURFACES` id (cork `#b98a5a`, glass `#cfd8dc`, brick `#8a4b37`, wood `#6b4a2f`, archive `#b49a73`) + a 256×256 noise tile (`ImageData` of seeded random greys at alpha 10–30) as a repeating `createPattern`; brick mortar lines and wood panel lines drawn with simple strokes. For `board` scope also the wooden frame isn't drawn (the board edge is the image edge).
4. **Strings** (if `strings`; for `item` scope only links whose both ends are inside the region): path `d` = `markerPath` for marker, else `staticPath(a, b, tension × (twine ? 0.5 : 1))` from `rope.ts` (the settled shape — no physics). Draw with `new Path2D(d)`: shadow (offset by `--sx/--sy` table from T4, `rgba(0,0,0,.28)`, width 4×thickness; skipped for marker), halo `rgba(12,8,4,.6)` width 6×t, main = link colour width 3×t (twine 2.2×t, marker 4×t), `setLineDash` for dashed `[14,8]`/dotted `[1,8]`/twine `[7,1.2]`, round caps. Arrowheads via `arrowHead` + `Path2D`. Labels: tag rect + Caveat 22px text at the path midpoint (compute midpoint with a temporary off-DOM `SVGPathElement.getPointAtLength`).
5. **Items** sorted by `z`: for each, `ctx.save(); translate(centre); rotate(rot°); translate(-w/2, -h/2)`; drop shadow (`shadowColor rgba(0,0,0,.45)`, `shadowBlur 18`, offsets 6×sx / 14×sy) for paper types; call `drawers[type]`; if `aged`/`crossed` draw the overlays (aged: sepia `rgba(160,120,60,.22)` fill with `globalCompositeOperation='multiply'` + 3 foxing radial spots; crossed: `stampSvg('red-x')` image scaled to the item); restore. Unknown types (no drawer yet) draw a plain card and continue.
6. **Pins/fasteners** at `pinPoint(it)` (skip stamps): draw per `attach` kind with simple circles/rects coloured by `attachColor` (nail = steel grey).
7. **Mood** (if `mood`): light pool radial gradient per `MOODS[mood].light` matching `mood.css` colours/alphas, warm/sepia multiply tint, vignette; centred on the region centre. No animated effects; blinds drawn as static bands at ≤ 6% if the mood has `blinds`.
8. Images: `img(id)` = `getBlob` → `createImageBitmap` (cached per export); missing ⇒ `null` ⇒ drawers draw the empty/silhouette state.

- [ ] **Step 3: Core drawers** — `draw-core.ts` (registers into `drawers`)

Match `items.css` looks at k = w / default width:
- **photo**: white 8px border card, image `cover`-fitted, `null` ⇒ `#222` fill.
- **polaroid**: `#fbf8ef` card, window `14k` inset `226k` tall with image cover-fit or silhouette (two `#3a352f` shapes like the CSS) and the "?" when `unknown`; caption Caveat `26 × k × textScale` px, `#1d2a5c`, centred, wrapped with `wrapLines`.
- **sticky**: yellow gradient `#f9e98f→#f3dc6b`, text Caveat `26 × k × textScale`, line height 1.15, padding 26k/16k/12k, clipped to the card.
- **index**: `#fbfaf4` with the blue ruled lines + red margin line from the CSS, Courier Prime `18 × k × ts` / line `28 × k × ts`.
Honour `neat-hand` (Patrick Hand instead of Caveat).

- [ ] **Step 4: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build`. Manual check if you can (port 5175): in the console, `composeBoard(store board, {...})` → `canvas.toDataURL()` opened in a new tab; describe what you saw or say unchecked. Report `.superpowers/sdd/phase-2-3/task-11-report.md`.
