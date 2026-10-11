# Handoff — where we left off (2026-10-10)

Branch: `phase-1` (not merged to `master`, not pushed — no GitHub repo created yet).
Spec: `docs/specs/2026-10-09-detective-board-design.md` · Plan: `docs/plans/phase-1/00-overview.md` + task files 01–20.
Execution ledger (git-ignored, local): `.superpowers/sdd/phase-1/progress.md` — full record of tasks, reviews, rulings, deferred minors.

## Done (all committed on `phase-1`, 102 tests passing, tsc clean, build OK)
- Tasks 1–13: core board (cork, noir lamp + safe flicker, pan/pinch/zoom, photo/polaroid/sticky/index items, rope strings, undo/redo, autosave to IndexedDB, folder-tab cases, JSON export/import, desk UI, settings, demo case, keyboard).
- Task 14 steps 1–2: `.github/workflows/deploy.yml` + README.
- User-requested additions: T15 fastener choice (pin/tack/tape/magnet/clip) + live rotate handle + optional tilt; T16 live resize handle + "Unknown person" ? polaroid + add/replace photo; T17 Move/String modes + per-string anchor pins; T18 copy/paste/duplicate (keyboard).
- Final Opus review → fix wave (`f04d208`): 5 Important fixes, plus user changes: strings snap to main pin by default (Advanced setting "Pin strings where I drop them"), Move/String/**Erase** modes (E key), undo/redo buttons only on touch devices (Ctrl+Z/Ctrl+Y on desktop), copy/paste keyboard-only with a Settings toggle.

## In flight when we stopped
- **Task 19** browser-verified 2026-10-10. **Task 20** (text size) committed + browser-verified. Known nits from implementer: hover and string-target highlight share `.hot` (one can clear the other); in Move mode the hot glow overrides the lifted shadow during drag.

## 2026-10-10
- Tasks 20 (text size) and 21 (cards grow to fit text) done and browser-verified; string click-through bug fixed (d898205); `.gitattributes` forces LF.
- User decisions: stay **local only** until told otherwise (no GitHub repo/Pages yet); build phases 2 + 3 **together**; add export (PNG/JPEG/WebP/PDF, whole board/view/item); add string thickness + extras (arrows, swap direction, labels).
- Plan written: `docs/plans/phase-2-3/` (00-overview + tasks 01–14). Waves: A T1 · B T2–T8 parallel · C T9 + T11 · D T10 + T12 · E T13 · F T14 verify/review. Awaiting user review before execution.

## Phases 2+3 — PARKED 2026-10-10 (usage limit)
- Branch `phase-2-3` (from `phase-1`), HEAD 900608f. Tasks 1–13 all implemented, reviewed, fixed and committed. 239 tests, tsc clean, build OK.
- Controller browser checks done on 127.0.0.1:5174: mood picker, surfaces/effects, all new item types, sketch pad, string thickness/arrows/labels, archive, export compose + PDF bytes + dialog, hostile import.
- **Resume here:** re-run the final whole-branch Opus review (it was stopped mid-run) over a99fa27..HEAD with the ledger `.superpowers/sdd/phase-2-3/progress.md` (deferred minors + rulings), do ONE fix wave + scoped re-review, then report the "Rulings I made" list to the user and decide merge/keep (local only — no publishing).
- Not yet checked: hearing the ambience/music; real touch devices; reduced-motion emulation in DevTools.
- Later (user): starter sample cases per mood.

## Next steps (phase 1 leftovers, lower priority now)
1. (done) Tasks 19–20 verified. Test in the browser (test on `http://127.0.0.1:5174` via `npx vite --host 127.0.0.1 --port 5174` so the user's `localhost` data isn't touched).
2. Browser checks still outstanding: snap-to-pin default in String mode (unit-tested only), touch-only undo/redo, Task 14 step 3 checklist items 6–7 (large photo upload, export → burn → import round trip), reduced-motion.
3. `/ponytail-review` or a final scoped review of tasks 19 + fix wave.
4. **Ask the user before publishing:** `gh repo create` (public, account `jabed-tech`), push `phase-1` → merge to `main`, enable Pages (source: GitHub Actions), confirm the URL loads. Note the default branch locally is `master`; the workflow triggers on `main`.
5. Then phase 2 (boards & moods): write its plan from the spec §9.

## Decisions to remember
- Usage: Opus plans/reviews only; Sonnet implements; Haiku for mechanical tasks. Batch reviews per wave.
- Toolchain resolved newer than planned (TypeScript 7, Vite 8, Vitest 5) — kept; all green.
- Rope: ITERATIONS=40, gravity scaled 0.02+0.98·tension so taut strings look straight.
- Deferred minors (see ledger) were triaged by the final review as not blocking publish; large (~48 MP) photo decode can crash older iPhones → phase 5.

## 2026-10-11 — phases 2+3 review done
- Final whole-branch review: 0 Critical, 5 Important, all fixed (bbabf16..53408a2) with 5 minors. 245 tests, tsc, build clean. Fix diff re-reviewed; browser spot-check on 5174 (focus ring on receipt/newspaper, motel/basement lighting) OK.
- **Resume here:** user decides merge of `phase-2-3` (local only). Deferred minors are in the ledger. Still unchecked: hearing ambience/music, real touch devices, reduced-motion emulation, starter sample cases per mood (later).

## 2026-10-11 — phase 2b built (branch `phase-2b`, not merged)
- Spec `docs/specs/2026-10-11-phase-2b-design.md`, plan `docs/plans/phase-2b/`. Close-up brick (user asked for +60% after: 650×186 bricks), frame themed per mood (`src/view/themes.ts`), Precinct = acrylic panel, one ambience sound per mood + quieter default, rare muffled phone/voice "incidents" layer.
- 282 tests, tsc, build clean. Per-task reviews + final Opus review + fix wave done; browser-checked on 5174.
- **Resume here:** (1) user decides merge of `phase-2b` → `master` (local only); (2) recorded clips: user stopped the download step — `CLIPS` in `src/audio/incidents.ts` is empty so the layer is silent. Shortlist (9 Freesound CC0 clips) is in the conversation/ledger; ask how they want to source/convert (no ffmpeg installed).
- Deferred minors in `.superpowers/sdd/phase-2b/progress.md` (unused --accent, flat frame textures, micro-scratches, a few untested hard-coded muted colours).

## 2026-10-11 — published
- Public repo https://github.com/jabed-tech/detective-board, live at https://jabed-tech.github.io/detective-board/ (GitHub Actions deploy on every push to `main`). Local `master` was renamed `main`.
- Commit emails rewritten to jabed-tech's GitHub no-reply address before the first push (backup bundle was kept in the session scratch folder). Push over HTTPS via `gh` (the SSH key belongs to another account).
- Since phase 2b: 10 CC0 phone/voice clips (`public/audio/incidents/`, credits in README); Add menu with group tabs; tape straddles the item's top edge; × on a case tab puts it away (reopen under "Put away").
- Follow-ups (menu tabs / put-away / tape) were browser-checked but not separately code-reviewed — worth a review pass next session.
