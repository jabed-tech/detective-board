import { describe, expect, it } from 'vitest';
import { ITEM_FORMAT, offsetCopy, parseClipboardText, serializeItem } from './clipboard';
import type { Item } from './model/types';

const item: Item = {
  id: 'a1', type: 'sticky', x: 100, y: 200, w: 200, h: 180, rot: 3, z: 4,
  attach: 'tape', attachColor: '#1f5fae', data: { text: 'hello', caption: 'cap' },
};

describe('clipboard', () => {
  it('round-trips an item', () => {
    const r = parseClipboardText(serializeItem(item));
    expect(r).toEqual({ kind: 'item', item });
  });

  it('sanitises hostile item fields', () => {
    const text = JSON.stringify({ format: ITEM_FORMAT, version: 1, item: { ...item, attachColor: 'red;x' } });
    const r = parseClipboardText(text);
    expect(r.kind).toBe('item');
    if (r.kind === 'item') expect(r.item.attachColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('our format with a bad item is empty, not text', () => {
    const text = JSON.stringify({ format: ITEM_FORMAT, version: 1, item: { ...item, type: 'evil' } });
    expect(parseClipboardText(text)).toEqual({ kind: 'empty' });
  });

  it('plain and foreign-JSON text is text', () => {
    expect(parseClipboardText('  a clue ')).toEqual({ kind: 'text', text: 'a clue' });
    expect(parseClipboardText('{"format":"other"}')).toEqual({ kind: 'text', text: '{"format":"other"}' });
  });

  it('whitespace is empty', () => {
    expect(parseClipboardText(' \n\t')).toEqual({ kind: 'empty' });
  });

  it('offsetCopy changes id and position only', () => {
    const c = offsetCopy(item);
    expect(c.id).not.toBe(item.id);
    expect({ ...c, id: item.id }).toEqual({ ...item, x: 140, y: 240 });
    expect(c.data).not.toBe(item.data);
  });
});
