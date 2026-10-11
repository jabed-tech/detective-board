// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { composeBoard } from './compose';
import { drawBackground, drawMood } from './backdrop';
import { BRICK_TONES } from '../view/brickTile';
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

  it('draws strings after the items (strings drape over items, as on screen)', async () => {
    const calls: string[] = [];
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx(calls) as never);
    const orig = drawers.sticky;
    drawers.sticky = async () => { calls.push('ITEM'); };
    const two: Board = { ...b, items: [item({ id: 'a', z: 1 }), item({ id: 'p', x: 500, z: 2 })],
      links: [{ id: 'l', from: 'a', to: 'p', color: '#b3261e', tension: 0.5 }] };
    await composeBoard(two, { ...opts(async () => undefined), strings: true });
    drawers.sticky = orig;
    spy.mockRestore();
    expect(calls.filter(k => k === 'ITEM')).toHaveLength(2);
    expect(calls.indexOf('setLineDash')).toBeGreaterThan(calls.lastIndexOf('ITEM'));
  });

  it('brick board: draws the tile pattern when the tile decodes, falls back to plain colour when it does not', () => {
    const rect = { x: 0, y: 0, w: 1000, h: 800 };
    const run = (tiles?: { brick?: CanvasImageSource | null }) => {
      const patterns: unknown[] = [];
      const fills: unknown[] = [];
      const props: Record<string, unknown> = {};
      const ctx = new Proxy({}, {
        get(_t, k: string) {
          if (k === 'createPattern') return (img: unknown) => { patterns.push(img); return { pat: true }; };
          if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
          if (k === 'createImageData') return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
          if (k === 'fillRect') return () => { fills.push(props.fillStyle); };
          if (k in props) return props[k];
          return () => undefined;
        },
        set(_t, k: string, v) { props[k] = v; return true; },
      }) as unknown as CanvasRenderingContext2D;
      const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as never);
      drawBackground(ctx, rect, 'brick', tiles);
      spy.mockRestore();
      return { patterns, fills };
    };
    const tile = { tile: true } as unknown as CanvasImageSource;
    const a = run({ brick: tile });
    expect(a.patterns).toContain(tile);
    const bad = run({ brick: null });
    expect(bad.patterns).toHaveLength(0);
    expect(bad.fills).toContain(BRICK_TONES[0]);
    expect(() => run()).not.toThrow();
  });

  it('acrylic board draws the room, bokeh, sheen and four bolts', () => {
    const c = { linear: 0, radial: 0, arc: 0, pattern: 0 };
    const fills: unknown[] = [];
    const props: Record<string, unknown> = {};
    const ctx = new Proxy({}, {
      get(_t, k: string) {
        if (k === 'createLinearGradient') return () => { c.linear++; return { addColorStop() {} }; };
        if (k === 'createRadialGradient') return () => { c.radial++; return { addColorStop() {} }; };
        if (k === 'createPattern') return () => { c.pattern++; return {}; };
        if (k === 'createImageData') return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
        if (k === 'fillRect') return () => { fills.push(props.fillStyle); };
        if (k === 'arc') return () => { c.arc++; };
        if (k in props) return props[k];
        return () => undefined;
      },
      set(_t, k: string, v) { props[k] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as never);
    drawBackground(ctx, { x: 0, y: 0, w: 4000, h: 3000 }, 'glass');
    spy.mockRestore();
    expect(c.linear).toBeGreaterThanOrEqual(1);
    expect(c.radial).toBeGreaterThanOrEqual(5);
    expect(c.arc).toBeGreaterThanOrEqual(4);
    expect(fills[0]).toBe('#6a7682');   // base colour first
    expect(c.pattern).toBe(0);           // noise tile skipped
  });

  it('composeBoard on a brick board still succeeds when the tile image fails to decode', async () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx([]) as never);
    vi.stubGlobal('Image', class { onerror?: () => void; set src(_v: string) { setTimeout(() => this.onerror?.(), 0); } });
    vi.resetModules();   // svgImage caches by markup; start from a cold cache so the failing decode is really hit
    const { composeBoard: fresh } = await import('./compose');
    const c = await fresh({ ...b, items: [], links: [] }, { ...opts(async () => undefined), background: true });
    spy.mockRestore();
    vi.stubGlobal('Image', class { onload?: () => void; set src(_v: string) { setTimeout(() => this.onload?.(), 0); } });
    expect(c).not.toBeNull();
  });

  it('does not bake in blinds or grain the user switched off', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx([]) as never);
    const rect = { x: 0, y: 0, w: 1000, h: 800 };
    const count = (mood: 'noir-office' | 'basement', effects?: Record<string, boolean>) => {
      const calls: string[] = [];
      drawMood(fakeCtx(calls), rect, mood, effects);
      return calls.filter(k => k === 'fillRect').length;
    };
    expect(count('noir-office', { blinds: false })).toBeLessThan(count('noir-office'));
    expect(count('noir-office', { blinds: true })).toBe(count('noir-office'));
    expect(count('basement', { grain: false })).toBeLessThan(count('basement'));
    spy.mockRestore();
  });
});
