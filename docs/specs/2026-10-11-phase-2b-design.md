# Phase 2b — Close-up brick, mood-themed frame, acrylic precinct board, voices & phones

Date: 2026-10-11 · Status: approved in chat, awaiting written-spec review · Branch: `phase-2b` (from `master` 16fed6d)

## 1. Intent

Five changes asked for after using phases 2+3:

1. Brick should feel like a **close-up of part of a wall** with notes on it, not a giant wall seen from afar.
2. The **outer frame** (folder-tab bar, desk toolbar, drawer, menus, dialogs, room around the board) is always warm brown wood. It should **follow the case's mood**.
3. **Precinct** board becomes the **clear acrylic panel** from TV procedurals, with the dim squad room visible behind it.
4. **Occasional muffled talking and phone calls**, very sporadic, using recorded CC0 clips.
5. **Calmer ambience:** one signature sound per mood and a lower default volume (§5b).

**Success looks like:** switching a case from Noir to Precinct changes the board *and* the whole frame around it. A Precinct case looks like evidence taped to perspex in a squad room. Basement bricks look about palm-sized next to a photo. With room ambience on, every few minutes you hear a phone ring next door or voices through the wall. All of it stays readable, accessible and offline-safe.

**Constraints (unchanged from the main spec):** static hosting, no user content leaves the device, 44 px targets on coarse pointers, chrome text ≥ 4.5:1, yellow focus ring identical in every mood, lighting floor ~35%, reduced-motion respected, sound muted by default, never before a user gesture. Exports match the screen.

**Non-goals:** a frame-theme picker separate from the mood (the user chose "follows the mood"); new moods; changing desk-prop icons (pin tin, yarn spool etc. stay the same objects in every theme); speech recognition or any generated speech.

## 2. Close-up brick

- Brick module roughly **3×** current: brick ≈ 420 × 130 world px with ≈ 14 px mortar (today 140 × 70 with 4 px), running bond.
- Big bricks must not look like a scaled-up pattern. Each brick gets:
  - its own tone, picked from 5–6 varied reds/browns
  - a lighter top arris and a darker shadow under each bed joint (recessed mortar)
  - a few chips and spalls
  - fine surface noise
- Built as one SVG data-URI tile covering several courses × 2 bricks, so the repeat isn't obvious (tile ≥ 840 × 576).
- The whitewash wash bottom-left stays.
- The lighting floor still holds: the darkest brick tone under the basement bulb's outer overlay stays ≥ ~35% HSL lightness. This is checked by arithmetic in the implementer's report, as in the phase-2+3 fix wave.
- **Export:** `src/export/backdrop.ts` draws the same tile (decode the same SVG as an image pattern) so exports match.

## 3. Mood-themed frame

### Mechanism
- The theme table lives in TS: `src/view/themes.ts` exports `THEMES: Record<MoodId, FrameTokens>`.
- `mood.ts` already writes per-mood variables on `<html>`. On every mood change it now also writes each frame token as a CSS variable there, and sets `data-mood` for the few rules that need a different texture rather than a colour.
- All hard-coded frame colours in `src/styles/chrome.css` (and the `--paper`, `--ink`, `--chrome-text` roots in `base.css`) become `var(--token)`.
- The `base.css` `:root` fallbacks equal the Noir values, so the first paint before the board loads never flashes brown.
- Tokens (final names may differ slightly; the set is fixed):
  - room: `--room-bg` (area around the board)
  - tab bar: `--tabbar-bg`, `--tabbar-edge`
  - tabs: `--tab-bg`, `--tab-ink`, `--tab-current-bg`, `--tab-closed-bg`, `--tab-closed-ink`, `--tab-new-ink`
  - desk toolbar: `--desk-bg` (gradient allowed), `--desk-edge`, `--chrome-text`
  - panels (drawer, menus, dialogs, toasts, memo): `--paper`, `--ink`, `--rule`, `--btn-bg`, `--btn-border`, `--btn-hover`
  - accent: `--accent` (used sparingly: active desk button tint, tab underline)
- `--focus` is **not** themed (spec §5).

### Themes

| Mood | Room | Tab bar / desk | Tabs | Panels |
|---|---|---|---|---|
| Noir Office | near-black warm wall | black lacquer, brass edge | dark manila, current tab lighter manila | cream paper |
| Precinct | cold blue-grey | grey steel, black rubber edge | blue-grey hanging-file tabs | cool white form paper (clipboard feel: pale-grey rule lines) |
| Basement | dark concrete | scarred plywood workbench | masking-tape labels (off-white, slightly torn edge) | plain off-white |
| Motel | dim brown-violet | 70s orange wood-grain laminate, pink accent | pastel (peach/mint) | motel notepad (cream, pink header rule) |
| Archive | dark olive | olive filing-cabinet steel | manila (close to today's) | yellowed paper |

- Desk-prop icons are unchanged. Danger buttons stay dark red with white text in every theme.
- Theme changes apply instantly with the mood (undo/redo included, because `syncLook` already runs on every store change).
- No transition animation on the frame, which keeps reduced motion simple.

### Contrast guarantee
- Colours exist only in `THEMES`, with no hand-written CSS copy, so the test and the screen can't drift.
- `src/view/themes.test.ts` asserts ≥ 4.5:1 for these pairs in every theme:
  - `--tab-ink` on `--tab-bg`, on `--tab-current-bg` and on `--tab-closed-bg`
  - `--chrome-text` on the desk's darkest stop
  - `--ink` on `--paper`
  - `--ink` on `--btn-bg`
  - `--tab-new-ink` on `--tabbar-bg`

## 4. Acrylic precinct panel

- Surface id stays **`glass`**, so saved boards and imports are unaffected. The display name becomes **"Acrylic panel"** in `SURFACES`.
- Look, built bottom to top:
  1. **Squad room behind:** dim blue-grey, out of focus, built from CSS gradients only (no images). It has:
     - 2–3 blurred fluorescent ceiling strips near the top
     - soft bokeh dots (monitor/desk-lamp lights, a few warm, most cool)
     - darker horizontal bands suggesting desks and partitions in the lower third

     Overall lightness stays ~35–45% so marker strings (with halo) and item edges read.
  2. **Acrylic sheet:**
     - very slight cool tint
     - 2 diagonal specular bands
     - a faint cyan-green glowing cut edge (inset border light)
     - micro-scratches at very low opacity
  3. **Hardware:** 4 chrome standoff bolts at the board corners (drawn in the surface layer, non-interactive).
- **Shadows:** items cast a softer, larger, further-offset shadow on this surface (the "wall" is far behind). This uses a surface modifier class on `#world` that scales the shadow offset and blur.
- **Fasteners:** `glass` fasteners become `['tape', 'magnet']`. Tape is the default for new items; magnet stays selectable, so existing magnet items still render.
- **Strings:** marker material stays the default.
- **Export:** `backdrop.ts` paints the same layers: room gradients, bokeh, sheen, edge and bolts. Base colour updated.
- The Precinct mood blurb changes to "Cold fluorescent tubes, an acrylic evidence board, sirens far off."

## 5. Voices & phone calls

### Behaviour
- A new ambience layer kind, **`incidents`**, plays **one clip at a time** after a random gap.
- Each clip is routed through a **through-the-wall chain**:
  - low-pass filter at ~900–1600 Hz (random per play)
  - a short room delay at low mix
  - a random stereo pan of ±0.6
  - gain at about 0.35 × ambience volume
- Never two incidents overlapping. A clip is never repeated twice in a row.
- Starts only when room ambience is on, after the audio unlock. It stops (and clears its timer) on mute, when ambience is turned off, when the tab is hidden, and on a mood change. Same lifecycle as the existing layers.

| Mood | Pool | Gap |
|---|---|---|
| precinct | phone rings, chatter, one-sided calls | 60–180 s |
| noir-office | phone ringing next office, voices through door | 120–300 s |
| motel | voices/TV through wall, room phone | 120–300 s |
| basement | phone upstairs (extra muffled: low-pass ≤ 700 Hz) | 240–480 s |
| archive | distant phone (extra muffled) | 240–480 s |

- The first incident after enabling waits at least 30 s.
- **Own music:** when the user's own music plays, incidents still play (they're room sound, not music) unless the user mutes. *(Decision: keep them. Existing `layersFor(mood, musicPlaying)` only drops jazz.)*

### Clips
- 8–10 recorded **CC0** clips, each 3–15 s, converted to **mono MP3 ~48 kbps**. Total ≤ 400 KB, stored in `public/audio/incidents/`. Categories:
  - phone ring (desk, old bell)
  - office chatter / murmur
  - one-sided phone call fragments (no intelligible personal content)
  - TV/voices through a wall
- `src/audio/incidents.ts` holds a manifest: `{ id, file, kind: 'ring' | 'talk' | 'call' | 'tv', moods: MoodId[] }`.
- Clips are fetched lazily with `fetch` + `decodeAudioData` on the first incident of a mood that needs them, then cached in memory. A failed fetch or decode skips that clip silently and tries another next time. No toast.
- These are static app assets, so no user content is sent anywhere.
- **Sourcing:**
  - The controller searches CC0 sources (Freesound CC0 filter, OpenGameArt CC0, BigSoundBank) and gives the user a shortlist with link, licence, length and a one-line description.
  - Downloads happen only with the user's explicit OK per file. Where a login is required, the user downloads the file.
  - Conversion uses ffmpeg if available locally. Otherwise the user converts, or the clips are kept as-is if already small.
  - Credits go in `README.md` → "Sound credits".
- **Implementation does not wait for the clips:**
  - Tests use a fake fetch and a fake AudioContext.
  - In the browser, the feature is a silent no-op until the files exist (missing files are skipped).

### Testable units
- `nextIncidentDelay(mood, rng)` stays within range; the first delay is ≥ 30 s.
- `pickClip(pool, lastId, rng)` never repeats the last clip and filters by mood.
- Scheduler lifecycle with a fake clock and fake AudioContext:
  - no play before unlock
  - timer cleared on mute, hide and mood change
  - no overlap
  - a failed decode is skipped

## 5b. Calmer ambience: one sound per mood

User feedback (2026-10-11): the stacked layers are too much, and rain plus hum read as static.

Each mood now has **one** signature ambience layer, plus the sporadic incidents from §5.

| Mood | Before | After |
|---|---|---|
| Noir Office | rain + jazz | **jazz** |
| Precinct | hum + sirens | **sirens** (distant, sporadic) |
| Basement | hum | **hum** (kept, the only option; level −30%) |
| Motel | buzz + rain | **neon buzz** |
| Archive | tick | **clock tick** |

- `MOODS[*].ambience` becomes a single-element list.
- **Own music:** when the user's own music plays, the Noir jazz drops out as now.
- The `rain` sound builder is deleted (nothing uses it, YAGNI). The visual rain effect stays.
- Default `ambienceVolume` drops from 0.3 to **0.2**. Only the default changes: a user's saved volume is kept.
- Mood blurbs that mention rain sound are updated. Noir's becomes "Desk lamp, venetian blinds, rain on the window, a little jazz." Rain is still seen, just not heard.

## 6. Files touched (expected)

| Area | Files |
|---|---|
| Brick | `src/styles/board.css`, `src/export/backdrop.ts` |
| Frame | `src/view/themes.ts` (new), `src/view/themes.test.ts` (new), `src/view/mood.ts`, `src/styles/chrome.css`, `src/styles/base.css`, `src/styles/board.css` (room) |
| Acrylic | `src/styles/board.css`, `src/styles/items.css` (shadow modifier), `src/model/types.ts` (SURFACES name/fasteners, mood blurb), `src/export/backdrop.ts` |
| Incidents | `src/audio/incidents.ts` (new) + test, `src/audio/ambience.ts` (wire), `src/audio/jazz.ts` (`layersFor`), `public/audio/incidents/*`, `README.md` |
| Calmer ambience | `src/model/types.ts` (MOODS ambience + blurbs), `src/audio/ambience.ts` (drop rain builder, hum level), `src/prefs.ts` (default volume), affected tests |

## 7. Testing & verification

- Vitest:
  - theme contrast table
  - glass fasteners default to tape
  - incident scheduler and picker
  - existing suites stay green
  - `tsc` and `build` clean
- Browser check on `127.0.0.1:5174` (never the user's localhost data):
  - each mood's frame
  - brick scale next to a photo
  - acrylic panel with all item types
  - export of brick and acrylic boards matches the screen
  - 390 px phone layout
  - reduced motion
  - incidents audible once the clips exist (shorten the gap in a dev check via a console call, not a shipped setting)

## 8. Execution

Same model as phases 2+3:
- Opus writes the plan and reviews.
- Sonnet implements. Tasks are independent and run in parallel: brick ∥ acrylic ∥ frame ∥ incidents (code).
- Clip sourcing runs alongside with the user.
- One Opus review, one fix wave, a controller browser check, then the merge decision.
- Local only, no publishing.
