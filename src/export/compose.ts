import { MOODS, type Board, type Item, type LightId } from '../model/types';
import { rng } from '../model/random';
import { stampSvg } from '../view/art';
import { hashSeed } from '../view/linePaths';
import { drawBackground, drawMood } from './backdrop';
import { setShadow } from './draw-core';
import './draw-content';
import { drawPin } from './pins';
import { regionFor, type Rect, type Scope } from './region';
import { drawers } from './registry';
import { drawStrings } from './stringsdraw';

export interface ComposeOpts {
  scope: Scope; scale: number; mood: boolean; strings: boolean; background: boolean;
  getBlob(id: string): Promise<Blob | undefined>;
}

// Same table as view/mood.ts SHADOW (shadow direction per light).
const SHADOW: Record<LightId, [number, number]> = { lamp: [1, 1], fluorescent: [0, 0.8], bulb: [0.3, 1.4], neon: [-1.2, 0.6], sepia: [1, 1] };

const FONTS = ['22px Caveat', '26px Caveat', '18px "Courier Prime"', '20px "Special Elite"', '30px "Playfair Display"'];

async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const list = [...FONTS];
  if (document.documentElement.classList.contains('neat-hand')) list.push('26px "Patrick Hand"', '22px "Patrick Hand"');
  try {
    await Promise.all(list.map(f => document.fonts.load(f).catch(() => [])));
    await document.fonts.ready;
  } catch { /* fonts are best-effort */ }
}

function svgImage(svg: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    setTimeout(() => res(null), 8000); // never hang an export on an image that won't decode
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function sortedByZ(items: Item[]): Item[] {
  return items.map((it, i) => [it, i] as const).sort((a, b) => a[0].z - b[0].z || a[1] - b[1]).map(p => p[0]);
}

function plainCard(ctx: CanvasRenderingContext2D, it: Item): void {
  ctx.fillStyle = '#f1ead8'; ctx.fillRect(0, 0, it.w, it.h);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, it.w, it.h);
}

function drawAged(ctx: CanvasRenderingContext2D, it: Item): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, it.w, it.h); ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(160,120,60,.22)'; ctx.fillRect(0, 0, it.w, it.h);
  const r = rng(it.data.seed ?? hashSeed(it.id));
  for (let i = 0; i < 3; i++) {
    const x = r() * it.w, y = r() * it.h, rad = 14 + r() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(140,90,40,.35)'); g.addColorStop(1, 'rgba(140,90,40,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}

export async function composeBoard(b: Board, o: ComposeOpts): Promise<HTMLCanvasElement | null> {
  const r: Rect | null = regionFor(b, o.scope);
  if (!r) return null;
  const w = Math.round(r.w * o.scale), h = Math.round(r.h * o.scale);
  if (!(w > 0) || !(h > 0)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(w / r.w, h / r.h);
  ctx.translate(-r.x, -r.y);

  await loadFonts();

  const cache = new Map<string, Promise<ImageBitmap | null>>();
  const img = (id: string): Promise<CanvasImageSource | null> => {
    let p = cache.get(id);
    if (!p) {
      p = o.getBlob(id).then(blob => (blob ? createImageBitmap(blob) : null)).catch(() => null);
      cache.set(id, p);
    }
    return p;
  };

  const light = MOODS[b.mood]?.light ?? 'lamp';
  const [sx, sy] = SHADOW[light];

  if (o.background || o.scope.kind !== 'item') drawBackground(ctx, r, b.surface);

  if (o.strings) drawStrings(ctx, b, r, o.scope.kind === 'item', sx, sy);

  const scopeId = o.scope.kind === 'item' ? o.scope.id : null;
  const shown = sortedByZ(b.items).filter(it => scopeId === null || it.id === scopeId);
  let redX: HTMLImageElement | null | undefined;

  for (const it of shown) {
    ctx.save();
    ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
    ctx.rotate((it.rot * Math.PI) / 180);
    ctx.translate(-it.w / 2, -it.h / 2);
    if (it.type !== 'stamp' && it.type !== 'object') {
      ctx.save();
      setShadow(ctx, 'rgba(0,0,0,.45)', 18, 6 * sx, 14 * sy);
      ctx.fillStyle = '#d8d0bc'; ctx.fillRect(0, 0, it.w, it.h);
      ctx.restore();
    }
    const draw = drawers[it.type];
    if (draw) {
      try { await draw(ctx, it, img); } catch { plainCard(ctx, it); }
    } else plainCard(ctx, it);
    if (it.data.aged) drawAged(ctx, it);
    if (it.data.crossed) {
      if (redX === undefined) redX = await svgImage(stampSvg('red-x'));
      if (redX) ctx.drawImage(redX, 0, 0, it.w, it.h);
    }
    ctx.restore();
  }

  for (const it of shown) drawPin(ctx, it, sx, sy);

  if (o.mood) drawMood(ctx, r, b.mood);
  return canvas;
}
