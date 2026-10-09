import { describe, it, expect } from 'vitest';
import { openDb } from './db';
import { newBoard, makeItem, addItem } from '../model/actions';

describe('openDb without IndexedDB', () => {
  it('falls back to memory and is marked non-persistent', async () => {
    const db = await openDb();
    expect(db.persistent).toBe(false);
  });
  it('saves, lists, loads and deletes boards with their blobs', async () => {
    const db = await openDb();
    let b = newBoard('Case A', 2);
    b = addItem(b, makeItem('photo', 100, 100, { imageId: 'img1' }));
    await db.putBlob('img1', new Blob(['x'], { type: 'image/webp' }));
    await db.saveBoard(b);
    await db.saveBoard(newBoard('Case B', 1));
    const metas = await db.listBoards();
    expect(metas.map(m => m.caseNo)).toEqual([1, 2]);
    const loaded = await db.loadBoard(b.id);
    expect(loaded).toEqual(b);
    expect(loaded).not.toBe(b); // stored copy, not the same object
    await db.deleteBoard(b.id);
    expect(await db.loadBoard(b.id)).toBeUndefined();
    expect(await db.getBlob('img1')).toBeUndefined();
  });
  it('clearAll empties everything', async () => {
    const db = await openDb();
    await db.saveBoard(newBoard('x', 1));
    await db.putBlob('b', new Blob(['y']));
    await db.clearAll();
    expect(await db.listBoards()).toEqual([]);
    expect(await db.getBlob('b')).toBeUndefined();
  });
});
