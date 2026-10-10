import '../styles/sketch.css';
import { SKETCH_VIEW, type SketchStroke } from '../model/types';
import { capStrokes, strokePath, type InputPoint } from '../view/strokes';
import { button, h } from './dom';

const NS = 'http://www.w3.org/2000/svg';
const COLORS = [
  ['Graphite', '#22201a'], ['Red', '#b3261e'], ['Blue', '#1f5fae'], ['Green', '#2f7d32'], ['Chalk', '#ece6d6'],
] as const;
const NIBS = [['Fine', 3], ['Medium', 6], ['Thick', 12]] as const;

export function openSketchPad(dialog: HTMLDialogElement, init: SketchStroke[] = []): Promise<SketchStroke[] | null> {
  return new Promise(resolve => {
    const strokes: SketchStroke[] = init.map(s => ({ ...s }));
    let color: string = COLORS[0][1];
    let size: number = NIBS[1][1];
    let done = false;

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${SKETCH_VIEW.w} ${SKETCH_VIEW.h}`);
    svg.setAttribute('class', 'sketch-surface');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Drawing area');
    for (let y = 30; y < SKETCH_VIEW.h; y += 30) {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', '0'); l.setAttribute('x2', String(SKETCH_VIEW.w));
      l.setAttribute('y1', String(y)); l.setAttribute('y2', String(y));
      l.setAttribute('stroke', '#8aa4c8'); l.setAttribute('stroke-opacity', '0.25'); l.setAttribute('stroke-width', '0.5');
      svg.append(l);
    }
    const inkLayer = document.createElementNS(NS, 'g');
    svg.append(inkLayer);

    const addPath = (s: SketchStroke): SVGPathElement => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', s.d); p.setAttribute('fill', s.color);
      inkLayer.append(p);
      return p;
    };
    const redraw = () => { inkLayer.replaceChildren(); strokes.forEach(addPath); };
    redraw();

    const hint = h('p', { className: 'sketch-hint', textContent: 'Draw with a finger, pen or mouse.' });
    const bar = h('div', { className: 'sketch-bar' });
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Sketch tools');

    const swatches: HTMLButtonElement[] = [];
    for (const [name, c] of COLORS) {
      const b = h('button', { type: 'button', className: 'sketch-swatch', title: name });
      b.style.background = c; b.style.width = b.style.height = '44px';
      b.setAttribute('aria-label', name);
      b.setAttribute('aria-pressed', String(c === color));
      b.addEventListener('click', () => { color = c; swatches.forEach(s => s.setAttribute('aria-pressed', String(s === b))); });
      swatches.push(b); bar.append(b);
    }
    const nibs: HTMLButtonElement[] = [];
    for (const [name, n] of NIBS) {
      const b = button(name, () => { size = n; nibs.forEach(x => x.setAttribute('aria-pressed', String(x === b))); }, 'btn sketch-nib');
      b.setAttribute('aria-pressed', String(n === size));
      nibs.push(b); bar.append(b);
    }
    let activeId: number | null = null;
    let pin: HTMLButtonElement;
    const sync = () => { if (pin) pin.disabled = strokes.length === 0; };
    const undo = () => { if (activeId !== null) return; strokes.pop(); redraw(); sync(); };
    bar.append(button('Undo stroke', undo), button('Clear', () => { if (activeId !== null) return; strokes.length = 0; redraw(); sync(); }));

    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: SketchStroke[] | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
      dialog.removeEventListener('keydown', onKey);
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onClose);
      if (dialog.open) dialog.close();
      resolve(result);
    };
    pin = button('Pin it up', () => {
      const r = capStrokes(strokes);
      if (r.capped) {
        hint.textContent = "That's a lot of ink — some strokes were left off.";
        pin.disabled = true;
        timer = setTimeout(() => finish(r.strokes), 2000);
      } else finish(r.strokes);
    }, 'btn primary');
    bar.append(button('Cancel', () => finish(null)), pin);
    sync();

    // pointer handling
    let points: InputPoint[] = [];
    let cur: SVGPathElement | null = null;
    let curSize = size;
    let curColor = color;
    let simulate = true;
    const toView = (e: PointerEvent): [number, number] | null => {
      const m = svg.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return [p.x, p.y];
    };
    const onDown = (e: PointerEvent) => {
      if (activeId !== null) return;
      const v = toView(e);
      if (!v) return;
      const [x, y] = v;
      activeId = e.pointerId;
      svg.setPointerCapture(e.pointerId);
      curSize = size; curColor = color; simulate = e.pointerType !== 'pen';
      points = [[x, y, e.pressure || 0.5]];
      cur = addPath({ d: '', color: curColor, width: curSize });
      cur.setAttribute('d', strokePath(points, curSize, simulate));
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activeId || !cur) return;
      const v = toView(e);
      if (!v) return;
      const [x, y] = v;
      points.push([x, y, e.pressure || 0.5]);
      cur.setAttribute('d', strokePath(points, curSize, simulate));
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      const d = strokePath(points, curSize, simulate);
      if (d) strokes.push({ d, color: curColor, width: curSize });
      else cur?.remove();
      cur = null; points = [];
      sync();
    };
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) {
        e.preventDefault(); e.stopPropagation();
        if (k === 'z' && !e.shiftKey) undo();
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); finish(null);
      }
    };
    const onCancel = (e: Event) => { e.preventDefault(); finish(null); };
    const onClose = () => finish(null);
    dialog.addEventListener('keydown', onKey);
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClose);

    dialog.replaceChildren(h('h2', {}, 'Sketch pad'), svg, bar, hint);
    dialog.showModal();
  });
}
