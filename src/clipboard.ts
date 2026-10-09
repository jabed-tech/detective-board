import type { Item } from './model/types';
import { newId } from './model/actions';
import { validateBoard } from './storage/transfer';

export const ITEM_FORMAT = 'detective-board-item';

export function serializeItem(item: Item): string {
  return JSON.stringify({ format: ITEM_FORMAT, version: 1, item });
}

export function parseClipboardText(text: string): { kind: 'item'; item: Item } | { kind: 'text'; text: string } | { kind: 'empty' } {
  const trimmed = text.trim();
  if (!trimmed) return { kind: 'empty' };
  let raw: unknown;
  try { raw = JSON.parse(trimmed); } catch { return { kind: 'text', text: trimmed }; }
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== ITEM_FORMAT) return { kind: 'text', text: trimmed };
  const r = raw as { version?: unknown; item?: unknown };
  const item = r.version === 1 ? validateBoard({ items: [r.item], links: [] })?.items[0] : undefined;
  return item ? { kind: 'item', item } : { kind: 'empty' };
}

export function offsetCopy(item: Item, dx = 40, dy = 40): Item {
  return { ...item, id: newId(), x: item.x + dx, y: item.y + dy, data: { ...item.data } };
}
