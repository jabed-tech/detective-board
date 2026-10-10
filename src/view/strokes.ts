import { getStroke } from 'perfect-freehand';
import type { SketchStroke } from '../model/types';
export type InputPoint = [x: number, y: number, pressure: number];
const f = (n: number) => String(Math.round(n * 10) / 10);
export function strokePath(points: InputPoint[], size: number, simulatePressure: boolean): string {
  if (!points.length) return '';
  const o = getStroke(points, { size, thinning: 0.55, smoothing: 0.5, streamline: 0.45, simulatePressure, last: true });
  if (o.length < 2) return '';
  let d = `M${f(o[0][0])} ${f(o[0][1])} Q`;
  for (let i = 0; i < o.length; i++) {
    const [x0, y0] = o[i], [x1, y1] = o[(i + 1) % o.length];
    d += `${f(x0)} ${f(y0)} ${f((x0 + x1) / 2)} ${f((y0 + y1) / 2)} `;
  }
  return d.trimEnd() + ' Z';
}
export function capStrokes(s: SketchStroke[]): { strokes: SketchStroke[]; capped: boolean } {
  const out: SketchStroke[] = [];
  let total = 0;
  let capped = false;
  for (const x of s) {
    if (x.d.length > 60_000) { capped = true; continue; } // one absurdly long scribble: drop it, keep the rest
    if (out.length >= 300 || total + x.d.length > 400_000) return { strokes: out, capped: true };
    out.push(x); total += x.d.length;
  }
  return { strokes: out, capped };
}
