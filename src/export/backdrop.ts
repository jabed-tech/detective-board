import { BOARD_H, BOARD_W, MOODS, type EffectId, type MoodId, type SurfaceId } from '../model/types';
import { rng } from '../model/random';
import { BRICK_TONES } from '../view/brickTile';
import type { Rect } from './region';

const BASE: Record<SurfaceId, string> = { cork: '#b88a57', glass: '#6a7682', brick: '#b3a794', wood: '#9a6d47', archive: '#b49a73' };

function noiseTile(seed: number, alphaLo: number, alphaHi: number): HTMLCanvasElement | null {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(256, 256);
  const r = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(r() * 256);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.round(alphaLo + r() * (alphaHi - alphaLo));
  }
  g.putImageData(img, 0, 0);
  return c;
}

function clipTo(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
}

/** Surface colour + noise + brick/wood lines, over the region. */
export function drawBackground(ctx: CanvasRenderingContext2D, r: Rect, surface: SurfaceId, tiles: { brick?: CanvasImageSource | null } = {}): void {
  ctx.fillStyle = BASE[surface] ?? BASE.cork;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  ctx.save();
  clipTo(ctx, r);
  if (surface === 'brick') {
    const pat = tiles.brick ? ctx.createPattern(tiles.brick, 'repeat') : null;
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(r.x, r.y, r.w, r.h); }   // pattern anchored at world 0,0 like the CSS tile
    else { ctx.fillStyle = BRICK_TONES[0]; ctx.fillRect(r.x, r.y, r.w, r.h); }  // decode failed: plain brick
    glowWhitewash(ctx, r);
  } else if (surface === 'glass') {
    drawAcrylic(ctx, r);
  } else if (surface === 'wood') {
    ctx.strokeStyle = 'rgba(20,12,6,.5)'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = Math.floor(r.x / 220) * 220; x < r.x + r.w; x += 220) { ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,190,.08)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = Math.floor(r.x / 220) * 220 + 4; x < r.x + r.w; x += 220) { ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); }
    ctx.stroke();
  }
  if (surface !== 'brick' && surface !== 'glass') {   // brick carries its own noise; the acrylic room is smooth (out of focus)
    const tile = noiseTile(surface.length * 977 + 13, 10, 30);
    const npat = tile && ctx.createPattern(tile, 'repeat');
    if (npat) { ctx.fillStyle = npat; ctx.fillRect(r.x, r.y, r.w, r.h); }
  }
  ctx.restore();
}

/** Radial glow in an ellipse of radii rx,ry around cx,cy; the last stop colour extends outward (like CSS). */
function glow(ctx: CanvasRenderingContext2D, r: Rect, cx: number, cy: number, rx: number, ry: number, stops: [number, string][]): void {
  ctx.save();
  clipTo(ctx, r);
  ctx.translate(cx, cy); ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
  ctx.restore();
}

/** Whitewash pooling bottom-left of the 4000 x 3000 board; matches the CSS `ellipse at 0% 100%`. */
function glowWhitewash(ctx: CanvasRenderingContext2D, r: Rect): void {
  glow(ctx, r, 0, BOARD_H, BOARD_W * 0.55 * 1.414, BOARD_H * 0.55 * 1.414, [[0, 'rgba(240,232,220,.45)'], [1, 'rgba(240,232,220,0)']]);
}

/** Acrylic panel in world coordinates (4000 x 3000), mirroring the `.surface-glass` CSS layers bottom to top. */
function drawAcrylic(ctx: CanvasRenderingContext2D, r: Rect): void {
  const W = BOARD_W, H = BOARD_H;
  // 1. room gradient
  const room = ctx.createLinearGradient(0, 0, 0, H);
  room.addColorStop(0, '#7d8996'); room.addColorStop(0.4, '#717d89'); room.addColorStop(1, '#6a7682');
  ctx.fillStyle = room; ctx.fillRect(0, 0, W, H);
  // 2. desk and partition bands
  const bands: [number, number, string][] = [[0.62, 0.64, 'rgba(24,30,36,.18)'], [0.64, 0.78, 'rgba(40,48,56,.12)'], [0.78, 0.80, 'rgba(24,30,36,.18)'], [0.80, 1, 'rgba(34,40,48,.1)']];
  for (const [a, b, c] of bands) { ctx.fillStyle = c; ctx.fillRect(0, H * a, W, H * (b - a)); }
  // 3. bokeh (CSS `circle R at x% y%`, colour fades to transparent at 70%)
  const bokeh: [number, number, number, string][] = [
    [0.14, 0.58, 80, 'rgba(255,200,120,.26)'], [0.36, 0.66, 55, 'rgba(140,220,255,.22)'], [0.63, 0.60, 100, 'rgba(140,200,255,.2)'],
    [0.86, 0.70, 65, 'rgba(255,210,140,.22)'], [0.48, 0.52, 45, 'rgba(160,255,200,.16)'],
  ];
  const fade = (c: string): [number, string][] => [[0, c], [0.7, c.replace(/[\d.]+\)$/, '0)')], [1, c.replace(/[\d.]+\)$/, '0)')]];
  for (const [x, y, rad, c] of bokeh) glow(ctx, r, W * x, H * y, rad, rad, fade(c));
  // 4. ceiling strips
  glow(ctx, r, W * 0.22, H * 0.06, 640, 70, fade('rgba(235,245,255,.5)'));
  glow(ctx, r, W * 0.70, H * 0.04, 640, 70, fade('rgba(235,245,255,.4)'));
  // 5. 115deg sheen bands (hard stops along the CSS gradient line)
  const a = (115 * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a);
  const half = (Math.abs(W * dx) + Math.abs(H * dy)) / 2, cx = W / 2, cy = H / 2;
  const sheen = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  const t = 'rgba(255,255,255,0)', w1 = 'rgba(255,255,255,.10)', w2 = 'rgba(255,255,255,.06)';
  for (const [o, c] of [[0, t], [0.18, t], [0.18, w1], [0.24, w1], [0.24, t], [0.58, t], [0.58, w2], [0.61, w2], [0.61, t], [1, t]] as [number, string][]) sheen.addColorStop(o, c);
  ctx.fillStyle = sheen; ctx.fillRect(0, 0, W, H);
  // 6. cut edge
  ctx.strokeStyle = 'rgba(190,255,240,.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  // inner glow (CSS `inset 0 0 26px rgba(160,240,230,.16)`): stacked inset strokes fading inward, clipped to the panel
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(160,240,230,${(0.16 * (1 - i / 6) / 2.2).toFixed(3)})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(2 + i * 4, 2 + i * 4, W - 4 - i * 8, H - 4 - i * 8);
  }
  ctx.restore();
  // 7. chrome standoff bolts
  for (const [bx, by] of [[60, 60], [W - 60, 60], [60, H - 60], [W - 60, H - 60]]) {
    const ring = ctx.createRadialGradient(bx, by, 0, bx, by, 20);   // CSS: .35 until 17px, fading to 0 at 20px
    ring.addColorStop(0, 'rgba(0,0,0,.35)'); ring.addColorStop(0.85, 'rgba(0,0,0,.35)'); ring.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ring;
    ctx.beginPath(); ctx.arc(bx, by, 20, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, 14);
    g.addColorStop(0, '#f4f6f7'); g.addColorStop(0.4, '#b9c1c6'); g.addColorStop(1, '#6b747b');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI * 2); ctx.fill();
  }
}

function multiply(ctx: CanvasRenderingContext2D, r: Rect, color: string): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Mood baked in: light pool, tint, static effects (grain, blinds), vignette. Mirrors mood.css. */
/** `effects` is the user's per-effect toggles; an effect that is off on screen is not baked in. Omitted = all on. */
export function drawMood(ctx: CanvasRenderingContext2D, r: Rect, mood: MoodId, effects?: Partial<Record<EffectId, boolean>>): void {
  const def = MOODS[mood];
  if (!def) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const light = def.light;
  const dark = 'rgba(8,5,3,';
  if (light === 'lamp') {
    multiply(ctx, r, 'rgba(255,170,90,.10)');
    glow(ctx, r, cx, r.y + r.h * 0.35, r.w * 0.6, r.h * 0.65,
      [[0, 'rgba(255,214,150,.14)'], [0.45, 'rgba(255,214,150,0)'], [0.78, dark + '.26)'], [1, dark + '.36)']]);
  } else if (light === 'bulb') {
    multiply(ctx, r, 'rgba(255,170,90,.10)');
    glow(ctx, r, cx, r.y + r.h * 0.35, r.w * 0.4, r.h * 0.45,
      [[0, 'rgba(255,210,140,.16)'], [0.4, 'rgba(255,210,140,0)'], [0.7, dark + '.12)'], [1, dark + '.18)']]);
  } else if (light === 'fluorescent') {
    glow(ctx, r, cx, r.y + r.h * 0.35, r.w * 0.45, r.h * 0.55, [[0, 'rgba(220,240,255,.10)'], [0.7, 'rgba(220,240,255,0)'], [1, 'rgba(220,240,255,0)']]);
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, 'rgba(220,240,255,.10)'); g.addColorStop(0.55, 'rgba(220,240,255,.04)'); g.addColorStop(1, 'rgba(8,10,14,.22)');
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  } else if (light === 'neon') {
    glow(ctx, r, cx, r.y + r.h * 0.35, r.w * 0.4, r.h * 0.5, [[0, 'rgba(255,140,210,.08)'], [0.7, 'rgba(255,140,210,0)'], [1, 'rgba(255,140,210,0)']]);
    glow(ctx, r, r.x + r.w, r.y + r.h * 0.45, r.w * 0.6, r.h * 0.8, [[0, 'rgba(255,60,170,.16)'], [0.7, 'rgba(255,60,170,0)'], [1, 'rgba(255,60,170,0)']]);
    glow(ctx, r, r.x + r.w, r.y + r.h * 0.6, r.w * 0.5, r.h * 0.7, [[0, 'rgba(40,220,210,.10)'], [0.7, 'rgba(40,220,210,0)'], [1, 'rgba(40,220,210,0)']]);
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    g.addColorStop(0, 'rgba(8,5,10,.12)'); g.addColorStop(1, 'rgba(8,5,10,.04)');
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  } else {
    multiply(ctx, r, 'rgba(150,110,60,.18)');
    glow(ctx, r, cx, r.y + r.h * 0.35, r.w * 0.7, r.h * 0.75,
      [[0, 'rgba(255,230,180,.08)'], [0.5, dark + '0)'], [1, dark + '.24)']]);
  }

  if (def.effects.includes('grain') && effects?.grain !== false) {
    const tile = noiseTile(4242, 255, 255);
    const pat = tile && ctx.createPattern(tile, 'repeat');
    if (pat) {
      ctx.save();
      ctx.globalAlpha = 0.05; ctx.fillStyle = pat; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }
  if (def.effects.includes('blinds') && effects?.blinds !== false) {
    ctx.save();
    clipTo(ctx, r);
    ctx.translate(cx, cy); ctx.rotate((-10 * Math.PI) / 180);
    ctx.fillStyle = 'rgba(0,0,0,.06)';
    const reach = Math.hypot(r.w, r.h) / 2;
    for (let y = -reach; y < reach; y += 64) ctx.fillRect(-reach, y, reach * 2, 26);
    ctx.restore();
  }

  // Vignette (CSS: inset 140px at 40% black), approximated radially.
  const rad = Math.hypot(r.w, r.h) / 2;
  const v = ctx.createRadialGradient(cx, cy, rad * 0.55, cx, cy, rad);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.40)');
  ctx.save();
  clipTo(ctx, r);
  ctx.fillStyle = v; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}
