import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAmbience } from './ambience';
import { CLIPS } from './incidents';
import { FIRST_MIN, INCIDENT_GAP } from './incidents';

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
const CLIP_BUF = { fake: 'clip' };
function fakeCtx() {
  const gains: ReturnType<typeof param>[] = [];
  const sources: ReturnType<typeof node>[] = [];
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: {}, state: 'running',
    suspend: vi.fn(async () => {}), resume: vi.fn(async () => {}),
    createGain: vi.fn(() => { const g = param(); gains.push(g); return node({ gain: g }); }),
    createOscillator: vi.fn(() => node({ frequency: param(), type: 'sine' })),
    createBiquadFilter: vi.fn(() => node({ frequency: param(), Q: param(), type: 'lowpass' })),
    createBufferSource: vi.fn(() => { const n = node({ playbackRate: param(), buffer: null, loop: false, onended: null }); sources.push(n); return n; }),
    createDelay: vi.fn(() => node({ delayTime: param() })),
    createStereoPanner: vi.fn(() => node({ pan: param() })),
    decodeAudioData: vi.fn(async () => CLIP_BUF),
    createBuffer: vi.fn((_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) })),
  };
  return { ctx, gains, sources };
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
  it('retries a rejected resume on later unlock() calls and reports settled once running', () => {
    const f = fakeCtx(); (f.ctx as { state: string }).state = 'suspended';
    const a = createAmbience(() => f.ctx as unknown as AudioContext);
    a.setEnabled(true); a.setMood('archive');
    a.unlock();
    const first = f.ctx.resume.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    expect(a.settled()).toBe(false);
    a.unlock();
    expect(f.ctx.resume.mock.calls.length).toBeGreaterThan(first);
    (f.ctx as { state: string }).state = 'running';
    expect(a.settled()).toBe(true);
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
  it('muting stops scheduling new nodes', () => {
    const f = fakeCtx(); const a = createAmbience(() => f.ctx as unknown as AudioContext);
    a.setEnabled(true); a.setMood('noir-office'); a.unlock();
    vi.advanceTimersByTime(500);
    a.setMuted(true);
    vi.advanceTimersByTime(1000);
    const n = f.ctx.createBufferSource.mock.calls.length + f.ctx.createOscillator.mock.calls.length;
    vi.advanceTimersByTime(10000);
    expect(f.ctx.createBufferSource.mock.calls.length + f.ctx.createOscillator.mock.calls.length).toBe(n);
    expect(f.ctx.suspend).toHaveBeenCalled();
    a.setMuted(false);
    expect(f.ctx.createOscillator.mock.calls.length).toBeGreaterThan(0);
  });
  it('a hidden document stops scheduling new nodes', () => {
    const f = fakeCtx(); const a = createAmbience(() => f.ctx as unknown as AudioContext);
    const listeners: Array<() => void> = [];
    let hidden = false;
    vi.stubGlobal('document', { get hidden() { return hidden; }, addEventListener: (_: string, fn: () => void) => listeners.push(fn) });
    try {
      a.setEnabled(true); a.setMood('noir-office'); a.unlock();
      vi.advanceTimersByTime(500);
      hidden = true; listeners.forEach(l => l());
      vi.advanceTimersByTime(1000);
      const n = f.ctx.createBufferSource.mock.calls.length + f.ctx.createOscillator.mock.calls.length;
      vi.advanceTimersByTime(10000);
      expect(f.ctx.createBufferSource.mock.calls.length + f.ctx.createOscillator.mock.calls.length).toBe(n);
      expect(f.ctx.suspend).toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  describe('incidents', () => {
    const clipSources = (f: ReturnType<typeof fakeCtx>) => f.sources.filter(n => (n as { buffer?: unknown }).buffer === CLIP_BUF);
    const okFetch = () => vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
    beforeEach(() => {
      CLIPS.push(
        { id: 'p1', file: 'p1.mp3', kind: 'ring', moods: ['precinct'] },
        { id: 'a1', file: 'a1.mp3', kind: 'talk', moods: ['archive'] },
      );
    });
    afterEach(() => { CLIPS.length = 0; vi.unstubAllGlobals(); });

    it('nothing before unlock, then one clip after the first gap', async () => {
      const fetchMock = okFetch(); vi.stubGlobal('fetch', fetchMock);
      const f = fakeCtx(); const a = createAmbience(() => f.ctx as unknown as AudioContext);
      a.setEnabled(true); a.setMood('precinct');
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(fetchMock).not.toHaveBeenCalled();
      a.unlock();
      await vi.advanceTimersByTimeAsync(INCIDENT_GAP.precinct[0]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(clipSources(f)).toHaveLength(1);
      expect(clipSources(f)[0].start).toHaveBeenCalledTimes(1);
      expect(FIRST_MIN).toBeLessThan(INCIDENT_GAP.precinct[0]);
    });
    it('a failed fetch is skipped silently and never fetched again', async () => {
      CLIPS.length = 0; CLIPS.push({ id: 'bad', file: 'bad.mp3', kind: 'ring', moods: ['precinct'] });
      const fetchMock = vi.fn(async () => ({ ok: false, status: 404 })); vi.stubGlobal('fetch', fetchMock);
      const f = fakeCtx(); const a = createAmbience(() => f.ctx as unknown as AudioContext);
      a.setEnabled(true); a.setMood('precinct'); a.unlock();
      await vi.advanceTimersByTimeAsync(3 * INCIDENT_GAP.precinct[1]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(clipSources(f)).toHaveLength(0);
    });
    it('a mood change restarts with the new pool and the old timer does not fire', async () => {
      const fetchMock = okFetch(); vi.stubGlobal('fetch', fetchMock);
      const f = fakeCtx(); const a = createAmbience(() => f.ctx as unknown as AudioContext);
      a.setEnabled(true); a.setMood('precinct'); a.unlock();
      await vi.advanceTimersByTimeAsync(5_000);
      a.setMood('archive');
      await vi.advanceTimersByTimeAsync(INCIDENT_GAP.precinct[1]);
      const files = (fetchMock.mock.calls as unknown as string[][]).map(c => c[0]);
      expect(files.some(u => u.includes('p1.mp3'))).toBe(false);
      await vi.advanceTimersByTimeAsync(INCIDENT_GAP.archive[1]);
      expect((fetchMock.mock.calls as unknown as string[][]).every(c => c[0].includes('a1.mp3'))).toBe(true);
      expect(fetchMock).toHaveBeenCalled();
    });
    it('a clip whose fetch resolves while its layer fades out never starts', async () => {
      let release: () => void = () => {};
      const gate = new Promise<void>(r => { release = r; });
      const fetchMock = vi.fn(async () => { await gate; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; });
      vi.stubGlobal('fetch', fetchMock);
      const f = fakeCtx(); const a = createAmbience(() => f.ctx as unknown as AudioContext);
      a.setEnabled(true); a.setMood('precinct'); a.unlock();
      await vi.advanceTimersByTimeAsync(INCIDENT_GAP.precinct[0]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      a.setMood('archive');            // old layer is fading out, its fetch is still pending
      release();
      await vi.advanceTimersByTimeAsync(300);
      expect(clipSources(f)).toHaveLength(0);
    });
    it('muting stops the playing clip and no new one is scheduled', async () => {
      vi.stubGlobal('fetch', okFetch());
      const f = fakeCtx(); const a = createAmbience(() => f.ctx as unknown as AudioContext);
      a.setEnabled(true); a.setMood('precinct'); a.unlock();
      await vi.advanceTimersByTimeAsync(INCIDENT_GAP.precinct[0]);
      const [src] = clipSources(f);
      expect(src.start).toHaveBeenCalledTimes(1);
      a.setMuted(true);
      await vi.advanceTimersByTimeAsync(1000);
      expect(src.stop).toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(20 * 60_000);
      expect(clipSources(f)).toHaveLength(1);
    });
    it('never two at once', async () => {
      vi.stubGlobal('fetch', okFetch());
      const f = fakeCtx(); const a = createAmbience(() => f.ctx as unknown as AudioContext);
      a.setEnabled(true); a.setMood('precinct'); a.unlock();
      await vi.advanceTimersByTimeAsync(INCIDENT_GAP.precinct[0]);
      expect(clipSources(f)).toHaveLength(1);   // onended never fires: it is still "playing"
      await vi.advanceTimersByTimeAsync(20 * 60_000);
      expect(clipSources(f)).toHaveLength(1);
    });
  });
});
