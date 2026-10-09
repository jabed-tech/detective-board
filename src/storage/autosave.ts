import type { Board } from '../model/types';

export function createAutosave(save: (b: Board) => Promise<void>, onError: (e: unknown) => void, delay = 500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Board | null = null;

  let inflight: Promise<void> = Promise.resolve();

  function flush(): Promise<void> {
    clearTimeout(timer);
    // chain so saves never overlap and flush resolves only after earlier writes land
    inflight = inflight.then(async () => {
      if (!pending) return;
      const b = { ...pending, updatedAt: Date.now() };
      pending = null;
      try { await save(b); } catch (e) { pending ??= b; onError(e); } // keep for retry unless newer exists
    });
    return inflight;
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
