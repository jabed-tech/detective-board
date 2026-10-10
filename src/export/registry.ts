import type { Item, ItemType } from '../model/types';

/**
 * Draws one item's face. The context is already translated/rotated so (0,0) is the card's
 * top-left and the card is `it.w` x `it.h`. `img` resolves an image id to a bitmap (or null if missing).
 */
export type ItemDrawer = (ctx: CanvasRenderingContext2D, it: Item, img: (id: string) => Promise<CanvasImageSource | null>) => Promise<void>;

/** T11 registers photo/polaroid/sticky/index (draw-core.ts); T12 registers the rest. */
export const drawers: Partial<Record<ItemType, ItemDrawer>> = {};
