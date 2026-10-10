import { describe, it, expect } from 'vitest';
import { regionFor, fitScale } from './region';
import type { Board, Item } from '../model/types';

const item = (o: Partial<Item>): Item => ({ id: 'a', type: 'photo', x: 100, y: 100, w: 200, h: 100, rot: 0, z: 1, attach: 'pin', attachColor: '#c0392b', data: {}, ...o });
const board = (items: Item[]): Board => ({ id: 'b', name: 'B', caseNo: 1, surface: 'cork', mood: 'noir-office', items, links: [], version: 1, updatedAt: 0 });

describe('regionFor', () => {
  it('whole board', () => {
    expect(regionFor(board([]), { kind: 'board' })).toEqual({ x: 0, y: 0, w: 4000, h: 3000 });
  });
  it('clamps a view rect to the board', () => {
    expect(regionFor(board([]), { kind: 'view', rect: { x: -50, y: 2900, w: 500, h: 400 } })).toEqual({ x: 0, y: 2900, w: 450, h: 100 });
  });
  it('item rot 0 adds the margin', () => {
    expect(regionFor(board([item({})]), { kind: 'item', id: 'a' })).toEqual({ x: 76, y: 76, w: 248, h: 148 });
  });
  it('item rot 90 swaps width and height about the centre', () => {
    const r = regionFor(board([item({ rot: 90 })]), { kind: 'item', id: 'a' })!;
    expect(r.w).toBeCloseTo(148); expect(r.h).toBeCloseTo(248);
    expect(r.x + r.w / 2).toBeCloseTo(200); expect(r.y + r.h / 2).toBeCloseTo(150);
  });
  it('missing id is null', () => {
    expect(regionFor(board([]), { kind: 'item', id: 'zz' })).toBeNull();
  });
  it('clamps near the edge', () => {
    const r = regionFor(board([item({ x: 5, y: 2950 })]), { kind: 'item', id: 'a' })!;
    expect(r.x).toBe(0); expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(4000); expect(r.y + r.h).toBeLessThanOrEqual(3000);
  });
});

describe('fitScale', () => {
  it('limits by pixel count', () => {
    const s = fitScale({ x: 0, y: 0, w: 4000, h: 3000 }, 2);
    expect(4000 * s * 3000 * s).toBeLessThanOrEqual(16_777_216);
    expect(s).toBeGreaterThan(1.18);
  });
  it('keeps wanted scale when small', () => {
    expect(fitScale({ x: 0, y: 0, w: 300, h: 200 }, 2)).toBe(2);
  });
  it('limits by longest side', () => {
    expect(fitScale({ x: 0, y: 0, w: 9000, h: 100 }, 1)).toBeCloseTo(8192 / 9000);
  });
});
