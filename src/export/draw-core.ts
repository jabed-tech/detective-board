import { ITEM_SIZES, type Item } from '../model/types';
import { drawers } from './registry';
import { wrapLines } from './text';

/** Shared canvas helpers (also used by compose.ts and the T12 drawers). */

export function neatHand(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('neat-hand');
}
export function handFont(px: number): string {
  return neatHand() ? `${px}px "Patrick Hand", cursive` : `${px}px Caveat, cursive`;
}
export const uiFont = (px: number) => `${px}px "Courier Prime", ui-monospace, monospace`;
export const displayFont = (px: number) => `${px}px "Special Elite", "Courier Prime", monospace`;

/** Card scale vs the type's default width, and the text multiplier on top. */
export function scales(it: Item): { k: number; tk: number } {
  const k = it.w / ITEM_SIZES[it.type].w;
  return { k, tk: k * (it.data.textScale ?? 1) };
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Draws `src` filling x,y,w,h like CSS object-fit: cover (clipped to the box). */
export function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, x: number, y: number, w: number, h: number): void {
  const s = src as unknown as { width: number; height: number };
  const sw = s.width, sh = s.height;
  if (!(sw > 0) || !(sh > 0)) return;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale, dh = sh * scale;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/** Applies a drop shadow whose offset is in world px (the canvas shadow offset is in device px, so we scale it). */
export function setShadow(ctx: CanvasRenderingContext2D, color: string, blur: number, ox: number, oy: number): void {
  const m = ctx.getTransform();
  const s = Math.hypot(m.a, m.b) || 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * s;
  ctx.shadowOffsetX = ox * s;
  ctx.shadowOffsetY = oy * s;
}
export function clearShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
}

/** Draws wrapped text lines (middle baseline), clipped by the caller. Returns the number of lines drawn. */
export function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number,
  align: CanvasTextAlign = 'left', maxLines = Infinity): number {
  const lines = wrapLines(text, maxW, s => ctx.measureText(s).width);
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  const ax = align === 'center' ? x + maxW / 2 : x;
  let n = 0;
  for (const ln of lines) {
    if (n >= maxLines) break;
    ctx.fillText(ln, ax, y + lineH * (n + 0.5));
    n++;
  }
  return n;
}

// ---- Core drawers ----

drawers.photo = async (ctx, it, img) => {
  const { w, h } = it;
  ctx.fillStyle = '#fdfaf2'; ctx.fillRect(0, 0, w, h);
  const b = 8, iw = w - 2 * b, ih = h - 2 * b;
  ctx.fillStyle = '#222'; ctx.fillRect(b, b, iw, ih);
  const src = it.data.imageId ? await img(it.data.imageId) : null;
  if (src) drawCover(ctx, src, b, b, iw, ih);
  else if (it.data.imageId) missingLabel(ctx, b, b, iw, ih);
};

function missingLabel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#d8cfb8'; ctx.font = uiFont(16); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Photo missing', x + w / 2, y + h / 2);
}

drawers.polaroid = async (ctx, it, img) => {
  const { w, h } = it;
  const { k, tk } = scales(it);
  ctx.fillStyle = '#fbf8ef'; ctx.fillRect(0, 0, w, h);
  const m = 14 * k, ww = w - 2 * m, wh = 226 * k;
  ctx.fillStyle = '#1d1a17'; ctx.fillRect(m, m, ww, wh);
  const src = it.data.imageId ? await img(it.data.imageId) : null;
  if (src) drawCover(ctx, src, m, m, ww, wh);
  else {
    ctx.save();
    ctx.beginPath(); ctx.rect(m, m, ww, wh); ctx.clip();
    ctx.fillStyle = '#3a352f';
    ctx.beginPath(); ctx.arc(m + ww * 0.5, m + wh * 0.38, 0.18 * Math.hypot(ww * 0.5, wh * 0.62), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(m + ww * 0.5, m + wh, ww * 0.42, wh * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (it.data.imageId) missingLabel(ctx, m, m, ww, wh);
  }
  if (it.data.unknown) {
    ctx.save();
    ctx.font = displayFont(Math.max(72, 96 * k));
    ctx.fillStyle = '#f4eedd'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    setShadow(ctx, 'rgba(0,0,0,.7)', 3, 1, 2);
    ctx.fillText('?', m + ww / 2, m + wh / 2);
    ctx.restore();
  }
  const cap = it.data.caption;
  if (cap) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    const px = 26 * tk;
    ctx.font = handFont(px); ctx.fillStyle = '#1d2a5c';
    drawWrapped(ctx, cap, m, m + wh + 10 * k, ww, px * 1.1, 'center');
    ctx.restore();
  }
};

drawers.sticky = async (ctx, it) => {
  const { w, h } = it;
  const { k, tk } = scales(it);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f9e98f'); g.addColorStop(1, '#f3dc6b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const text = it.data.text;
  if (!text) return;
  const px = 26 * tk, padL = 16 * k, padT = 26 * k, padB = 12 * k;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.font = handFont(px); ctx.fillStyle = '#22201a';
  drawWrapped(ctx, text, padL, padT, w - 2 * padL, px * 1.15, 'left', Math.max(1, Math.floor((h - padT - padB) / (px * 1.15))));
  ctx.restore();
};

drawers.index = async (ctx, it) => {
  const { w, h } = it;
  const { k, tk } = scales(it);
  ctx.fillStyle = '#fbfaf4'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#9fc3e6';
  for (let y = 30 * k; y < h; y += 28 * k) ctx.fillRect(0, y + 27 * k, w, Math.max(1, k));
  ctx.fillStyle = '#d9534f'; ctx.fillRect(0, 27 * k, w, 2 * k);
  const text = it.data.text;
  if (!text) return;
  const lh = 28 * tk, padL = 16 * k, padT = 34 * k, padB = 8 * k;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.font = uiFont(18 * tk); ctx.fillStyle = '#22201a';
  drawWrapped(ctx, text, padL, padT, w - 2 * padL, lh, 'left', Math.max(1, Math.floor((h - padT - padB) / lh)));
  ctx.restore();
};
