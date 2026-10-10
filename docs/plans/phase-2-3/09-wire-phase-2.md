# Task 9: Wire phase 2 — moods, surfaces, string controls, sound, new-case picker (Sonnet) — wave C

Read `00-overview.md`. Depends on T1–T5 (all committed). Read each file before editing; follow `main.ts`/`drawer.ts`/`settings.ts` patterns. Runs alone (touches the shared hot files).

**Files:**
- Create: `src/ui/newcase.ts`
- Modify: `src/main.ts`, `src/ui/drawer.ts`, `src/ui/settings.ts`, `src/ui/desk.ts`, `src/view/connect.ts`, `src/view/connect.test.ts`, `src/model/surfaces.ts`, `src/model/surfaces.test.ts`, `src/storage/db.ts`, `src/storage/db.test.ts`, `src/styles/chrome.css`, `index.html`

**Interfaces:**
- Consumes: `SURFACES`, `MOODS`, `MATERIALS`, `THICKNESSES`, `reverseLink`, prefs fields (T1); `pickFastener` (T2); `applySurface` (T2); `markerPath` etc. via `StringsView.preview(..., thickness)` (T3); `Mood.setMood/setEffects` (T4); `createAmbience`, `createMusic` (T5).
- Produces: `moodPatch(m: MoodId): Pick<Board, 'mood' | 'surface'>` in `model/surfaces.ts`; `Db.deleteBlob(id: string): Promise<void>`; `pickMood(dialog): Promise<MoodId | null>`; `ConnectDeps` gains `material(): StringMaterial`, `thickness(): number`; `DrawerDeps` gains `setLastThickness(v: number)`; `SettingsDeps` gains `chooseMusic()`, `removeMusic()`.

- [ ] **Step 1: Failing tests**
- `surfaces.test.ts`: `moodPatch('motel')` → `{ mood: 'motel', surface: 'wood' }`.
- `db.test.ts` (memory fallback path the file already tests): `putBlob('a', blob)`, `deleteBlob('a')` → `getBlob('a')` is `undefined`; `deleteBlob('missing')` resolves.
- `connect.test.ts`: with deps `material: () => 'twine'`, `thickness: () => 1.6`, completing a tap-tap connection creates a link with `material: 'twine'` and `thickness: 1.6`; with `material: () => 'yarn'`, `thickness: () => 1` the link has neither key.
Run those files — Expected: FAIL. Implement `moodPatch`, `deleteBlob` (idb `del` + memory map delete), and pass `material`/`thickness` through `connect.ts` to `actions.connect`; pass `thickness()` as the preview thickness. Run — PASS.

- [ ] **Step 2: Mood & surface follow the board** — `main.ts`

- Create `ambience = createAmbience()` and `music = createMusic()` next to `sfx`.
- `applyLook(b)`: `applySurface($('surface'), b.surface)`, `mood.setMood(b.mood)`, `ambience.setMood(b.mood)`. Track the last applied `{surface, mood}`; call `applyLook` in first paint and in the store subscriber whenever either differs (this covers open/switch/import/delete/undo/redo).
- `setPrefs`: `sfx.setEnabled(prefs.sfx && !prefs.muted)`; `ambience.setEnabled(prefs.ambience)`, `.setVolume(prefs.ambienceVolume)`, `.setMuted(prefs.muted)`; `music.setVolume(prefs.ambienceVolume)`, `.setMuted(prefs.muted)`, `.setOn(prefs.musicOn)`; `ambience.setMusicPlaying(music.playing())`; `mood.setEffects(prefs.effects)`.
- Audio unlock: one `{ once: true, capture: true }` listener each for `pointerdown` and `keydown` on `document` → `ambience.unlock(); music.unlock(); setPrefs({})`.
- Boot: if `prefs.musicId`, `getBlob` → `music.load(blob)`; if missing or `false`, toast `"The tape's gone missing."` / `"Choose your track again in Settings."` and `setPrefs({ musicId: undefined, musicName: undefined, musicOn: false })`.
- New fasteners: every `makeItem` call in `main.ts` uses `attach: pickFastener(store.get().surface, prefs.lastFastener)`.
- Connect deps: `material: () => SURFACES[store.get().surface].material`, `thickness: () => prefs.lastThickness`.

- [ ] **Step 3: New-case mood picker** — `ui/newcase.ts`, `index.html`, `chrome.css`

`index.html`: `<dialog id="newcase" class="newcase" aria-label="Open a new case"></dialog>`. `pickMood(dialog)` builds (static text only): heading "Open a new case" (Special Elite), plain line "Pick the room you'll work in. You can change it later in the case file.", then five big `<button>`s (one per `MOODS` entry, ≥ 44px tall, full-width on phones, 2-column grid ≥ 640px), each with a 64×48 swatch `<span class="surface surface-<id>">` preview, the mood name (bold) and blurb; plus "Cancel". Resolves the `MoodId` or `null` (Cancel/Escape/backdrop). `main.ts` `newCase()`: `const m = await pickMood($('newcase'))`; `null` ⇒ return; else `{ ...newBoard('Untitled case', nextCaseNo()), ...moodPatch(m) }`.

- [ ] **Step 4: Drawer** — `ui/drawer.ts`

- **Board panel**, after "Case name": `field('Mood', select)` with the 5 moods (`commit(b => ({ ...b, ...moodPatch(m) }))`) and `field('Board surface', select)` with the 5 surfaces (`commit(b => ({ ...b, surface }))`), plus hint "Mood sets the light, sound and board. Change the board on its own if you like."
- **Item panel, "Held by"**: list the board's surface fasteners first (in `SURFACES[surface].fasteners` order), then the rest; add `nail` (it's in `FASTENERS` now).
- **Link panel** (keep Colour, Droop, Pattern, Cut):
  - `Material` select (`MATERIALS`): commit `updateLink(…, { material: v === 'yarn' ? undefined : v })`. When `marker`, hide Droop and its tip ("Marker lines are drawn straight.").
  - `Thickness`: a row of 4 toggle `<button>`s (`THICKNESSES`, `aria-pressed`, ≥ 44px, each showing a short line sample at that width via an inline `<span class="thick-sample" style="--sw:…">`): click commits `{ thickness: v === 1 ? undefined : v }` and `deps.setLastThickness(v)` (main ⇒ `setPrefs({ lastThickness: v })`).
  - `Arrows` select: None / "Arrow at the end" / "Arrows at both ends" → `{ arrow: undefined | 'end' | 'both' }`.
  - "Swap direction" button, shown only when `arrow === 'end'` → `commit(b => reverseLink(b, l.id))`.
  - `Label` text input (maxLength 80, debounced like Case name): commit `{ label: v.trim() || undefined }`; hint "A few words shown on a tag at the middle of the string."
- Keep everything ≥ 44px; selects/inputs use the UI font.

- [ ] **Step 5: Settings** — `ui/settings.ts`

Replace the "Sound effects"/"Volume" pair with a `Sound` fieldset: "Sound effects (pins, string, paper)" (`sfx`), "Effects volume" (`volume`), "Room ambience (rain, jazz, hum… depends on the mood)" (`ambience`), "Ambience & music volume" (`ambienceVolume`), and a "Your music" row: current `musicName` or "No tape loaded", buttons "Choose a track…" and "Remove track", checkbox "Play my track" (`musicOn`, disabled with no track), hint "Your track stays on this device and is never uploaded or exported." New deps: `chooseMusic(): Promise<void>`, `removeMusic(): Promise<void>` (dialog re-renders after each).
Add an `Effects` fieldset with 6 checkboxes (Venetian blinds, Rain, Film grain, Neon glow, Dust, Light flicker) bound to `prefs.effects[id]`, hint "Each mood uses some of these. Reduced-motion settings turn moving ones off."

`main.ts` implements: `chooseMusic` — `pickFile('audio/*')`; > 60 MB ⇒ toast `"That tape's too long."` / `"Pick a file under 60 MB."`; `await music.load(file)` false ⇒ toast `"That tape won't play."` / `"Try an MP3, M4A or OGG file."` and store nothing; else `putBlob('music-' + newId(), file)` (storage error ⇒ existing `storageError()`), delete the old `musicId` blob, `setPrefs({ musicId, musicName: file.name.slice(0, 80), musicOn: true })`. `removeMusic` — `music.clear()`, `deleteBlob`, clear the three prefs.

- [ ] **Step 6: Desk** — `ui/desk.ts`

The radio button becomes the master mute: `aria-label` "Mute all sound", toggles `prefs.muted`; label "Sound"/"Muted" from `DeskState.muted = prefs.muted`.

- [ ] **Step 7: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build`. Report `.superpowers/sdd/phase-2-3/task-9-report.md` (list every new user-visible control with its file:line).
