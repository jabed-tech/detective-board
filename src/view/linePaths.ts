type Pt = { x: number; y: number };
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const f1 = (v: number) => Math.round(v * 10) / 10;
/** Straight-ish ink line: one quadratic with a small seeded bow (≤ 6px visible) and a seeded control-point slide. */
export function markerPath(a: Pt, b: Pt, seed: number): string {
  const r1 = ((seed * 9301 + 49297) % 233280) / 233280;
  const r2 = ((seed * 4096 + 150889) % 714025) / 714025;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const t = 0.35 + r1 * 0.3, bow = (r2 * 2 - 1) * 12; // control offset 12 => visible bow 6
  const cx = a.x + dx * t + nx * bow, cy = a.y + dy * t + ny * bow;
  return `M${f1(a.x)} ${f1(a.y)} Q${f1(cx)} ${f1(cy)} ${f1(b.x)} ${f1(b.y)}`;
}
/** Triangle with its tip at `tip`, pointing away from `from`; half-width = size * 0.45. */
export function arrowHead(tip: Pt, from: Pt, size: number): string {
  const dx = tip.x - from.x, dy = tip.y - from.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, bx = tip.x - ux * size, by = tip.y - uy * size, hw = size * 0.45;
  return `M${f1(tip.x)} ${f1(tip.y)} L${f1(bx - uy * hw)} ${f1(by + ux * hw)} L${f1(bx + uy * hw)} ${f1(by - ux * hw)} Z`;
}
export function pathMidpoint(p: SVGPathElement): Pt | null {
  if (typeof p.getTotalLength !== 'function') return null;
  try { const L = p.getTotalLength(); if (!L) return null; const m = p.getPointAtLength(L / 2); return { x: m.x, y: m.y }; } catch { return null; }
}
