import type { Board } from './types';

export type ChangeReason = 'commit' | 'load' | 'undo' | 'redo';
export type Listener = (b: Board, reason: ChangeReason) => void;

export interface Store {
  get(): Board;
  commit(next: Board): void;
  load(board: Board): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(fn: Listener): () => void;
}

export function createStore(initial: Board, limit = 100): Store {
  let cur = initial;
  let past: Board[] = [];
  let future: Board[] = [];
  const subs = new Set<Listener>();
  const emit = (r: ChangeReason) => { for (const fn of subs) fn(cur, r); };

  return {
    get: () => cur,
    commit(next) {
      if (next === cur) return;
      past.push(cur);
      if (past.length > limit) past.shift();
      future = [];
      cur = next;
      emit('commit');
    },
    load(b) { cur = b; past = []; future = []; emit('load'); },
    undo() {
      const p = past.pop();
      if (!p) return false;
      future.push(cur); cur = p; emit('undo');
      return true;
    },
    redo() {
      const n = future.pop();
      if (!n) return false;
      past.push(cur); cur = n; emit('redo');
      return true;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}
