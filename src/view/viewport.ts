import { BOARD_H, BOARD_W } from '../model/types';
import { clampView, fitView, screenToWorld, worldToScreen, zoomAt, type View } from './viewMath';

export interface Viewport {
  el: HTMLElement;
  get(): View;
  set(v: View): void;
  fit(): void;
  zoomBy(f: number): void;
  toWorld(clientX: number, clientY: number): { x: number; y: number };
  toScreen(wx: number, wy: number): { x: number; y: number };
  centerWorld(): { x: number; y: number };
  pinching(): boolean;
  onChange(fn: (v: View) => void): () => void;
  onTap(fn: () => void): () => void;
}

export function createViewport(el: HTMLElement, world: HTMLElement): Viewport {
  let v: View = { x: 0, y: 0, scale: 1 };
  let rect = el.getBoundingClientRect();
  const changeFns = new Set<(v: View) => void>();
  const tapFns = new Set<() => void>();
  const pts = new Map<number, { x: number; y: number }>();
  let mode: 'none' | 'pan' | 'pinch' = 'none';
  let panStart = { x: 0, y: 0 };
  let panMoved = false;
  let pinch = { dist: 1, mx: 0, my: 0 };

  function apply(next: View) {
    v = clampView(next, rect.width, rect.height, BOARD_W, BOARD_H);
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
    world.style.setProperty('--inv-scale', String(1 / v.scale));
    for (const fn of changeFns) fn(v);
  }
  const local = (cx: number, cy: number) => ({ x: cx - rect.left, y: cy - rect.top });
  const isBackground = (t: EventTarget | null) =>
    !(t instanceof Element) || !t.closest('[data-item-id], [data-pin-for], [data-link-id], .rotate-handle, .resize-handle');
  function pinchState() {
    const [a, b] = [...pts.values()];
    const pa = local(a.x, a.y);
    const pb = local(b.x, b.y);
    return { dist: Math.hypot(pa.x - pb.x, pa.y - pb.y) || 1, mx: (pa.x + pb.x) / 2, my: (pa.y + pb.y) / 2 };
  }

  // Capture phase: runs before item/pin/string handlers so the viewport always knows the pointer count.
  el.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      mode = 'pinch';
      pinch = pinchState();
      el.dispatchEvent(new CustomEvent('viewport:pinch'));
    } else if (pts.size === 1 && isBackground(e.target)) {
      mode = 'pan';
      panStart = { x: e.clientX, y: e.clientY };
      panMoved = false;
      el.setPointerCapture(e.pointerId);
    }
  }, { capture: true });

  el.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const prev = { x: p.x, y: p.y };
    p.x = e.clientX;
    p.y = e.clientY;
    if (mode === 'pan' && pts.size === 1) {
      if (Math.hypot(e.clientX - panStart.x, e.clientY - panStart.y) > 5) panMoved = true;
      apply({ ...v, x: v.x + (p.x - prev.x), y: v.y + (p.y - prev.y) });
    } else if (mode === 'pinch' && pts.size >= 2) {
      const s = pinchState();
      const z = zoomAt(v, s.mx, s.my, s.dist / pinch.dist);
      apply({ ...z, x: z.x + (s.mx - pinch.mx), y: z.y + (s.my - pinch.my) });
      pinch = s;
    }
  }, { capture: true });

  const end = (e: PointerEvent) => {
    if (!pts.delete(e.pointerId)) return;
    if (mode === 'pan' && pts.size === 0 && !panMoved && e.type === 'pointerup') for (const fn of tapFns) fn();
    if (pts.size === 0 || mode === 'pinch') mode = 'none'; // don't resume panning with the leftover finger
  };
  el.addEventListener('pointerup', end, { capture: true });
  el.addEventListener('pointercancel', end, { capture: true });

  el.addEventListener('wheel', e => {
    e.preventDefault();
    const p = local(e.clientX, e.clientY);
    if (e.ctrlKey || e.metaKey) apply(zoomAt(v, p.x, p.y, Math.exp(-e.deltaY * 0.01)));
    else apply({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
  }, { passive: false });

  el.addEventListener('contextmenu', e => e.preventDefault()); // no long-press callout on the board

  new ResizeObserver(() => { rect = el.getBoundingClientRect(); apply(v); }).observe(el);

  return {
    el,
    get: () => v,
    set: apply,
    fit() { rect = el.getBoundingClientRect(); apply(fitView(rect.width, rect.height, BOARD_W, BOARD_H)); },
    zoomBy(f) { apply(zoomAt(v, rect.width / 2, rect.height / 2, f)); },
    toWorld(cx, cy) { const p = local(cx, cy); return screenToWorld(v, p.x, p.y); },
    toScreen: (wx, wy) => worldToScreen(v, wx, wy),
    centerWorld: () => screenToWorld(v, rect.width / 2, rect.height / 2),
    pinching: () => mode === 'pinch',
    onChange(fn) { changeFns.add(fn); return () => { changeFns.delete(fn); }; },
    onTap(fn) { tapFns.add(fn); return () => { tapFns.delete(fn); }; },
  };
}
