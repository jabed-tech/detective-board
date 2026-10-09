import { describe, it, expect } from 'vitest';
import { screenToWorld, worldToScreen, zoomAt, clampView, fitView, MAX_SCALE, MIN_SCALE } from './viewMath';

const v = { x: 30, y: -40, scale: 0.5 };

describe('viewMath', () => {
  it('screen/world are inverses', () => {
    const w = screenToWorld(v, 200, 100);
    expect(worldToScreen(v, w.x, w.y)).toEqual({ x: 200, y: 100 });
  });
  it('zoomAt keeps the point under the cursor fixed', () => {
    const before = screenToWorld(v, 300, 200);
    const z = zoomAt(v, 300, 200, 2);
    const after = screenToWorld(z, 300, 200);
    expect(z.scale).toBe(1);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it('zoomAt clamps scale', () => {
    expect(zoomAt(v, 0, 0, 100).scale).toBe(MAX_SCALE);
    expect(zoomAt(v, 0, 0, 0.0001).scale).toBe(MIN_SCALE);
  });
  it('clampView keeps part of the board on screen', () => {
    const far = clampView({ x: 99999, y: 99999, scale: 1 }, 800, 600, 4000, 3000, 120);
    expect(far.x).toBe(800 - 120);
    expect(far.y).toBe(600 - 120);
    const neg = clampView({ x: -99999, y: -99999, scale: 1 }, 800, 600, 4000, 3000, 120);
    expect(neg.x).toBe(120 - 4000);
    expect(neg.y).toBe(120 - 3000);
  });
  it('fitView centres the whole board', () => {
    const f = fitView(1000, 800, 4000, 3000, 0);
    expect(f.scale).toBeCloseTo(0.25);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeCloseTo((800 - 750) / 2);
  });
});
