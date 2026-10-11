// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { createMood } from './mood';
const ALL = { blinds: true, rain: true, grain: true, neon: true, dust: true, flicker: true };

beforeAll(() => {
  window.matchMedia = (() => ({ matches: false, addEventListener() {} })) as unknown as typeof window.matchMedia;
  (globalThis as { matchMedia?: unknown }).matchMedia = window.matchMedia;
});

describe('createMood', () => {
  it('switches mood, effects and atmosphere', () => {
    const root = document.createElement('div');
    const m = createMood(root, 'full');
    m.setMood('motel');
    const q = (s: string) => root.querySelector<HTMLElement>(s)!;
    expect(root.dataset.mood).toBe('motel');
    expect(q('.fx-neon').hidden).toBe(false);
    expect(q('.fx-rain').hidden).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--sx')).toBe('-1.2');
    m.setEffects({ ...ALL, neon: false });
    expect(q('.fx-neon').hidden).toBe(true);
    m.setAtmosphere('off');
    expect(q('.fx-grain').dataset.anim).toBe('off');
  });
  it('setMood themes the frame on <html>', () => {
    const m = createMood(document.createElement('div'), 'gentle');
    expect(document.documentElement.dataset.mood).toBe('noir-office');
    m.setMood('motel');
    expect(document.documentElement.dataset.mood).toBe('motel');
    expect(document.documentElement.style.getPropertyValue('--tab-bg')).toBe('#f2b99a');
  });
});
