# Task 6: Paperwork generators (Haiku) — wave B

Read `00-overview.md`. Depends on T1. Touch ONLY the files below. Pure functions, no DOM.

**Files:**
- Create: `src/model/generators.ts`, `src/model/generators.test.ts`

**Interfaces:**
- Consumes: `ItemData`, `ReceiptLine` (T1).
- Produces (all deterministic for a given `seed` and `now`):
```ts
export { rng } from './random';                      // T1; mulberry32, returns [0,1)
export function genMugshot(seed: number): Pick<ItemData, 'name' | 'bookingNo'>;
export function genNewspaper(seed: number, now: number): Pick<ItemData, 'masthead' | 'date' | 'headline' | 'text'>;
export function genReceipt(seed: number, now: number): Pick<ItemData, 'store' | 'lines' | 'time'>;
export function genCaseFile(seed: number, now: number): Pick<ItemData, 'subject' | 'officer' | 'status' | 'date' | 'text'>;
export function receiptTotal(lines: ReceiptLine[]): number;   // pence
export function formatMoney(pence: number): string;           // "£12.30"
export function newSeed(): number;                            // Math.floor(Math.random() * 2**32)
```

- [ ] **Step 1: Write the generator module skeleton with the word lists** — `src/model/generators.ts`

```ts
const FIRST = ['Gary', 'Linda', 'Vince', 'Marjorie', 'Doug', 'Rosa', 'Eddie', 'Pearl', 'Frank', 'Dolores', 'Sal', 'Bev', 'Clive', 'Nora', 'Reg', 'Ida'];
const LAST = ['Malone', 'Pike', 'Crane', 'Delgado', 'Hobbs', 'Finch', 'Moreau', 'Kowalski', 'Bright', 'Vance', 'Okafor', 'Lomax', 'Shaw', 'Duval', 'Pratt', 'Quill'];
const NICK = ['"The Stapler"', '"Two Coats"', '"Lucky"', '"Biscuits"', '"The Accountant"', '"Slim"', '"No Receipts"', ''];
const MASTHEAD = ['The Evening Ledger', 'Daily Clarion', 'The Night Herald', 'City Courier', 'The Morning Wire'];
const H_WHO = ['Office Worker', 'Local Baker', 'Night Watchman', 'Retired Clown', 'Council Clerk', 'Mystery Man', 'Dentist', 'Tap-Dance Teacher'];
const H_DID = ['Vanishes After', 'Questioned Over', 'Seen Fleeing', 'Denies Role In', 'Linked To', 'Arrested Near', 'Silent On'];
const H_WHAT = ['Stapler Heist', 'Midnight Bake Sale', 'Pigeon Racket', 'Missing Trophy', 'Library Fine Scandal', 'Garden Gnome Ring', 'Office Party Incident'];
const BODY = [
  'Police are asking anyone with information to come forward.',
  'Witnesses described a figure in a long coat leaving the scene.',
  'A spokesperson declined to comment, citing an ongoing investigation.',
  'Neighbours say the area has been "unusually quiet" since Tuesday.',
  'The only clue left behind was a single paperclip.',
];
const STORES = ["Sal's Diner", 'QuikMart 24h', 'Lucky Star Laundromat', 'Rex Hardware', 'The Blue Note Bar', 'Pearl Dry Cleaning'];
const GOODS: [string, number][] = [['Coffee, black', 120], ['Rye bread', 210], ['Duct tape', 450], ['Rubber gloves', 300],
  ['Torch batteries', 599], ['Matches', 80], ['Whisky (single)', 650], ['Newspaper', 90], ['Bin bags', 275], ['Spade', 1899],
  ['Doughnut', 110], ['Map of the city', 399], ['Bleach', 225], ['Rope, 10 m', 799]];
const OFFICERS = ['Det. Sgt. Malone', 'Det. Insp. Crane', 'Det. Con. Pike', 'Det. Insp. Okafor', 'Det. Sgt. Duval'];
const STATUS = ['OPEN', 'OPEN — PRIORITY', 'PENDING LAB RESULTS', 'COLD', 'UNDER REVIEW'];
const SUBJECTS = ['Disappearance of office equipment', 'Suspicious late-night deliveries', 'Anonymous letters', 'Break-in at the bakery', 'The vanishing trophy'];
```

- [ ] **Step 2: Failing tests** — `src/model/generators.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { formatMoney, genCaseFile, genMugshot, genNewspaper, genReceipt, receiptTotal, rng } from './generators';
const NOW = Date.UTC(2026, 9, 10, 21, 37); // 10 Oct 2026 21:37 UTC
describe('generators', () => {
  it('rng is deterministic and in [0,1)', () => {
    const a = rng(42), b = rng(42);
    for (let i = 0; i < 100; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('same seed ⇒ same output; different seed ⇒ usually different', () => {
    expect(genMugshot(7)).toEqual(genMugshot(7));
    expect(genNewspaper(7, NOW)).toEqual(genNewspaper(7, NOW));
    const names = new Set(Array.from({ length: 20 }, (_, i) => genMugshot(i).name));
    expect(names.size).toBeGreaterThan(5);
  });
  it('mugshot booking number format', () => expect(genMugshot(1).bookingNo).toMatch(/^\d{2}-\d{5}$/));
  it('newspaper fields', () => {
    const n = genNewspaper(3, NOW);
    expect(n.date).toBe('Saturday, 10 October 2026');
    expect(n.headline!.split(' ').length).toBeGreaterThanOrEqual(4);
    expect(n.headline!.length).toBeLessThanOrEqual(140);
    expect(n.text!.length).toBeGreaterThan(20);
  });
  it('receipt: 2–6 lines, sane prices, time stamp', () => {
    const r = genReceipt(5, NOW);
    expect(r.lines!.length).toBeGreaterThanOrEqual(2); expect(r.lines!.length).toBeLessThanOrEqual(6);
    for (const l of r.lines!) { expect(Number.isInteger(l.price)).toBe(true); expect(l.price).toBeGreaterThan(0); }
    expect(r.time).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });
  it('receipt total and money format', () => {
    expect(receiptTotal([{ name: 'a', price: 120 }, { name: 'b', price: 1899 }])).toBe(2019);
    expect(formatMoney(2019)).toBe('£20.19'); expect(formatMoney(5)).toBe('£0.05'); expect(formatMoney(0)).toBe('£0.00');
  });
  it('case file fields', () => {
    const c = genCaseFile(9, NOW);
    for (const k of ['subject', 'officer', 'status', 'date', 'text'] as const) expect(c[k]).toBeTruthy();
    expect(c.date).toBe('10/10/2026');
  });
});
```
Run: `npx vitest run src/model/generators.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

- `rng` comes from `src/model/random.ts` (T1) — import it and re-export it (`export { rng } from './random'`); add a local `pick(r, arr)`.
- Dates use **UTC** getters (tests are timezone-independent): newspaper `Weekday, D Month YYYY`; receipt time `DD/MM/YYYY HH:MM` of `now` minus a random 0–600 minutes; case-file date `DD/MM/YYYY` of `now` (test expects 10/10/2026).
- Mugshot: `name` = `First Last` + (` ${nick}` if nick non-empty); `bookingNo` = `${YY}-${5 digits}` with YY 70–99 or 00–26 (any 2 digits zero-padded is fine).
- Newspaper: `masthead` pick; `headline` = `${who} ${did} ${what}`; `text` = two different `BODY` sentences joined with a space.
- Receipt: `store` pick; 2–6 distinct `GOODS` (shuffle with r), each price ± up to 10% rounded to integer pence.
- Case file: `subject`, `officer`, `status` picks; `text` = `Notes:\n- ` + one `BODY` sentence.

Run — PASS. Then `npm test`, `npx tsc --noEmit`. Report: `.superpowers/sdd/phase-2-3/task-6-report.md`.
