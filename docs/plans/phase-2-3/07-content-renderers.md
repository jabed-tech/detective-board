# Task 7: Content renderers — paperwork, sketch, stamps, objects, aged, crossed (Sonnet) — wave B

Read `00-overview.md` (Global Constraints: **never user text in `innerHTML`**; font rules). Depends on T1. Touch ONLY the files below.

**Files:**
- Create: `src/view/art.ts`, `src/styles/content.css`
- Modify: `src/view/renderers.ts`, `src/view/renderers.test.ts`

**Interfaces:**
- Consumes: all T1 types; `formatMoney`/`receiptTotal` are in T6 (parallel) — **do not import them**; use a local `money(p) = '£' + (p / 100).toFixed(2)` and a local sum (T10 may later dedupe).
- Produces: `renderItemContent(body, it)` and `itemLabel(it)` handle all 11 types; `objectSvg(id: ObjectId): string`, `stampSvg(id: 'red-x' | 'coffee-ring'): string` (static markup, no parameters reach the markup). `renderers.ts` imports `'../styles/content.css'` itself.
- Contract with `items.ts` (unchanged): photos are `<img class="it-img">` elements (items.ts fills `src` from `data.imageId`); the element that holds the main free text has class `it-text` (Task 21's `fitHeight` measures it); fonts scale with `var(--k)` (card size) and text with `var(--tk)` (card × text size).

## Rendering per type (classes are the contract with `content.css`)
- **Every type:** after the content, if `data.aged` append `<div class="aged-overlay">`; if `data.crossed` append `<div class="cross-overlay">` containing `stampSvg('red-x')`. Both `pointer-events:none`, absolutely covering the body.
- **mugshot:** `.mug-chart` (height-chart background: horizontal rules every 10% with static labels 4'–7' as `<span>`s), `.mug-photo` holding `<img class="it-img">` if `imageId`, else `.pol-silhouette`; `.mug-board` placard with `.mug-name` (`name`) and `.mug-no` (`bookingNo`). Photo `filter: grayscale(1) contrast(1.15)` (a filter on one `<img>` is fine — the rule bans it on the whole world) + `.mug-grain` noise overlay.
- **newspaper:** `.np-masthead` (`masthead`, Playfair Display 700, ≥ 18px at k=1), `.np-date` (`date`, Courier Prime 13px — UI font is fine small), `.np-headline` (`headline`, Playfair 900, 30px×tk), `.np-body.it-text` (`text`, Courier Prime 15px×tk, two CSS columns, `flex:1; min-height:0; overflow:hidden`). Off-white `#efe9da` paper, torn top/bottom edges via `clip-path` polygon.
- **receipt:** `.rc-store` (centred caps), `.rc-time`, `<ul class="rc-lines">` one `<li>` per line: `<span class="rc-name">` + `<span class="rc-price">` (`money(price)`), dashed rule, `.rc-total` "TOTAL" + money(sum). Courier Prime 15px×tk, `#fbfbf6`, zig-zag bottom edge via `clip-path`.
- **casefile:** manila `#d9b77a` folder with a tab reading "CASE FILE" (Special Elite 20px — static), rows `.cf-row` with `<b>` label (static: Subject, Officer, Status, Date) + `<span>` value; `.cf-notes.it-text` (`text`) in Courier Prime 15px×tk; status also shown as an angled red `.cf-status` rubber stamp (Special Elite ≥ 18px, `text-transform: uppercase`).
- **sketch:** `<svg class="sk" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">` created with `createElementNS`; one `<path>` per stroke via `setAttribute('d', s.d)` and `setAttribute('fill', s.color)` (strokes are perfect-freehand outlines — filled, no stroke). Paper `#fdfcf7` with faint blue rules. Empty strokes ⇒ just the paper.
- **stamp:** `.stamp.stamp-{id}`. `classified` / `evidence` / `case-closed`: `<span class="stamp-text">` with the static `STAMPS` label, Special Elite, red `#b3261e` double border, rotated −6°, `mix-blend-mode: multiply`, ink texture via a noise `mask-image`. `question`: big red "?" (Special Elite 120px×k). `red-x`, `coffee-ring`: `stampSvg(id)`. No paper background (transparent body, no drop shadow): `.item-stamp .item-body { background: none; box-shadow: none; }`.
- **object:** `.obj-art` containing `objectSvg(id)`; if `caption`, a `.obj-tag` evidence tag (Caveat 22px×tk) hanging off the bottom-right. Transparent body, drop shadow via `filter: drop-shadow(...)` on `.obj-art svg` using `--sx/--sy`.

`objectSvg` art (simple, readable at 150px, flat colours + one highlight, `viewBox="0 0 100 100"`): keys (ring + two keys), matchbook (open cover, three matches), cassette (shell, two reels, label strip), casing (brass cylinder + rim), evidence-bag (clear bag with red "EVIDENCE" strip — static text), ticket (stub with perforation and "ADMIT ONE"), burner-phone (flip phone, tiny screen). `stampSvg('red-x')`: two rough brush strokes `#c0392b` opacity .85 corner to corner; `coffee-ring`: brown `#6b4423` ring opacity .35 with uneven width.

**itemLabel:** `Mugshot: <name>`, `Newspaper: <headline>`, `Receipt: <store>`, `Case file: <subject>`, `Sketch`, `Stamp: <STAMPS label>`, `<OBJECTS name>` (+ `: <caption>` if any). Apply the existing 60-char trim and whitespace collapse.

- [ ] **Step 1: Failing tests** — `src/view/renderers.test.ts` (extend; keep existing tests)

```ts
const EVIL = '<img src=x onerror=alert(1)>';
const evilData = { name: EVIL, bookingNo: EVIL, masthead: EVIL, date: EVIL, headline: EVIL, text: EVIL,
  store: EVIL, time: EVIL, lines: [{ name: EVIL, price: 199 }], subject: EVIL, officer: EVIL, status: EVIL, caption: EVIL };
for (const type of ['mugshot', 'newspaper', 'receipt', 'casefile', 'object'] as const) {
  it(`${type}: user text is literal`, () => {
    const body = document.createElement('div');
    renderItemContent(body, { ...makeItem(type, 0, 0), data: { ...evilData, object: 'keys' } });
    expect(body.querySelector('img[src="x"]')).toBeNull();
    expect(body.textContent).toContain(EVIL);
  });
}
```
Plus:
- receipt `lines: [{name:'Tea', price: 120}, {name:'Rope', price: 799}]` → two `li`, `.rc-total` text contains `£9.19`;
- sketch with 2 strokes → `svg.sk path` count 2 and the first path's `d`/`fill` attributes equal the data; with no strokes → `svg.sk` present, 0 paths;
- stamp `case-closed` → `.stamp-text` text `CASE CLOSED`; stamp `red-x` → contains an `svg`;
- object for each of the 7 ids → `.obj-art svg` present;
- `aged: true` → `.aged-overlay` present; `crossed: true` → `.cross-overlay svg` present; neither → both absent;
- mugshot without image → `.pol-silhouette`, with `imageId` → `img.it-img`;
- newspaper and casefile each contain exactly one `.it-text`;
- `itemLabel` for mugshot `{ name: 'Gary' }` → `Mugshot: Gary`; stamp `classified` → `Stamp: CLASSIFIED`; object `keys` with caption `Found in sink` → `Keys: Found in sink`.

Run: `npx vitest run src/view/renderers.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement** `art.ts`, the renderer cases, and `content.css` (all sizes in `calc(<px> * var(--k, 1))`, body text in `var(--tk, 1)`; Special Elite/Playfair never below 18px at k=1; aged overlay = `linear-gradient` sepia multiply `rgba(160,120,60,.22)` + 3–4 `radial-gradient` foxing spots + darker edges; no `filter` on the body).

Run all tests — PASS. Then `npx tsc --noEmit`, `npm run build`. If you can, run `npx vite --host 127.0.0.1 --port 5175` and add one of each type in the console to eyeball them; report what you saw or say unchecked.

Report: `.superpowers/sdd/phase-2-3/task-7-report.md`.
