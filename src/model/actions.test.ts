import { describe, it, expect, vi } from 'vitest';
import { newId, newBoard, makeItem, addItem, updateItem, removeItem, bringToFront, connect, updateLink, removeLink } from './actions';
import { BOARD_W, ITEM_SIZES } from './types';

const rand = () => 0.5;
function twoItems() {
  let b = newBoard('Test', 1);
  const a = makeItem('sticky', 500, 500, { text: 'A' }, undefined, rand);
  const c = makeItem('index', 900, 500, { text: 'C' }, undefined, rand);
  b = addItem(addItem(b, a), c);
  return { b, a, c };
}

describe('makeItem opts', () => {
  it('tilt:false gives rot 0, attach is kept', () => {
    const i = makeItem('sticky', 500, 500, {}, undefined, () => 0.9, { tilt: false, attach: 'magnet' });
    expect(i.rot).toBe(0);
    expect(i.attach).toBe('magnet');
  });
  it('defaults to pin and tilt', () => {
    const i = makeItem('sticky', 500, 500, {}, undefined, () => 0.9);
    expect(i.attach).toBe('pin');
    expect(i.rot).not.toBe(0);
  });
});

describe('newId', () => {
  it('falls back when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    try {
      const a = newId();
      const b = newId();
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      expect(a).not.toBe(b);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

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
  it('keeps a resized item inside the board', () => {
    const { b, a } = twoItems();
    const edge = updateItem(b, a.id, { x: BOARD_W - 10 });
    const it = updateItem(edge, a.id, { w: 1200, h: 1200 }).items.find(i => i.id === a.id)!;
    expect(it.w).toBe(1200);
    expect(it.x + it.w).toBeLessThanOrEqual(BOARD_W);
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
