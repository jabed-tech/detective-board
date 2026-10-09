# Task 2: Model & store (Sonnet)

Read `00-overview.md` Global Constraints first. Depends on Task 1.

**Files:**
- Create: `src/model/types.ts`, `src/model/geometry.ts`, `src/model/actions.ts`, `src/model/store.ts`
- Test: `src/model/geometry.test.ts`, `src/model/actions.test.ts`, `src/model/store.test.ts`

**Produces:** all types and pure reducers below. Reducers never mutate input and return the **same reference** when nothing changes (missing id, duplicate link, self-link). Reducers do not touch `updatedAt` (autosave sets it).

- [ ] **Step 1: types.ts**

```ts
export type ItemType = 'photo' | 'polaroid' | 'sticky' | 'index';
export type SurfaceId = 'cork';
export type MoodId = 'noir-office';
export type FastenerId = 'pin';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type Atmosphere = 'full' | 'gentle' | 'off';

export interface ItemData { imageId?: string; text?: string; caption?: string }

export interface Item {
  id: string; type: ItemType;
  x: number; y: number; w: number; h: number; // top-left + size in world px, before rotation
  rot: number; // degrees, rotation about centre
  z: number;
  attach: FastenerId; attachColor: string;
  data: ItemData;
}

export interface Link {
  id: string; from: string; to: string;
  color: string; tension: number; // 0 taut … 1 droopy
  style?: LineStyle; label?: string;
}

export interface Board {
  id: string; name: string; caseNo: number;
  surface: SurfaceId; mood: MoodId;
  items: Item[]; links: Link[];
  version: 1; updatedAt: number;
}

export const BOARD_W = 4000;
export const BOARD_H = 3000;

export const ITEM_SIZES: Record<ItemType, { w: number; h: number }> = {
  photo: { w: 260, h: 200 },
  polaroid: { w: 240, h: 290 },
  sticky: { w: 220, h: 220 },
  index: { w: 320, h: 200 },
};

export const PIN_COLORS = ['#c0392b', '#1f5fae', '#2f7d32', '#e0b000', '#ece6d6', '#6a3d9a'] as const;
export const YARN_COLORS = ['#b3261e', '#1f5fae', '#2f7d32', '#e0b000', '#ece6d6', '#1d1d1d', '#6a3d9a', '#d9661f'] as const;
```

- [ ] **Step 2: Write failing geometry test** — `src/model/geometry.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { pinPoint, clamp, PIN_INSET } from './geometry';

const base = { x: 100, y: 200, w: 200, h: 100, rot: 0 };

describe('pinPoint', () => {
  it('sits top-centre when unrotated', () => {
    expect(pinPoint(base)).toEqual({ x: 200, y: 200 + PIN_INSET });
  });
  it('rotates about the item centre', () => {
    const p = pinPoint({ ...base, rot: 90 });
    // centre (200,250); local offset (0,-50+14) rotated 90deg -> (36, 0)
    expect(p.x).toBeCloseTo(200 + 50 - PIN_INSET);
    expect(p.y).toBeCloseTo(250);
  });
});

describe('clamp', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
```

Run: `npx vitest run src/model/geometry.test.ts` → FAIL (module missing).

- [ ] **Step 3: geometry.ts**

```ts
import type { Item } from './types';

export const PIN_INSET = 14;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function pinPoint(it: Pick<Item, 'x' | 'y' | 'w' | 'h' | 'rot'>): { x: number; y: number } {
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  const ly = -it.h / 2 + PIN_INSET; // local x is 0
  const r = (it.rot * Math.PI) / 180;
  return { x: cx - ly * Math.sin(r), y: cy + ly * Math.cos(r) };
}
```

Run test → PASS.

- [ ] **Step 4: Write failing actions test** — `src/model/actions.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { newBoard, makeItem, addItem, updateItem, removeItem, bringToFront, connect, updateLink, removeLink } from './actions';
import { BOARD_W, ITEM_SIZES } from './types';

const rand = () => 0.5;
function twoItems() {
  let b = newBoard('Test', 1);
  const a = makeItem('sticky', 500, 500, { text: 'A' }, undefined, rand);
  const c = makeItem('index', 900, 500, { text: 'C' }, undefined, rand);
  b = addItem(addItem(b, a), c);
  return { b, a, c };
}

describe('makeItem', () => {
  it('centres the item on the point with default size', () => {
    const it = makeItem('sticky', 500, 400, {}, undefined, rand);
    expect(it.w).toBe(ITEM_SIZES.sticky.w);
    expect(it.x + it.w / 2).toBe(500);
    expect(it.y + it.h / 2).toBe(400);
    expect(Math.abs(it.rot)).toBeLessThanOrEqual(4);
  });
  it('accepts a size override', () => {
    const it = makeItem('photo', 500, 400, {}, { w: 260, h: 390 }, rand);
    expect(it.h).toBe(390);
  });
});

describe('addItem / updateItem', () => {
  it('gives new items the highest z', () => {
    const { b, a, c } = twoItems();
    const za = b.items.find(i => i.id === a.id)!.z;
    const zc = b.items.find(i => i.id === c.id)!.z;
    expect(zc).toBeGreaterThan(za);
  });
  it('clamps positions inside the board', () => {
    const { b, a } = twoItems();
    const next = updateItem(b, a.id, { x: 99999, y: -50 });
    const it = next.items.find(i => i.id === a.id)!;
    expect(it.x).toBe(BOARD_W - it.w);
    expect(it.y).toBe(0);
  });
  it('returns the same board for a missing id', () => {
    const { b } = twoItems();
    expect(updateItem(b, 'nope', { x: 1 })).toBe(b);
    expect(removeItem(b, 'nope')).toBe(b);
    expect(bringToFront(b, 'nope')).toBe(b);
  });
  it('does not mutate the input', () => {
    const { b, a } = twoItems();
    const before = JSON.stringify(b);
    updateItem(b, a.id, { x: 10 });
    expect(JSON.stringify(b)).toBe(before);
  });
});

describe('links', () => {
  it('connects two items once, in either direction', () => {
    const { b, a, c } = twoItems();
    const b1 = connect(b, a.id, c.id, { color: '#b3261e', tension: 0.5 });
    expect(b1.links).toHaveLength(1);
    expect(connect(b1, a.id, c.id, { color: '#b3261e', tension: 0.5 })).toBe(b1);
    expect(connect(b1, c.id, a.id, { color: '#b3261e', tension: 0.5 })).toBe(b1);
  });
  it('rejects self-links and missing items', () => {
    const { b, a } = twoItems();
    expect(connect(b, a.id, a.id, { color: '#b3261e', tension: 0.5 })).toBe(b);
    expect(connect(b, a.id, 'ghost', { color: '#b3261e', tension: 0.5 })).toBe(b);
  });
  it('removing an item removes its strings', () => {
    const { b, a, c } = twoItems();
    const b1 = connect(b, a.id, c.id, { color: '#b3261e', tension: 0.5 });
    const b2 = removeItem(b1, a.id);
    expect(b2.items).toHaveLength(1);
    expect(b2.links).toHaveLength(0);
  });
  it('updates and removes links; clamps tension', () => {
    const { b, a, c } = twoItems();
    const b1 = connect(b, a.id, c.id, { color: '#b3261e', tension: 0.5 });
    const id = b1.links[0].id;
    expect(updateLink(b1, id, { tension: 7 }).links[0].tension).toBe(1);
    expect(removeLink(b1, id).links).toHaveLength(0);
    expect(updateLink(b1, 'nope', { tension: 0 })).toBe(b1);
  });
});
```

Run: `npx vitest run src/model/actions.test.ts` → FAIL.

- [ ] **Step 5: actions.ts**

```ts
import { BOARD_H, BOARD_W, ITEM_SIZES, PIN_COLORS, type Board, type Item, type ItemData, type ItemType, type Link } from './types';
import { clamp } from './geometry';

export function newId(): string {
  return crypto.randomUUID();
}

export function newBoard(name: string, caseNo: number): Board {
  return { id: newId(), name, caseNo, surface: 'cork', mood: 'noir-office', items: [], links: [], version: 1, updatedAt: 0 };
}

export function makeItem(
  type: ItemType, cx: number, cy: number, data: ItemData = {},
  size?: { w: number; h: number }, rand: () => number = Math.random,
): Item {
  const { w, h } = size ?? ITEM_SIZES[type];
  return {
    id: newId(), type,
    x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h,
    rot: Math.round((rand() * 8 - 4) * 10) / 10,
    z: 0, attach: 'pin',
    attachColor: PIN_COLORS[Math.floor(rand() * 4)],
    data,
  };
}

function clampPos(it: Item): Item {
  return { ...it, x: clamp(it.x, 0, BOARD_W - it.w), y: clamp(it.y, 0, BOARD_H - it.h) };
}

const maxZ = (b: Board) => b.items.reduce((m, i) => Math.max(m, i.z), 0);

export function addItem(b: Board, item: Item): Board {
  return { ...b, items: [...b.items, clampPos({ ...item, z: maxZ(b) + 1 })] };
}

export function updateItem(b: Board, id: string, patch: Partial<Omit<Item, 'id'>>): Board {
  const idx = b.items.findIndex(i => i.id === id);
  if (idx < 0) return b;
  const items = b.items.slice();
  items[idx] = clampPos({ ...items[idx], ...patch });
  return { ...b, items };
}

export function removeItem(b: Board, id: string): Board {
  if (!b.items.some(i => i.id === id)) return b;
  return {
    ...b,
    items: b.items.filter(i => i.id !== id),
    links: b.links.filter(l => l.from !== id && l.to !== id),
  };
}

export function bringToFront(b: Board, id: string): Board {
  const it = b.items.find(i => i.id === id);
  if (!it) return b;
  const top = maxZ(b);
  if (it.z === top && b.items.filter(i => i.z === top).length === 1) return b;
  return updateItem(b, id, { z: top + 1 });
}

export function connect(b: Board, from: string, to: string, opts: { color: string; tension: number }): Board {
  if (from === to) return b;
  if (!b.items.some(i => i.id === from) || !b.items.some(i => i.id === to)) return b;
  if (b.links.some(l => (l.from === from && l.to === to) || (l.from === to && l.to === from))) return b;
  const link: Link = { id: newId(), from, to, color: opts.color, tension: clamp(opts.tension, 0, 1) };
  return { ...b, links: [...b.links, link] };
}

export function updateLink(b: Board, id: string, patch: Partial<Omit<Link, 'id' | 'from' | 'to'>>): Board {
  const idx = b.links.findIndex(l => l.id === id);
  if (idx < 0) return b;
  const links = b.links.slice();
  const next = { ...links[idx], ...patch };
  next.tension = clamp(next.tension, 0, 1);
  links[idx] = next;
  return { ...b, links };
}

export function removeLink(b: Board, id: string): Board {
  if (!b.links.some(l => l.id === id)) return b;
  return { ...b, links: b.links.filter(l => l.id !== id) };
}
```

Run test → PASS.

- [ ] **Step 6: Write failing store test** — `src/model/store.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { createStore } from './store';
import { newBoard } from './actions';

describe('store', () => {
  it('commits, undoes and redoes', () => {
    const b0 = newBoard('a', 1);
    const s = createStore(b0);
    const b1 = { ...b0, name: 'b' };
    s.commit(b1);
    expect(s.get()).toBe(b1);
    expect(s.undo()).toBe(true);
    expect(s.get()).toBe(b0);
    expect(s.redo()).toBe(true);
    expect(s.get()).toBe(b1);
    expect(s.redo()).toBe(false);
  });
  it('ignores committing the same reference', () => {
    const s = createStore(newBoard('a', 1));
    const fn = vi.fn();
    s.subscribe(fn);
    s.commit(s.get());
    expect(fn).not.toHaveBeenCalled();
    expect(s.canUndo()).toBe(false);
  });
  it('a new commit clears redo', () => {
    const b0 = newBoard('a', 1);
    const s = createStore(b0);
    s.commit({ ...b0, name: 'b' });
    s.undo();
    s.commit({ ...b0, name: 'c' });
    expect(s.canRedo()).toBe(false);
  });
  it('caps history', () => {
    const b0 = newBoard('a', 1);
    const s = createStore(b0, 3);
    for (let i = 0; i < 5; i++) s.commit({ ...b0, name: String(i) });
    let n = 0;
    while (s.undo()) n++;
    expect(n).toBe(3);
  });
  it('load resets history and reports reason', () => {
    const s = createStore(newBoard('a', 1));
    s.commit({ ...s.get(), name: 'x' });
    const fn = vi.fn();
    s.subscribe(fn);
    const other = newBoard('o', 2);
    s.load(other);
    expect(fn).toHaveBeenCalledWith(other, 'load');
    expect(s.canUndo()).toBe(false);
  });
  it('unsubscribes', () => {
    const s = createStore(newBoard('a', 1));
    const fn = vi.fn();
    const off = s.subscribe(fn);
    off();
    s.commit({ ...s.get(), name: 'z' });
    expect(fn).not.toHaveBeenCalled();
  });
});
```

Run → FAIL.

- [ ] **Step 7: store.ts**

```ts
import type { Board } from './types';

export type ChangeReason = 'commit' | 'load' | 'undo' | 'redo';
export type Listener = (b: Board, reason: ChangeReason) => void;

export interface Store {
  get(): Board;
  commit(next: Board): void;
  load(board: Board): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(fn: Listener): () => void;
}

export function createStore(initial: Board, limit = 100): Store {
  let cur = initial;
  let past: Board[] = [];
  let future: Board[] = [];
  const subs = new Set<Listener>();
  const emit = (r: ChangeReason) => { for (const fn of subs) fn(cur, r); };

  return {
    get: () => cur,
    commit(next) {
      if (next === cur) return;
      past.push(cur);
      if (past.length > limit) past.shift();
      future = [];
      cur = next;
      emit('commit');
    },
    load(b) { cur = b; past = []; future = []; emit('load'); },
    undo() {
      const p = past.pop();
      if (!p) return false;
      future.push(cur); cur = p; emit('undo');
      return true;
    },
    redo() {
      const n = future.pop();
      if (!n) return false;
      past.push(cur); cur = n; emit('redo');
      return true;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}
```

Run: `npm test` → all PASS.

- [ ] **Step 8: Commit** (controller) — `git commit -m "feat(model): types, reducers, store with undo"`
