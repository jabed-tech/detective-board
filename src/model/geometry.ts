import type { Item } from './types';

export const PIN_INSET = 14;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function pinPoint(it: Pick<Item, 'x' | 'y' | 'w' | 'h' | 'rot'>): { x: number; y: number } {
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  const ly = -it.h / 2 + PIN_INSET; // local x is 0
  const r = (it.rot * Math.PI) / 180;
  return { x: cx - ly * Math.sin(r), y: cy + ly * Math.cos(r) };
}
