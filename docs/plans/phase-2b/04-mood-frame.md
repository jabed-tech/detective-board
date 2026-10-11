# Task 4: Mood-themed frame — wave A (Sonnet)

Report to: `.superpowers/sdd/phase-2b/task-4-report.md`

**Files:**
- Create: `src/view/themes.ts`, `src/view/themes.test.ts`
- Modify: `src/view/mood.ts`, `src/view/mood.test.ts`, `src/styles/chrome.css`, `src/styles/base.css`

**Interfaces:**
- Consumes: `MoodId` from `src/model/types.ts`.
- Produces: `FrameTokens`, `THEMES`, `TOKEN_VARS`, `applyTheme(el, mood)`, `contrast(a, b)`. `mood.ts` calls `applyTheme(document.documentElement, id)` on create (Noir) and on every `setMood`.

**Goal:** the folder-tab bar, folder tabs, desk toolbar, drawer, menus, dialogs, buttons and the room around the board follow the case's mood. Colours live **only** in `THEMES` (TS). `base.css` keeps Noir fallbacks that a test proves equal to `THEMES['noir-office']`.

Things that stay the same:
- layout and sizes
- the desk-prop icons
- `--focus`
- danger buttons
- the CASE CLOSED badge plate (`#8f1d14` on `#f1e6c6`)

## Steps

- [ ] **Step 1: Failing tests `src/view/themes.test.ts`**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import baseCss from '../styles/base.css?raw';
import { THEMES, TOKEN_VARS, applyTheme, contrast, type FrameTokens } from './themes';
import { MOODS, type MoodId } from '../model/types';

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
```
Run: `npx vitest run src/view/themes.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 2: Create `src/view/themes.ts`**

The values below are pre-checked: every pair is ≥ 4.5:1. If you change a colour, the test is the judge.

```ts
import type { MoodId } from '../model/types';

/** Colours of the frame around the board (tabs, desk, panels, room). Static values only — written as CSS variables. */
export interface FrameTokens {
  roomBg: string; tabbarBg: string; tabbarEdge: string;
  tabBg: string; tabInk: string; tabCurrentBg: string; tabClosedBg: string; tabClosedInk: string; tabNewInk: string;
  deskBg: string; deskEdge: string; chromeText: string;
  paper: string; ink: string; rule: string; btnBg: string; btnBorder: string; btnHover: string; accent: string;
}

export const TOKEN_VARS: Record<keyof FrameTokens, string> = {
  roomBg: '--room-bg', tabbarBg: '--tabbar-bg', tabbarEdge: '--tabbar-edge',
  tabBg: '--tab-bg', tabInk: '--tab-ink', tabCurrentBg: '--tab-current-bg', tabClosedBg: '--tab-closed-bg',
  tabClosedInk: '--tab-closed-ink', tabNewInk: '--tab-new-ink',
  deskBg: '--desk-bg', deskEdge: '--desk-edge', chromeText: '--chrome-text',
  paper: '--paper', ink: '--ink', rule: '--rule', btnBg: '--btn-bg', btnBorder: '--btn-border', btnHover: '--btn-hover', accent: '--accent',
};

export const THEMES: Record<MoodId, FrameTokens> = {
  // Black lacquer desk with brass trim, dark manila tabs.
  'noir-office': {
    roomBg: 'radial-gradient(ellipse at 50% 30%, #1c1712, #070605 70%)', tabbarBg: '#0b0908', tabbarEdge: '#b8913f',
    tabBg: '#a8916a', tabInk: '#0e0b07', tabCurrentBg: '#c9b07a', tabClosedBg: '#5e5038', tabClosedInk: '#f1e6c6', tabNewInk: '#d9b46a',
    deskBg: 'linear-gradient(#2a2420, #141110 30%, #0c0a09)', deskEdge: '#b8913f', chromeText: '#f1e3c2',
    paper: '#f4ecd8', ink: '#1b1712', rule: '#c8b98f', btnBg: '#e9dcb6', btnBorder: '#8a7246', btnHover: '#f4e9c6', accent: '#b8913f',
  },
  // Grey steel desk, rubber edge, blue-grey hanging-file tabs, clipboard-white forms.
  precinct: {
    roomBg: 'radial-gradient(ellipse at 50% 30%, #2a333b, #0e1317 70%)', tabbarBg: '#1b2229', tabbarEdge: '#5d6c78',
    tabBg: '#8fa3b3', tabInk: '#0f171e', tabCurrentBg: '#c9d6e0', tabClosedBg: '#5d6c78', tabClosedInk: '#f2f5f7', tabNewInk: '#a9c3d6',
    deskBg: 'linear-gradient(#59636c, #3c444b 30%, #2b3137)', deskEdge: '#111417', chromeText: '#eef2f5',
    paper: '#f7f8f6', ink: '#1a2128', rule: '#c5ced6', btnBg: '#e3e8ec', btnBorder: '#7a8894', btnHover: '#eef2f5', accent: '#8fb3d9',
  },
  // Scarred plywood workbench, masking-tape labels.
  basement: {
    roomBg: 'radial-gradient(ellipse at 50% 30%, #2b2a28, #0d0d0c 70%)', tabbarBg: '#161514', tabbarEdge: '#6b5a44',
    tabBg: '#d9cfb4', tabInk: '#24201a', tabCurrentBg: '#efe7cf', tabClosedBg: '#9c937c', tabClosedInk: '#1c1914', tabNewInk: '#d9cfb4',
    deskBg: 'linear-gradient(#6e5840, #5a4632 30%, #3a2e22)', deskEdge: '#8c7458', chromeText: '#f3ead6',
    paper: '#f2efe6', ink: '#1f1c18', rule: '#cfc8b5', btnBg: '#e2dccb', btnBorder: '#8f8670', btnHover: '#f3efe2', accent: '#d9cfb4',
  },
  // 70s orange laminate, pastel tabs, pink neon accent, motel notepad.
  motel: {
    roomBg: 'radial-gradient(ellipse at 50% 30%, #2c1a26, #0d070b 70%)', tabbarBg: '#1d1219', tabbarEdge: '#ff6fb5',
    tabBg: '#f2b99a', tabInk: '#2a1610', tabCurrentBg: '#ffd9c2', tabClosedBg: '#9fd3c0', tabClosedInk: '#14261f', tabNewInk: '#ff9ccf',
    deskBg: 'linear-gradient(#8f4a1f, #74391a 30%, #5a2c12)', deskEdge: '#d98a4a', chromeText: '#fff1e3',
    paper: '#fff6e4', ink: '#2a1a12', rule: '#f2b6c8', btnBg: '#f7e2c8', btnBorder: '#c98a6a', btnHover: '#fff0dc', accent: '#ff6fb5',
  },
  // Olive filing-cabinet steel, manila tabs, yellowed paper.
  archive: {
    roomBg: 'radial-gradient(ellipse at 50% 30%, #252b1e, #0b0d08 70%)', tabbarBg: '#151a10', tabbarEdge: '#c9a86a',
    tabBg: '#b89a62', tabInk: '#2a1f12', tabCurrentBg: '#e2c88f', tabClosedBg: '#a8946d', tabClosedInk: '#2a1f10', tabNewInk: '#d6c38f',
    deskBg: 'linear-gradient(#56603f, #3d4530 30%, #2c3322)', deskEdge: '#6f7a52', chromeText: '#efe8cf',
    paper: '#efe3c2', ink: '#1f1a10', rule: '#c8b98f', btnBg: '#e4d3a6', btnBorder: '#8a7246', btnHover: '#efe1b8', accent: '#c9a86a',
  },
};

export function applyTheme(el: HTMLElement, mood: MoodId): void {
  const t = THEMES[mood] ?? THEMES['noir-office'];
  for (const k of Object.keys(TOKEN_VARS) as (keyof FrameTokens)[]) el.style.setProperty(TOKEN_VARS[k], t[k]);
  el.dataset.mood = mood;
}

const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255]
    .map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
};
/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
```
Run the test. Expected: everything passes except the `base.css` fallback test.

- [ ] **Step 3: `src/styles/base.css`**

In `:root`, replace `--ink`, `--paper` and `--chrome-text` with **all 19 tokens**. Copy the Noir values verbatim, one per line, in the form `--room-bg: radial-gradient(ellipse at 50% 30%, #1c1712, #070605 70%);`. Keep `--cork`, `--focus`, fonts and sizes.

Also change `html, body { … background: #120e0b; … }` to `background: var(--tabbar-bg);`.

Run the test. Expected: PASS.

- [ ] **Step 4: `src/styles/chrome.css` — colours → tokens**

Make exactly these replacements. Leave every other colour alone: desk-prop icons, danger, the tab-stamp plate, `--focus` uses, shadows and the `rgba` overlays.

| Rule | Property | New value |
|---|---|---|
| `.folder-tabs` | background / border-bottom colour | `var(--tabbar-bg)` / `var(--tabbar-edge)` |
| `.tab` | background / color | `var(--tab-bg)` / `var(--tab-ink)` |
| `.tab[aria-current="true"]` | background | `var(--tab-current-bg)` |
| `.tab-new` | color / border colour | `var(--tab-new-ink)` / `var(--btn-border)` |
| `.tab-archive` | color / border colour | `var(--tab-new-ink)` / `var(--btn-border)` |
| `.tab-closed` | background / color | `var(--tab-closed-bg)` / `var(--tab-closed-ink)` |
| `.tab-closed[aria-current="true"]` | background (+ color) | `var(--tab-current-bg)`, and add `color: var(--tab-ink)` |
| `.desk` | background / border-top colour | `var(--desk-bg)` / `var(--desk-edge)` |
| `.desk-menu button` | border-bottom colour | `var(--rule)` |
| `.desk-menu button:hover, :focus-visible` | background | `var(--btn-hover)` |
| `.drawer::before` (sheet handle) | background | `var(--btn-border)` |
| `.drawer textarea, input, select` | border colour | `var(--btn-border)` |
| `.swatch-custom` | border colour | `var(--btn-border)` |
| `.btn` | background / border colour | `var(--btn-bg)` / `var(--btn-border)` |
| `.newcase-opt`, `.thick-btn` | background / border colour; `:hover` background | `var(--btn-bg)` / `var(--btn-border)`; `var(--btn-hover)` |

Then append:
```css
/* The room around the board follows the mood too. */
.room .viewport { background: var(--room-bg); }
```
Grep `chrome.css` for the old hexes `#b89a62`, `#e2c88f`, `#c9a86a`, `#8a7246`, `#efe1b8`, `#c8b98f`, `#b9a77c`, `#120e0b`, `#6b4a2f`, `#7d5a3a` and `#8d7a58`. Any remaining hit must be a deliberate keep; list each in the report.

- [ ] **Step 5: `src/view/mood.ts`**

Import `applyTheme` from `./themes`. In `createMood`, after `root.dataset.light = …`, call `applyTheme(document.documentElement, mood);`. In `setMood`, call `applyTheme(document.documentElement, id);`.

Add to `src/view/mood.test.ts`:
```ts
it('setMood themes the frame on <html>', () => {
  const m = createMood(document.createElement('div'), 'gentle');
  expect(document.documentElement.dataset.mood).toBe('noir-office');
  m.setMood('motel');
  expect(document.documentElement.dataset.mood).toBe('motel');
  expect(document.documentElement.style.getPropertyValue('--tab-bg')).toBe('#f2b99a');
});
```
Run: `npx vitest run src/view`. Expected: PASS.

- [ ] **Step 6: Look at it**

Run `npx vite --host 127.0.0.1 --port 5175`. Open one case per mood (or switch the mood in the Case drawer) and check, for each mood:
- tab bar, tabs (current, closed, + Open new case), desk toolbar, Add menu, drawer, a dialog (Settings) and the room
- a visible change from mood to mood, and text that reads cleanly
- the focus ring still yellow

Also check 390 px width. Stop the server.

- [ ] **Step 7: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build`. Report.
