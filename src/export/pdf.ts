// Minimal single-image PDF writer: one page, one DCT (JPEG) image, no dependencies.
export type PageSize = 'fit' | 'a4';

const num = (n: number): string => String(Math.round(n * 100) / 100);
const enc = (s: string): Uint8Array => Uint8Array.from(s, c => c.charCodeAt(0) & 0xff);

export function jpegToPdf(jpeg: Uint8Array, wPx: number, hPx: number, page: PageSize): Uint8Array {
  const iw = wPx * 0.75, ih = hPx * 0.75; // 96 dpi px to pt
  let pw = iw, ph = ih, dw = iw, dh = ih, dx = 0, dy = 0;
  if (page === 'a4') {
    const landscape = wPx > hPx;
    pw = landscape ? 842 : 595; ph = landscape ? 595 : 842;
    const s = Math.min((pw - 72) / wPx, (ph - 72) / hPx);
    dw = wPx * s; dh = hPx * s; dx = (pw - dw) / 2; dy = (ph - dh) / 2;
  }
  const content = `q ${num(dw)} 0 0 ${num(dh)} ${num(dx)} ${num(dy)} cm /Im0 Do Q`;
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (c: Uint8Array | string) => { const u = typeof c === 'string' ? enc(c) : c; chunks.push(u); len += u.length; };
  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = len;
    push(`${n} 0 obj\n${body}`);
    if (stream) { push('\nstream\n'); push(stream); push('\nendstream'); }
    push('\nendobj\n');
  };
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pw)} ${num(ph)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, `<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
  obj(5, `<< /Length ${content.length} >>`, enc(content));
  const xref = len;
  push('xref\n0 6\n0000000000 65535 f \n');
  for (let n = 1; n <= 5; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
