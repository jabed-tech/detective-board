import { BOARD_H, BOARD_W, type Board } from '../model/types';
import { clamp } from '../model/geometry';

export interface Rect { x: number; y: number; w: number; h: number }
export type Scope = { kind: 'board' } | { kind: 'view'; rect: Rect } | { kind: 'item'; id: string };

function clampRect(x0: number, y0: number, x1: number, y1: number): Rect | null {
  const l = clamp(x0, 0, BOARD_W), t = clamp(y0, 0, BOARD_H), r = clamp(x1, 0, BOARD_W), b = clamp(y1, 0, BOARD_H);
  if (!(r - l > 0) || !(b - t > 0)) return null;
  return { x: l, y: t, w: r - l, h: b - t };
}

export function regionFor(b: Board, scope: Scope, margin = 24): Rect | null {
  if (scope.kind === 'board') return { x: 0, y: 0, w: BOARD_W, h: BOARD_H };
  if (scope.kind === 'view') {
    const r = scope.rect;
    if (![r.x, r.y, r.w, r.h].every(Number.isFinite)) return null;
    return clampRect(r.x, r.y, r.x + r.w, r.y + r.h);
  }
  const it = b.items.find(i => i.id === scope.id);
  if (!it) return null;
  const rad = (it.rot * Math.PI) / 180, c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  const bw = it.w * c + it.h * s, bh = it.w * s + it.h * c;
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  return clampRect(cx - bw / 2 - margin, cy - bh / 2 - margin, cx + bw / 2 + margin, cy + bh / 2 + margin);
}

export function fitScale(r: Rect, want: number, maxSide = 8192, maxPixels = 16_777_216): number {
  const bySide = maxSide / Math.max(r.w, r.h);
  const byPix = Math.sqrt(maxPixels / (r.w * r.h)) * (1 - 1e-12); // guard float rounding
  return Math.min(want, bySide, byPix);
}
