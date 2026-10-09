import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAutosave } from './autosave';
import { newBoard } from '../model/actions';

afterEach(() => { vi.useRealTimers(); });

describe('autosave', () => {
  it('debounces to one save with the latest board and stamps updatedAt', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const a = createAutosave(save, vi.fn(), 500);
    const b1 = newBoard('one', 1);
    const b2 = newBoard('two', 2);
    a.schedule(b1);
    a.schedule(b2);
    await vi.advanceTimersByTimeAsync(499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].id).toBe(b2.id);
    expect(save.mock.calls[0][0].updatedAt).toBeGreaterThan(0);
  });
  it('flush saves immediately and only once', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const a = createAutosave(save, vi.fn(), 500);
    a.schedule(newBoard('x', 1));
    await a.flush();
    await a.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('reports save errors instead of throwing', async () => {
    const err = new Error('QuotaExceededError');
    const onError = vi.fn();
    const a = createAutosave(vi.fn().mockRejectedValue(err), onError, 500);
    a.schedule(newBoard('x', 1));
    await expect(a.flush()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(err);
  });
});
