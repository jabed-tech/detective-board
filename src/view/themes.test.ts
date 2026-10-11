// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
// @ts-expect-error node types are not installed (tsconfig types: vite/client); vitest runs in node
import { readFileSync } from 'node:fs';
import { THEMES, TOKEN_VARS, applyTheme, contrast, type FrameTokens } from './themes';
import { MOODS, type MoodId } from '../model/types';

// vitest blanks `?raw` CSS imports, so read the file directly (cwd is the repo root under vitest).
const baseCss = readFileSync('src/styles/base.css', 'utf8') as string;
const hexes = (s: string): string[] => s.match(/#[0-9a-f]{6}\b/gi) ?? [];
const MOOD_IDS = Object.keys(MOODS) as MoodId[];

describe('frame themes', () => {
  it('has a theme for every mood', () => expect(Object.keys(THEMES).sort()).toEqual([...MOOD_IDS].sort()));
  it.each(MOOD_IDS)('%s: every text pair is at least 4.5:1', id => {
    const t = THEMES[id];
    const pairs: [keyof FrameTokens, keyof FrameTokens][] = [
      ['tabInk', 'tabBg'], ['tabInk', 'tabCurrentBg'], ['tabClosedInk', 'tabClosedBg'], ['tabNewInk', 'tabbarBg'],
      ['ink', 'paper'], ['ink', 'btnBg'], ['ink', 'btnHover'],
    ];
    for (const [fg, bg] of pairs) expect(contrast(t[fg], t[bg]), `${id} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    for (const stop of hexes(t.deskBg)) expect(contrast(t.chromeText, stop), `${id} chromeText on desk ${stop}`).toBeGreaterThanOrEqual(4.5);
  });
  it('base.css fallbacks equal the Noir theme (first paint never flashes another frame)', () => {
    for (const [k, v] of Object.entries(TOKEN_VARS) as [keyof FrameTokens, string][]) {
      const m = new RegExp(`${v}:\\s*([^;]+);`).exec(baseCss);
      expect(m?.[1].trim(), v).toBe(THEMES['noir-office'][k]);
    }
  });
  it('applyTheme writes every token and data-mood', () => {
    const el = document.createElement('div');
    applyTheme(el, 'precinct');
    expect(el.dataset.mood).toBe('precinct');
    for (const [k, v] of Object.entries(TOKEN_VARS) as [keyof FrameTokens, string][]) expect(el.style.getPropertyValue(v)).toBe(THEMES.precinct[k]);
  });
  it('contrast is symmetric and black/white is 21', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });
});
