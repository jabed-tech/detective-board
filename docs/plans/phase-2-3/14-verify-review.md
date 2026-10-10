# Task 14: Browser verification + phase review (Opus, controller) — wave F

Runs after T1–T13 are committed. The controller does this, not a subagent. Use `http://127.0.0.1:5174` (isolated storage) — never the user's `localhost:5173` data.

## Checklist (record pass/fail + notes in the ledger)
1. **Old data:** a board saved before phase 2 (copy one from localhost via export → import on 5174) opens unchanged: cork, noir, same items/strings.
2. **New case picker:** "+ Open new case" shows 5 moods; each opens with its surface, light, effects, and fastener for new items (glass ⇒ magnet, brick ⇒ tape, wood ⇒ thumbtack). Cancel creates nothing.
3. **Mood/surface switching** in the case file; undo restores the previous look in one step.
4. **Effects:** each mood shows its effects; Settings toggles hide each one; Atmosphere gentle stops the blind sweep; Atmosphere off and emulated `prefers-reduced-motion` stop every animation (DevTools Rendering panel). Count flicker dips ≤ 3/s. Text on items readable under every mood; chrome never covered.
5. **Sound:** nothing plays before the first click; enabling ambience plays the mood's layers; switching mood crossfades; master mute silences everything; hidden tab suspends. Own music: choose an MP3 → plays and loops, jazz drops out; a renamed `.txt` → "That tape won't play." and nothing stored; reload keeps the track; Remove clears it; exported case file contains no audio.
6. **Strings:** yarn/twine/marker look right; marker ignores tension; thickness presets (and new strings use the last one); arrows end/both + Swap direction; label tag at the midpoint follows while dragging an item; labels with `<b>` show literally; hit area still easy to grab at 0.6×.
7. **Content:** add one of each Add-menu entry; edit every field; "New random …" is one undo step; receipt lines editor + total; sketch pad draw/undo/clear/cancel/save and Edit sketch; stamps have no pin; objects with tags; Aged and Cross-out on several types; text-size and grow-to-fit on newspaper and case file.
8. **Archive:** Close the case → stamp + tab moves under "Archive (n)"; reopen; current closed case stays visible.
9. **Export:** whole board / view / selected item × PNG, JPEG, WebP, PDF (open the PDF in the browser), Large and Print sizes (capped note shown), transparent item PNG without background, Share/Copy where offered. Compare exported image against the screen for every item type and mood.
10. **Import hostility:** import a crafted JSON with the Review Focus #1 values → no script runs, bad values dropped, current case untouched on failure.
11. **Phone layout (390 px):** Add menu scrolls, drawer controls ≥ 44 px, sketch pad usable with touch emulation, export dialog fits.
12. `npm test`, `npx tsc --noEmit`, `npm run build` clean; no console errors during the whole run.

## Review
One Opus whole-branch review of `phase-1..HEAD` for phases 2–3 against the spec and this plan (correctness, security of new inputs, a11y, reduced motion). Fix wave for Critical/Important; minors to the ledger. Then update `docs/HANDOFF.md`.
