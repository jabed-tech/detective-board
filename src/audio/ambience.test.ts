import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAmbience } from './ambience';

function param() {
  const p = {
    value: 0, last: undefined as number | undefined,
    setValueAtTime: vi.fn((v: number) => { p.last = v; return p; }),
    linearRampToValueAtTime: vi.fn((v: number) => { p.last = v; return p; }),
    exponentialRampToValueAtTime: vi.fn((v: number) => { p.last = v; return p; }),
    setTargetAtTime: vi.fn((v: number) => { p.last = v; return p; }),
    cancelScheduledValues: vi.fn(() => p),
  };
  return p;
}
function node(extra: Record<string, unknown> = {}) {
  return { connect: vi.fn((n: unknown) => n), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), ...extra };
}
function fakeCtx() {
  const gains: ReturnType<typeof param>[] = [];
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: {}, state: 'running',
    suspend: vi.fn(async () => {}), resume: vi.fn(async () => {}),
    createGain: vi.fn(() => { const g = param(); gains.push(g); return node({ gain: g }); }),
    createOscillator: vi.fn(() => node({ frequency: param(), type: 'sine' })),
    createBiquadFilter: vi.fn(() => node({ frequency: param(), Q: param(), type: 'lowpass' })),
    createBufferSource: vi.fn(() => node({ playbackRate: param(), buffer: null, loop: false })),
    createBuffer: vi.fn((_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) })),
  };
  return { ctx, gains };
}

describe('ambience', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('creates no AudioContext before unlock()', () => {
    const f = fakeCtx(); const make = vi.fn(() => f.ctx as unknown as AudioContext);
    const a = createAmbience(make);
    a.setEnabled(true); a.setMood('archive');
    expect(make).toHaveBeenCalledTimes(0);
  });
  it('creates it once on unlock()', () => {
    const f = fakeCtx(); const make = vi.fn(() => f.ctx as unknown as AudioContext);
    const a = createAmbience(make);
    a.setEnabled(true); a.setMood('archive');
    a.unlock(); expect(make).toHaveBeenCalledTimes(1);
    a.unlock(); expect(make).toHaveBeenCalledTimes(1);
  });
  it('muting drives the master gain to 0', () => {
    const f = fakeCtx(); const make = vi.fn(() => f.ctx as unknown as AudioContext);
    const a = createAmbience(make);
    a.setEnabled(true); a.setVolume(0.5); a.setMood('noir-office'); a.unlock();
    const master = f.gains[0];
    expect(master.last).toBe(0.5);
    a.setMuted(true);
    expect(master.last).toBe(0);
    a.setMuted(false);
    expect(master.last).toBe(0.5);
  });
});
