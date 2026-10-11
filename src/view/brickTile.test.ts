import { describe, expect, it } from 'vitest';
import { BRICK, BRICK_TILE, BRICK_TONES, brickTileSvg } from './brickTile';

const hslL = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => v / 255);
  return (Math.max(...c) + Math.min(...c)) / 2;
};

describe('brickTileSvg', () => {
  it('is deterministic', () => expect(brickTileSvg()).toBe(brickTileSvg()));
  it('is one 1260 × 780 tile (3 bricks × 6 courses)', () => {
    expect(BRICK_TILE).toEqual({ w: 1260, h: 780 });
    expect(brickTileSvg()).toContain('width="1260" height="780"');
  });
  it('every brick tone keeps the 35% lighting floor under the basement bulb (×0.82)', () => {
    for (const t of BRICK_TONES) expect(hslL(t) * 0.82).toBeGreaterThanOrEqual(0.35);
  });
  it('offset courses wrap: the brick crossing the right edge is repeated at the left', () => {
    const svg = brickTileSvg();
    const crossX = 2 * (BRICK.w + BRICK.mortar) + (BRICK.w + BRICK.mortar) / 2 + BRICK.mortar / 2; // 1057
    expect(svg).toContain(`translate(${crossX} `);
    expect(svg).toContain(`translate(${crossX - BRICK_TILE.w} `);
  });
  it('contains no user content or external references', () => expect(brickTileSvg()).not.toMatch(/https?:|<script|href=/));
});
