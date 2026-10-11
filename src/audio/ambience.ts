import type { AmbienceId, MoodId } from '../model/types';
import { chordNotes, layersFor, nextSirenDelay, progression, rng, walkingBass } from './jazz';
import type { Chord } from './jazz';
import { CLIPS, MUFFLE, nextIncidentDelay, pickClip } from './incidents';

export interface Ambience {
  unlock(): void; settled(): boolean; setMood(id: MoodId): void; setEnabled(on: boolean): void;
  setVolume(v: number): void; setMuted(m: boolean): void; setMusicPlaying(on: boolean): void;
}

interface Layer { gain: GainNode; stop(): void; retire(): void }
interface Env {
  c: AudioContext; out: GainNode; noise: AudioBuffer; mood: MoodId;
  later: (fn: () => void, ms: number) => void; every: (fn: () => void, ms: number) => void;
  alive: () => boolean;                                   // false once this layer is stopped, retired (fading out) or silent
  clip: (file: string) => Promise<AudioBuffer | null>;    // cached fetch+decode; null on any failure
}
type Builder = (e: Env) => () => void;   // returns a teardown for sources/timers it started

const FADE = 1.5;
const mtof = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
const between = (a: number, b: number): number => a + Math.random() * (b - a);

function filter(c: AudioContext, type: BiquadFilterType, freq: number, q?: number): BiquadFilterNode {
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  if (q !== undefined) f.Q.value = q;
  return f;
}
/** One-shot burst of noise through `chain`, shaped by a short gain envelope into `out`. */
function burst(e: Env, when: number, dur: number, peak: number, through: AudioNode[], out: AudioNode = e.out): void {
  const { c } = e;
  const s = c.createBufferSource(); s.buffer = e.noise;
  const g = c.createGain();
  g.gain.setValueAtTime(peak, when);
  g.gain.linearRampToValueAtTime(0, when + dur);
  let n: AudioNode = s;
  for (const f of through) { n.connect(f); n = f; }
  n.connect(g); g.connect(out);
  s.start(when, Math.random() * 1.5, dur + 0.01);
}

const jazz: Builder = e => {
  const { c } = e;
  const beat = 60 / 76;
  const rand = rng(Math.floor(Math.random() * 1e9));
  let seed = Math.floor(Math.random() * 1e9);
  let prog: Chord[] = progression(seed, 8);
  let bar = 0;
  let beatNo = 0;
  let t = c.currentTime + 0.1;
  let bass: number[] = walkingBass(prog[0], prog[1], rand);
  const live = new Set<OscillatorNode>();

  const note = (freq: number, when: number, dur: number, peak: number, type: OscillatorType, through: AudioNode[]): void => {
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.01);
    g.gain.linearRampToValueAtTime(0, when + dur);
    let n: AudioNode = o;
    for (const f of through) { n.connect(f); n = f; }
    n.connect(g); g.connect(e.out);
    o.start(when); o.stop(when + dur + 0.05);
    live.add(o); o.onended = () => live.delete(o);
  };
  const epiano = (freq: number, when: number): void => {
    const car = c.createOscillator(), car2 = c.createOscillator(), mod = c.createOscillator();
    car.type = 'sine'; car2.type = 'sine'; mod.type = 'sine';
    car.frequency.value = freq; car2.frequency.value = freq * 2; mod.frequency.value = freq;
    const idx = c.createGain(); idx.gain.value = 0.3 * freq;
    mod.connect(idx); idx.connect(car.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.045, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.5);
    const g2 = c.createGain(); g2.gain.value = 0.35;
    car.connect(g); car2.connect(g2); g2.connect(g); g.connect(e.out);
    for (const o of [car, car2, mod]) { o.start(when); o.stop(when + 1.55); live.add(o); o.onended = () => live.delete(o); }
  };
  const chord = (when: number): void => { for (const n of chordNotes(prog[bar])) epiano(mtof(n), when); };

  const tick = (): void => {
    while (t < c.currentTime + 0.3) {
      if (beatNo === 0) chord(t);
      if (beatNo === 1) chord(t + beat * (2 / 3));           // the "and" of 2, swing 2:1
      note(mtof(bass[beatNo]), t, beat * 0.9, 0.22, 'triangle', [filter(c, 'lowpass', 600)]);
      if (beatNo === 1 || beatNo === 3) burst(e, t, 0.18, 0.05, [filter(c, 'bandpass', 2500, 0.7)]);
      t += beat;
      beatNo++;
      if (beatNo === 4) {
        beatNo = 0; bar++;
        if (bar === prog.length) { bar = 0; seed++; prog = progression(seed, 8); }
        bass = walkingBass(prog[bar], prog[(bar + 1) % prog.length], rand);
      }
    }
  };
  tick();
  e.every(tick, 100);
  return () => { for (const o of live) { try { o.stop(); } catch { /* ended */ } } live.clear(); };
};

const sirens: Builder = e => {
  const { c } = e;
  const live = new Set<OscillatorNode>();
  const wail = (): void => {
    const t = c.currentTime, dur = 7;
    const o = c.createOscillator(); o.type = 'sine';
    if (Math.random() < 0.5) {
      for (let i = 0; i < dur * 2; i++) o.frequency.setValueAtTime(i % 2 ? 850 : 650, t + i * 0.5);
    } else {
      o.frequency.setValueAtTime(500, t);
      o.frequency.linearRampToValueAtTime(900, t + dur / 2);
      o.frequency.linearRampToValueAtTime(500, t + dur);
    }
    const lp = filter(c, 'lowpass', 900);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 2);
    g.gain.setValueAtTime(0.06, t + dur - 2);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp); lp.connect(g); g.connect(e.out);
    o.start(t); o.stop(t + dur + 0.05);
    live.add(o); o.onended = () => live.delete(o);
  };
  const arm = (): void => e.later(() => { wail(); arm(); }, nextSirenDelay(Math.random));
  arm();
  return () => { for (const o of live) { try { o.stop(); } catch { /* ended */ } } live.clear(); };
};

const hum: Builder = e => {
  const { c } = e;
  const bus = c.createGain(); bus.gain.value = 1; bus.connect(e.out);
  const oscs: OscillatorNode[] = [];
  for (const [f, v] of [[50, 0.028], [100, 0.014], [150, 0.007]] as const) {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = c.createGain(); g.gain.value = v;
    o.connect(g); g.connect(bus); o.start(); oscs.push(o);
  }
  const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.1;
  const depth = c.createGain(); depth.gain.value = 0.15;
  lfo.connect(depth); depth.connect(bus.gain); lfo.start(); oscs.push(lfo);
  return () => { for (const o of oscs) { try { o.stop(); } catch { /* ended */ } } };
};

const buzz: Builder = e => {
  const { c } = e;
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
  const bp = filter(c, 'bandpass', 1200, 4);
  const g = c.createGain(); g.gain.value = 0.02;
  o.connect(bp); bp.connect(g); g.connect(e.out); o.start();
  const crackle = (): void => {
    burst(e, c.currentTime, 0.04, 0.05, [filter(c, 'bandpass', 1200, 4)]);
    e.later(crackle, between(3000, 9000));
  };
  e.later(crackle, between(3000, 9000));
  return () => { try { o.stop(); } catch { /* ended */ } };
};

const tick: Builder = e => {
  const { c } = e;
  let tock = false;
  e.every(() => {
    burst(e, c.currentTime, 0.004, tock ? 0.06 : 0.08, [filter(c, 'highpass', 3000)]);
    tock = !tock;
  }, 1000);
  return () => {};
};

/** Rare recorded phone calls / voices, one at a time, muffled as if through a wall. */
const incidents: Builder = e => {
  const { c } = e;
  let last: string | null = null;
  let playing: AudioBufferSourceNode | null = null;
  let first = true;
  const bad = new Set<string>();
  const arm = (): void => { e.later(fire, nextIncidentDelay(e.mood, Math.random, first)); first = false; };
  const fire = (): void => {
    const clip = !e.alive() || playing ? null : pickClip(CLIPS.filter(k => !bad.has(k.id)), e.mood, last, Math.random);
    if (!clip) { arm(); return; }
    void e.clip(clip.file).then(buf => {
      if (!e.alive()) return;
      if (!buf) { bad.add(clip.id); arm(); return; }
      last = clip.id;
      const s = c.createBufferSource(); s.buffer = buf;
      const [lo, hi] = MUFFLE[e.mood];
      const lp = filter(c, 'lowpass', between(lo, hi));
      const g = c.createGain(); g.gain.value = 0.35;
      const d = c.createDelay(0.5); d.delayTime.value = 0.07;
      const dg = c.createGain(); dg.gain.value = 0.25;
      s.connect(lp); lp.connect(g); lp.connect(d); d.connect(dg); dg.connect(g);
      const pan = typeof c.createStereoPanner === 'function' ? c.createStereoPanner() : null;
      if (pan) { pan.pan.value = between(-0.6, 0.6); g.connect(pan); pan.connect(e.out); } else g.connect(e.out);
      playing = s;
      s.onended = () => { if (playing === s) { playing = null; if (e.alive()) arm(); } };
      s.start();
    });
  };
  arm();
  return () => { const p = playing; playing = null; if (p) { try { p.stop(); } catch { /* ended */ } } };
};

const BUILDERS: Record<AmbienceId, Builder> = { jazz, sirens, hum, buzz, tick, incidents };

export function createAmbience(makeCtx: () => AudioContext = () => new AudioContext()): Ambience {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let enabled = false, muted = false, volume = 0.2, musicPlaying = false;
  let unlocked = false;
  let mood: MoodId | null = null;
  const layers = new Map<AmbienceId, Layer>();
  const clipCache = new Map<string, Promise<AudioBuffer | null>>();
  function loadClip(file: string): Promise<AudioBuffer | null> {
    let p = clipCache.get(file);
    if (!p) {
      const c = ctx!;
      p = fetch(`${import.meta.env.BASE_URL}audio/incidents/${file}`)
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then(b => c.decodeAudioData(b))
        .catch(() => null);
      clipCache.set(file, p);   // failures stay cached as null: never re-fetched this session
    }
    return p;
  }

  const target = (): number => (muted || !enabled ? 0 : volume);
  const audible = (): boolean => enabled && !muted && volume > 0 && !(typeof document !== 'undefined' && document.hidden);

  function applyMaster(): void {
    if (ctx && master) master.gain.setTargetAtTime(target(), ctx.currentTime, 0.1);
  }
  function onVisibility(): void { applyLayers(); applyRunState(); }
  function applyRunState(): void {
    if (!ctx) return;
    if (audible()) { if (ctx.state !== 'running') void ctx.resume().catch(() => {}); }
    else if (typeof document !== 'undefined' && document.hidden) void ctx.suspend().catch(() => {});
    else setTimeout(() => { if (ctx && !audible()) void ctx.suspend().catch(() => {}); }, 400);
  }

  function startLayer(id: AmbienceId): void {
    const c = ctx!;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(1, c.currentTime + FADE);
    gain.connect(master!);
    const timers = new Set<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>();
    let dead = false, retired = false;
    const env: Env = {
      c, out: gain, noise: noise!, mood: mood!,
      alive: () => !dead && !retired && audible(),
      clip: loadClip,
      later(fn, ms) { const h = setTimeout(() => { timers.delete(h); if (!dead && audible()) fn(); }, ms); timers.add(h); },
      every(fn, ms) { timers.add(setInterval(() => { if (!dead && audible()) fn(); }, ms)); },
    };
    const teardown = BUILDERS[id](env);
    layers.set(id, {
      gain,
      retire() { retired = true; },
      stop() {
        dead = true;
        for (const h of timers) { clearTimeout(h as ReturnType<typeof setTimeout>); clearInterval(h as ReturnType<typeof setInterval>); }
        timers.clear();
        teardown();
        try { gain.disconnect(); } catch { /* ignore */ }
      },
    });
  }
  function fadeOut(id: AmbienceId): void {
    const l = layers.get(id); if (!l || !ctx) return;
    layers.delete(id);
    l.retire();   // a clip whose fetch resolves during the fade must not start on this layer
    const t = ctx.currentTime;
    l.gain.gain.cancelScheduledValues?.(t);
    l.gain.gain.setValueAtTime(l.gain.gain.value, t);
    l.gain.gain.linearRampToValueAtTime(0, t + FADE);
    setTimeout(() => l.stop(), (FADE + 0.1) * 1000);
  }
  function applyLayers(): void {
    if (!ctx) return;
    if (!audible()) {
      // Silent: stop scheduling at once (callbacks check audible()), tear down after the master fade.
      for (const [id, l] of [...layers]) { layers.delete(id); l.retire(); setTimeout(() => l.stop(), 400); }
      return;
    }
    const want = new Set<AmbienceId>(mood ? layersFor(mood, musicPlaying) : []);
    for (const id of [...layers.keys()]) if (!want.has(id)) fadeOut(id);
    for (const id of want) if (!layers.has(id)) startLayer(id);
  }

  function create(): void {
    if (ctx) return;
    try { ctx = makeCtx(); } catch { ctx = null; return; }
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    applyMaster();
    applyLayers();
    applyRunState();
  }

  return {
    // Idempotent, but every call after the first retries a rejected resume().
    unlock() { unlocked = true; if (ctx) { applyLayers(); applyRunState(); } else create(); },
    // True once nothing more is needed from further gestures (running, or silent on purpose).
    settled() { return !!ctx && (ctx.state === 'running' || !audible()); },
    setMood(id) { if (id !== mood) fadeOut('incidents'); mood = id; applyLayers(); },
    setEnabled(on) { enabled = on; applyMaster(); applyLayers(); applyRunState(); },
    setVolume(v) { volume = v; applyMaster(); applyLayers(); applyRunState(); },
    setMuted(m) { muted = m; applyMaster(); applyLayers(); applyRunState(); },
    setMusicPlaying(on) { musicPlaying = on; applyLayers(); },
  };
}
