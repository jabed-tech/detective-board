# Task 14: Deploy workflow, README, browser verification, phase review

Depends on Task 13. Steps 1–2 by Haiku; steps 3–6 by the Opus controller.

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1: deploy.yml** (Haiku). Check https://github.com/actions for the current major versions of these four actions and bump them if newer ones exist.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README.md** (Haiku)

```markdown
# Detective Board

A red-string evidence board in your browser. Pin photos, notes and index cards to a cork board, string them together, and brood under a flickering desk lamp.

Everything stays on your device — nothing is uploaded. Export a case as a `.json` file to back it up or share it.

## Develop

    npm install
    npm run dev     # local server
    npm test        # unit tests
    npm run build   # production build in dist/

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml` (Settings → Pages → Source: GitHub Actions).
```

- [ ] **Step 3: Browser verification** (Opus, Claude in Chrome against `npm run dev`). Check each and record pass/fail:
  1. Desktop 1440×900: demo case, lamp pool, drawer on the right, all desk tools visible.
  2. Phone emulation 390×844: bottom desk scrolls if needed, drawer is a bottom sheet, no horizontal page scroll, tabs scroll.
  3. Drag item → strings follow and wobble; settle + thunk; one undo step.
  4. Pin-drag connect; tap-tap connect via spool; keyboard `C` → Tab → Enter connect.
  5. String midpoint drag changes droop; drawer droop slider matches.
  6. Upload a large JPEG (≥ 12 MP) and a PNG: both develop in; exported JSON has no EXIF (re-encoded WebP).
  7. Export → Burn this case → Import: case returns intact with photos.
  8. Import a hand-edited file with `<script>` in a note: renders as text.
  9. **Review Focus #5:** two-finger pinch starting on an item zooms; the item does not move (touch emulation or real device).
  10. Reduced motion (DevTools rendering emulation): no flicker, no wobble, no develop/settle animation.
  11. Atmosphere full: flicker dips are brief and dim, never strobing.
  12. Keyboard only: Tab reaches items and desk, focus ring visible everywhere, arrows move, Delete removes, Esc closes.
  13. Console: no errors during all of the above.

- [ ] **Step 4: Phase review** (Opus) — run `/ponytail-review` over the phase diff; fix or ticket findings.

- [ ] **Step 5: Publish** — **ask the user first** (outward-facing): create the GitHub repo (`gh repo create`), push `main`, enable Pages with source "GitHub Actions", confirm the deployed URL loads.

- [ ] **Step 6: Commit** (controller) — `ci: github pages deploy workflow; docs: readme`
