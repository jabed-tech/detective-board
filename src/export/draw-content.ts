import { SKETCH_VIEW, STAMPS } from '../model/types';
import { formatMoney, receiptTotal } from '../model/generators';
import { objectSvg, stampSvg } from '../view/art';
import { clearShadow, displayFont, drawCover, handFont, scales, setShadow, uiFont } from './draw-core';
import { drawers, shapes } from './registry';
import { svgImage } from './svg-image';
import { wrapLines } from './text';

/** Content drawers (mugshot, newspaper, receipt, casefile, sketch, stamp, object). Sizes follow styles/content.css. */

const NEWS = (px: number, weight: number) => `${weight} ${px}px "Playfair Display", Georgia, serif`;
const mono = (px: number, weight = 400) => `${weight} ${uiFont(px)}`;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  return wrapLines(text, Math.max(1, maxW), s => ctx.measureText(s).width);
}

function polygon(ctx: CanvasRenderingContext2D, w: number, h: number, pts: [number, number][]): void {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * w / 100, py * h / 100) : ctx.moveTo(px * w / 100, py * h / 100)));
  ctx.closePath();
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, v: string): void {
  (ctx as unknown as { letterSpacing?: string }).letterSpacing = v;
}

function silhouette(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x + w * 0.5, y + h * 0.38, 0.18 * Math.hypot(w * 0.5, h * 0.62), 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + w * 0.5, y + h, w * 0.42, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---- mugshot ----

function filterSupported(c: CanvasRenderingContext2D): boolean {
  try { c.filter = 'grayscale(1)'; return c.filter === 'grayscale(1)'; } catch { return false; }
}

/** Draws src cover-fitted into the box, in greyscale with a little extra contrast. */
function drawGrey(ctx: CanvasRenderingContext2D, src: CanvasImageSource, x: number, y: number, w: number, h: number): void {
  const m = ctx.getTransform();
  const s = Math.hypot(m.a, m.b) || 1;
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.ceil(w * s)); off.height = Math.max(1, Math.ceil(h * s));
  const o = off.getContext('2d');
  if (!o) { drawCover(ctx, src, x, y, w, h); return; }
  o.scale(off.width / w, off.height / h);
  if (filterSupported(o)) {
    o.filter = 'grayscale(1) contrast(1.15)';
    drawCover(o, src, 0, 0, w, h);
    o.filter = 'none';
  } else {
    drawCover(o, src, 0, 0, w, h);
    try {
      const d = o.getImageData(0, 0, off.width, off.height);
      const p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const l = 0.299 * p[i]! + 0.587 * p[i + 1]! + 0.114 * p[i + 2]!;
        const v = Math.max(0, Math.min(255, (l - 128) * 1.15 + 128));
        p[i] = p[i + 1] = p[i + 2] = v;
      }
      o.putImageData(d, 0, 0);
    } catch { /* tainted: leave colour */ }
  }
  ctx.drawImage(off, x, y, w, h);
}

drawers.mugshot = async (ctx, it, img) => {
  const { w, h } = it;
  const { k, tk } = scales(it);
  ctx.fillStyle = '#cfd3d4'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#6d7274';
  for (let i = 1; i <= 10; i++) ctx.fillRect(0, h * i / 10 - 2, w, 2);
  ctx.fillStyle = '#2a2d2e'; ctx.font = mono(13 * k, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const top = h * 0.06, span = h * 0.88;
  ["7'", "6'", "5'", "4'"].forEach((t, i) => ctx.fillText(t, 6 * k, top + (span - 13 * k) * i / 3 + 6.5 * k));

  const px = w * 0.22, py = h * 0.06, pw = w * 0.72, ph = h * 0.70;
  ctx.fillStyle = '#8c9294'; ctx.fillRect(px, py, pw, ph);
  const src = it.data.imageId ? await img(it.data.imageId) : null;
  if (src) drawGrey(ctx, src, px, py, pw, ph);
  else silhouette(ctx, px, py, pw, ph, '#4d4f50');

  // placard
  const bx = w * 0.1, bw = w * 0.8, pad = 6 * k, bd = 2;
  ctx.font = mono(18 * tk, 700);
  const nameLines = wrap(ctx, (it.data.name ?? '').toUpperCase(), bw - 2 * bd - 2 * pad);
  const nameH = nameLines.length * 18 * tk * 1.15, noH = 15 * tk * 1.2;
  const bh = Math.min(h * 0.4, nameH + noH + 2 * pad + 2 * bd);
  const by = h * 0.97 - bh;
  ctx.fillStyle = '#111'; ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#eee'; ctx.lineWidth = bd; ctx.strokeRect(bx + bd / 2, by + bd / 2, bw - bd, bh - bd);
  ctx.save();
  ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
  ctx.fillStyle = '#f4f1e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = bx + bw / 2;
  nameLines.forEach((ln, i) => ctx.fillText(ln, cx, by + bd + pad + 18 * tk * 1.15 * (i + 0.5)));
  ctx.font = mono(15 * tk, 700); setLetterSpacing(ctx, `${(0.1 * 15 * tk).toFixed(2)}px`);
  ctx.fillText(it.data.bookingNo ?? '', cx, by + bd + pad + nameH + noH / 2);
  setLetterSpacing(ctx, '0px');
  ctx.restore();
};

// ---- newspaper ----

const NEWS_CLIP: [number, number][] = [[0, 3], [6, 0], [14, 2], [24, 0], [36, 2], [48, 0], [60, 2], [72, 0], [84, 2], [94, 0], [100, 2],
  [100, 97], [92, 100], [80, 98], [66, 100], [52, 98], [38, 100], [24, 98], [10, 100], [0, 97]];

drawers.newspaper = async (ctx, it) => {
  const { w, h } = it;
  const { k, tk } = scales(it);
  const d = it.data;
  ctx.save();
  polygon(ctx, w, h, NEWS_CLIP); ctx.clip();
  ctx.fillStyle = '#efe9da'; ctx.fillRect(0, 0, w, h);
  const padX = 14 * k, padB = 18 * k;
  const iw = w - 2 * padX;
  let y = 14 * k;
  ctx.fillStyle = '#1e1b16'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';

  const mp = Math.max(18, 22 * k);
  ctx.font = NEWS(mp, 700);
  const mast = wrap(ctx, d.masthead ?? '', iw);
  mast.forEach((ln, i) => ctx.fillText(ln, w / 2, y + mp * 1.1 * (i + 0.5)));
  y += mast.length * mp * 1.1 + 4 * k;
  ctx.fillRect(padX, y, iw, 2);
  y += 2 + 4 * k;

  ctx.font = mono(13);
  ctx.fillText(d.date ?? '', w / 2, y + 8.5);
  y += 17 + 4 * k;

  const hp = Math.max(18, 30 * tk);
  ctx.font = NEWS(hp, 900); ctx.textAlign = 'left';
  const head = wrap(ctx, d.headline ?? '', iw);
  head.forEach((ln, i) => ctx.fillText(ln, padX, y + hp * 1.05 * (i + 0.5)));
  y += head.length * hp * 1.05 + 6 * k;

  const bp = 15 * tk, lh = bp * 1.3, gap = 12 * k;
  const colW = (iw - gap) / 2;
  ctx.font = mono(bp);
  const lines = wrap(ctx, d.text ?? '', colW);
  const perCol = Math.max(0, Math.floor((h - padB - y) / lh));
  for (let c = 0; c < 2; c++) {
    const cx = padX + c * (colW + gap);
    lines.slice(c * perCol, (c + 1) * perCol).forEach((ln, i) => ctx.fillText(ln, cx, y + lh * (i + 0.5)));
  }
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(padX + colW + gap / 2 - 0.5, y, 1, Math.max(0, h - padB - y));
  ctx.restore();
};

// ---- receipt ----

const RECEIPT_CLIP: [number, number][] = [[0, 0], [100, 0], [100, 97]];
for (let x = 95; x >= 0; x -= 5) RECEIPT_CLIP.push([x, (x / 5) % 2 === 1 ? 100 : 97]);
shapes.newspaper = (ctx, it) => polygon(ctx, it.w, it.h, NEWS_CLIP);
shapes.receipt = (ctx, it) => polygon(ctx, it.w, it.h, RECEIPT_CLIP);

drawers.receipt = async (ctx, it) => {
  const { w, h } = it;
  const { k, tk } = scales(it);
  const d = it.data;
  ctx.save();
  polygon(ctx, w, h, RECEIPT_CLIP); ctx.clip();
  ctx.fillStyle = '#fbfbf6'; ctx.fillRect(0, 0, w, h);
  const padX = 14 * k, iw = w - 2 * padX, px = 15 * tk, lh = px * 1.3, gap = 8 * k;
  let y = 14 * k;
  ctx.fillStyle = '#222'; ctx.textBaseline = 'middle';
  const centered = (text: string, weight: number) => {
    ctx.font = mono(px, weight); ctx.textAlign = 'center';
    const ls = wrap(ctx, text, iw);
    ls.forEach((ln, i) => ctx.fillText(ln, w / 2, y + lh * (i + 0.5)));
    y += ls.length * lh;
  };
  centered((d.store ?? '').toUpperCase(), 700);
  centered(d.time ?? '', 400);
  y += 6 * k;
  const row = (name: string, price: string, weight: number) => {
    ctx.font = mono(px, weight);
    const pw = ctx.measureText(price).width;
    const ls = wrap(ctx, name, iw - pw - gap);
    ctx.textAlign = 'left';
    ls.forEach((ln, i) => ctx.fillText(ln, padX, y + lh * (i + 0.5)));
    ctx.textAlign = 'right';
    ctx.fillText(price, padX + iw, y + lh * 0.5);
    y += ls.length * lh;
  };
  const lines = d.lines ?? [];
  for (const l of lines) row(l.name, formatMoney(l.price), 400);
  y += 6 * k;
  ctx.save();
  ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(padX, y + 1); ctx.lineTo(padX + iw, y + 1); ctx.stroke();
  ctx.restore();
  y += 2 + 6 * k;
  row('TOTAL', formatMoney(receiptTotal(lines)), 700);
  ctx.restore();
};

// ---- case file ----

drawers.casefile = async (ctx, it) => {
  const { w, h } = it;
  const { k, tk } = scales(it);
  const d = it.data;
  const tabH = 30 * k;
  const tabText = 'CASE FILE';
  ctx.font = displayFont(20);
  const tabW = ctx.measureText(tabText).width + 28 * k;
  const tx = w * 0.04, r = Math.min(6, tabH);
  ctx.fillStyle = '#d9b77a';
  ctx.beginPath();
  ctx.moveTo(tx, tabH); ctx.lineTo(tx, r); ctx.arcTo(tx, 0, tx + r, 0, r);
  ctx.lineTo(tx + tabW - r, 0); ctx.arcTo(tx + tabW, 0, tx + tabW, r, r);
  ctx.lineTo(tx + tabW, tabH); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3b2a12'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(tabText, tx + 14 * k, tabH / 2);

  ctx.fillStyle = '#d9b77a'; ctx.fillRect(0, tabH, w, h - tabH);
  const pad = 12 * k, px = 15 * tk, lh = px * 1.3;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, tabH, w, h - tabH); ctx.clip();
  let y = tabH + pad;
  const rows: [string, string][] = [['Subject', d.subject ?? ''], ['Officer', d.officer ?? ''], ['Status', d.status ?? ''], ['Date', d.date ?? '']];
  ctx.font = mono(px, 700);
  const labelW = Math.max(5.5 * px, ...rows.map(([l]) => ctx.measureText(l).width));
  const vx = pad + labelW + 8 * k;
  for (const [label, value] of rows) {
    ctx.font = mono(px, 400);
    const ls = wrap(ctx, value, w - pad - vx);
    ctx.fillStyle = '#2c2112'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = mono(px, 700); ctx.fillText(label, pad, y + 2 + lh / 2);
    ctx.font = mono(px, 400);
    ls.forEach((ln, i) => ctx.fillText(ln, vx, y + 2 + lh * (i + 0.5)));
    y += Math.max(1, ls.length) * lh + 4;
    ctx.fillStyle = 'rgba(60,40,10,.35)'; ctx.fillRect(pad, y - 1, w - 2 * pad, 1);
  }
  y += 8 * k;
  ctx.fillStyle = '#2c2112'; ctx.font = mono(px, 400);
  const notes = wrap(ctx, d.text ?? '', w - 2 * pad);
  const room = Math.max(0, Math.floor((h - pad - y) / lh));
  notes.slice(0, room).forEach((ln, i) => ctx.fillText(ln, pad, y + lh * (i + 0.5)));
  ctx.restore();

  if (d.status) {
    ctx.save();
    const sp = Math.max(18, 20 * k);
    ctx.font = displayFont(sp);
    const ls = wrap(ctx, d.status.toUpperCase(), w * 0.7 - 20 * k - 6);
    const tw = Math.max(...ls.map(l => ctx.measureText(l).width));
    const bw = tw + 20 * k + 6, bh = ls.length * sp * 1.2 + 4 + 6;
    ctx.translate(w * 0.96 - bw / 2, h * 0.18 + bh / 2); ctx.rotate(-12 * Math.PI / 180);
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = '#b3261e'; ctx.fillStyle = '#b3261e'; ctx.lineWidth = 3;
    ctx.strokeRect(-bw / 2 + 1.5, -bh / 2 + 1.5, bw - 3, bh - 3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ls.forEach((ln, i) => ctx.fillText(ln, 0, -bh / 2 + 5 + sp * 1.2 * (i + 0.5)));
    ctx.restore();
  }
};

// ---- sketch ----

drawers.sketch = async (ctx, it) => {
  const { w, h } = it;
  const { k } = scales(it);
  ctx.fillStyle = '#fdfcf7'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(120,160,210,.35)';
  for (let y = 27 * k; y < h; y += 28 * k) ctx.fillRect(0, y, w, Math.max(1, k));
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  const s = Math.min(w / SKETCH_VIEW.w, h / SKETCH_VIEW.h);
  ctx.translate((w - SKETCH_VIEW.w * s) / 2, (h - SKETCH_VIEW.h * s) / 2);
  ctx.scale(s, s);
  for (const st of it.data.strokes ?? []) {
    ctx.fillStyle = st.color;
    ctx.fill(new Path2D(st.d));
  }
  ctx.restore();
};

// ---- stamp ----

drawers.stamp = async (ctx, it) => {
  const { w, h } = it;
  const { k } = scales(it);
  const id = it.data.stamp ?? 'evidence';
  if (id === 'red-x' || id === 'coffee-ring') {
    ctx.drawImage(await svgImage(stampSvg(id)), 0, 0, w, h);
    return;
  }
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.rotate(-6 * Math.PI / 180);
  ctx.globalAlpha = 0.85; ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#b3261e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (id === 'question') {
    ctx.font = displayFont(Math.max(18, 120 * k));
    ctx.fillText('?', 0, 0);
  } else {
    const label = STAMPS.find(s => s.id === id)?.label ?? '';
    const px = Math.max(18, 40 * k);
    ctx.font = displayFont(px);
    const ls = 0.06 * px;
    setLetterSpacing(ctx, `${ls.toFixed(2)}px`);
    const tw = ctx.measureText(label).width;
    const bw = tw + 2 * 14 * k + 8, bh = px * 1.1 + 2 * 6 * k + 8;
    ctx.fillText(label, ls / 2, 0);
    setLetterSpacing(ctx, '0px');
    ctx.strokeStyle = '#b3261e';
    ctx.lineWidth = 4 / 3;
    ctx.strokeRect(-bw / 2 + 2 / 3, -bh / 2 + 2 / 3, bw - 4 / 3, bh - 4 / 3);
    ctx.strokeRect(-bw / 2 + 10 / 3, -bh / 2 + 10 / 3, bw - 20 / 3, bh - 20 / 3);
  }
  ctx.restore();
};

// ---- object ----

drawers.object = async (ctx, it) => {
  const { w, h } = it;
  const { k, tk } = scales(it);
  const art = await svgImage(objectSvg(it.data.object ?? 'keys'));
  ctx.save();
  setShadow(ctx, 'rgba(0,0,0,.5)', 5, 4, 8);
  ctx.drawImage(art, 0, 0, w, h);
  ctx.restore();
  clearShadow(ctx);
  const cap = it.data.caption;
  if (!cap) return;
  const px = 22 * tk, lh = px * 1.15;
  ctx.save();
  ctx.font = handFont(px);
  const padL = 16 * k, padR = 10 * k;
  const ls = wrap(ctx, cap, w * 0.8 - padL - padR - 2);
  const tw = Math.max(...ls.map(l => ctx.measureText(l).width));
  const bw = tw + padL + padR + 2, bh = ls.length * lh + 4 + 2;
  ctx.translate(w + 14 * k - bw / 2, h + 16 * k - bh / 2); ctx.rotate(3 * Math.PI / 180);
  const x0 = -bw / 2, y0 = -bh / 2, nb = Math.min(10, bw / 2);
  ctx.beginPath();
  ctx.moveTo(x0 + nb, y0); ctx.lineTo(x0 + bw, y0); ctx.lineTo(x0 + bw, y0 + bh); ctx.lineTo(x0 + nb, y0 + bh); ctx.lineTo(x0, y0 + bh / 2); ctx.closePath();
  ctx.fillStyle = '#f1e6c6'; ctx.fill();
  ctx.strokeStyle = '#b9a77c'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#1d2a5c'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ls.forEach((ln, i) => ctx.fillText(ln, x0 + padL + 1, y0 + 3 + lh * (i + 0.5)));
  ctx.restore();
};
