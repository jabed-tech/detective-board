import { createStore, get, set, del, values, clear } from 'idb-keyval';
import type { Board } from '../model/types';

export interface BoardMeta { id: string; name: string; caseNo: number; updatedAt: number }

export interface Db {
  persistent: boolean;
  listBoards(): Promise<BoardMeta[]>;
  loadBoard(id: string): Promise<Board | undefined>;
  saveBoard(b: Board): Promise<void>;
  deleteBoard(id: string): Promise<void>;
  putBlob(id: string, blob: Blob): Promise<void>;
  getBlob(id: string): Promise<Blob | undefined>;
  clearAll(): Promise<void>;
}

const meta = (b: Board): BoardMeta => ({ id: b.id, name: b.name, caseNo: b.caseNo, updatedAt: b.updatedAt });
const byCase = (a: BoardMeta, b: BoardMeta) => a.caseNo - b.caseNo;
const imageIds = (b: Board) => b.items.flatMap(i => (i.data.imageId ? [i.data.imageId] : []));

function idbDb(): Db {
  // idb-keyval allows one object store per database, hence two databases.
  const boards = createStore('detective-board-boards', 'boards');
  const blobs = createStore('detective-board-blobs', 'blobs');
  return {
    persistent: true,
    async listBoards() { return (await values<Board>(boards)).map(meta).sort(byCase); },
    loadBoard: id => get<Board>(id, boards),
    saveBoard: b => set(b.id, b, boards),
    async deleteBoard(id) {
      const b = await get<Board>(id, boards);
      if (b) await Promise.all(imageIds(b).map(i => del(i, blobs)));
      await del(id, boards);
    },
    putBlob: (id, blob) => set(id, blob, blobs),
    getBlob: id => get<Blob>(id, blobs),
    async clearAll() { await clear(boards); await clear(blobs); },
  };
}

function memoryDb(): Db {
  const boards = new Map<string, Board>();
  const blobs = new Map<string, Blob>();
  return {
    persistent: false,
    async listBoards() { return [...boards.values()].map(meta).sort(byCase); },
    async loadBoard(id) { const b = boards.get(id); return b && structuredClone(b); },
    async saveBoard(b) { boards.set(b.id, structuredClone(b)); },
    async deleteBoard(id) {
      const b = boards.get(id);
      if (b) for (const i of imageIds(b)) blobs.delete(i);
      boards.delete(id);
    },
    async putBlob(id, blob) { blobs.set(id, blob); },
    async getBlob(id) { return blobs.get(id); },
    async clearAll() { boards.clear(); blobs.clear(); },
  };
}

export async function openDb(): Promise<Db> {
  if (typeof indexedDB === 'undefined') return memoryDb();
  try {
    const db = idbDb();
    await db.listBoards(); // probe: throws in some private modes
    return db;
  } catch {
    return memoryDb();
  }
}
// shortcut: blobs of removed items are kept (undo may restore them). Orphan GC is a phase 5 task.
