# Handoff — where we left off (2026-10-09)

Branch: `phase-1` (not merged to `master`, not pushed — no GitHub repo created yet).
Spec: `docs/specs/2026-10-09-detective-board-design.md` · Plan: `docs/plans/phase-1/00-overview.md` + task files 01–19.
Execution ledger (git-ignored, local): `.superpowers/sdd/phase-1/progress.md` — full record of tasks, reviews, rulings, deferred minors.

## Done (all committed on `phase-1`, 102 tests passing, tsc clean, build OK)
- Tasks 1–13: core board (cork, noir lamp + safe flicker, pan/pinch/zoom, photo/polaroid/sticky/index items, rope strings, undo/redo, autosave to IndexedDB, folder-tab cases, JSON export/import, desk UI, settings, demo case, keyboard).
- Task 14 steps 1–2: `.github/workflows/deploy.yml` + README.
- User-requested additions: T15 fastener choice (pin/tack/tape/magnet/clip) + live rotate handle + optional tilt; T16 live resize handle + "Unknown person" ? polaroid + add/replace photo; T17 Move/String modes + per-string anchor pins; T18 copy/paste/duplicate (keyboard).
- Final Opus review → fix wave (`f04d208`): 5 Important fixes, plus user changes: strings snap to main pin by default (Advanced setting "Pin strings where I drop them"), Move/String/**Erase** modes (E key), undo/redo buttons only on touch devices (Ctrl+Z/Ctrl+Y on desktop), copy/paste keyboard-only with a Settings toggle.

## In flight when we stopped
- **Task 19** committed (104 tests pass) but NOT browser-checked. Known nits from implementer: hover and string-target highlight share `.hot` (one can clear the other); in Move mode the hot glow overrides the lifted shadow during drag.

## Next steps
1. Finish/verify Task 19 in the browser (test on `http://127.0.0.1:5174` via `npx vite --host 127.0.0.1 --port 5174` so the user's `localhost` data isn't touched).
2. Browser checks still outstanding: snap-to-pin default in String mode (unit-tested only), touch-only undo/redo, Task 14 step 3 checklist items 6–7 (large photo upload, export → burn → import round trip), reduced-motion.
3. `/ponytail-review` or a final scoped review of tasks 19 + fix wave.
4. **Ask the user before publishing:** `gh repo create` (public, account `jabed-tech`), push `phase-1` → merge to `main`, enable Pages (source: GitHub Actions), confirm the URL loads. Note the default branch locally is `master`; the workflow triggers on `main`.
5. Then phase 2 (boards & moods): write its plan from the spec §9.

## Decisions to remember
- Usage: Opus plans/reviews only; Sonnet implements; Haiku for mechanical tasks. Batch reviews per wave.
- Toolchain resolved newer than planned (TypeScript 7, Vite 8, Vitest 5) — kept; all green.
- Rope: ITERATIONS=40, gravity scaled 0.02+0.98·tension so taut strings look straight.
- Deferred minors (see ledger) were triaged by the final review as not blocking publish; large (~48 MP) photo decode can crash older iPhones → phase 5.
