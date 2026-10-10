import { describe, expect, it } from 'vitest';
import { jpegToPdf } from './pdf';

const JPEG = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
const text = (u: Uint8Array) => new TextDecoder('latin1').decode(u);

describe('jpegToPdf', () => {
  it('writes a well-formed single-image PDF', () => {
    const u = jpegToPdf(JPEG, 800, 600, 'fit');
    const s = text(u);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.endsWith('%%EOF\n')).toBe(true);
    expect(s).toContain('/Filter /DCTDecode');
    expect(s).toContain('/Width 800');
    expect(s).toContain('/Height 600');
    const at = s.indexOf('\xff\xd8\x01\x02\x03\xff\xd9');
    expect(at).toBeGreaterThan(0);
  });
  it('fit uses 0.75 pt per px', () => {
    expect(text(jpegToPdf(JPEG, 800, 600, 'fit'))).toContain('/MediaBox [0 0 600 450]');
  });
  it('a4 picks orientation and fits inside 36pt margins', () => {
    const l = text(jpegToPdf(JPEG, 800, 600, 'a4'));
    expect(l).toContain('/MediaBox [0 0 842 595]');
    const p = text(jpegToPdf(JPEG, 600, 800, 'a4'));
    expect(p).toContain('/MediaBox [0 0 595 842]');
    for (const s of [l, p]) {
      const m = /q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/.exec(s)!;
      const [w, h, x, y] = m.slice(1).map(Number);
      expect(w).toBeLessThanOrEqual(770 + 1e-6);
      expect(h).toBeLessThanOrEqual(770 + 1e-6);
      expect(x).toBeGreaterThanOrEqual(36);
      expect(y).toBeGreaterThanOrEqual(36);
    }
    const m = /q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/.exec(l)!;
    expect(Number(m[1])).toBeLessThanOrEqual(770);
    expect(Number(m[2])).toBeLessThanOrEqual(523);
  });
  it('has a correct xref table', () => {
    const s = text(jpegToPdf(JPEG, 800, 600, 'fit'));
    const start = Number(/startxref\n(\d+)\n/.exec(s)![1]);
    expect(s.slice(start, start + 4)).toBe('xref');
    const rows = s.slice(start).split('\n').slice(3, 8);
    expect(rows).toHaveLength(5);
    rows.forEach((r, i) => {
      const off = Number(r.slice(0, 10));
      expect(s.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });
});
