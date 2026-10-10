# Task 1: Foundation — types, tables, import validation, prefs, deps (Sonnet)

Read `00-overview.md` (Global Constraints + Shared interfaces). Read each file before editing. This task lands every shared type so wave B can run in parallel; it adds **no** UI.

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm), `src/styles/fonts.ts`
- Create: `src/model/random.ts`, `src/model/random.test.ts`
- Modify: `src/model/types.ts`, `src/model/actions.ts`, `src/model/actions.test.ts`
- Modify: `src/storage/transfer.ts`, `src/storage/transfer.test.ts`
- Modify: `src/prefs.ts`, `src/prefs.test.ts`
- Modify (compile-fix only): `src/view/renderers.ts` (`NAMES` entries), `src/ui/drawer.ts` (`TYPE_NAMES` entries) — add a name per new item type, nothing else.

**Interfaces:** Produces everything in the overview's "Shared interfaces" for `model/types.ts`, `actions.connect`, and `prefs.ts`.

- [ ] **Step 1: Install the two dependencies**

Run: `npm install perfect-freehand @fontsource/playfair-display`
Then add to `src/styles/fonts.ts`: `import '@fontsource/playfair-display/700.css';` (and `900.css` if present). Add `--font-news: 'Playfair Display', Georgia, serif;` wherever the other `--font-*` vars are declared (grep `--font-display`).

- [ ] **Step 2: Types and tables** — `src/model/types.ts`

Replace `SurfaceId`, `MoodId`, `FastenerId`, `ItemType`, `ItemData`, `Link`, `Board` per the overview, and add the new types/constants. Values:

```ts
export const FASTENERS: { id: FastenerId; name: string }[] = [
  { id: 'pin', name: 'Push pin' }, { id: 'tack', name: 'Thumbtack' }, { id: 'tape', name: 'Tape' },
  { id: 'magnet', name: 'Magnet' }, { id: 'clip', name: 'Binder clip' }, { id: 'nail', name: 'Nail' },
];
export const MATERIALS: { id: StringMaterial; name: string }[] = [
  { id: 'yarn', name: 'Yarn' }, { id: 'twine', name: 'Twine' }, { id: 'marker', name: 'Marker line' },
];
export const SURFACES: Record<SurfaceId, { name: string; fasteners: FastenerId[]; material: StringMaterial }> = {
  cork:    { name: 'Cork board',      fasteners: ['pin', 'tack'],    material: 'yarn' },
  glass:   { name: 'Precinct glass',  fasteners: ['magnet', 'tape'], material: 'marker' },
  brick:   { name: 'Brick wall',      fasteners: ['tape', 'nail'],   material: 'yarn' },
  wood:    { name: 'Wood panelling',  fasteners: ['tack', 'nail'],   material: 'twine' },
  archive: { name: 'Archive cork',    fasteners: ['pin', 'tack'],    material: 'twine' },
};
export const MOODS: Record<MoodId, { name: string; blurb: string; surface: SurfaceId; light: LightId; effects: EffectId[]; ambience: AmbienceId[] }> = {
  'noir-office': { name: 'Noir Office', blurb: 'Desk lamp, venetian blinds, rain on the glass, a little jazz.', surface: 'cork', light: 'lamp', effects: ['blinds', 'rain', 'flicker'], ambience: ['rain', 'jazz'] },
  precinct: { name: 'Precinct Night Shift', blurb: 'Cold fluorescent tubes, a glass board, sirens far off.', surface: 'glass', light: 'fluorescent', effects: ['flicker'], ambience: ['hum', 'sirens'] },
  basement: { name: 'Basement Obsession', blurb: 'One bare bulb, brick, and a lot of grain.', surface: 'brick', light: 'bulb', effects: ['grain', 'flicker'], ambience: ['hum'] },
  motel: { name: 'Motel Stakeout', blurb: 'Wood panelling lit by a buzzing neon sign.', surface: 'wood', light: 'neon', effects: ['neon', 'grain'], ambience: ['buzz', 'rain'] },
  archive: { name: 'Cold Case Archive', blurb: 'Sepia files, dust in the air, a clock ticking.', surface: 'archive', light: 'sepia', effects: ['dust', 'grain'], ambience: ['tick'] },
};
export const STAMPS: { id: StampId; label: string; w: number; h: number }[] = [
  { id: 'classified', label: 'CLASSIFIED', w: 300, h: 100 }, { id: 'evidence', label: 'EVIDENCE', w: 260, h: 100 },
  { id: 'case-closed', label: 'CASE CLOSED', w: 340, h: 110 }, { id: 'question', label: '?', w: 120, h: 160 },
  { id: 'red-x', label: 'Red X', w: 200, h: 200 }, { id: 'coffee-ring', label: 'Coffee ring', w: 180, h: 180 },
];
export const OBJECTS: { id: ObjectId; name: string; w: number; h: number }[] = [
  { id: 'keys', name: 'Keys', w: 150, h: 120 }, { id: 'matchbook', name: 'Matchbook', w: 110, h: 150 },
  { id: 'cassette', name: 'Cassette tape', w: 200, h: 130 }, { id: 'casing', name: 'Bullet casing', w: 90, h: 140 },
  { id: 'evidence-bag', name: 'Evidence bag', w: 200, h: 240 }, { id: 'ticket', name: 'Ticket stub', w: 200, h: 90 },
  { id: 'burner-phone', name: 'Burner phone', w: 110, h: 200 },
];
// ITEM_SIZES gains:
//   mugshot { w: 260, h: 330 }, newspaper { w: 300, h: 380 }, receipt { w: 200, h: 340 }, casefile { w: 340, h: 260 },
//   sketch { w: 300, h: 225 }, stamp { w: 260, h: 100 }, object { w: 150, h: 150 }
```

Links also gain `thickness?: number` (multiplier 0.5–3, absent = 1) and `arrow?: LinkArrow` where `export type LinkArrow = 'end' | 'both'` (absent = none). Add:
```ts
export const THICKNESSES: { value: number; name: string }[] = [
  { value: 0.6, name: 'Thread' }, { value: 1, name: 'Yarn' }, { value: 1.6, name: 'Cord' }, { value: 2.4, name: 'Rope' },
];
```

Keep `Board.version: 1`.

- [ ] **Step 2b: Seeded random** — `src/model/random.ts` (shared by T5 jazz and T6 generators)

```ts
/** mulberry32: deterministic PRNG returning [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```
Test (`random.test.ts`): two generators with seed 42 give the same 100 values, all in [0, 1); seeds 1 and 2 differ on the first value.

- [ ] **Step 3: `connect` material** — `src/model/actions.ts`

`connect(b, from, to, opts: { color; tension; fromAt?; toAt?; material?: StringMaterial })` — store `link.material` only when it is set and not `'yarn'`.

Also accept `thickness?: number` (stored only when ≠ 1, clamped 0.5–3) and `arrow?: LinkArrow`. Add `reverseLink(b: Board, id: string): Board` — swaps `from`/`to` and `fromAt`/`toAt` (an absent anchor stays absent on the other side); missing id ⇒ same board object.

Test (`actions.test.ts`): `reverseLink` swaps ends and anchors and returns `b` unchanged for a missing id; `connect(..., { thickness: 1 })` → no `thickness` key, `{ thickness: 9 }` → `3`. `connect(..., { color, tension: .5, material: 'twine' })` → link has `material: 'twine'`; with `material: 'yarn'` → link has no `material` key.

- [ ] **Step 4: Write the failing transfer tests** — `src/storage/transfer.test.ts`

Use the file's existing helpers for building a raw board. One `it` per line:
1. board `surface: 'brick', mood: 'basement'` kept; `surface: 'lava'`, `mood: 42` → `'cork'`, `'noir-office'`.
2. `closed: true` kept; `closed: 'yes'` dropped.
3. link `material: 'marker'` kept; `material: 'yarn'` → no key; `material: 'rope'` → no key.
4. item type `'mugshot'` with `name: '<b>Gary</b>'` keeps the string verbatim (escaping is the renderer's job) and truncates `name` to 80 chars.
5. unknown item type `'bomb'` dropped (existing behaviour, keep a test).
6. receipt `lines`: 10 000 entries → 40 kept; entry `{ name: 'x', price: NaN }` dropped; `price: 12.7` → `13`; `price: -5` → `0`; `price: 5e9` → `999999`; non-array `lines` → absent.
7. sketch `strokes`: `{ d: 'M1 2 L3 4', color: '#112233', width: 4 }` kept; `d: 'M1 2 url(x)'` dropped; `d` 60 001 chars dropped; `color: 'red'` → `'#22201a'`; `width: 999` → `40`; 1000 strokes → 300 kept; once total `d` length passes 400 000 chars further strokes are dropped.
8. stamp item with `stamp: 'nope'` → `stamp: 'evidence'`; object item with `object: 'nope'` → `object: 'keys'`.
9. `aged: true`/`crossed: true` kept; `aged: 1` dropped. `seed: 3.7` → `3`; `seed: -1` dropped; `seed: 2**33` dropped.
10. link `thickness: 1.6` kept; `thickness: 1` → no key; `thickness: 0.1` → `0.5`; `thickness: 'big'` → no key; `arrow: 'both'` kept; `arrow: 'up'` → no key.
11. a phase-1-shaped board (no new fields) round-trips through `validateBoard` deep-equal to itself.

Run: `npx vitest run src/storage/transfer.test.ts` — Expected: the new tests FAIL.

- [ ] **Step 5: Implement validation** — `src/storage/transfer.ts`

- `ITEM_TYPES` includes all 11 types. Board: `surface` / `mood` must be keys of `SURFACES` / `MOODS` (use `Object.hasOwn`), else defaults. `closed === true` only.
- String caps: `name` 80, `bookingNo` 20, `masthead` 60, `date` 40, `headline` 140, `store` 60, `time` 40, `subject` 80, `officer` 60, `status` 40.
- `lines`: `Array.isArray` → first 40 → keep entries with `isRec`, `name` string (≤ 60), finite `price` → `Math.round(clamp(price, 0, 999999))`.
- `strokes`: `Array.isArray` → iterate first 300; keep if `d` is a string, `d.length <= 60000`, `/^[MLQCZmlqcz0-9 .,\-]+$/.test(d)`, running total ≤ 400 000; `color` via existing `color(v, '#22201a')`; `width` `num(v, 1, 40, 4)`.
- `stamp` / `object`: for `type === 'stamp'` set `STAMPS` id or `'evidence'`; for `type === 'object'` set `OBJECTS` id or `'keys'`; ignore those keys on other types.
- `aged`/`crossed`: `=== true` only. `seed`: `Number.isInteger(Math.trunc(v))`, `0 <= v < 2**32` → `Math.trunc(v)`.
- `material`: in `MATERIALS` and not `'yarn'`.
- `thickness`: finite number → `clamp(v, 0.5, 3)`, kept only when ≠ 1. `arrow`: `'end' | 'both'` only.

Run the transfer tests — Expected: PASS.

- [ ] **Step 6: Prefs** — `src/prefs.ts`, `src/prefs.test.ts`

Add the fields from the overview with defaults `muted: false, ambience: false, ambienceVolume: 0.3, musicOn: false, lastThickness: 1, effects: { blinds: true, rain: true, grain: true, neon: true, dust: true, flicker: true }` and optional `musicId`, `musicName`. Parse: booleans by `typeof`, volume via `num(…, 0, 1, 0.3)`, `musicId` string ≤ 100, `musicName` string ≤ 80, `effects` per-key boolean else `true` (unknown keys ignored).
`lastThickness` via `num(…, 0.5, 3, 1)`. Tests: defaults when empty; `effects: { rain: false, bogus: false }` → `rain` false, others true, no `bogus` key; `ambienceVolume: 7` → `1`; `musicName` 200 chars → 80.

- [ ] **Step 7: Compile fixes + full verify**

Add `NAMES` (renderers.ts) and `TYPE_NAMES` (drawer.ts) entries: Mugshot, Newspaper clipping, Receipt, Case file, Sketch, Stamp, Object. `renderItemContent` may leave the new types empty for now (T7 fills them) — add a `default: break;` if the switch needs it.
Run: `npm test`, `npx tsc --noEmit`, `npm run build` — all pass.

Report: `.superpowers/sdd/phase-2-3/task-1-report.md`.
