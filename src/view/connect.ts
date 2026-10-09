import { connect as connectItems } from '../model/actions';
import { pinPoint } from '../model/geometry';
import type { Store } from '../model/store';

type Pt = { x: number; y: number };

export interface ConnectDeps {
  store: Store;
  viewport: { toWorld(cx: number, cy: number): Pt; pinching(): boolean };
  strings: { preview(from: Pt | null, to?: Pt, color?: string): void };
  items: { setConnectFrom(id: string | null): void };
  sfx: { pluck(): void };
  color(): string;
  tension(): number;
  announce(msg: string): void;
  onModeChange(on: boolean): void;
  select(itemId: string): void;
}
export interface ConnectTool {
  pinDrag(fromId: string, e: PointerEvent): void;
  mode(): boolean;
  setMode(on: boolean): void;
  tap(itemId: string): boolean;
  begin(fromId: string): void;
  complete(toId: string): boolean;
  cancel(): void;
  pending(): string | null;
}

export function createConnect(d: ConnectDeps): ConnectTool {
  let on = false;
  let from: string | null = null;
  const setFrom = (id: string | null) => { from = id; d.items.setConnectFrom(id); };

  function link(a: string, b: string): boolean {
    const board = d.store.get();
    const next = connectItems(board, a, b, { color: d.color(), tension: d.tension() });
    if (next === board) {
      if (a !== b) d.announce('Those two are already connected.');
      return false;
    }
    d.store.commit(next);
    d.sfx.pluck();
    d.announce('Strung together.');
    return true;
  }

  const tool: ConnectTool = {
    pending: () => from,
    mode: () => on,
    setMode(v) { on = v; if (!v) setFrom(null); d.onModeChange(v); },
    begin(id) { setFrom(id); d.announce('Connecting. Choose another item, then press Enter. Escape cancels.'); },
    complete(toId) { const src = from; setFrom(null); return src ? link(src, toId) : false; },
    cancel() { setFrom(null); d.announce('Connection cancelled.'); },
    tap(id) {
      if (from) {
        if (from === id) { setFrom(null); return true; }
        tool.complete(id);
        return true;
      }
      if (on) { setFrom(id); return true; }
      return false;
    },
    pinDrag(fromId, e) {
      const it = d.store.get().items.find(i => i.id === fromId);
      if (!it || d.viewport.pinching()) return;
      const start = pinPoint(it);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const sx = e.clientX;
      const sy = e.clientY;
      let moved = false;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true;
        if (moved) d.strings.preview(start, d.viewport.toWorld(ev.clientX, ev.clientY), d.color());
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        d.strings.preview(null);
        if (ev.type === 'pointercancel') return;
        if (!moved) { if (!tool.tap(fromId)) d.select(fromId); return; }
        const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-item-id], [data-pin-for]');
        const toId = hit?.dataset.itemId ?? hit?.dataset.pinFor;
        if (toId && toId !== fromId) link(fromId, toId);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
  };
  return tool;
}
