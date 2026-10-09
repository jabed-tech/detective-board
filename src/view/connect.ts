import { connect as connectItems } from '../model/actions';
import { anchorPoint, toAnchor } from '../model/geometry';
import type { Anchor } from '../model/types';
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
  stringDrag(fromId: string, e: PointerEvent, fromAt?: Anchor): void;
  mode(): boolean;
  setMode(on: boolean): void;
  tap(itemId: string, at?: Anchor): boolean;
  begin(fromId: string, at?: Anchor): void;
  complete(toId: string, at?: Anchor): boolean;
  cancel(): void;
  pending(): string | null;
}

export function createConnect(d: ConnectDeps): ConnectTool {
  let on = false;
  let from: string | null = null;
  let fromAt: Anchor | undefined;
  const setFrom = (id: string | null, at?: Anchor) => { from = id; fromAt = id ? at : undefined; d.items.setConnectFrom(id); };

  function link(a: string, b: string, aAt?: Anchor, bAt?: Anchor): boolean {
    const board = d.store.get();
    const next = connectItems(board, a, b, { color: d.color(), tension: d.tension(), fromAt: aAt, toAt: bAt });
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
    begin(id, at) { setFrom(id, at); d.announce('Connecting. Choose another item, then press Enter. Escape cancels.'); },
    complete(toId, at) { const src = from, srcAt = fromAt; setFrom(null); return src ? link(src, toId, srcAt, at) : false; },
    cancel() { setFrom(null); d.announce('Connection cancelled.'); },
    tap(id, at) {
      if (from) {
        if (from === id) { setFrom(null); return true; }
        tool.complete(id, at);
        return true;
      }
      if (on) { setFrom(id, at); return true; }
      return false;
    },
    stringDrag(fromId, e, startAt) {
      const it = d.store.get().items.find(i => i.id === fromId);
      if (!it || d.viewport.pinching()) return;
      const start = anchorPoint(it, startAt);
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
        if (!moved) { if (!tool.tap(fromId, startAt)) d.select(fromId); return; }
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const hit = under?.closest<HTMLElement>('[data-item-id], [data-pin-for]');
        const toId = hit?.dataset.itemId ?? hit?.dataset.pinFor;
        const target = toId ? d.store.get().items.find(i => i.id === toId) : undefined;
        if (!target || target.id === fromId) return;
        const p = d.viewport.toWorld(ev.clientX, ev.clientY);
        link(fromId, target.id, startAt, under?.closest('.pin') ? undefined : toAnchor(target, p.x, p.y));
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
  };
  return tool;
}
