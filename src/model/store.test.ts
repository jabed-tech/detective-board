import { describe, it, expect, vi } from 'vitest';
import { createStore } from './store';
import { newBoard } from './actions';

describe('store', () => {
  it('commits, undoes and redoes', () => {
    const b0 = newBoard('a', 1);
    const s = createStore(b0);
    const b1 = { ...b0, name: 'b' };
    s.commit(b1);
    expect(s.get()).toBe(b1);
    expect(s.undo()).toBe(true);
    expect(s.get()).toBe(b0);
    expect(s.redo()).toBe(true);
    expect(s.get()).toBe(b1);
    expect(s.redo()).toBe(false);
  });
  it('ignores committing the same reference', () => {
    const s = createStore(newBoard('a', 1));
    const fn = vi.fn();
    s.subscribe(fn);
    s.commit(s.get());
    expect(fn).not.toHaveBeenCalled();
    expect(s.canUndo()).toBe(false);
  });
  it('a new commit clears redo', () => {
    const b0 = newBoard('a', 1);
    const s = createStore(b0);
    s.commit({ ...b0, name: 'b' });
    s.undo();
    s.commit({ ...b0, name: 'c' });
    expect(s.canRedo()).toBe(false);
  });
  it('caps history', () => {
    const b0 = newBoard('a', 1);
    const s = createStore(b0, 3);
    for (let i = 0; i < 5; i++) s.commit({ ...b0, name: String(i) });
    let n = 0;
    while (s.undo()) n++;
    expect(n).toBe(3);
  });
  it('load resets history and reports reason', () => {
    const s = createStore(newBoard('a', 1));
    s.commit({ ...s.get(), name: 'x' });
    const fn = vi.fn();
    s.subscribe(fn);
    const other = newBoard('o', 2);
    s.load(other);
    expect(fn).toHaveBeenCalledWith(other, 'load');
    expect(s.canUndo()).toBe(false);
  });
  it('unsubscribes', () => {
    const s = createStore(newBoard('a', 1));
    const fn = vi.fn();
    const off = s.subscribe(fn);
    off();
    s.commit({ ...s.get(), name: 'z' });
    expect(fn).not.toHaveBeenCalled();
  });
});
