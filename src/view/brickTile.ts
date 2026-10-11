import { rng } from '../model/random';

/** A close-up brick wall: ~3× the old module so a brick is about one and a half photos wide. */
export const BRICK = { w: 650, h: 186, mortar: 22, cols: 3, rows: 6 } as const;
export const BRICK_TILE = { w: (BRICK.w + BRICK.mortar) * BRICK.cols, h: (BRICK.h + BRICK.mortar) * BRICK.rows };
/** Alpha of the full-tile noise layer, and the darkest soft-patch opacity: both darken the bricks, so the floor budgets them. */
export const NOISE_ALPHA = 0.15;
export const PATCH_MAX = 0.05;
/** Tones are chosen so that, after the noise + patch darkening and the basement bulb's outer overlay (x0.82), L stays >= 35%. */
export const BRICK_TONES = ['#a85e42', '#ad6346', '#a45e44', '#b16a4b', '#ab6342', '#b87455'];
const MORTAR = '#b3a794';

/** One brick drawn at the origin: base tone, lit top arris, shadow into the bed joint, a few chips, a soft patch. */
function brick(tone: string, r: () => number): string {
  const { w, h } = BRICK;
  let s = `<rect width="${w}" height="${h}" rx="5" fill="${tone}"/>`;
  s += `<rect width="${w}" height="5" fill="#fff" fill-opacity=".14"/>`;
  s += `<rect y="${h - 6}" width="${w}" height="6" fill="#000" fill-opacity=".22"/>`;
  const chips = Math.floor(r() * 3);
  for (let i = 0; i < chips; i++) {
    const cx = Math.round(r() * (w - 64)), cw = 16 + Math.round(r() * 35), depth = 10 + Math.round(r() * 10);
    s += r() < 0.5
      ? `<path d="M${cx} 0h${cw}l${-Math.round(cw / 2)} ${depth}z" fill="${MORTAR}" fill-opacity=".9"/>`
      : `<path d="M${cx} ${h}h${cw}l${-Math.round(cw / 2)} ${-depth}z" fill="${MORTAR}" fill-opacity=".9"/>`;
  }
  const px = Math.round(r() * w * 0.6), pw = Math.round(w * 0.3 + r() * w * 0.3);
  s += `<rect x="${px}" y="${Math.round(r() * h * 0.4)}" width="${pw}" height="${Math.round(h * 0.45)}" rx="38" fill="#000" fill-opacity="${(PATCH_MAX * 0.4 + r() * PATCH_MAX * 0.6).toFixed(3)}"/>`;
  return s;
}

/** Deterministic seamless tile (static markup, no user content; svgDataUrl adds the xmlns). Offset courses wrap the edge brick to the left. */
export function brickTileSvg(seed = 7): string {
  const r = rng(seed);
  const mw = BRICK.w + BRICK.mortar, mh = BRICK.h + BRICK.mortar, half = BRICK.mortar / 2;
  const out: string[] = [];
  for (let row = 0; row < BRICK.rows; row++) {
    const y = row * mh + half;
    const off = row % 2 ? mw / 2 : 0;
    for (let col = 0; col < BRICK.cols; col++) {
      const x = col * mw + off + half;
      const tone = BRICK_TONES[Math.floor(r() * BRICK_TONES.length)];
      const body = brick(tone, r);
      out.push(`<g transform="translate(${x} ${y})">${body}</g>`);
      if (x + BRICK.w > BRICK_TILE.w) out.push(`<g transform="translate(${x - BRICK_TILE.w} ${y})">${body}</g>`);
    }
  }
  const { w, h } = BRICK_TILE;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<filter id="n" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/>`
    + `<feColorMatrix values="0 0 0 0 .2 0 0 0 0 .1 0 0 0 0 .06 0 0 0 ${NOISE_ALPHA} 0"/></filter>`
    + `<rect width="${w}" height="${h}" fill="${MORTAR}"/>${out.join('')}`
    + `<rect width="${w}" height="${h}" filter="url(#n)"/></svg>`;
}
