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
