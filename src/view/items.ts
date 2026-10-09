import { BOARD_H, BOARD_W, ITEM_SIZES, type Anchor, type Board, type Item, type Mode } from '../model/types';
import { anchorPoint, clamp, pinPoint } from '../model/geometry';
import { bringToFront, updateItem } from '../model/actions';
import type { Store } from '../model/store';
import type { Viewport } from './viewport';
import type { Sfx } from '../audio/sfx';
import { FASTENERS } from '../model/types';
import { itemLabel, renderItemContent } from './renderers';

type Pt = { x: number; y: number };
const MIN_SIZE = 80;
const MAX_SIZE = 1200;

/** Resize about the top-left corner as it sits in the item's rotated frame. */
function sized(it: Item, w: number, h: number): Item {
  const r = (it.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const tlx = it.x + it.w / 2 + (-it.w / 2) * c - (-it.h / 2) * s; // top-left corner stays put
  const tly = it.y + it.h / 2 + (-it.w / 2) * s + (-it.h / 2) * c;
  const cx = tlx + (w / 2) * c - (h / 2) * s;
  const cy = tly + (w / 2) * s + (h / 2) * c;
  return { ...it, w, h, x: cx - w / 2, y: cy - h / 2 };
}

/** Uniform scale by f (clamped to 80–1200 on both sides) for keys and the drawer slider. */
export function scaledGeom(it: Item, f: number): Pick<Item, 'x' | 'y' | 'w' | 'h'> {
  const k = Math.min(MAX_SIZE / it.w, MAX_SIZE / it.h, Math.max(MIN_SIZE / it.w, MIN_SIZE / it.h, f));
  const { x, y, w, h } = sized(it, it.w * k, it.h * k);
  return { x, y, w, h };
}

export interface ItemsDeps {
  store: Store;
  viewport: Pick<Viewport, 'el' | 'get' | 'pinching' | 'toWorld' | 'onChange'>;
  strings: { override(itemId: string, pos: (Pt & { rot?: number; w?: number; h?: number }) | null): void };
  sfx: Pick<Sfx, 'thunk' | 'rustle'>;
  getImageUrl(id: string): Promise<string | undefined>;
  reducedMotion(): boolean;
  onSelect(id: string): void;
  onItemTap(id: string): boolean;
  mode(): Mode;
  onErase(id: string): void;
  onStringPointerDown(id: string, e: PointerEvent): void;
}
export interface ItemsView { sync(board: Board): void; select(id: string | null): void; markFresh(id: string): void; setConnectFrom(id: string | null): void; setHot(id: string | null): void; refreshHandles(): void }

interface Entry { el: HTMLElement; body: HTMLElement; pin: HTMLButtonElement; key: string; item: Item }
interface AnchorPin { el: HTMLElement; itemId: string; at: Anchor }
interface Drag { id: string; pointerId: number; sx: number; sy: number; ox: number; oy: number; x: number; y: number; moved: boolean }

export function createItems(layer: HTMLElement, pinsLayer: HTMLElement, deps: ItemsDeps): ItemsView {
  const entries = new Map<string, Entry>();
  const fresh = new Set<string>();
  const anchorPins = new Map<string, AnchorPin>(); // key `${linkId}:from|to`
  let selectedId: string | null = null;
  let connectFrom: string | null = null;
  let drag: Drag | null = null;
  let erasing: { id: string; pointerId: number; sx: number; sy: number } | null = null;
  let pressing = false; // suppress focus→select while a pointer is down

  const norm = (r: number) => ((((r + 180) % 360) + 360) % 360) - 180;
  let rotDrag: { id: string; pointerId: number; a0: number; r0: number; rot: number } | null = null;
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'rotate-handle';
  handle.textContent = '↻';
  handle.hidden = true;
  handle.setAttribute('aria-label', 'Rotate — drag around');
  pinsLayer.append(handle);

  function refreshHandle() {
    const e = selectedId ? entries.get(selectedId) : undefined;
    const scale = deps.viewport.get().scale;
    const tiny = !!e && !rotDrag && !resDrag && Math.min(e.item.w, e.item.h) * scale < 64; // handles would cover the item
    handle.hidden = resizeHandle.hidden = !e || !!drag?.moved || deps.mode() !== 'move' || tiny;
    if (!e || handle.hidden) return;
    const it = e.item;
    const r = ((rotDrag?.id === it.id ? rotDrag.rot : it.rot) * Math.PI) / 180;
    const pad = 30 / scale; // fixed distance on screen, not on the board
    const lx = it.w / 2 + pad, ly = -it.h / 2 - pad;
    const x = it.x + it.w / 2 + lx * Math.cos(r) - ly * Math.sin(r);
    const y = it.y + it.h / 2 + lx * Math.sin(r) + ly * Math.cos(r);
    handle.style.transform = `translate(${x}px, ${y}px)`;
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    const rx = it.w / 2 + pad, ry = it.h / 2 + pad; // bottom-right corner, pushed out
    const bx = cx + rx * Math.cos(r) - ry * Math.sin(r);
    const by = cy + rx * Math.sin(r) + ry * Math.cos(r);
    resizeHandle.style.transform = `translate(${bx}px, ${by}px)`;
  }

  // Resize: project the pointer's world delta onto the item's rotated axes, keep the top-left corner fixed.
  interface ResDrag { id: string; pointerId: number; p0: Pt; it0: Item; live: Item }
  let resDrag: ResDrag | null = null;
  const resizeHandle = document.createElement('button');
  resizeHandle.type = 'button';
  resizeHandle.className = 'resize-handle';
  resizeHandle.textContent = '⤡';
  resizeHandle.hidden = true;
  resizeHandle.setAttribute('aria-label', 'Resize — drag the corner');
  pinsLayer.append(resizeHandle);

  const keepsAspect = (it: Item) => it.type === 'photo' || it.type === 'polaroid';
  function resizeTo(it: Item, nw: number, nh: number): Item {
    if (keepsAspect(it)) {
      const k = Math.min(MAX_SIZE / it.w, MAX_SIZE / it.h, Math.max(MIN_SIZE / it.w, MIN_SIZE / it.h, Math.max(nw / it.w, nh / it.h)));
      return sized(it, it.w * k, it.h * k);
    }
    return sized(it, clamp(nw, MIN_SIZE, MAX_SIZE), clamp(nh, MIN_SIZE, MAX_SIZE));
  }
  resizeHandle.addEventListener('pointerdown', ev => {
    const e = selectedId ? entries.get(selectedId) : undefined;
    if (ev.button !== 0 || !e || rotDrag || resDrag || drag || deps.viewport.pinching()) return;
    ev.stopPropagation(); ev.preventDefault();
    resDrag = { id: e.item.id, pointerId: ev.pointerId, p0: deps.viewport.toWorld(ev.clientX, ev.clientY), it0: e.item, live: e.item };
    resizeHandle.setPointerCapture(ev.pointerId);
    deps.sfx.rustle();
  });
  resizeHandle.addEventListener('pointermove', ev => {
    if (!resDrag || ev.pointerId !== resDrag.pointerId) return;
    const e = entries.get(resDrag.id);
    if (!e) return;
    const { it0 } = resDrag;
    const p = deps.viewport.toWorld(ev.clientX, ev.clientY);
    const dx = p.x - resDrag.p0.x, dy = p.y - resDrag.p0.y;
    const r = (it0.rot * Math.PI) / 180;
    const live = resizeTo(it0, it0.w + dx * Math.cos(r) + dy * Math.sin(r), it0.h - dx * Math.sin(r) + dy * Math.cos(r));
    resDrag.live = live;
    e.item = live;
    applyGeom(e);
    deps.strings.override(live.id, { x: live.x, y: live.y, rot: live.rot, w: live.w, h: live.h });
    refreshHandle();
  });
  function endRes(ev: PointerEvent, cancelled: boolean) {
    if (!resDrag || ev.pointerId !== resDrag.pointerId) return;
    const d = resDrag;
    resDrag = null;
    deps.strings.override(d.id, null);
    const e = entries.get(d.id);
    if (!e) return;
    if (cancelled) { e.item = d.it0; applyGeom(e); }
    else {
      const { x, y, w, h } = d.live;
      deps.store.commit(updateItem(deps.store.get(), d.id, { x, y, w, h }));
    }
    refreshHandle();
  }
  resizeHandle.addEventListener('pointerup', ev => endRes(ev, false));
  resizeHandle.addEventListener('pointercancel', ev => endRes(ev, true));
  resizeHandle.addEventListener('lostpointercapture', ev => endRes(ev, true)); // no-op after a normal end

  const angleOf = (ev: PointerEvent, it: Item) => {
    const w = deps.viewport.toWorld(ev.clientX, ev.clientY);
    return (Math.atan2(w.y - (it.y + it.h / 2), w.x - (it.x + it.w / 2)) * 180) / Math.PI;
  };
  handle.addEventListener('pointerdown', ev => {
    const e = selectedId ? entries.get(selectedId) : undefined;
    if (ev.button !== 0 || !e || rotDrag || resDrag || drag || deps.viewport.pinching()) return;
    ev.stopPropagation(); ev.preventDefault();
    rotDrag = { id: e.item.id, pointerId: ev.pointerId, a0: angleOf(ev, e.item), r0: e.item.rot, rot: e.item.rot };
    handle.setPointerCapture(ev.pointerId);
    deps.sfx.rustle();
  });
  handle.addEventListener('pointermove', ev => {
    if (!rotDrag || ev.pointerId !== rotDrag.pointerId) return;
    const e = entries.get(rotDrag.id);
    if (!e) return;
    let r = rotDrag.r0 + angleOf(ev, e.item) - rotDrag.a0;
    if (ev.shiftKey) r = Math.round(r / 15) * 15;
    rotDrag.rot = norm(r);
    place(e, e.item.x, e.item.y);
    deps.strings.override(e.item.id, { x: e.item.x, y: e.item.y, rot: rotDrag.rot });
    refreshHandle();
  });
  function endRot(ev: PointerEvent, cancelled: boolean) {
    if (!rotDrag || ev.pointerId !== rotDrag.pointerId) return;
    const d = rotDrag;
    rotDrag = null;
    deps.strings.override(d.id, null);
    const e = entries.get(d.id);
    if (!e) return;
    if (cancelled) place(e, e.item.x, e.item.y);
    else deps.store.commit(updateItem(deps.store.get(), d.id, { rot: d.rot }));
    refreshHandle();
  }
  handle.addEventListener('pointerup', ev => endRot(ev, false));
  handle.addEventListener('pointercancel', ev => endRot(ev, true));
  handle.addEventListener('lostpointercapture', ev => endRot(ev, true)); // no-op after a normal end

  function place(e: Entry, x: number, y: number) {
    const rot = rotDrag?.id === e.item.id ? rotDrag.rot : e.item.rot;
    e.el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    const p = pinPoint({ ...e.item, x, y, rot });
    e.pin.style.transform = `translate(${p.x}px, ${p.y}px)`;
    for (const a of anchorPins.values()) if (a.itemId === e.item.id) putAnchor(a, { ...e.item, x, y, rot });
  }

  function putAnchor(a: AnchorPin, it: Pick<Item, 'x' | 'y' | 'w' | 'h' | 'rot'>) {
    const p = anchorPoint(it, a.at);
    a.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  function applyGeom(e: Entry) {
    const it = e.item;
    e.el.style.width = `${it.w}px`;
    e.el.style.height = `${it.h}px`;
    e.el.style.setProperty('--k', String(it.w / ITEM_SIZES[it.type].w)); // text scales with the card
    place(e, it.x, it.y);
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
    el.addEventListener('pointerdown', ev => onItemDown(ev, it.id));
    el.addEventListener('pointerenter', () => el.classList.add('hot'));
    el.addEventListener('pointerleave', () => { if (!erasing && !drag) el.classList.remove('hot'); }); // a captured press stays lit until release
    el.addEventListener('lostpointercapture', ev => endDrag(ev.pointerId, true));
    el.addEventListener('focus', () => { if (!pressing && el.matches(':focus-visible') && selectedId !== it.id) deps.onSelect(it.id); });
    pin.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); deps.onStringPointerDown(it.id, ev); });
    layer.append(el);
    pinsLayer.append(pin);
    return { el, body, pin, key: '', item: it };
  }

  function update(e: Entry, it: Item) {
    e.item = it;
    e.el.style.width = `${it.w}px`;
    e.el.style.height = `${it.h}px`;
    e.el.style.setProperty('--k', String(it.w / ITEM_SIZES[it.type].w));
    e.el.style.zIndex = String(it.z);
    e.el.setAttribute('aria-label', itemLabel(it));
    e.pin.style.setProperty('--pin', it.attachColor);
    e.pin.dataset.kind = it.attach;
    e.pin.setAttribute('aria-label', `${FASTENERS.find(f => f.id === it.attach)?.name ?? 'Push pin'} — drag to another item to connect`);
    if ((!drag || drag.id !== it.id) && rotDrag?.id !== it.id && resDrag?.id !== it.id) place(e, it.x, it.y);
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
    e.el.classList.add('hot'); // touch has no hover
    if (deps.mode() === 'string') { deps.onStringPointerDown(id, ev); return; }
    if (deps.mode() === 'erase') {
      erasing = { id, pointerId: ev.pointerId, sx: ev.clientX, sy: ev.clientY };
      e.el.setPointerCapture(ev.pointerId);
      return;
    }
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
      refreshHandle();
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
    refreshHandle();
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
  function endErase(ev: PointerEvent, cancelled: boolean) {
    if (!erasing || ev.pointerId !== erasing.pointerId) return;
    const d = erasing;
    erasing = null;
    const over = document.elementFromPoint?.(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-item-id]');
    const slidOff = !!document.elementFromPoint && over?.dataset.itemId !== d.id; // sliding off cancels
    if (!cancelled && !slidOff && !deps.viewport.pinching() && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < 5) deps.onErase(d.id);
  }
  const unlit = (ev: PointerEvent) => { // touch has no hover to fall back on
    if (ev.pointerType === 'touch') for (const e of entries.values()) e.el.classList.remove('hot');
  };
  layer.addEventListener('pointerup', ev => { endDrag(ev.pointerId, false); endErase(ev, false); unlit(ev); });
  layer.addEventListener('pointercancel', ev => { endDrag(ev.pointerId, true); endErase(ev, true); unlit(ev); });
  deps.viewport.el.addEventListener('viewport:pinch', () => { erasing = null; if (drag) endDrag(drag.pointerId, true); });
  deps.viewport.onChange(refreshHandle); // handle offset depends on zoom

  return {
    sync(board) {
      const seen = new Set<string>();
      for (const it of board.items) {
        seen.add(it.id);
        let e = entries.get(it.id);
        if (!e) { e = create(it); entries.set(it.id, e); }
        update(e, it);
      }
      const keys = new Set<string>();
      for (const l of board.links) {
        for (const [end, itemId, at] of [['from', l.from, l.fromAt], ['to', l.to, l.toAt]] as const) {
          if (!at) continue;
          const key = `${l.id}:${end}`;
          keys.add(key);
          let a = anchorPins.get(key);
          if (!a) {
            const el = document.createElement('span');
            el.className = 'anchor-pin';
            el.setAttribute('aria-hidden', 'true');
            pinsLayer.append(el);
            a = { el, itemId, at };
            anchorPins.set(key, a);
          }
          a.itemId = itemId; a.at = at;
          a.el.dataset.pinFor = itemId;
          a.el.style.setProperty('--pin', l.color);
          const e = entries.get(itemId);
          if (e && drag?.id !== itemId && rotDrag?.id !== itemId && resDrag?.id !== itemId) putAnchor(a, e.item);
        }
      }
      for (const [key, a] of anchorPins) if (!keys.has(key)) { a.el.remove(); anchorPins.delete(key); }
      for (const [id, e] of entries) if (!seen.has(id)) {
        if (drag && drag.id === id) { drag = null; pressing = false; deps.strings.override(id, null); }
        e.el.remove(); e.pin.remove(); entries.delete(id); }
      refreshHandle();
    },
    select(id) {
      selectedId = id;
      for (const [k, e] of entries) e.el.classList.toggle('selected', k === id);
      refreshHandle();
    },
    markFresh(id) { fresh.add(id); },
    refreshHandles: refreshHandle,
    setHot(id) { for (const [k, e] of entries) if (k === id || e.el.classList.contains('hot')) e.el.classList.toggle('hot', k === id); },
    setConnectFrom(id) {
      connectFrom = id;
      for (const [k, e] of entries) e.el.classList.toggle('connect-from', k === id);
    },
  };
}
