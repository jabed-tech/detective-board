import type { Item } from '../model/types';
import { pinPoint } from '../model/geometry';
import { clearShadow, setShadow } from './draw-core';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Draws the fastener at the item's pin point (simple circles/rects, coloured by attachColor; nail = steel). */
export function drawPin(ctx: CanvasRenderingContext2D, it: Item, sx: number, sy: number): void {
  if (it.type === 'stamp') return;
  const p = pinPoint(it);
  const col = HEX.test(it.attachColor) ? it.attachColor : '#c0392b';
  ctx.save();
  ctx.translate(p.x, p.y);
  setShadow(ctx, 'rgba(0,0,0,.5)', 4, sx * 2, sy * 4);
  switch (it.attach) {
    case 'tack':
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      clearShadow(ctx);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(-4, -4, 4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'tape':
      ctx.rotate((-6 * Math.PI) / 180);
      ctx.fillStyle = 'rgba(240,232,210,.7)'; ctx.fillRect(-35, -12, 70, 24);
      clearShadow(ctx);
      ctx.fillStyle = col; ctx.globalAlpha = 0.25; ctx.fillRect(-35, -12, 70, 24);
      break;
    case 'magnet':
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      clearShadow(ctx);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-4, -5, 3.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'clip':
      ctx.fillStyle = '#1d1d1d'; ctx.fillRect(-15, -7, 30, 14);
      clearShadow(ctx);
      ctx.fillStyle = col; ctx.fillRect(-3, -7, 2, 14);
      ctx.strokeStyle = '#c8ccd0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-10, -15); ctx.lineTo(10, -15); ctx.lineTo(10, -8); ctx.stroke();
      break;
    case 'nail': {
      const g = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, 7);
      g.addColorStop(0, '#f2f2f2'); g.addColorStop(0.45, '#9ea3a8'); g.addColorStop(1, '#5d6266');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      clearShadow(ctx);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(2, 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(-3, -3, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
