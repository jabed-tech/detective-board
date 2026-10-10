// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMusic } from './music';

function fakeAudio() {
  const a = new EventTarget() as EventTarget & {
    src: string; loop: boolean; volume: number; paused: boolean;
    play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn>;
  };
  a.src = ''; a.loop = false; a.volume = 1; a.paused = true;
  a.play = vi.fn(async () => { a.paused = false; });
  a.pause = vi.fn(() => { a.paused = true; });
  a.load = vi.fn();
  return a;
}
let n = 0;
let revoke: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers(); n = 0;
  revoke = vi.fn();
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = () => `blob:${++n}`;
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revoke;
});
afterEach(() => { vi.useRealTimers(); });
const mk = () => { const a = fakeAudio(); return { a, m: createMusic(() => a as unknown as HTMLAudioElement) }; };
const blob = new Blob(['x']);

describe('music', () => {
  it('load resolves true on loadedmetadata', async () => {
    const { a, m } = mk(); const p = m.load(blob); a.dispatchEvent(new Event('loadedmetadata')); expect(await p).toBe(true);
  });
  it('load resolves false on error', async () => {
    const { a, m } = mk(); const p = m.load(blob); a.dispatchEvent(new Event('error')); expect(await p).toBe(false);
  });
  it('load resolves false after 8 s', async () => {
    const { m } = mk(); const p = m.load(blob); vi.advanceTimersByTime(8000); expect(await p).toBe(false);
  });
  it('second load revokes the first url', async () => {
    const { a, m } = mk();
    const p1 = m.load(blob); a.dispatchEvent(new Event('loadedmetadata')); await p1;
    const p2 = m.load(blob); a.dispatchEvent(new Event('loadedmetadata')); await p2;
    expect(revoke).toHaveBeenCalledWith('blob:1');
  });
  it('respects the gesture and mute', async () => {
    const { a, m } = mk();
    const p = m.load(blob); a.dispatchEvent(new Event('loadedmetadata')); await p;
    m.setOn(true); expect(a.play).not.toHaveBeenCalled();
    m.unlock(); expect(a.play).toHaveBeenCalledTimes(1);
    expect(m.playing()).toBe(true);
    m.setMuted(true); expect(a.pause).toHaveBeenCalled(); expect(m.playing()).toBe(false);
    a.play.mockClear(); m.setOn(false); m.setOn(true); expect(a.play).not.toHaveBeenCalled();
  });
  it('clear pauses and revokes', async () => {
    const { a, m } = mk();
    const p = m.load(blob); a.dispatchEvent(new Event('loadedmetadata')); await p;
    m.unlock(); m.setOn(true);
    m.clear(); expect(a.pause).toHaveBeenCalled(); expect(revoke).toHaveBeenCalledWith('blob:1'); expect(m.playing()).toBe(false);
  });
  it('a stale load does not revoke or mark the newer load', async () => {
    const { a, m } = mk();
    const pA = m.load(blob);
    const pB = m.load(blob);
    vi.advanceTimersByTime(8000 - 1);
    a.dispatchEvent(new Event('loadedmetadata'));
    expect(await pB).toBe(true);
    expect(await pA).toBe(false);
    expect(revoke).not.toHaveBeenCalledWith('blob:2');
    m.setOn(true); m.unlock(); expect(a.play).toHaveBeenCalled();
  });
  it('a stale load timeout does not revoke the newer url', async () => {
    const { a, m } = mk();
    const pA = m.load(blob);
    vi.advanceTimersByTime(5000);
    const pB = m.load(blob);
    vi.advanceTimersByTime(3000); // A's timer elapses
    expect(await pA).toBe(false);
    expect(revoke).not.toHaveBeenCalledWith('blob:2');
    a.dispatchEvent(new Event('loadedmetadata'));
    expect(await pB).toBe(true);
  });
});
