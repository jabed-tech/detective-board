// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMusic } from './music';

function fakeAudio() {
  const a = new EventTarget() as EventTarget & {
    src: string; loop: boolean; volume: number; paused: boolean;
    play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn>;
  };
  a.src = ''; a.loop = false; a.volume = 1; a.paused = true;
  // Like a real browser: paused flips false at once; a rejection flips it back later.
  a.play = vi.fn(() => { a.paused = false; return Promise.resolve(); });
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
  it('retries play() on a later unlock() after a rejected first attempt', async () => {
    const { a, m } = mk();
    const p = m.load(blob); a.dispatchEvent(new Event('loadedmetadata')); await p;
    a.play.mockImplementationOnce(() => {
      a.paused = false;
      return Promise.resolve().then(() => { a.paused = true; throw new Error('NotAllowed'); });
    });
    m.setOn(true); m.unlock();
    expect(m.settled()).toBe(false); // play() pending: paused is already false, not yet confirmed
    await new Promise<void>(r => queueMicrotask(r)); await Promise.resolve();
    expect(m.settled()).toBe(false); // rejected
    m.unlock();
    expect(a.play).toHaveBeenCalledTimes(2);
    expect(m.settled()).toBe(false); // second attempt not yet resolved
    await Promise.resolve(); await Promise.resolve();
    expect(m.settled()).toBe(true);
  });
  it('is not settled after an external pause', async () => {
    const { a, m } = mk();
    const p = m.load(blob); a.dispatchEvent(new Event('loadedmetadata')); await p;
    m.setOn(true); m.unlock();
    await Promise.resolve(); await Promise.resolve();
    expect(m.settled()).toBe(true);
    a.paused = true; // e.g. audio focus lost, headset unplugged
    expect(m.settled()).toBe(false);
  });
  it('a retry after an external pause is not settled until its own play() resolves', async () => {
    const { a, m } = mk();
    const p = m.load(blob); a.dispatchEvent(new Event('loadedmetadata')); await p;
    m.setOn(true); m.unlock();
    await Promise.resolve(); await Promise.resolve();
    expect(m.settled()).toBe(true);
    a.paused = true; a.dispatchEvent(new Event('pause')); // external pause
    expect(m.settled()).toBe(false);
    let resolvePlay!: () => void;
    a.play.mockImplementationOnce(() => { a.paused = false; return new Promise<void>(r => { resolvePlay = r; }); });
    m.unlock();
    expect(a.play).toHaveBeenCalledTimes(2);
    expect(a.paused).toBe(false);
    expect(m.settled()).toBe(false); // retry pending
    await Promise.resolve(); await Promise.resolve();
    expect(m.settled()).toBe(false); // still pending
    resolvePlay();
    await Promise.resolve(); await Promise.resolve();
    expect(m.settled()).toBe(true);
  });
  it('a pause event clears confirmation even if paused was polled true later', async () => {
    const { a, m } = mk();
    const p = m.load(blob); a.dispatchEvent(new Event('loadedmetadata')); await p;
    m.setOn(true); m.unlock();
    await Promise.resolve(); await Promise.resolve();
    a.paused = true; a.dispatchEvent(new Event('pause'));
    a.paused = false; // element resumed without our play() (e.g. media keys)
    expect(m.settled()).toBe(false);
  });
  it('ignores a stale play() resolving after a newer load', async () => {
    const { a, m } = mk();
    const p1 = m.load(blob);
    let resolveOld!: () => void;
    a.play.mockImplementationOnce(() => { a.paused = false; return new Promise<void>(r => { resolveOld = r; }); });
    a.dispatchEvent(new Event('loadedmetadata')); await p1;
    m.setOn(true); m.unlock();
    expect(a.play).toHaveBeenCalledTimes(1);
    const p2 = m.load(blob); // pauses, new generation
    a.play.mockImplementationOnce(() => { a.paused = false; return new Promise<void>(() => { /* pending */ }); });
    a.dispatchEvent(new Event('loadedmetadata')); await p2;
    expect(a.play).toHaveBeenCalledTimes(2);
    resolveOld();
    await Promise.resolve(); await Promise.resolve();
    expect(m.settled()).toBe(false); // old attempt must not confirm the new one
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
