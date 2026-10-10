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
