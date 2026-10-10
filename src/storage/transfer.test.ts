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
    if (!res.ok) return;
    expect(Object.getPrototypeOf(res.assets)).toBe(Object.prototype);
    expect(({} as { constructor: unknown }).constructor).toBe(Object);
    expect(Object.keys(res.assets).length).toBe(1);
  });
  it('rejects non-integer or < 1 versions', () => {
    for (const v of [0, 1.5, -1]) {
      const res = parseImport(JSON.stringify({ format: FORMAT, version: v, board: sample(), assets: {} }));
      expect(res).toEqual({ ok: false, error: 'wrong-format' });
    }
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
  it('keeps known fasteners and resets unknown ones to pin', () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.items[0].attach = 'tape';
    expect(validateBoard(raw)!.items[0].attach).toBe('tape');
    raw.items[0].attach = 'glue';
    expect(validateBoard(raw)!.items[0].attach).toBe('pin');
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
  it('keeps finite anchors (clamped) and drops bad ones', () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.links[0].fromAt = { u: 2, v: -0.25 };
    raw.links[0].toAt = { u: 'x', v: 0 };
    const l = validateBoard(raw)!.links[0];
    expect(l.fromAt).toEqual({ u: 0.5, v: -0.25 });
    expect(l.toAt).toBeUndefined();
    raw.links[0].fromAt = { u: null, v: 0 };
    expect(validateBoard(raw)!.links[0].fromAt).toBeUndefined();
  });
  it('keeps data.unknown only when boolean', () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.items[0].data.unknown = true;
    expect(validateBoard(raw)!.items[0].data.unknown).toBe(true);
    raw.items[0].data.unknown = 'yes';
    expect(validateBoard(raw)!.items[0].data.unknown).toBeUndefined();
  });
  it('validates data.textScale: finite numbers only, clamped, 1 dropped', () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    const ts = (v: unknown) => { raw.items[1].data.textScale = v; return validateBoard(raw)!.items[1].data.textScale; };
    expect(ts('2')).toBeUndefined();
    expect(ts(null)).toBeUndefined();
    expect(ts(NaN)).toBeUndefined();
    expect(ts(Infinity)).toBeUndefined();
    expect(ts(10)).toBe(3);
    expect(ts(0.1)).toBe(0.5);
    expect(ts(1.5)).toBe(1.5);
    expect(ts(1)).toBeUndefined();
  });
  it('a board without textScale round-trips unchanged; textScale survives export/import and item copy', async () => {
    const b = sample();
    expect(validateBoard(JSON.parse(JSON.stringify(b)))!.items.every(i => !('textScale' in i.data))).toBe(true);
    const scaled = { ...b, items: b.items.map((i, n) => (n === 1 ? { ...i, data: { ...i.data, textScale: 1.75 } } : i)) };
    const r = parseImport(await (await exportBoard(scaled, getBlob)).text());
    expect(r.ok && r.board.items[1].data.textScale).toBe(1.75);
    const { parseClipboardText, serializeItem, offsetCopy } = await import('../clipboard');
    const pasted = parseClipboardText(serializeItem(offsetCopy(scaled.items[1])));
    expect(pasted.kind === 'item' && pasted.item.data.textScale).toBe(1.75);
  });
  it('truncates very long text', () => {
    const raw = JSON.parse(JSON.stringify(sample()));
    raw.items[1].data.text = 'x'.repeat(10000);
    expect(validateBoard(raw)!.items[1].data.text!.length).toBe(5000);
  });
});

describe('phase 2+3 fields', () => {
  const raw = () => JSON.parse(JSON.stringify(sample()));
  const item = (type: string, data: Record<string, unknown>) => {
    const r = raw();
    r.items.push({ ...r.items[0], id: 'n1', type, data });
    return validateBoard(r)!.items.find(i => i.id === 'n1');
  };
  it('keeps known surface/mood, defaults unknown ones', () => {
    const r = raw();
    r.surface = 'brick'; r.mood = 'basement';
    const v = validateBoard(r)!;
    expect([v.surface, v.mood]).toEqual(['brick', 'basement']);
    r.surface = 'lava'; r.mood = 42;
    const w = validateBoard(r)!;
    expect([w.surface, w.mood]).toEqual(['cork', 'noir-office']);
    r.surface = 'constructor'; r.mood = '__proto__';
    const x = validateBoard(r)!;
    expect([x.surface, x.mood]).toEqual(['cork', 'noir-office']);
  });
  it('closed only when true', () => {
    const r = raw();
    r.closed = true;
    expect(validateBoard(r)!.closed).toBe(true);
    r.closed = 'yes';
    expect('closed' in validateBoard(r)!).toBe(false);
  });
  it('validates link material', () => {
    const r = raw();
    r.links[0].material = 'marker';
    expect(validateBoard(r)!.links[0].material).toBe('marker');
    r.links[0].material = 'yarn';
    expect('material' in validateBoard(r)!.links[0]).toBe(false);
    r.links[0].material = 'rope';
    expect('material' in validateBoard(r)!.links[0]).toBe(false);
  });
  it('keeps mugshot name verbatim, truncated to 80', () => {
    expect(item('mugshot', { name: '<b>Gary</b>' })!.data.name).toBe('<b>Gary</b>');
    expect(item('mugshot', { name: 'x'.repeat(200) })!.data.name!.length).toBe(80);
  });
  it('drops unknown item types', () => expect(item('bomb', {})).toBeUndefined());
  it('validates receipt lines', () => {
    const lines = (l: unknown) => item('receipt', { lines: l })!.data.lines;
    expect(lines(Array.from({ length: 10000 }, () => ({ name: 'x', price: 1 })))).toHaveLength(40);
    expect(lines([{ name: 'x', price: NaN }])).toEqual([]);
    expect(lines([{ name: 'x', price: 12.7 }])![0].price).toBe(13);
    expect(lines([{ name: 'x', price: -5 }])![0].price).toBe(0);
    expect(lines([{ name: 'x', price: 5e9 }])![0].price).toBe(999999);
    expect(lines('nope')).toBeUndefined();
  });
  it('validates sketch strokes', () => {
    const strokes = (s: unknown) => item('sketch', { strokes: s })!.data.strokes!;
    const ok = { d: 'M1 2 L3 4', color: '#112233', width: 4 };
    expect(strokes([ok])).toEqual([ok]);
    expect(strokes([{ ...ok, d: 'M1 2 url(x)' }])).toEqual([]);
    expect(strokes([{ ...ok, d: 'M' + '1'.repeat(60000) }])).toEqual([]);
    expect(strokes([{ ...ok, color: 'red' }])[0].color).toBe('#22201a');
    expect(strokes([{ ...ok, width: 999 }])[0].width).toBe(40);
    expect(strokes(Array.from({ length: 1000 }, () => ok))).toHaveLength(300);
    const big = { ...ok, d: 'M' + '1'.repeat(59999) };
    expect(strokes(Array.from({ length: 20 }, () => big))).toHaveLength(6);
  });
  it('defaults stamp and object ids, only on their own types', () => {
    expect(item('stamp', { stamp: 'nope' })!.data.stamp).toBe('evidence');
    expect(item('stamp', { stamp: 'red-x' })!.data.stamp).toBe('red-x');
    expect(item('object', { object: 'nope' })!.data.object).toBe('keys');
    expect('stamp' in item('sticky', { stamp: 'red-x' })!.data).toBe(false);
  });
  it('validates aged, crossed and seed', () => {
    const d = item('sticky', { aged: true, crossed: true, seed: 3.7 })!.data;
    expect([d.aged, d.crossed, d.seed]).toEqual([true, true, 3]);
    const e = item('sticky', { aged: 1, seed: -1 })!.data;
    expect('aged' in e || 'seed' in e).toBe(false);
    expect('seed' in item('sticky', { seed: 2 ** 33 })!.data).toBe(false);
  });
  it('validates link thickness and arrow', () => {
    const r = raw();
    const l = (o: object) => { Object.assign(r.links[0], { thickness: undefined, arrow: undefined }, o); return validateBoard(r)!.links[0]; };
    expect(l({ thickness: 1.6 }).thickness).toBe(1.6);
    expect('thickness' in l({ thickness: 1 })).toBe(false);
    expect(l({ thickness: 0.1 }).thickness).toBe(0.5);
    expect('thickness' in l({ thickness: 'big' })).toBe(false);
    expect(l({ arrow: 'both' }).arrow).toBe('both');
    expect('arrow' in l({ arrow: 'up' })).toBe(false);
  });
  it('a phase-1-shaped board round-trips deep-equal', () => {
    const b = sample();
    expect(validateBoard(JSON.parse(JSON.stringify(b)))).toEqual(b);
  });
});
