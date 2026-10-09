# Task 11: Connect tool — drag from pin, tap-tap, keyboard (Sonnet)

Read `00-overview.md` Global Constraints. Depends on Tasks 2, 6, 9, 10. Parallel with Task 12.

**Files:**
- Create: `src/view/connect.ts`
- Test: `src/view/connect.test.ts`

**Consumes:** `connect` (actions), `pinPoint` (geometry), `Store`; `Viewport.toWorld/pinching`; `StringsView.preview`; `ItemsView.setConnectFrom`; `Sfx.pluck`.

**Produces:**
```ts
export interface ConnectDeps {
  store: Store;
  viewport: { toWorld(cx: number, cy: number): { x: number; y: number }; pinching(): boolean };
  strings: { preview(from: { x: number; y: number } | null, to?: { x: number; y: number }, color?: string): void };
  items: { setConnectFrom(id: string | null): void };
  sfx: { pluck(): void };
  color(): string;
  tension(): number;
  announce(msg: string): void;       // screen-reader live region
  onModeChange(on: boolean): void;   // desk spool button state
  select(itemId: string): void;      // a plain tap on a pin selects its item
}
export interface ConnectTool {
  pinDrag(fromId: string, e: PointerEvent): void;
  mode(): boolean; setMode(on: boolean): void;
  tap(itemId: string): boolean;   // returns true if the tap was consumed
  begin(fromId: string): void; complete(toId: string): boolean; cancel(): void;
  pending(): string | null;
}
export function createConnect(d: ConnectDeps): ConnectTool;
```
Rules: tap-tap works only when mode is on (spool) or after `begin` (keyboard `C`). Tapping the pending item again cancels. Duplicate or self connections are ignored with an announcement.

- [ ] **Step 1: Failing test** — `src/view/connect.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { createConnect } from './connect';
import { createStore } from '../model/store';
import { addItem, makeItem, newBoard } from '../model/actions';

function setup() {
  let b = newBoard('t', 1);
  const a = makeItem('sticky', 500, 500);
  const c = makeItem('sticky', 900, 500);
  b = addItem(addItem(b, a), c);
  const store = createStore(b);
  const deps = {
    store,
    viewport: { toWorld: (x: number, y: number) => ({ x, y }), pinching: () => false },
    strings: { preview: vi.fn() },
    items: { setConnectFrom: vi.fn() },
    sfx: { pluck: vi.fn() },
    color: () => '#1f5fae',
    tension: () => 0.4,
    announce: vi.fn(),
    onModeChange: vi.fn(),
    select: vi.fn(),
  };
  return { tool: createConnect(deps), deps, store, a, c };
}

describe('connect tool', () => {
  it('ignores taps when not in connect mode', () => {
    const { tool, store, a } = setup();
    expect(tool.tap(a.id)).toBe(false);
    expect(store.get().links).toHaveLength(0);
  });
  it('tap-tap in connect mode creates a link with current colour and tension', () => {
    const { tool, store, deps, a, c } = setup();
    tool.setMode(true);
    expect(deps.onModeChange).toHaveBeenCalledWith(true);
    expect(tool.tap(a.id)).toBe(true);
    expect(deps.items.setConnectFrom).toHaveBeenLastCalledWith(a.id);
    expect(tool.tap(c.id)).toBe(true);
    const l = store.get().links[0];
    expect([l.from, l.to, l.color, l.tension]).toEqual([a.id, c.id, '#1f5fae', 0.4]);
    expect(deps.sfx.pluck).toHaveBeenCalledOnce();
    expect(tool.pending()).toBeNull();
    expect(tool.mode()).toBe(true); // stays on for chaining
  });
  it('tapping the pending item again cancels', () => {
    const { tool, a } = setup();
    tool.setMode(true);
    tool.tap(a.id);
    tool.tap(a.id);
    expect(tool.pending()).toBeNull();
  });
  it('keyboard begin/complete works without mode', () => {
    const { tool, store, a, c } = setup();
    tool.begin(a.id);
    expect(tool.tap(c.id)).toBe(true);
    expect(store.get().links).toHaveLength(1);
  });
  it('duplicate connections are announced, not added', () => {
    const { tool, store, deps, a, c } = setup();
    tool.begin(a.id); tool.complete(c.id);
    tool.begin(c.id);
    expect(tool.complete(a.id)).toBe(false);
    expect(store.get().links).toHaveLength(1);
    expect(deps.announce).toHaveBeenLastCalledWith('Those two are already connected.');
  });
  it('turning mode off clears the pending item', () => {
    const { tool, a } = setup();
    tool.setMode(true);
    tool.tap(a.id);
    tool.setMode(false);
    expect(tool.pending()).toBeNull();
  });
});
```

Run → FAIL.

- [ ] **Step 2: connect.ts**

```ts
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
```

Run: `npm test` → PASS.

- [ ] **Step 3: Commit** (controller) — `feat(view): connect via pin drag, tap-tap and keyboard`
