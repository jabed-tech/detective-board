// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { composeBoard } from './compose';
import { drawers } from './registry';
import type { Board, Item } from '../model/types';

// Smoke test with a permissive recording context: checks the pipeline runs end to end without throwing.
function fakeCtx(calls: string[]) {
  const store: Record<string, unknown> = {};
  return new Proxy({}, {
    get(_t, k: string) {
      if (k === 'getTransform') return () => ({ a: 1, b: 0 });
      if (k === 'measureText') return (s: string) => ({ width: s.length * 8 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'createPattern') return () => ({});
      if (k === 'createImageData') return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (k in store) return store[k];
      return (...a: unknown[]) => { calls.push(k); void a; };
    },
    set(_t, k: string, v) { store[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

const item = (o: Partial<Item>): Item => ({ id: 'a', type: 'sticky', x: 100, y: 100, w: 220, h: 220, rot: 10, z: 1, attach: 'pin', attachColor: '#c0392b', data: { text: 'hello world' }, ...o });

beforeAll(() => {
  vi.stubGlobal('Path2D', class { constructor(public d?: string) {} });
  vi.stubGlobal('Image', class { onload?: () => void; set src(_v: string) { setTimeout(() => this.onload?.(), 0); } });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 10, height: 10 }));
});

describe('composeBoard', () => {
  const b: Board = {
    id: 'b', name: 'B', caseNo: 1, surface: 'brick', mood: 'noir-office', version: 1, updatedAt: 0,
    items: [item({}), item({ id: 'p', type: 'polaroid', x: 500, w: 240, h: 290, data: { caption: 'Cap', unknown: true, imageId: 'i', aged: true, crossed: true } }),
      item({ id: 'x', type: 'index', x: 900, w: 320, h: 200 }), item({ id: 'q', type: 'photo', x: 1300, w: 260, h: 200, data: {} }), item({ id: 'm', type: 'mugshot', x: 1700 })],
    links: [{ id: 'l', from: 'a', to: 'p', color: '#b3261e', tension: 0.5, label: 'x', arrow: 'both' }],
  };
  it('draws a board and returns a canvas of the scaled size', async () => {
    const calls: string[] = [];
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx(calls) as never);
    const c = await composeBoard(b, { scope: { kind: 'board' }, scale: 0.1, mood: true, strings: true, background: true, getBlob: async () => new Blob(['x']) });
    expect(c?.width).toBe(400);
    expect(c?.height).toBe(300);
    expect(calls.length).toBeGreaterThan(20);
    spy.mockRestore();
  });
  it('returns null for a missing item', async () => {
    expect(await composeBoard(b, { scope: { kind: 'item', id: 'nope' }, scale: 1, mood: false, strings: false, background: false, getBlob: async () => undefined })).toBeNull();
  });
  it('draws a single item', async () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx([]) as never);
    const c = await composeBoard(b, { scope: { kind: 'item', id: 'a' }, scale: 1, mood: false, strings: true, background: false, getBlob: async () => undefined });
    expect(c).not.toBeNull();
    spy.mockRestore();
  });

  const opts = (getBlob: (id: string) => Promise<Blob | undefined>) =>
    ({ scope: { kind: 'board' } as const, scale: 0.05, mood: false, strings: false, background: false, getBlob });

  it('copes with a missing blob', async () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx([]) as never);
    const c = await composeBoard(b, opts(async () => undefined));
    expect(c).not.toBeNull();
    spy.mockRestore();
  });

  it('draws nothing and does not throw for a stamp whose SVG will not decode', async () => {
    const calls: string[] = [];
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx(calls) as never);
    vi.stubGlobal('Image', class { onerror?: () => void; set src(_v: string) { setTimeout(() => this.onerror?.(), 0); } });
    const bad: Board = { ...b, items: [item({ id: 's', type: 'stamp', w: 260, h: 100, data: { stamp: 'coffee-ring' } })], links: [] };
    const c = await composeBoard(bad, opts(async () => undefined));
    expect(c).not.toBeNull();
    expect(calls.filter(k => k === 'drawImage')).toHaveLength(0);
    spy.mockRestore();
    vi.stubGlobal('Image', class { onload?: () => void; set src(_v: string) { setTimeout(() => this.onload?.(), 0); } });
  });

  it('a throwing drawer leaves later items drawn and save/restore balanced', async () => {
    const calls: string[] = [];
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx(calls) as never);
    const orig = { photo: drawers.photo, sticky: drawers.sticky };
    drawers.photo = async () => { throw new Error('boom'); };
    let later = 0;
    drawers.sticky = async () => { later++; };
    const two: Board = { ...b, links: [], items: [item({ id: 'p1', type: 'photo', z: 1 }), item({ id: 's1', type: 'sticky', z: 2 })] };
    const c = await composeBoard(two, opts(async () => undefined));
    drawers.photo = orig.photo; drawers.sticky = orig.sticky;
    spy.mockRestore();
    expect(c).not.toBeNull();
    expect(later).toBe(1);
    expect(calls.filter(k => k === 'save').length).toBe(calls.filter(k => k === 'restore').length);
  });

  it('caps the size and reports the scale used; rejects non-finite scale', async () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx([]) as never);
    const c = await composeBoard({ ...b, items: [], links: [] }, { ...opts(async () => undefined), scale: 5 });
    expect(c!.width * c!.height).toBeLessThanOrEqual(16_777_216);
    expect(Number(c!.dataset.scale)).toBeLessThan(5);
    expect(await composeBoard(b, { ...opts(async () => undefined), scale: NaN })).toBeNull();
    spy.mockRestore();
  });

  it('closes cached bitmaps, even when the export throws', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', async () => ({ width: 10, height: 10, close }));
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx([]) as never);
    const orig = drawers.photo;
    drawers.photo = async (_c, it, img) => { await img(it.data.imageId!); throw new Error('boom'); };
    const one: Board = { ...b, links: [], items: [item({ id: 'p1', type: 'photo', data: { imageId: 'i' } })] };
    await composeBoard(one, opts(async () => new Blob(['x'])));
    await new Promise(r => setTimeout(r, 0));
    drawers.photo = orig;
    spy.mockRestore();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
