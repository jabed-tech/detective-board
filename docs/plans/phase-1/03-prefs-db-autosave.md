# Task 3: Prefs, DB, autosave (Sonnet)

Read `00-overview.md` Global Constraints. Depends on Task 2. Parallel with Tasks 4–8.

**Files:**
- Create: `src/prefs.ts`, `src/storage/db.ts`, `src/storage/autosave.ts`
- Test: `src/prefs.test.ts`, `src/storage/db.test.ts`, `src/storage/autosave.test.ts`

**Consumes:** `Board`, `Atmosphere` from `src/model/types.ts`; `newBoard`, `makeItem`, `addItem` from `src/model/actions.ts` (tests only).

**Produces:**
```ts
// prefs.ts
interface Prefs { atmosphere: Atmosphere; sfx: boolean; volume: number; neatHand: boolean; defaultTension: number; lastBoardId?: string; lastExportAt: number; memoSnoozedAt: number }
DEFAULT_PREFS: Prefs; loadPrefs(store?): Prefs; savePrefs(p, store?): void; clearPrefs(store?): void
// db.ts
interface BoardMeta { id: string; name: string; caseNo: number; updatedAt: number }
interface Db { persistent: boolean; listBoards(): Promise<BoardMeta[]>; loadBoard(id): Promise<Board|undefined>; saveBoard(b): Promise<void>; deleteBoard(id): Promise<void>; putBlob(id, blob): Promise<void>; getBlob(id): Promise<Blob|undefined>; clearAll(): Promise<void> }
openDb(): Promise<Db>
// autosave.ts
createAutosave(save: (b: Board) => Promise<void>, onError: (e: unknown) => void, delay = 500): { schedule(b: Board): void; flush(): Promise<void> }
```

- [ ] **Step 1: Failing prefs test** — `src/prefs.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { loadPrefs, savePrefs, DEFAULT_PREFS } from './prefs';

function fakeStorage(initial?: string) {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set('detective-board:prefs', initial);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe('prefs', () => {
  it('returns defaults when nothing stored', () => {
    expect(loadPrefs(fakeStorage())).toEqual(DEFAULT_PREFS);
  });
  it('returns defaults on corrupt JSON', () => {
    expect(loadPrefs(fakeStorage('{nope'))).toEqual(DEFAULT_PREFS);
  });
  it('merges partial and rejects invalid values', () => {
    const p = loadPrefs(fakeStorage(JSON.stringify({ sfx: false, atmosphere: 'disco', volume: 9 })));
    expect(p.sfx).toBe(false);
    expect(p.atmosphere).toBe('gentle');
    expect(p.volume).toBe(1);
  });
  it('round-trips', () => {
    const s = fakeStorage();
    savePrefs({ ...DEFAULT_PREFS, neatHand: true, lastBoardId: 'abc' }, s);
    expect(loadPrefs(s).neatHand).toBe(true);
    expect(loadPrefs(s).lastBoardId).toBe('abc');
  });
  it('works with no storage at all', () => {
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(() => savePrefs(DEFAULT_PREFS, null)).not.toThrow();
  });
});
```

Run → FAIL.

- [ ] **Step 2: prefs.ts**

```ts
import type { Atmosphere } from './model/types';

export interface Prefs {
  atmosphere: Atmosphere;
  sfx: boolean;
  volume: number;
  neatHand: boolean;
  defaultTension: number;
  lastBoardId?: string;
  lastExportAt: number;
  memoSnoozedAt: number;
}

export const DEFAULT_PREFS: Prefs = {
  atmosphere: 'gentle', sfx: true, volume: 0.4, neatHand: false,
  defaultTension: 0.5, lastExportAt: 0, memoSnoozedAt: 0,
};

const KEY = 'detective-board:prefs';
type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function local(): KV | null {
  try { return window.localStorage; } catch { return null; }
}

const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

export function loadPrefs(store: KV | null = local()): Prefs {
  let raw: Record<string, unknown> = {};
  try {
    const s = store?.getItem(KEY);
    if (s) { const v = JSON.parse(s); if (v && typeof v === 'object') raw = v; }
  } catch { /* corrupt or blocked: use defaults */ }
  const atm = raw.atmosphere;
  const p: Prefs = {
    atmosphere: atm === 'full' || atm === 'gentle' || atm === 'off' ? atm : DEFAULT_PREFS.atmosphere,
    sfx: typeof raw.sfx === 'boolean' ? raw.sfx : DEFAULT_PREFS.sfx,
    volume: num(raw.volume, 0, 1, DEFAULT_PREFS.volume),
    neatHand: typeof raw.neatHand === 'boolean' ? raw.neatHand : DEFAULT_PREFS.neatHand,
    defaultTension: num(raw.defaultTension, 0, 1, DEFAULT_PREFS.defaultTension),
    lastExportAt: num(raw.lastExportAt, 0, Number.MAX_SAFE_INTEGER, 0),
    memoSnoozedAt: num(raw.memoSnoozedAt, 0, Number.MAX_SAFE_INTEGER, 0),
  };
  if (typeof raw.lastBoardId === 'string') p.lastBoardId = raw.lastBoardId;
  return p;
}

export function savePrefs(p: Prefs, store: KV | null = local()): void {
  try { store?.setItem(KEY, JSON.stringify(p)); } catch { /* quota/blocked: prefs are non-critical */ }
}

export function clearPrefs(store: KV | null = local()): void {
  try { store?.removeItem(KEY); } catch { /* ignore */ }
}
```

Run → PASS.

- [ ] **Step 3: Failing db test** — `src/storage/db.test.ts` (Node has no `indexedDB`, so this exercises the in-memory fallback — Review Focus #4)

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from './db';
import { newBoard, makeItem, addItem } from '../model/actions';

describe('openDb without IndexedDB', () => {
  it('falls back to memory and is marked non-persistent', async () => {
    const db = await openDb();
    expect(db.persistent).toBe(false);
  });
  it('saves, lists, loads and deletes boards with their blobs', async () => {
    const db = await openDb();
    let b = newBoard('Case A', 2);
    b = addItem(b, makeItem('photo', 100, 100, { imageId: 'img1' }));
    await db.putBlob('img1', new Blob(['x'], { type: 'image/webp' }));
    await db.saveBoard(b);
    await db.saveBoard(newBoard('Case B', 1));
    const metas = await db.listBoards();
    expect(metas.map(m => m.caseNo)).toEqual([1, 2]);
    const loaded = await db.loadBoard(b.id);
    expect(loaded).toEqual(b);
    expect(loaded).not.toBe(b); // stored copy, not the same object
    await db.deleteBoard(b.id);
    expect(await db.loadBoard(b.id)).toBeUndefined();
    expect(await db.getBlob('img1')).toBeUndefined();
  });
  it('clearAll empties everything', async () => {
    const db = await openDb();
    await db.saveBoard(newBoard('x', 1));
    await db.putBlob('b', new Blob(['y']));
    await db.clearAll();
    expect(await db.listBoards()).toEqual([]);
    expect(await db.getBlob('b')).toBeUndefined();
  });
});
```

Run → FAIL.

- [ ] **Step 4: db.ts**

```ts
import { createStore, get, set, del, values, clear } from 'idb-keyval';
import type { Board } from '../model/types';

export interface BoardMeta { id: string; name: string; caseNo: number; updatedAt: number }

export interface Db {
  persistent: boolean;
  listBoards(): Promise<BoardMeta[]>;
  loadBoard(id: string): Promise<Board | undefined>;
  saveBoard(b: Board): Promise<void>;
  deleteBoard(id: string): Promise<void>;
  putBlob(id: string, blob: Blob): Promise<void>;
  getBlob(id: string): Promise<Blob | undefined>;
  clearAll(): Promise<void>;
}

const meta = (b: Board): BoardMeta => ({ id: b.id, name: b.name, caseNo: b.caseNo, updatedAt: b.updatedAt });
const byCase = (a: BoardMeta, b: BoardMeta) => a.caseNo - b.caseNo;
const imageIds = (b: Board) => b.items.flatMap(i => (i.data.imageId ? [i.data.imageId] : []));

function idbDb(): Db {
  // idb-keyval allows one object store per database, hence two databases.
  const boards = createStore('detective-board-boards', 'boards');
  const blobs = createStore('detective-board-blobs', 'blobs');
  return {
    persistent: true,
    async listBoards() { return (await values<Board>(boards)).map(meta).sort(byCase); },
    loadBoard: id => get<Board>(id, boards),
    saveBoard: b => set(b.id, b, boards),
    async deleteBoard(id) {
      const b = await get<Board>(id, boards);
      if (b) await Promise.all(imageIds(b).map(i => del(i, blobs)));
      await del(id, boards);
    },
    putBlob: (id, blob) => set(id, blob, blobs),
    getBlob: id => get<Blob>(id, blobs),
    async clearAll() { await clear(boards); await clear(blobs); },
  };
}

function memoryDb(): Db {
  const boards = new Map<string, Board>();
  const blobs = new Map<string, Blob>();
  return {
    persistent: false,
    async listBoards() { return [...boards.values()].map(meta).sort(byCase); },
    async loadBoard(id) { const b = boards.get(id); return b && structuredClone(b); },
    async saveBoard(b) { boards.set(b.id, structuredClone(b)); },
    async deleteBoard(id) {
      const b = boards.get(id);
      if (b) for (const i of imageIds(b)) blobs.delete(i);
      boards.delete(id);
    },
    async putBlob(id, blob) { blobs.set(id, blob); },
    async getBlob(id) { return blobs.get(id); },
    async clearAll() { boards.clear(); blobs.clear(); },
  };
}

export async function openDb(): Promise<Db> {
  if (typeof indexedDB === 'undefined') return memoryDb();
  try {
    const db = idbDb();
    await db.listBoards(); // probe: throws in some private modes
    return db;
  } catch {
    return memoryDb();
  }
}
// shortcut: blobs of removed items are kept (undo may restore them). Orphan GC is a phase 5 task.
```

Run → PASS.

- [ ] **Step 5: Failing autosave test** — `src/storage/autosave.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAutosave } from './autosave';
import { newBoard } from '../model/actions';

afterEach(() => { vi.useRealTimers(); });

describe('autosave', () => {
  it('debounces to one save with the latest board and stamps updatedAt', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const a = createAutosave(save, vi.fn(), 500);
    const b1 = newBoard('one', 1);
    const b2 = newBoard('two', 2);
    a.schedule(b1);
    a.schedule(b2);
    await vi.advanceTimersByTimeAsync(499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].id).toBe(b2.id);
    expect(save.mock.calls[0][0].updatedAt).toBeGreaterThan(0);
  });
  it('flush saves immediately and only once', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const a = createAutosave(save, vi.fn(), 500);
    a.schedule(newBoard('x', 1));
    await a.flush();
    await a.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('reports save errors instead of throwing', async () => {
    const err = new Error('QuotaExceededError');
    const onError = vi.fn();
    const a = createAutosave(vi.fn().mockRejectedValue(err), onError, 500);
    a.schedule(newBoard('x', 1));
    await expect(a.flush()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(err);
  });
});
```

Run → FAIL.

- [ ] **Step 6: autosave.ts**

```ts
import type { Board } from '../model/types';

export function createAutosave(save: (b: Board) => Promise<void>, onError: (e: unknown) => void, delay = 500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Board | null = null;

  async function flush(): Promise<void> {
    clearTimeout(timer);
    if (!pending) return;
    const b = { ...pending, updatedAt: Date.now() };
    pending = null;
    try { await save(b); } catch (e) { onError(e); }
  }

  return {
    schedule(b: Board) {
      pending = b;
      clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, delay);
    },
    flush,
  };
}
```

Run: `npm test` → all PASS.

- [ ] **Step 7: Commit** (controller) — `feat(storage): prefs, indexeddb with memory fallback, autosave`
