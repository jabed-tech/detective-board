import { describe, expect, it } from 'vitest';
import { BRICK, BRICK_TILE, BRICK_TONES, NOISE_ALPHA, PATCH_MAX, brickTileSvg } from './brickTile';

const hslL = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => v / 255);
  return (Math.max(...c) + Math.min(...c)) / 2;
};

describe('brickTileSvg', () => {
  it('is deterministic', () => expect(brickTileSvg()).toBe(brickTileSvg()));
  it('is one 2016 × 1248 tile (3 bricks × 6 courses)', () => {
    expect(BRICK_TILE).toEqual({ w: 2016, h: 1248 });
    expect(brickTileSvg()).toContain('width="2016" height="1248"');
  });
  it('every tone keeps the 35% floor after noise + patch darkening and the basement bulb (x0.82 + 0.004)', () => {
    const nb = NOISE_ALPHA * 0.5 + PATCH_MAX * 0.25;   // mean darkening share (noise alpha x mean .5, patch share)
    for (const t of BRICK_TONES) expect((hslL(t) * (1 - nb) + 0.13 * nb) * 0.82 + 0.004).toBeGreaterThanOrEqual(0.35);
  });
  it('uses the exported noise alpha and a user-space filter region', () => {
    expect(brickTileSvg()).toContain(`.35 0`.replace('.35', String(NOISE_ALPHA)));
    expect(brickTileSvg()).toContain('filterUnits="userSpaceOnUse" x="0" y="0" width="2016" height="1248"');
  });
  it('offset courses wrap: the brick crossing the right edge is repeated at the left', () => {
    const svg = brickTileSvg();
    const crossX = 2 * (BRICK.w + BRICK.mortar) + (BRICK.w + BRICK.mortar) / 2 + BRICK.mortar / 2; // 1691
    expect(svg).toContain(`translate(${crossX} `);
    expect(svg).toContain(`translate(${crossX - BRICK_TILE.w} `);
  });
  it('contains no user content or external references', () => expect(brickTileSvg()).not.toMatch(/https?:|<script|href=/));
});
