import type { Board } from '../model/types';

export function createAutosave(save: (b: Board) => Promise<void>, onError: (e: unknown) => void, delay = 500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Board | null = null;

  async function flush(): Promise<void> {
    clearTimeout(timer);
    if (!pending) return;
    const b = { ...pending, updatedAt: Date.now() };
    pending = null;
    try { await save(b); } catch (e) { onError(e); }
  }

  return {
    schedule(b: Board) {
      pending = b;
      clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, delay);
    },
    flush,
  };
}
