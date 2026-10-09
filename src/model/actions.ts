import { BOARD_H, BOARD_W, ITEM_SIZES, PIN_COLORS, type Board, type Anchor, type FastenerId, type Item, type ItemData, type ItemType, type Link } from './types';
import { clamp } from './geometry';

export function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newBoard(name: string, caseNo: number): Board {
  return { id: newId(), name, caseNo, surface: 'cork', mood: 'noir-office', items: [], links: [], version: 1, updatedAt: 0 };
}

export function makeItem(
  type: ItemType, cx: number, cy: number, data: ItemData = {},
  size?: { w: number; h: number }, rand: () => number = Math.random,
  opts: { attach?: FastenerId; tilt?: boolean } = {},
): Item {
  const { w, h } = size ?? ITEM_SIZES[type];
  return {
    id: newId(), type,
    x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h,
    rot: opts.tilt === false ? 0 : Math.round((rand() * 8 - 4) * 10) / 10,
    z: 0, attach: opts.attach ?? 'pin',
    attachColor: PIN_COLORS[Math.floor(rand() * 4)],
    data,
  };
}

function clampPos(it: Item): Item {
  return { ...it, x: clamp(it.x, 0, BOARD_W - it.w), y: clamp(it.y, 0, BOARD_H - it.h) };
}

const maxZ = (b: Board) => b.items.reduce((m, i) => Math.max(m, i.z), 0);

export function addItem(b: Board, item: Item): Board {
  return { ...b, items: [...b.items, clampPos({ ...item, z: maxZ(b) + 1 })] };
}

export function updateItem(b: Board, id: string, patch: Partial<Omit<Item, 'id'>>): Board {
  const idx = b.items.findIndex(i => i.id === id);
  if (idx < 0) return b;
  const items = b.items.slice();
  items[idx] = clampPos({ ...items[idx], ...patch });
  return { ...b, items };
}

export function removeItem(b: Board, id: string): Board {
  if (!b.items.some(i => i.id === id)) return b;
  return {
    ...b,
    items: b.items.filter(i => i.id !== id),
    links: b.links.filter(l => l.from !== id && l.to !== id),
  };
}

export function bringToFront(b: Board, id: string): Board {
  const it = b.items.find(i => i.id === id);
  if (!it) return b;
  const top = maxZ(b);
  if (it.z === top && b.items.filter(i => i.z === top).length === 1) return b;
  return updateItem(b, id, { z: top + 1 });
}

export function connect(b: Board, from: string, to: string, opts: { color: string; tension: number; fromAt?: Anchor; toAt?: Anchor }): Board {
  if (from === to) return b;
  if (!b.items.some(i => i.id === from) || !b.items.some(i => i.id === to)) return b;
  if (b.links.some(l => (l.from === from && l.to === to) || (l.from === to && l.to === from))) return b;
  const link: Link = { id: newId(), from, to, color: opts.color, tension: clamp(opts.tension, 0, 1) };
  if (opts.fromAt) link.fromAt = opts.fromAt;
  if (opts.toAt) link.toAt = opts.toAt;
  return { ...b, links: [...b.links, link] };
}

export function updateLink(b: Board, id: string, patch: Partial<Omit<Link, 'id' | 'from' | 'to'>>): Board {
  const idx = b.links.findIndex(l => l.id === id);
  if (idx < 0) return b;
  const links = b.links.slice();
  const next = { ...links[idx], ...patch };
  next.tension = clamp(next.tension, 0, 1);
  links[idx] = next;
  return { ...b, links };
}

export function removeLink(b: Board, id: string): Board {
  if (!b.links.some(l => l.id === id)) return b;
  return { ...b, links: b.links.filter(l => l.id !== id) };
}
