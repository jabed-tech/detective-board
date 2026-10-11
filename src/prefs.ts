import { FASTENERS, type Atmosphere, type EffectId, type FastenerId } from './model/types';

export interface Prefs {
  atmosphere: Atmosphere;
  sfx: boolean;
  volume: number;
  neatHand: boolean;
  defaultTension: number;
  lastBoardId?: string;
  lastExportAt: number;
  memoSnoozedAt: number;
  tiltNew: boolean;
  lastFastener: FastenerId;
  clipboardKeys: boolean;
  freeAnchors: boolean;
  muted: boolean;
  ambience: boolean;
  ambienceVolume: number;
  musicId?: string;
  musicName?: string;
  musicOn: boolean;
  effects: Record<EffectId, boolean>;
  lastThickness: number;
}

export const EFFECT_IDS: EffectId[] = ['blinds', 'rain', 'grain', 'neon', 'dust', 'flicker'];

export const DEFAULT_PREFS: Prefs = {
  atmosphere: 'gentle', sfx: true, volume: 0.4, neatHand: false,
  defaultTension: 0.5, lastExportAt: 0, memoSnoozedAt: 0,
  tiltNew: true, lastFastener: 'pin',
  clipboardKeys: true, freeAnchors: false,
  muted: false, ambience: false, ambienceVolume: 0.2, musicOn: false, lastThickness: 1,
  effects: { blinds: true, rain: true, grain: true, neon: true, dust: true, flicker: true },
};

const KEY = 'detective-board:prefs';
type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function local(): KV | null {
  try { return window.localStorage; } catch { return null; }
}

const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

export function loadPrefs(store: KV | null = local()): Prefs {
  let raw: Record<string, unknown> = {};
  try {
    const s = store?.getItem(KEY);
    if (s) { const v = JSON.parse(s); if (v && typeof v === 'object') raw = v; }
  } catch { /* corrupt or blocked: use defaults */ }
  const atm = raw.atmosphere;
  const p: Prefs = {
    atmosphere: atm === 'full' || atm === 'gentle' || atm === 'off' ? atm : DEFAULT_PREFS.atmosphere,
    sfx: typeof raw.sfx === 'boolean' ? raw.sfx : DEFAULT_PREFS.sfx,
    volume: num(raw.volume, 0, 1, DEFAULT_PREFS.volume),
    neatHand: typeof raw.neatHand === 'boolean' ? raw.neatHand : DEFAULT_PREFS.neatHand,
    defaultTension: num(raw.defaultTension, 0, 1, DEFAULT_PREFS.defaultTension),
    lastExportAt: num(raw.lastExportAt, 0, Number.MAX_SAFE_INTEGER, 0),
    memoSnoozedAt: num(raw.memoSnoozedAt, 0, Number.MAX_SAFE_INTEGER, 0),
    tiltNew: typeof raw.tiltNew === 'boolean' ? raw.tiltNew : DEFAULT_PREFS.tiltNew,
    lastFastener: FASTENERS.find(f => f.id === raw.lastFastener)?.id ?? DEFAULT_PREFS.lastFastener,
    clipboardKeys: typeof raw.clipboardKeys === 'boolean' ? raw.clipboardKeys : DEFAULT_PREFS.clipboardKeys,
    freeAnchors: typeof raw.freeAnchors === 'boolean' ? raw.freeAnchors : DEFAULT_PREFS.freeAnchors,
    // Phase-1 stored only `sfx`; a user who had it off should see the mute button as muted, not as unmuted-but-silent.
    muted: typeof raw.muted === 'boolean' ? raw.muted : raw.sfx === false ? true : DEFAULT_PREFS.muted,
    ambience: typeof raw.ambience === 'boolean' ? raw.ambience : DEFAULT_PREFS.ambience,
    ambienceVolume: num(raw.ambienceVolume, 0, 1, DEFAULT_PREFS.ambienceVolume),
    musicOn: typeof raw.musicOn === 'boolean' ? raw.musicOn : DEFAULT_PREFS.musicOn,
    lastThickness: num(raw.lastThickness, 0.5, 3, DEFAULT_PREFS.lastThickness),
    effects: { ...DEFAULT_PREFS.effects },
  };
  if (raw.effects && typeof raw.effects === 'object') {
    const e = raw.effects as Record<string, unknown>;
    for (const id of EFFECT_IDS) if (typeof e[id] === 'boolean') p.effects[id] = e[id] as boolean;
  }
  if (typeof raw.musicId === 'string' && raw.musicId.length <= 100) p.musicId = raw.musicId;
  if (typeof raw.musicName === 'string') p.musicName = raw.musicName.slice(0, 80);
  if (typeof raw.lastBoardId === 'string') p.lastBoardId = raw.lastBoardId;
  return p;
}

export function savePrefs(p: Prefs, store: KV | null = local()): void {
  try { store?.setItem(KEY, JSON.stringify(p)); } catch { /* quota/blocked: prefs are non-critical */ }
}

export function clearPrefs(store: KV | null = local()): void {
  try { store?.removeItem(KEY); } catch { /* ignore */ }
}
