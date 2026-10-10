import { rng } from './random';
import type { ItemData, ReceiptLine } from './types';

export { rng } from './random';

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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type Rand = () => number;

function pick<T>(r: Rand, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)] as T;
}

function shuffle<T>(r: Rand, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC "Saturday, 10 October 2026". */
function longDate(ms: number): string {
  const d = new Date(ms);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** UTC "10/10/2026". */
function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** UTC "10/10/2026 21:37". */
function stampTime(ms: number): string {
  const d = new Date(ms);
  return `${shortDate(ms)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function genMugshot(seed: number): Pick<ItemData, 'name' | 'bookingNo'> {
  const r = rng(seed);
  const nick = pick(r, NICK);
  const base = `${pick(r, FIRST)} ${pick(r, LAST)}`;
  const name = nick ? `${base} ${nick}` : base;
  const yearIndex = Math.floor(r() * 57); // 70..99 then 00..26
  const yy = pad2((70 + yearIndex) % 100);
  const num = String(10000 + Math.floor(r() * 90000));
  return { name, bookingNo: `${yy}-${num}` };
}

export function genNewspaper(seed: number, now: number): Pick<ItemData, 'masthead' | 'date' | 'headline' | 'text'> {
  const r = rng(seed);
  const masthead = pick(r, MASTHEAD);
  const headline = `${pick(r, H_WHO)} ${pick(r, H_DID)} ${pick(r, H_WHAT)}`;
  const i = Math.floor(r() * BODY.length);
  const j = (i + 1 + Math.floor(r() * (BODY.length - 1))) % BODY.length;
  const text = `${BODY[i]} ${BODY[j]}`;
  return { masthead, date: longDate(now), headline, text };
}

export function genReceipt(seed: number, now: number): Pick<ItemData, 'store' | 'lines' | 'time'> {
  const r = rng(seed);
  const store = pick(r, STORES);
  const count = 2 + Math.floor(r() * 5); // 2..6 distinct goods
  const lines: ReceiptLine[] = shuffle(r, GOODS).slice(0, count).map(([name, base]) => ({
    name,
    price: Math.round(base * (0.9 + r() * 0.2)), // ±10%, whole pence
  }));
  const minutesAgo = Math.floor(r() * 601);
  return { store, lines, time: stampTime(now - minutesAgo * 60_000) };
}

export function receiptTotal(lines: ReceiptLine[]): number {
  return lines.reduce((sum, l) => sum + l.price, 0);
}

export function formatMoney(pence: number): string {
  return `£${Math.floor(pence / 100)}.${pad2(pence % 100)}`;
}

export function genCaseFile(seed: number, now: number): Pick<ItemData, 'subject' | 'officer' | 'status' | 'date' | 'text'> {
  const r = rng(seed);
  const subject = pick(r, SUBJECTS);
  const officer = pick(r, OFFICERS);
  const status = pick(r, STATUS);
  const text = `Notes:\n- ${pick(r, BODY)}`;
  return { subject, officer, status, date: shortDate(now), text };
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
