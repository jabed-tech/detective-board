import type { Atmosphere } from './model/types';

export interface Prefs {
  atmosphere: Atmosphere;
  sfx: boolean;
  volume: number;
  neatHand: boolean;
  defaultTension: number;
  lastBoardId?: string;
  lastExportAt: number;
  memoSnoozedAt: number;
}

export const DEFAULT_PREFS: Prefs = {
  atmosphere: 'gentle', sfx: true, volume: 0.4, neatHand: false,
  defaultTension: 0.5, lastExportAt: 0, memoSnoozedAt: 0,
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
  };
  if (typeof raw.lastBoardId === 'string') p.lastBoardId = raw.lastBoardId;
  return p;
}

export function savePrefs(p: Prefs, store: KV | null = local()): void {
  try { store?.setItem(KEY, JSON.stringify(p)); } catch { /* quota/blocked: prefs are non-critical */ }
}

export function clearPrefs(store: KV | null = local()): void {
  try { store?.removeItem(KEY); } catch { /* ignore */ }
}
