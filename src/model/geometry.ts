import type { Anchor, Item } from './types';

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

type Box = Pick<Item, 'x' | 'y' | 'w' | 'h' | 'rot'>;

export function anchorPoint(it: Box, at?: Anchor): { x: number; y: number } {
  if (!at) return pinPoint(it);
  const lx = at.u * it.w, ly = at.v * it.h;
  const r = (it.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return { x: it.x + it.w / 2 + lx * c - ly * s, y: it.y + it.h / 2 + lx * s + ly * c };
}

export function toAnchor(it: Box, wx: number, wy: number): Anchor {
  const dx = wx - (it.x + it.w / 2), dy = wy - (it.y + it.h / 2);
  const r = (it.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return { u: clamp((dx * c + dy * s) / it.w, -0.5, 0.5), v: clamp((-dx * s + dy * c) / it.h, -0.5, 0.5) };
}
