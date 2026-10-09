# Task 1: Scaffold (Haiku)

Read `00-overview.md` Global Constraints first.

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/styles/fonts.ts`, `src/styles/base.css`, `src/smoke.test.ts`

**Produces:** the DOM shell ids every later task uses: `#tabs #room #viewport #world #surface #items #strings #pins #mood #lamp-chain #drawer #desk #toasts #sr-live #settings`.

- [ ] **Step 1: package.json**

```json
{
  "name": "detective-board",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm i idb-keyval @fontsource/courier-prime @fontsource/special-elite @fontsource/caveat @fontsource/patrick-hand
npm i -D vite typescript vitest jsdom
```
Expected: both succeed; `package-lock.json` created.

- [ ] **Step 3: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: vite.config.ts**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  test: { environment: 'node' },
});
```

- [ ] **Step 5: index.html**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#120e0b">
  <meta name="description" content="A detective evidence board in your browser. Pin it, string it, solve it. Everything stays on your device.">
  <title>Detective Board</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📌</text></svg>">
</head>
<body>
  <div id="app">
    <nav id="tabs" class="folder-tabs" aria-label="Cases"></nav>
    <main id="room" class="room">
      <div id="viewport" class="viewport">
        <div id="world" class="world">
          <div id="surface" class="surface surface-cork"></div>
          <div id="items" class="items-layer"></div>
          <svg id="strings" class="strings-layer" aria-hidden="true"></svg>
          <div id="pins" class="pins-layer"></div>
        </div>
      </div>
      <div id="mood" class="mood" aria-hidden="true"></div>
      <button id="lamp-chain" class="lamp-chain" type="button" aria-label="Lamp pull-chain: change atmosphere" title="Pull the chain: change atmosphere">
        <span class="chain" aria-hidden="true"></span><span class="bead" aria-hidden="true"></span>
      </button>
    </main>
    <aside id="drawer" class="drawer" aria-label="Details drawer" hidden></aside>
    <footer id="desk" class="desk" aria-label="Desk tools"></footer>
    <div id="toasts" class="toasts" role="status" aria-live="polite"></div>
    <div id="sr-live" class="visually-hidden" aria-live="polite"></div>
    <dialog id="settings" aria-label="Settings"></dialog>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: src/styles/fonts.ts**

```ts
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import '@fontsource/special-elite/400.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/700.css';
import '@fontsource/patrick-hand/400.css';
```

- [ ] **Step 7: src/styles/base.css**

```css
:root {
  --ink: #1b1712;
  --paper: #f4ecd8;
  --cork: #b88a57;
  --chrome-text: #f4ecd8;
  --focus: #ffd23f;
  --font-ui: 'Courier Prime', ui-monospace, monospace;
  --font-display: 'Special Elite', 'Courier Prime', monospace;
  --font-hand: 'Caveat', cursive;
  --tab-h: 46px;
  --desk-h: 78px;
  color-scheme: dark;
}
:root.neat-hand { --font-hand: 'Patrick Hand', cursive; }

html, body { margin: 0; height: 100%; overscroll-behavior: none; background: #120e0b; color: var(--chrome-text); font-family: var(--font-ui); }
#app {
  position: relative;
  display: grid;
  grid-template-rows: var(--tab-h) 1fr auto;
  height: 100vh;
  height: 100dvh;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left);
  box-sizing: border-box;
  overflow: hidden;
}
:focus-visible { outline: 3px dashed var(--focus); outline-offset: 3px; }
button { font: inherit; color: inherit; min-height: 44px; min-width: 44px; cursor: pointer; }
.visually-hidden { position: absolute !important; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
```

- [ ] **Step 8: src/main.ts (stub, replaced in Task 13)**

```ts
import './styles/fonts';
import './styles/base.css';
```

- [ ] **Step 9: smoke test**

`src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(crypto.randomUUID()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 10: Verify**

Run: `npm test` → 1 passed. Run: `npm run build` → `dist/` created, no TS errors.

- [ ] **Step 11: Commit** (controller)

```bash
git add -A && git commit -m "chore: scaffold vite + ts app shell"
```
