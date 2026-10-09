# Task 4: Export / import with validation (Sonnet)

Read `00-overview.md` Global Constraints. Depends on Task 2. Parallel with Tasks 3, 5–8.

**Files:**
- Create: `src/storage/transfer.ts`
- Test: `src/storage/transfer.test.ts`

**Consumes:** types + `newId`, `newBoard`, `makeItem`, `addItem`, `connect` from Task 2.

**Produces:**
```ts
export const FORMAT = 'detective-board';
export type ImportError = 'not-json' | 'wrong-format' | 'newer-version' | 'bad-shape' | 'bad-asset';
export type ImportResult = { ok: true; board: Board; assets: Record<string, Blob> } | { ok: false; error: ImportError };
export function validateBoard(raw: unknown): Board | null;            // sanitises; drops bad items/links
export async function exportBoard(board: Board, getBlob: (id: string) => Promise<Blob | undefined>): Promise<Blob>;
export function parseImport(text: string): ImportResult;              // always remaps ids (board, items, links, images)
export const IMPORT_MESSAGES: Record<ImportError, [title: string, body: string]>;
```

File format: `{ "format": "detective-board", "version": 1, "board": Board, "assets": { [imageId]: "data:image/webp;base64,..." } }`.

- [ ] **Step 1: Failing test** — `src/storage/transfer.test.ts` (covers Review Focus #2)

```ts
import { describe, it, expect } from 'vitest';
import { exportBoard, parseImport, validateBoard, FORMAT } from './transfer';
import { newBoard, makeItem, addItem, connect } from '../model/actions';

function sample() {
  let b = newBoard('The Stapler', 3);
  const a = makeItem('polaroid', 500, 500, { imageId: 'img-a', caption: 'Gary' });
  const c = makeItem('sticky', 900, 500, { text: '<img src=x onerror=alert(1)>' });
  b = addItem(addItem(b, a), c);
  b = connect(b, a.id, c.id, { color: '#b3261e', tension: 0.7 });
  return b;
}
const blobs: Record<string, Blob> = { 'img-a': new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/webp' }) };
const getBlob = async (id: string) => blobs[id];
const file = (obj: unknown) => JSON.stringify(obj);

describe('export → import round trip', () => {
  it('preserves content but remaps every id', async () => {
    const b = sample();
    const text = await (await exportBoard(b, getBlob)).text();
    const res = parseImport(text);
    if (!res.ok) throw new Error(res.error);
    expect(res.board.id).not.toBe(b.id);
    expect(res.board.name).toBe('The Stapler');
    expect(res.board.items).toHaveLength(2);
    const ids = new Set(res.board.items.map(i => i.id));
    for (const old of b.items) expect(ids.has(old.id)).toBe(false);
    const l = res.board.links[0];
    expect(ids.has(l.from) && ids.has(l.to)).toBe(true);
    const pol = res.board.items.find(i => i.type === 'polaroid')!;
    expect(pol.data.imageId).not.toBe('img-a');
    const asset = res.assets[pol.data.imageId!];
    expect(asset.type).toBe('image/webp');
    expect([...new Uint8Array(await asset.arrayBuffer())]).toEqual([1, 2, 3, 250]);
    // HTML in text is preserved as plain data; rendering is responsible for escaping
    expect(res.board.items.find(i => i.type === 'sticky')!.data.text).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('parseImport errors', () => {
  it('not json', () => expect(parseImport('{oops')).toEqual({ ok: false, error: 'not-json' }));
  it('wrong format', () => expect(parseImport(file({ format: 'other', version: 1 }))).toEqual({ ok: false, error: 'wrong-format' }));
  it('newer version', () => expect(parseImport(file({ format: FORMAT, version: 2, board: {} }))).toEqual({ ok: false, error: 'newer-version' }));
  it('bad shape', () => expect(parseImport(file({ format: FORMAT, version: 1, board: { items: 'x' } }))).toEqual({ ok: false, error: 'bad-shape' }));
  it('non-image data url', () => {
    const b = sample();
    const res = parseImport(file({ format: FORMAT, version: 1, board: b, assets: { 'img-a': 'data:text/html;base64,PGgxPg==' } }));
    expect(res).toEqual({ ok: false, error: 'bad-asset' });
  });
});

describe('sanitising', () => {
  it('drops a missing asset reference instead of failing', () => {
    const res = parseImport(file({ format: FORMAT, version: 1, board: sample(), assets: {} }));
    if (!res.ok) throw new Error(res.error);
    expect(res.board.items.find(i => i.type === 'polaroid')!.data.imageId).toBeUndefined();
  });
  it('ignores __proto__ asset keys', () => {
    const b = sample();
    b.items[0].data.imageId = '__proto__';
    const text = `{"format":"${FORMAT}","version":1,"board":${JSON.stringify(b)},"assets":{"__proto__":"data:image/png;base64,AA=="}}`;
    const res = parseImport(text);
    expect(res.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('replaces unsafe colours and clamps numbers', () => {
    const b = sample();
    const raw = JSON.parse(JSON.stringify(b));
    raw.links[0].color = 'red;background:url(https://evil)';
    raw.links[0].tension = 50;
    raw.items[0].attachColor = 'javascript:alert(1)';
    raw.items[0].x = 1e9;
    const v = validateBoard(raw)!;
    expect(v.links[0].color).toBe('#b3261e');
    expect(v.links[0].tension).toBe(1);
    expect(v.items[0].attachColor).toBe('#c0392b');
    expect(v.items[0].x).toBeLessThanOrEqual(4000);
  });
  it('drops links to missing items, self-links, unknown item types and duplicate ids', () => {
    const b = sample();
    const raw = JSON.parse(JSON.stringify(b));
    raw.links.push({ id: 'l2', from: raw.items[0].id, to: 'ghost', color: '#000000', tension: 0.5 });
    raw.links.push({ id: 'l3', from: raw.items[0].id, to: raw.items[0].id, color: '#000000', tension: 0.5 });
    raw.items.push({ ...raw.items[0], type: 'bomb', id: 'zz' });
    raw.items.push({ ...raw.items[1] });
    const v = validateBoard(raw)!;
    expect(v.items).toHaveLength(2);
    expect(v.links).toHaveLength(1);
  });
  it('truncates very long text', () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.items[1].data.text = 'x'.repeat(10000);
    expect(validateBoard(raw)!.items[1].data.text!.length).toBe(5000);
  });
});
```

Run: `npx vitest run src/storage/transfer.test.ts` → FAIL.

- [ ] **Step 2: transfer.ts**

```ts
import { BOARD_H, BOARD_W, PIN_COLORS, YARN_COLORS, type Board, type Item, type ItemType, type Link, type LineStyle } from '../model/types';
import { newId } from '../model/actions';

export const FORMAT = 'detective-board';
export type ImportError = 'not-json' | 'wrong-format' | 'newer-version' | 'bad-shape' | 'bad-asset';
export type ImportResult = { ok: true; board: Board; assets: Record<string, Blob> } | { ok: false; error: ImportError };

export const IMPORT_MESSAGES: Record<ImportError, [string, string]> = {
  'not-json': ['That file is smudged beyond reading.', "It isn't a valid JSON file."],
  'wrong-format': ["That's not one of our case files.", 'Pick a .json file exported from Detective Board.'],
  'newer-version': ['This file is from the future.', 'It was made by a newer version of Detective Board. Reload the page and try again.'],
  'bad-shape': ['The case file is damaged.', 'Its contents are missing or corrupted, so nothing was imported.'],
  'bad-asset': ['A photo in this file is damaged.', 'One of the embedded images is corrupted, so nothing was imported.'],
};

const ITEM_TYPES = new Set<ItemType>(['photo', 'polaroid', 'sticky', 'index']);
const STYLES = new Set<LineStyle>(['solid', 'dashed', 'dotted']);
const HEX = /^#[0-9a-f]{6}$/i;
const DATA_URL = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]*={0,2})$/;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const color = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v : d);

function validateItem(raw: unknown): Item | null {
  if (!isRec(raw)) return null;
  const id = str(raw.id, 100);
  const type = raw.type as ItemType;
  if (!id || !ITEM_TYPES.has(type)) return null;
  const w = num(raw.w, 40, 1200, 220);
  const h = num(raw.h, 40, 1200, 220);
  const d = isRec(raw.data) ? raw.data : {};
  const data: Item['data'] = {};
  const imageId = str(d.imageId, 100);
  const text = str(d.text, 5000);
  const caption = str(d.caption, 200);
  if (imageId) data.imageId = imageId;
  if (text !== undefined) data.text = text;
  if (caption !== undefined) data.caption = caption;
  return {
    id, type, w, h,
    x: num(raw.x, 0, BOARD_W - w, 0),
    y: num(raw.y, 0, BOARD_H - h, 0),
    rot: num(raw.rot, -180, 180, 0),
    z: Math.round(num(raw.z, 0, 1e6, 0)),
    attach: 'pin',
    attachColor: color(raw.attachColor, PIN_COLORS[0]),
    data,
  };
}

function validateLink(raw: unknown, ids: Set<string>): Link | null {
  if (!isRec(raw)) return null;
  const id = str(raw.id, 100);
  const from = str(raw.from, 100);
  const to = str(raw.to, 100);
  if (!id || !from || !to || from === to || !ids.has(from) || !ids.has(to)) return null;
  const link: Link = { id, from, to, color: color(raw.color, YARN_COLORS[0]), tension: num(raw.tension, 0, 1, 0.5) };
  if (STYLES.has(raw.style as LineStyle)) link.style = raw.style as LineStyle;
  const label = str(raw.label, 80);
  if (label) link.label = label;
  return link;
}

export function validateBoard(raw: unknown): Board | null {
  if (!isRec(raw) || !Array.isArray(raw.items) || !Array.isArray(raw.links)) return null;
  const items: Item[] = [];
  const ids = new Set<string>();
  for (const r of raw.items) {
    const it = validateItem(r);
    if (it && !ids.has(it.id)) { ids.add(it.id); items.push(it); }
  }
  const links: Link[] = [];
  const linkIds = new Set<string>();
  for (const r of raw.links) {
    const l = validateLink(r, ids);
    if (l && !linkIds.has(l.id)) { linkIds.add(l.id); links.push(l); }
  }
  return {
    id: str(raw.id, 100) || newId(),
    name: str(raw.name, 80)?.trim() || 'Untitled case',
    caseNo: Math.round(num(raw.caseNo, 1, 9999, 1)),
    surface: 'cork', mood: 'noir-office',
    items, links, version: 1,
    updatedAt: num(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

async function blobToDataUrl(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${b.type};base64,${btoa(s)}`;
}

function dataUrlToBlob(url: string): Blob | null {
  const m = DATA_URL.exec(url);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  } catch {
    return null;
  }
}

export async function exportBoard(board: Board, getBlob: (id: string) => Promise<Blob | undefined>): Promise<Blob> {
  const assets: Record<string, string> = {};
  for (const it of board.items) {
    const id = it.data.imageId;
    if (!id || Object.hasOwn(assets, id)) continue;
    const blob = await getBlob(id);
    if (blob) assets[id] = await blobToDataUrl(blob);
  }
  return new Blob([JSON.stringify({ format: FORMAT, version: 1, board, assets })], { type: 'application/json' });
}

function remapIds(board: Board, assets: Map<string, Blob>): { board: Board; assets: Record<string, Blob> } {
  const itemMap = new Map<string, string>();
  const imgMap = new Map<string, string>();
  const outAssets: Record<string, Blob> = {};
  for (const [old, blob] of assets) { const n = newId(); imgMap.set(old, n); outAssets[n] = blob; }
  const items = board.items.map(it => {
    const id = newId();
    itemMap.set(it.id, id);
    const data = { ...it.data };
    if (data.imageId) data.imageId = imgMap.get(data.imageId);
    return { ...it, id, data };
  });
  const links = board.links.map(l => ({ ...l, id: newId(), from: itemMap.get(l.from)!, to: itemMap.get(l.to)! }));
  return { board: { ...board, id: newId(), items, links }, assets: outAssets };
}

export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'not-json' }; }
  if (!isRec(raw) || raw.format !== FORMAT || typeof raw.version !== 'number') return { ok: false, error: 'wrong-format' };
  if (raw.version > 1) return { ok: false, error: 'newer-version' };
  const board = validateBoard(raw.board);
  if (!board) return { ok: false, error: 'bad-shape' };
  const src = isRec(raw.assets) ? raw.assets : {};
  const assets = new Map<string, Blob>();
  for (const it of board.items) {
    const id = it.data.imageId;
    if (!id) continue;
    if (assets.has(id)) continue;
    const url = Object.hasOwn(src, id) ? src[id] : undefined;
    if (typeof url !== 'string') { delete it.data.imageId; continue; } // item shows "photo missing"
    const blob = dataUrlToBlob(url);
    if (!blob) return { ok: false, error: 'bad-asset' };
    assets.set(id, blob);
  }
  return { ok: true, ...remapIds(board, assets) };
}
```

Note: `assets` is a `Map` internally so a `__proto__` image id is a normal key.

Run: `npx vitest run src/storage/transfer.test.ts` → PASS. `npm test` → all PASS.

- [ ] **Step 3: Commit** (controller) — `feat(storage): json export/import with validation and id remap`
