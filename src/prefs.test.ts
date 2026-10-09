import { describe, it, expect } from 'vitest';
import { loadPrefs, savePrefs, DEFAULT_PREFS } from './prefs';

function fakeStorage(initial?: string) {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set('detective-board:prefs', initial);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe('prefs', () => {
  it('returns defaults when nothing stored', () => {
    expect(loadPrefs(fakeStorage())).toEqual(DEFAULT_PREFS);
  });
  it('returns defaults on corrupt JSON', () => {
    expect(loadPrefs(fakeStorage('{nope'))).toEqual(DEFAULT_PREFS);
  });
  it('merges partial and rejects invalid values', () => {
    const p = loadPrefs(fakeStorage(JSON.stringify({ sfx: false, atmosphere: 'disco', volume: 9 })));
    expect(p.sfx).toBe(false);
    expect(p.atmosphere).toBe('gentle');
    expect(p.volume).toBe(1);
  });
  it('defaults and validates tiltNew / lastFastener', () => {
    expect(DEFAULT_PREFS.tiltNew).toBe(true);
    expect(DEFAULT_PREFS.lastFastener).toBe('pin');
    const p = loadPrefs(fakeStorage(JSON.stringify({ tiltNew: 'yes', lastFastener: 'glue' })));
    expect(p.tiltNew).toBe(true);
    expect(p.lastFastener).toBe('pin');
    const q = loadPrefs(fakeStorage(JSON.stringify({ tiltNew: false, lastFastener: 'clip' })));
    expect(q.tiltNew).toBe(false);
    expect(q.lastFastener).toBe('clip');
  });
  it('defaults and validates clipboardKeys / freeAnchors', () => {
    expect(DEFAULT_PREFS.clipboardKeys).toBe(true);
    expect(DEFAULT_PREFS.freeAnchors).toBe(false);
    const p = loadPrefs(fakeStorage(JSON.stringify({ clipboardKeys: 'no', freeAnchors: 1 })));
    expect(p.clipboardKeys).toBe(true);
    expect(p.freeAnchors).toBe(false);
    const q = loadPrefs(fakeStorage(JSON.stringify({ clipboardKeys: false, freeAnchors: true })));
    expect(q.clipboardKeys).toBe(false);
    expect(q.freeAnchors).toBe(true);
  });
  it('round-trips', () => {
    const s = fakeStorage();
    savePrefs({ ...DEFAULT_PREFS, neatHand: true, lastBoardId: 'abc' }, s);
    expect(loadPrefs(s).neatHand).toBe(true);
    expect(loadPrefs(s).lastBoardId).toBe('abc');
  });
  it('works with no storage at all', () => {
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(() => savePrefs(DEFAULT_PREFS, null)).not.toThrow();
  });
});
