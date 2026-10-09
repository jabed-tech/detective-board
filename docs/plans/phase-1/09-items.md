# Task 9: Items view — render, select, drag (Sonnet)

Read `00-overview.md` Global Constraints. Depends on Tasks 2, 6, 8 (types only from 8). Parallel with Task 10.

**Files:**
- Create: `src/view/renderers.ts`, `src/view/items.ts`, `src/styles/items.css`
- Test: `src/view/renderers.test.ts` (jsdom)

**Consumes:**
- `Board`, `Item`, `BOARD_W`, `BOARD_H` (types); `pinPoint`, `clamp` (geometry); `updateItem`, `bringToFront` (actions); `Store` (store)
- `Viewport` from `src/view/viewport.ts` — uses `el`, `get().scale`, `pinching()`; listens for `viewport:pinch` on `viewport.el`
- `Sfx` from `src/audio/sfx.ts`
- `StringsView` from `src/view/strings.ts` (Task 10, parallel) — only `override(itemId, pos | null)`. Import the type; if Task 10 isn't merged yet, declare locally: `type StringsLike = { override(id: string, pos: { x: number; y: number } | null): void }` and use that.

**Produces:**
```ts
// renderers.ts
export function renderItemContent(body: HTMLElement, it: Item): void; // builds DOM with textContent only
export function itemLabel(it: Item): string;
// items.ts
export interface ItemsDeps {
  store: Store;
  viewport: Pick<Viewport, 'el' | 'get' | 'pinching'>;
  strings: { override(itemId: string, pos: { x: number; y: number } | null): void };
  sfx: Pick<Sfx, 'thunk' | 'rustle'>;
  getImageUrl(id: string): Promise<string | undefined>;
  reducedMotion(): boolean;
  onSelect(id: string): void;            // tap (no drag) or keyboard focus
  onItemTap(id: string): boolean;        // connect tool may consume the tap; return true if consumed
  onPinPointerDown(id: string, e: PointerEvent): void;
}
export interface ItemsView { sync(board: Board): void; select(id: string | null): void; markFresh(id: string): void; setConnectFrom(id: string | null): void }
export function createItems(layer: HTMLElement, pinsLayer: HTMLElement, deps: ItemsDeps): ItemsView;
```
DOM contract: item element has `data-item-id`; pin is a `<button class="pin" data-pin-for="<id>">` in `pinsLayer`. Drag = pointer moves > 5 px; otherwise it's a tap. Drag commits once on release (one undo step). Selection does not change during a drag.

- [ ] **Step 1: Failing test** — `src/view/renderers.test.ts` (Review Focus #1)

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderItemContent, itemLabel } from './renderers';
import { makeItem } from '../model/actions';

const evil = '<img src=x onerror="window.pwned=1"><b>bold</b>';

describe('renderers', () => {
  it('renders sticky text literally', () => {
    const body = document.createElement('div');
    renderItemContent(body, makeItem('sticky', 0, 0, { text: evil }));
    expect(body.querySelector('img, b')).toBeNull();
    expect(body.textContent).toBe(evil);
  });
  it('renders polaroid captions literally and adds an img only for imageId', () => {
    const body = document.createElement('div');
    renderItemContent(body, makeItem('polaroid', 0, 0, { caption: evil, imageId: 'abc' }));
    expect(body.querySelectorAll('img')).toHaveLength(1);
    expect(body.querySelector('b')).toBeNull();
    expect(body.querySelector('.pol-cap')!.textContent).toBe(evil);
  });
  it('polaroid without a photo shows a silhouette', () => {
    const body = document.createElement('div');
    renderItemContent(body, makeItem('polaroid', 0, 0, { caption: 'Gary' }));
    expect(body.querySelector('img')).toBeNull();
    expect(body.querySelector('.pol-silhouette')).not.toBeNull();
  });
  it('re-rendering replaces old content', () => {
    const body = document.createElement('div');
    renderItemContent(body, makeItem('sticky', 0, 0, { text: 'one' }));
    renderItemContent(body, makeItem('sticky', 0, 0, { text: 'two' }));
    expect(body.textContent).toBe('two');
  });
  it('labels items for screen readers', () => {
    expect(itemLabel(makeItem('sticky', 0, 0, { text: '  Gary did it  ' }))).toBe('Sticky note: Gary did it');
    expect(itemLabel(makeItem('photo', 0, 0, {}))).toBe('Photograph');
  });
});
```

Run → FAIL.

- [ ] **Step 2: renderers.ts**

```ts
import type { Item, ItemType } from '../model/types';

const NAMES: Record<ItemType, string> = { photo: 'Photograph', polaroid: 'Polaroid', sticky: 'Sticky note', index: 'Index card' };

function add<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, cls: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  n.className = cls;
  parent.append(n);
  return n;
}
function photo(parent: HTMLElement): void {
  const img = add(parent, 'img', 'it-img');
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
}

export function renderItemContent(body: HTMLElement, it: Item): void {
  body.replaceChildren();
  switch (it.type) {
    case 'photo': {
      const frame = add(body, 'div', 'ph-frame');
      if (it.data.imageId) photo(frame);
      break;
    }
    case 'polaroid': {
      const win = add(body, 'div', 'pol-window');
      if (it.data.imageId) photo(win); else add(win, 'div', 'pol-silhouette');
      add(body, 'p', 'pol-cap').textContent = it.data.caption ?? '';
      break;
    }
    case 'sticky':
    case 'index':
      add(body, 'p', 'it-text').textContent = it.data.text ?? '';
      break;
  }
}

export function itemLabel(it: Item): string {
  const t = (it.data.text ?? it.data.caption ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return t ? `${NAMES[it.type]}: ${t}` : NAMES[it.type];
}
```

Run → PASS.

- [ ] **Step 3: items.ts**

```ts
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
    el.addEventListener('focus', () => { if (!pressing && selectedId !== it.id) deps.onSelect(it.id); });
    pin.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); deps.onPinPointerDown(it.id, ev); });
    layer.append(el);
    pinsLayer.append(pin);
    return { el, body, pin, key: '', item: it };
  }

  function update(e: Entry, it: Item) {
    e.item = it;
    e.el.className = `item item-${it.type}`;
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
        e.body.addEventListener('animationend', () => e.body.classList.remove('developing'), { once: true });
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
      for (const [id, e] of entries) if (!seen.has(id)) { e.el.remove(); e.pin.remove(); entries.delete(id); }
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
```

- [ ] **Step 4: items.css**

```css
.items-layer, .pins-layer { position: absolute; inset: 0; }
.pins-layer { pointer-events: none; }

.item { position: absolute; left: 0; top: 0; transform-origin: 50% 50%; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; cursor: grab; outline: none; }
.item.lifted { cursor: grabbing; }
.item-body {
  position: relative; width: 100%; height: 100%; box-sizing: border-box;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .45), 6px 14px 22px -6px rgba(0, 0, 0, .55);
  transition: transform .12s ease, box-shadow .12s ease;
}
.item-body::after { /* paper curl / sheen */
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, .12), transparent 30%, transparent 75%, rgba(0, 0, 0, .12));
}
.item.lifted .item-body { transform: scale(1.04); box-shadow: 0 2px 4px rgba(0, 0, 0, .35), 14px 30px 40px -8px rgba(0, 0, 0, .55); }
.item:focus-visible .item-body, .item.selected .item-body { outline: 3px dashed var(--focus); outline-offset: 6px; }
.item.connect-from .item-body { outline: 4px solid var(--focus); outline-offset: 6px; }

.settle { animation: settle .32s ease-out; }
@keyframes settle { 0% { transform: scale(1.04); } 60% { transform: scale(.99); } 100% { transform: scale(1); } }
.developing img { animation: develop 2s ease-out; }
@keyframes develop { from { filter: sepia(1) hue-rotate(50deg) saturate(.4) brightness(1.4) contrast(.6); } to { filter: none; } }

.it-img { display: block; width: 100%; height: 100%; object-fit: cover; }
.missing .ph-frame::after, .missing .pol-window::after {
  content: 'Photo missing'; position: absolute; inset: 0; display: grid; place-items: center;
  color: #d8cfb8; font: 16px var(--font-ui);
}

.item-photo .item-body { background: #fdfaf2; padding: 8px; }
.ph-frame { position: relative; width: 100%; height: 100%; overflow: hidden; background: #222; }

.item-polaroid .item-body { background: #fbf8ef; padding: 14px 14px 0; }
.pol-window { position: relative; height: calc(100% - 64px); overflow: hidden; background: #1d1a17; }
.pol-silhouette { position: absolute; inset: 0;
  background:
    radial-gradient(circle at 50% 38%, #3a352f 0 18%, transparent 19%),
    radial-gradient(ellipse 42% 30% at 50% 100%, #3a352f 0 98%, transparent 100%);
}
.pol-cap { margin: 10px 0 0; font: 26px/1.1 var(--font-hand); color: #1d2a5c; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.item-sticky .item-body { background: linear-gradient(#f9e98f, #f3dc6b); padding: 26px 16px 12px; }
.item-index .item-body {
  padding: 34px 16px 8px;
  background:
    linear-gradient(transparent 27px, #d9534f 27px 29px, transparent 29px),
    repeating-linear-gradient(transparent 0 27px, #9fc3e6 27px 28px) 0 30px / 100% 28px,
    #fbfaf4;
}
.it-text { margin: 0; height: 100%; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; color: #22201a; }
.item-sticky .it-text { font: 26px/1.15 var(--font-hand); }
.item-index .it-text { font: 18px/28px var(--font-ui); }

/* Pins: visual head is world-sized; hit area stays ≥ 44 screen px at any zoom. */
.pin {
  position: absolute; left: 0; top: 0; padding: 0; border: 0; background: transparent;
  width: calc(44px * var(--inv-scale, 1)); height: calc(44px * var(--inv-scale, 1));
  margin: calc(-22px * var(--inv-scale, 1)) 0 0 calc(-22px * var(--inv-scale, 1));
  min-width: 0; min-height: 0; pointer-events: auto; cursor: crosshair; touch-action: none;
}
.pin::before {
  content: ''; position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, rgba(255, 255, 255, .9) 0 2px, transparent 3px),
    radial-gradient(circle, var(--pin, #c0392b) 55%, color-mix(in srgb, var(--pin, #c0392b) 60%, #000) 100%);
  box-shadow: 2px 4px 4px rgba(0, 0, 0, .5);
}
```

Note: the pin's `transform` (set inline) positions its top-left at the pin point; the negative margin centres it.

- [ ] **Step 5: Verify** — `npm test` PASS; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit** (controller) — `feat(view): items render/select/drag with settle + develop`
