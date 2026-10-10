# Task 8: Sketch pad (Sonnet) — wave B

Read `00-overview.md`. Depends on T1 (installs `perfect-freehand`). Touch ONLY the files below.

**Files:**
- Create: `src/view/strokes.ts`, `src/view/strokes.test.ts`, `src/ui/sketchpad.ts`, `src/styles/sketch.css`
- Modify: `index.html` (add `<dialog id="sketchpad" class="sketchpad" aria-label="Sketch pad"></dialog>` next to `#settings`)

**Interfaces:**
- Consumes: `SketchStroke`, `SKETCH_VIEW` (T1); `perfect-freehand`'s `getStroke`.
- Produces:
```ts
// view/strokes.ts (pure)
export type InputPoint = [x: number, y: number, pressure: number];
export function strokePath(points: InputPoint[], size: number, simulatePressure: boolean): string; // '' for no points
export function capStrokes(s: SketchStroke[]): { strokes: SketchStroke[]; capped: boolean };     // ≤ 300 strokes, each d ≤ 60 000, Σ d.length ≤ 400 000 (same limits as T1's import check)
// ui/sketchpad.ts
export function openSketchPad(dialog: HTMLDialogElement, init?: SketchStroke[]): Promise<SketchStroke[] | null>; // null = cancelled
```
`sketchpad.ts` imports `'../styles/sketch.css'` itself.

- [ ] **Step 1: Failing tests** — `src/view/strokes.test.ts`

```ts
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
```
Run: `npx vitest run src/view/strokes.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement** — `src/view/strokes.ts`

```ts
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
```
Run — PASS. (If `getStroke`'s option names differ in the installed version, check `node_modules/perfect-freehand/dist/types` and adapt; note it in the report.)

- [ ] **Step 3: Sketch pad dialog** — `src/ui/sketchpad.ts`, `src/styles/sketch.css`

Layout (built with `createElement`/`createElementNS`, static strings only): heading "Sketch pad" (Special Elite 20px); an `<svg viewBox="0 0 400 300">` drawing surface on paper `#fdfcf7` with faint rules, sized `width: min(90vw, 720px)`, `aspect-ratio: 4/3`, `touch-action: none`; toolbar of real `<button>`s ≥ 44px: 5 colour swatches (Graphite `#22201a`, Red `#b3261e`, Blue `#1f5fae`, Green `#2f7d32`, Chalk `#ece6d6`) with `aria-pressed`; 3 nib sizes (Fine 3, Medium 6, Thick 12) with `aria-pressed`; "Undo stroke"; "Clear"; "Cancel"; "Pin it up" (primary). A live hint `<p>` "Draw with a finger, pen or mouse."
- Pointer handling: `pointerdown` on the svg → `setPointerCapture`, start points; `pointermove` → push `[x, y, pressure]` in viewBox coords (`svg.getScreenCTM()!.inverse()` on a `DOMPoint`), live-update the current `<path>` with `strokePath(points, size, e.pointerType !== 'pen')`; `pointerup`/`pointercancel` → finish (drop if path is `''`). Ignore a second simultaneous pointer.
- `init` strokes are drawn first and can be undone like new ones.
- Keyboard: Escape = Cancel; Ctrl/⌘+Z = Undo stroke (stop propagation so the board's undo doesn't fire).
- "Pin it up" resolves `capStrokes(strokes).strokes` (if `capped`, show the hint "That's a lot of ink — some strokes were left off." for 2 s before closing); Cancel/Escape/close resolves `null`. Always `dialog.close()` and remove listeners.

- [ ] **Step 4: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build`. If you can, open the dialog from the console on `npx vite --host 127.0.0.1 --port 5175` and draw with the mouse; report what you saw or say unchecked.

Report: `.superpowers/sdd/phase-2-3/task-8-report.md`.
