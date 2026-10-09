import { BOARD_H, BOARD_W, type Board, type Item } from '../model/types';
import { clamp, pinPoint } from '../model/geometry';
import { bringToFront, updateItem } from '../model/actions';
import type { Store } from '../model/store';
import type { Viewport } from './viewport';
import type { Sfx } from '../audio/sfx';
import { itemLabel, renderItemContent } from './renderers';

type Pt = { x: number; y: number };

export interface ItemsDeps {
  store: Store;
  viewport: Pick<Viewport, 'el' | 'get' | 'pinching'>;
  strings: { override(itemId: string, pos: Pt | null): void };
  sfx: Pick<Sfx, 'thunk' | 'rustle'>;
  getImageUrl(id: string): Promise<string | undefined>;
  reducedMotion(): boolean;
  onSelect(id: string): void;
  onItemTap(id: string): boolean;
  onPinPointerDown(id: string, e: PointerEvent): void;
}
export interface ItemsView { sync(board: Board): void; select(id: string | null): void; markFresh(id: string): void; setConnectFrom(id: string | null): void }

interface Entry { el: HTMLElement; body: HTMLElement; pin: HTMLButtonElement; key: string; item: Item }
interface Drag { id: string; pointerId: number; sx: number; sy: number; ox: number; oy: number; x: number; y: number; moved: boolean }

export function createItems(layer: HTMLElement, pinsLayer: HTMLElement, deps: ItemsDeps): ItemsView {
  const entries = new Map<string, Entry>();
  const fresh = new Set<string>();
  let selectedId: string | null = null;
  let connectFrom: string | null = null;
  let drag: Drag | null = null;
  let pressing = false; // suppress focus→select while a pointer is down

  function place(e: Entry, x: number, y: number) {
    e.el.style.transform = `translate(${x}px, ${y}px) rotate(${e.item.rot}deg)`;
    const p = pinPoint({ ...e.item, x, y });
    e.pin.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  function create(it: Item): Entry {
    const el = document.createElement('div');
    el.className = `item item-${it.type}`;
    el.dataset.itemId = it.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    const body = document.createElement('div');
    body.className = 'item-body';
    el.append(body);
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'pin';
    pin.tabIndex = -1;
    pin.dataset.pinFor = it.id;
    pin.setAttribute('aria-label', 'Pin — drag to another item to connect');
    el.addEventListener('pointerdown', ev => onItemDown(ev, it.id));
    el.addEventListener('lostpointercapture', ev => endDrag(ev.pointerId, true));
    el.addEventListener('focus', () => { if (!pressing && el.matches(':focus-visible') && selectedId !== it.id) deps.onSelect(it.id); });
    pin.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); deps.onPinPointerDown(it.id, ev); });
    layer.append(el);
    pinsLayer.append(pin);
    return { el, body, pin, key: '', item: it };
  }

  function update(e: Entry, it: Item) {
    e.item = it;
    e.el.style.width = `${it.w}px`;
    e.el.style.height = `${it.h}px`;
    e.el.style.zIndex = String(it.z);
    e.el.setAttribute('aria-label', itemLabel(it));
    e.pin.style.setProperty('--pin', it.attachColor);
    if (!drag || drag.id !== it.id) place(e, it.x, it.y);
    e.el.classList.toggle('selected', it.id === selectedId);
    e.el.classList.toggle('connect-from', it.id === connectFrom);

    const key = JSON.stringify([it.type, it.data]);
    if (key === e.key) return;
    e.key = key;
    renderItemContent(e.body, it);
    e.body.classList.remove('missing');
    const img = e.body.querySelector('img');
    const imageId = it.data.imageId;
    if (!img || !imageId) return;
    void deps.getImageUrl(imageId).then(url => {
      if (e.key !== key) return; // content changed meanwhile
      if (!url) { e.body.classList.add('missing'); return; }
      img.src = url;
      if (fresh.delete(it.id) && !deps.reducedMotion()) {
        e.body.classList.add('developing');
        const done = (ev: AnimationEvent) => {
          if (ev.animationName !== 'develop') return;
          e.body.classList.remove('developing');
          e.body.removeEventListener('animationend', done);
        };
        e.body.addEventListener('animationend', done);
      }
    });
  }

  function onItemDown(ev: PointerEvent, id: string) {
    if (ev.button !== 0 || drag || deps.viewport.pinching()) return;
    const e = entries.get(id);
    if (!e) return;
    pressing = true;
    drag = { id, pointerId: ev.pointerId, sx: ev.clientX, sy: ev.clientY, ox: e.item.x, oy: e.item.y, x: e.item.x, y: e.item.y, moved: false };
    e.el.setPointerCapture(ev.pointerId);
  }

  layer.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const e = entries.get(drag.id);
    if (!e) return;
    if (!drag.moved) {
      if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) < 5) return;
      drag.moved = true;
      deps.sfx.rustle();
      e.el.classList.add('lifted');
      e.el.style.zIndex = '100000';
    }
    const s = deps.viewport.get().scale;
    drag.x = clamp(drag.ox + (ev.clientX - drag.sx) / s, 0, BOARD_W - e.item.w);
    drag.y = clamp(drag.oy + (ev.clientY - drag.sy) / s, 0, BOARD_H - e.item.h);
    place(e, drag.x, drag.y);
    deps.strings.override(drag.id, { x: drag.x, y: drag.y });
  });

  function endDrag(pointerId: number, cancelled: boolean) {
    if (!drag || pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    pressing = false;
    deps.strings.override(d.id, null);
    const e = entries.get(d.id);
    if (!e) return; // item vanished (e.g. undo mid-drag)
    e.el.classList.remove('lifted');
    if (cancelled) { place(e, e.item.x, e.item.y); e.el.style.zIndex = String(e.item.z); return; }
    if (!d.moved) { if (!deps.onItemTap(d.id)) deps.onSelect(d.id); return; }
    const b = deps.store.get();
    deps.store.commit(bringToFront(updateItem(b, d.id, { x: d.x, y: d.y }), d.id)); // no-op if the item is gone
    deps.sfx.thunk();
    if (!deps.reducedMotion()) {
      e.body.classList.remove('settle');
      void e.body.offsetWidth; // restart animation
      e.body.classList.add('settle');
    }
  }
  layer.addEventListener('pointerup', ev => endDrag(ev.pointerId, false));
  layer.addEventListener('pointercancel', ev => endDrag(ev.pointerId, true));
  deps.viewport.el.addEventListener('viewport:pinch', () => { if (drag) endDrag(drag.pointerId, true); });

  return {
    sync(board) {
      const seen = new Set<string>();
      for (const it of board.items) {
        seen.add(it.id);
        let e = entries.get(it.id);
        if (!e) { e = create(it); entries.set(it.id, e); }
        update(e, it);
      }
      for (const [id, e] of entries) if (!seen.has(id)) {
        if (drag && drag.id === id) { drag = null; pressing = false; deps.strings.override(id, null); }
        e.el.remove(); e.pin.remove(); entries.delete(id); }
    },
    select(id) {
      selectedId = id;
      for (const [k, e] of entries) e.el.classList.toggle('selected', k === id);
    },
    markFresh(id) { fresh.add(id); },
    setConnectFrom(id) {
      connectFrom = id;
      for (const [k, e] of entries) e.el.classList.toggle('connect-from', k === id);
    },
  };
}
