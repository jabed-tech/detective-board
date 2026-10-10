export type ItemType = 'photo' | 'polaroid' | 'sticky' | 'index';
export type SurfaceId = 'cork';
export type MoodId = 'noir-office';
export type FastenerId = 'pin' | 'tack' | 'tape' | 'magnet' | 'clip';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type Atmosphere = 'full' | 'gentle' | 'off';

export interface ItemData { imageId?: string; text?: string; caption?: string; unknown?: boolean; textScale?: number }

/** Per-item text size multiplier (absent = 1), on top of the card-size scaling. */
export const TEXT_SCALE_MIN = 0.5;
export const TEXT_SCALE_MAX = 3;
export const TEXT_STEP = 1.15;

/** Step a text scale by `factor`, clamped, rounded to 2 dp. */
export function stepTextScale(cur: number | undefined, factor: number): number {
  return Math.round(Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, (cur ?? 1) * factor)) * 100) / 100;
}

export interface Item {
  id: string; type: ItemType;
  x: number; y: number; w: number; h: number; // top-left + size in world px, before rotation
  rot: number; // degrees, rotation about centre
  z: number;
  attach: FastenerId; attachColor: string;
  data: ItemData;
}

/** Spot on an item, in its own unrotated frame: fractions of w/h from the centre (each -0.5..0.5). */
export interface Anchor { u: number; v: number }

export interface Link {
  id: string; from: string; to: string;
  color: string; tension: number; // 0 taut … 1 droopy
  style?: LineStyle; label?: string;
  fromAt?: Anchor; toAt?: Anchor; // absent = the item's main fastener
}

export interface Board {
  id: string; name: string; caseNo: number;
  surface: SurfaceId; mood: MoodId;
  items: Item[]; links: Link[];
  version: 1; updatedAt: number;
}

export const BOARD_W = 4000;
export const BOARD_H = 3000;

export const ITEM_SIZES: Record<ItemType, { w: number; h: number }> = {
  photo: { w: 260, h: 200 },
  polaroid: { w: 240, h: 290 },
  sticky: { w: 220, h: 220 },
  index: { w: 320, h: 200 },
};

export const FASTENERS: { id: FastenerId; name: string }[] = [
  { id: 'pin', name: 'Push pin' }, { id: 'tack', name: 'Thumbtack' }, { id: 'tape', name: 'Tape' },
  { id: 'magnet', name: 'Magnet' }, { id: 'clip', name: 'Binder clip' },
];

export const PIN_COLORS = ['#c0392b', '#1f5fae', '#2f7d32', '#e0b000', '#ece6d6', '#6a3d9a'] as const;
export const YARN_COLORS = ['#b3261e', '#1f5fae', '#2f7d32', '#e0b000', '#ece6d6', '#1d1d1d', '#6a3d9a', '#d9661f'] as const;

export type Mode = 'move' | 'string' | 'erase';
