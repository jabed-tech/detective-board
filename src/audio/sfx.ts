export interface Sfx { thunk(): void; pluck(): void; rustle(): void; setEnabled(on: boolean): void; setVolume(v: number): void }

export function createSfx(opts: { enabled: boolean; volume: number }): Sfx {
  let enabled = opts.enabled;
  let volume = opts.volume;
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let noise: AudioBuffer;

  function ac(): AudioContext | null {
    if (!enabled || volume <= 0) return null;
    if (!ctx) {
      try { ctx = new AudioContext(); } catch { return null; }
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }
  const vary = () => 1 + (Math.random() - 0.5) * 0.16;
  function env(c: AudioContext, peak: number, dur: number): GainNode {
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    return g;
  }
  function noiseSrc(c: AudioContext, dur: number, rate = 1): AudioBufferSourceNode {
    const s = c.createBufferSource();
    s.buffer = noise;
    s.playbackRate.value = rate;
    s.start(c.currentTime, Math.random() * 0.3, dur);
    return s;
  }

  return {
    thunk() {
      const c = ac(); if (!c) return;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500 * vary();
      noiseSrc(c, 0.08).connect(lp); lp.connect(env(c, 0.8, 0.08));
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(110 * vary(), c.currentTime);
      o.frequency.exponentialRampToValueAtTime(55, c.currentTime + 0.1);
      o.connect(env(c, 0.6, 0.12)); o.start(); o.stop(c.currentTime + 0.13);
    },
    pluck() {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(); o.type = 'triangle';
      const f = 220 * vary();
      o.frequency.setValueAtTime(f, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(f * 0.97, c.currentTime + 0.35);
      o.connect(env(c, 0.35, 0.35)); o.start(); o.stop(c.currentTime + 0.36);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      noiseSrc(c, 0.02).connect(hp); hp.connect(env(c, 0.15, 0.02));
    },
    rustle() {
      const c = ac(); if (!c) return;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3500 * vary(); bp.Q.value = 0.8;
      noiseSrc(c, 0.18, vary()).connect(bp); bp.connect(env(c, 0.25, 0.18));
    },
    setEnabled(on) { enabled = on; },
    setVolume(v) { volume = v; if (ctx) master.gain.value = v; },
  };
}
