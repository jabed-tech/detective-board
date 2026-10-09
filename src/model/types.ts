export type ItemType = 'photo' | 'polaroid' | 'sticky' | 'index';
export type SurfaceId = 'cork';
export type MoodId = 'noir-office';
export type FastenerId = 'pin';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type Atmosphere = 'full' | 'gentle' | 'off';

export interface ItemData { imageId?: string; text?: string; caption?: string }

export interface Item {
  id: string; type: ItemType;
  x: number; y: number; w: number; h: number; // top-left + size in world px, before rotation
  rot: number; // degrees, rotation about centre
  z: number;
  attach: FastenerId; attachColor: string;
  data: ItemData;
}

export interface Link {
  id: string; from: string; to: string;
  color: string; tension: number; // 0 taut … 1 droopy
  style?: LineStyle; label?: string;
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

export const PIN_COLORS = ['#c0392b', '#1f5fae', '#2f7d32', '#e0b000', '#ece6d6', '#6a3d9a'] as const;
export const YARN_COLORS = ['#b3261e', '#1f5fae', '#2f7d32', '#e0b000', '#ece6d6', '#1d1d1d', '#6a3d9a', '#d9661f'] as const;
