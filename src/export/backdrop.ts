import { MOODS, type MoodId, type SurfaceId } from '../model/types';
import { rng } from '../model/random';
import type { Rect } from './region';

const BASE: Record<SurfaceId, string> = { cork: '#b98a5a', glass: '#cfd8dc', brick: '#8a4b37', wood: '#6b4a2f', archive: '#b49a73' };

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
export function drawBackground(ctx: CanvasRenderingContext2D, r: Rect, surface: SurfaceId): void {
  ctx.fillStyle = BASE[surface] ?? BASE.cork;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  ctx.save();
  clipTo(ctx, r);
  if (surface === 'brick') {
    ctx.strokeStyle = 'rgba(40,30,26,.55)'; ctx.lineWidth = 4;
    const bh = 60, bw = 160;
    ctx.beginPath();
    for (let row = Math.floor(r.y / bh); row * bh < r.y + r.h; row++) {
      const y = row * bh;
      ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y);
      const off = row % 2 ? bw / 2 : 0;
      for (let x = Math.floor((r.x - off) / bw) * bw + off; x < r.x + r.w; x += bw) { ctx.moveTo(x, y); ctx.lineTo(x, y + bh); }
    }
    ctx.stroke();
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
  const tile = noiseTile(surface.length * 977 + 13, 10, 30);
  const pat = tile && ctx.createPattern(tile, 'repeat');
  if (pat) { ctx.fillStyle = pat; ctx.fillRect(r.x, r.y, r.w, r.h); }
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

function multiply(ctx: CanvasRenderingContext2D, r: Rect, color: string): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Mood baked in: light pool, tint, static effects (grain, blinds), vignette. Mirrors mood.css. */
export function drawMood(ctx: CanvasRenderingContext2D, r: Rect, mood: MoodId): void {
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
      [[0, 'rgba(255,210,140,.16)'], [0.4, 'rgba(255,210,140,0)'], [0.7, dark + '.26)'], [1, dark + '.34)']]);
  } else if (light === 'fluorescent') {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, 'rgba(220,240,255,.10)'); g.addColorStop(0.55, 'rgba(220,240,255,.04)'); g.addColorStop(1, 'rgba(8,10,14,.22)');
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  } else if (light === 'neon') {
    glow(ctx, r, r.x + r.w, r.y + r.h * 0.45, r.w * 0.6, r.h * 0.8, [[0, 'rgba(255,60,170,.16)'], [0.7, 'rgba(255,60,170,0)'], [1, 'rgba(255,60,170,0)']]);
    glow(ctx, r, r.x + r.w, r.y + r.h * 0.6, r.w * 0.5, r.h * 0.7, [[0, 'rgba(40,220,210,.10)'], [0.7, 'rgba(40,220,210,0)'], [1, 'rgba(40,220,210,0)']]);
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    g.addColorStop(0, 'rgba(8,5,10,.30)'); g.addColorStop(1, 'rgba(8,5,10,.10)');
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  } else {
    multiply(ctx, r, 'rgba(150,110,60,.18)');
    glow(ctx, r, cx, r.y + r.h * 0.35, r.w * 0.7, r.h * 0.75,
      [[0, 'rgba(255,230,180,.08)'], [0.5, dark + '0)'], [1, dark + '.24)']]);
  }

  if (def.effects.includes('grain')) {
    const tile = noiseTile(4242, 255, 255);
    const pat = tile && ctx.createPattern(tile, 'repeat');
    if (pat) {
      ctx.save();
      ctx.globalAlpha = 0.05; ctx.fillStyle = pat; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }
  if (def.effects.includes('blinds')) {
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
