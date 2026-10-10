import { describe, expect, it } from 'vitest';
import { capStrokes, strokePath } from './strokes';
const VALID = /^[MLQCZmlqcz0-9 .,\-]+$/; // must pass T1's import check
describe('strokePath', () => {
  it('empty input ⇒ empty path', () => expect(strokePath([], 6, true)).toBe(''));
  it('a single tap still makes a visible dot', () => {
    const d = strokePath([[100, 100, 0.5]], 6, true);
    expect(d.length).toBeGreaterThan(10); expect(d).toMatch(VALID); expect(d.endsWith('Z')).toBe(true);
  });
  it('a line stays inside a sane box and uses ≤ 1 decimal', () => {
    const pts = Array.from({ length: 50 }, (_, i) => [50 + i * 4, 150, 0.5] as [number, number, number]);
    const d = strokePath(pts, 6, true);
    expect(d).toMatch(VALID);
    for (const n of d.match(/-?\d+(\.\d+)?/g)!) { expect(n.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(1); expect(+n).toBeGreaterThan(30); expect(+n).toBeLessThan(270); }
  });
});
describe('capStrokes', () => {
  const s = (len: number) => ({ d: 'M' + '1 '.repeat(len / 2), color: '#000000', width: 4 });
  it('keeps everything under the caps', () => expect(capStrokes([s(10), s(10)])).toEqual({ strokes: [s(10), s(10)], capped: false }));
  it('caps at 300 strokes', () => { const r = capStrokes(Array.from({ length: 310 }, () => s(10))); expect(r.strokes).toHaveLength(300); expect(r.capped).toBe(true); });
  it('drops a single stroke over 60 000 characters but keeps the others', () => {
    const r = capStrokes([s(10), s(70_000), s(10)]); expect(r.strokes).toEqual([s(10), s(10)]); expect(r.capped).toBe(true);
  });
  it('caps at 400 000 total characters, keeping the earliest strokes', () => {
    const r = capStrokes(Array.from({ length: 30 }, () => s(19_000)));
    expect(r.strokes.reduce((n, x) => n + x.d.length, 0)).toBeLessThanOrEqual(400_000); expect(r.capped).toBe(true);
  });
});
