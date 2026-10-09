import { connect as connectItems } from '../model/actions';
import { anchorPoint, toAnchor } from '../model/geometry';
import type { Anchor } from '../model/types';
import type { Store } from '../model/store';

type Pt = { x: number; y: number };

export interface ConnectDeps {
  store: Store;
  viewport: { toWorld(cx: number, cy: number): Pt; pinching(): boolean };
  strings: { preview(from: Pt | null, to?: Pt, color?: string, snapped?: boolean): void };
  items: { setConnectFrom(id: string | null): void; setHot(id: string | null): void };
  sfx: { pluck(): void };
  color(): string;
  tension(): number;
  freeAnchors(): boolean;
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

/** Where the preview string ends: on the target's attach point when over one, else under the pointer. */
export function previewEnd(pointerWorld: Pt, target?: { point: Pt }): Pt {
  return target ? target.point : pointerWorld;
}

export function createConnect(d: ConnectDeps): ConnectTool {
  let on = false;
  let from: string | null = null;
  let fromAt: Anchor | undefined;
  let dragging = false; // a String-mode drag owns the preview
  const hasWindow = typeof window !== 'undefined';

  /** Draw the "empty" string from `fromId` to the pointer, snapping to a valid target under it. */
  function showPreview(fromId: string, at: Anchor | undefined, ev: PointerEvent) {
    const it = d.store.get().items.find(i => i.id === fromId);
    if (!it) return;
    const p = d.viewport.toWorld(ev.clientX, ev.clientY);
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const hit = under?.closest<HTMLElement>('[data-item-id], [data-pin-for]');
    const toId = hit?.dataset.itemId ?? hit?.dataset.pinFor;
    const target = toId && toId !== fromId ? d.store.get().items.find(i => i.id === toId) : undefined;
    const point = target && anchorPoint(target, d.freeAnchors() && !under?.closest('.pin') ? toAnchor(target, p.x, p.y) : undefined);
    d.strings.preview(anchorPoint(it, at), previewEnd(p, point && { point }), d.color(), !!target);
    d.items.setHot(target?.id ?? null);
  }
  const pendingMove = (ev: PointerEvent) => { if (from && !dragging && !d.viewport.pinching()) showPreview(from, fromAt, ev); };
  const setFrom = (id: string | null, at?: Anchor) => {
    from = id; fromAt = id ? at : undefined; d.items.setConnectFrom(id);
    if (hasWindow) window.removeEventListener('pointermove', pendingMove);
    const it = id ? d.store.get().items.find(i => i.id === id) : undefined;
    if (!it) { d.strings.preview(null); d.items.setHot(null); return; }
    const start = anchorPoint(it, at);
    d.strings.preview(start, start, d.color()); // zero-length until the pointer moves
    if (hasWindow) window.addEventListener('pointermove', pendingMove);
  };

  function link(a: string, b: string, aAt?: Anchor, bAt?: Anchor): boolean {
    const board = d.store.get();
    const free = d.freeAnchors();
    const next = connectItems(board, a, b, { color: d.color(), tension: d.tension(), fromAt: free ? aAt : undefined, toAt: free ? bAt : undefined });
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
      dragging = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const sx = e.clientX;
      const sy = e.clientY;
      let moved = false;
      let aborted = false;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        if (d.viewport.pinching()) { aborted = true; d.strings.preview(null); d.items.setHot(null); return; }
        if (aborted) return;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) moved = true;
        if (moved) showPreview(fromId, startAt, ev);
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        dragging = false;
        d.strings.preview(null);
        d.items.setHot(null);
        if (aborted || ev.type === 'pointercancel') return;
        if (!moved) { if (!tool.tap(fromId, startAt)) d.select(fromId); return; }
        setFrom(null); // a drag replaces any pending tap source
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
