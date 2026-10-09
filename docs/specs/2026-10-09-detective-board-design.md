# Detective Board — Design Spec

Date: 2026-10-09 · Status: draft for review

## 1. Intent

A fun, free, interactive evidence board ("red-string conspiracy board") that runs entirely in the browser and is hosted on GitHub Pages. People pin photos, templates, drawings and small objects to themed boards, connect them with string, move things around, and soak in a detective atmosphere.

**Success looks like:** a first-time visitor on a phone or desktop can, within a minute, add a photo, pin it, string it to a note, drag it and watch the string follow — under a flickering lamp — and reload the page to find it still there.

**Constraints**
- Static hosting only (GitHub Pages). No server, no accounts.
- All user data stays on the user's device.
- Responsive: desktop, tablet, phone (touch, pinch, pen).
- Accessible: keyboard operable, screen-reader list view, photosensitive-safe effects.
- Free/MIT-compatible dependencies only (no tldraw — production licence key and watermark).

**Non-goals:** live collaboration, cloud sync, share links containing photos, accounts, moderation.

## 2. Feature set (all phases)

### Look & feel (applies everywhere)
- **Fonts** (self-hosted via `@fontsource/*`, no Google CDN calls): Courier Prime — UI chrome & labels; Special Elite — headings, stamps, folder tabs (≥ 18 px only); Caveat — captions, notes, string labels; Permanent Marker — conspiracy-wall scrawl (≥ 18 px only); Playfair Display — newspaper masthead (phase 3). "Neat handwriting" pref swaps Caveat → Patrick Hand.
- **In-world chrome** (all real `<button>`s with `aria-label` + visible text label/tooltip):
  - Toolbar = desk front edge: pin tin (add item), yarn spool (connect / colour), magnifying glass (zoom/fit), eraser (undo/redo), master mute.
  - Properties panel = desk drawer (bottom sheet on phones).
  - Board picker = manila folder tabs "CASE #0042 – name"; new board = "Open new case".
  - Settings = matchbook; lamp pull-chain cycles Atmosphere full/gentle/off.
- **Depth:** two-layer shadows (tight contact + soft ambient), specular dot on pin heads, slight paper-curl gradient on photo corners; one static warm overlay (`mix-blend-mode: multiply`); never a CSS `filter` on the whole world.
- **Micro-interactions (phase 1):** drop = scale 1.04→1 + shadow tightens + pin wobbles once; new photo "develops" grey-green → full colour over ~2 s. Skipped under reduced motion.
- **SFX (phase 1):** pin thunk, yarn pluck, paper rustle (CC0, ~30 KB total, small random pitch variance), on by default at low volume; one master mute. No per-keystroke typing sounds.
- **Copy voice:** flavour headline + plain explanation, e.g. "Photo won't develop." / "That file type isn't supported (HEIC?). Try JPG or PNG." Export reminder = memo from the Chief. Destructive confirmations always in plain literal wording ("Burn the files" button, but dialog says "Delete all boards and images from this device? This cannot be undone.").
- **First run:** seeded demo case "The Case of the Missing Stapler" (5–6 items, 4 strings) with handwritten sticky notes teaching gestures ("drag me", "pull string from my pin", "pinch to zoom"). "Clear the board" button.

### Boards (surface + allowed fasteners + line style)
Phase 2 ships five surfaces matching the five moods: cork, precinct glass, brick basement, wood panelling, archive (sepia cork). The rest are later/maybe; darkroom clothesline is dropped (different layout model).

| Surface | Fasteners | Default line style |
|---|---|---|
| Cork (default) | push pin, thumbtack | yarn (sagging) |
| Conspiracy wall (newspaper-covered plaster) | pin, tape, nail | yarn + scrawled annotations |
| Precinct glass board | magnet, tape | marker (straight, slight jitter) |
| Chalkboard | magnet, tape | chalk (smudgy) |
| Pegboard | hook, binder clip | twine (taut) |
| Brick basement | tape, nail | yarn |
| Wood panelling | thumbtack, nail | twine |
| Fridge / metal cabinet | novelty magnet | none / marker |
| Map table | map pin, coin | pencil / dotted |

Users may override fastener and line style per item/link.

### Moods (presets = surface + lighting + effects + sound)
- **Noir Office** — cork, desk lamp pool, venetian-blind shadows, rain, jazz.
- **Precinct Night Shift** — glass board, fluorescent with occasional flicker, sirens.
- **Basement Obsession** — brick, single bare bulb, heavy grain, hum.
- **Motel Stakeout** — wood panelling, neon glow, buzz.
- **Cold Case Archive** — sepia, dust motes, clock tick.

Effects are CSS overlay layers (`pointer-events: none`), animating only `opacity`/`transform`. Item drop shadows offset away from the light source.

### Items
- **Phase 1:** photo (upload), polaroid (photo + handwritten caption), sticky note, index card.
- **Later:** mugshot, newspaper clipping, receipt, case file, typewritten memo, fingerprint card, redacted doc, sketch (drawn), small objects (keys, matchbook, cassette, bullet casing, evidence bag, ticket stub, burner phone…), stamps (CLASSIFIED, EVIDENCE, CASE CLOSED, ?, coffee ring).
- Every item: random tilt on creation (±4°), rotatable, resizable, z-order, fastener type + colour, optional "aged" look, optional hidden "UV ink" text (phase 4).

### Templates / generators (phase 3)
Mugshot (photo or silhouette, name, auto booking no., height chart, auto desaturate+grain), newspaper headline (masthead/date/headline from word lists, editable), receipt (store + line items, auto total & timestamp), case file (cover form). All fields editable; seeded randomness.

### Strings
- Connect by **dragging from an item's pin** to another item (signature interaction); alternatives: tap-tap via yarn-spool tool on touch, `C` on keyboard. Attaches at the fastener point.
- Colour: red default, 8 yarn-spool quick picks + "custom colour" (full picker).
- **Tension:** grab string midpoint and pull down/up to add/remove sag; also a slider in the drawer (keyboard/a11y); global default in Settings. Range taut 0 … droopy 1.
- Strings have a thin dark outline/halo so they read on any surface (e.g. red on brick); optional dashed/dotted pattern so colour is never the only signal.
- Rope physics (verlet) so strings sag and wobble on drag; sleeps when idle. Reduced motion ⇒ static curve, no wobble.
- Optional text label at the string midpoint.
- Line styles per §Boards.

### Detective tools (phase 4)
- **Torch:** room dark, light follows cursor/finger (CSS radial mask); **UV toggle** turns it into a blacklight revealing hidden UV-ink text on items.
- **Focus:** select item ⇒ dim everything more than 1 hop away.
- Crossout is a stamp (red X) — see phase 3 stamps.
- **Pull the thread:** pick two items ⇒ animate shortest string path between them.
- Each tool toggleable in Settings.

### Sound (phase 2)
Mood ambience loops (CC0), muted by default. **Own music:** user picks a local audio file; played via object URL, stored in IndexedDB, never uploaded.

### Persistence & sharing
- **IndexedDB** (via `idb-keyval`): boards (JSON) + image/audio Blobs keyed by id. Preferences in `localStorage`.
- Autosave debounced (~500 ms) after each change. Multiple boards with a simple board picker.
- `navigator.storage.persist()` requested; usage shown via `storage.estimate()`; warning near quota.
- **Export:** single `.json` file: `{ format: "detective-board", version, board, assets: { [id]: dataURL } }`.
- **Import:** validate format + version + shape; on failure show a readable message and leave current data untouched. Imported board gets new ids if it collides.
- **PNG export** (phase 4): own compositor redraws model to `<canvas>` with mood baked in.
- Reminder banner (dismissible) recommending periodic export — Safari may evict storage after ~7 days of no visits.
- "Clear all data" in Settings.

### Privacy
Uploads are re-encoded through canvas (strips EXIF/GPS), resized to max 1600 px long edge as WebP q0.8 (JPEG fallback) plus a 400 px thumbnail. No network calls with user content. No third-party image hotlinking. Settings page states "everything stays on your device".

## 3. Architecture

Vite + TypeScript, vanilla (no UI framework). Canonical state is a plain model; the DOM is a projection of it.

```
src/
  main.ts                 bootstrap: load prefs, open last board, mount views
  model/
    types.ts              Board, Item, Link, Prefs, enums
    store.ts              state + subscribe(listener) + dispatch(action)
    actions.ts            pure reducers: addItem, moveItem, connect, …
    history.ts            undo/redo via board snapshots (images by id → snapshots small)
  storage/
    db.ts                 idb-keyval wrappers: boards, blobs
    autosave.ts           debounced persist on store change
    transfer.ts           export/import JSON, validation, id remap
  images/
    process.ts            File → {full Blob, thumb Blob} (resize, re-encode)
  view/
    viewport.ts           pan/zoom transform, pointer map, pinch, wheel, clamp, fit
    items.ts              item DOM render/update, drag, select, rotate, keyboard move
    itemTypes/            one renderer per item type
    strings.ts            SVG layer, one <path> per link
    rope.ts               verlet rope sim (pure, testable)
    mood.ts               overlay layers + flicker scheduler
  ui/
    toolbar.ts            add / connect / undo / redo / zoom / settings
    sheet.ts              properties panel (bottom sheet on coarse pointers)
    settings.ts           prefs dialog
    a11y.ts               live region, list view (phase 4)
  styles/                 base.css, boards/*.css, moods/*.css
public/textures/, public/objects/, public/audio/
```

**Data model**
```ts
type Board = { id: string; name: string; surface: SurfaceId; mood: MoodId;
  items: Item[]; links: Link[]; version: 1; updatedAt: number };
type Item = { id: string; type: ItemType; x: number; y: number; w: number;
  rot: number; z: number; attach: FastenerId; attachColor: string;
  data: { imageId?: string; text?: string; caption?: string; uv?: string;
          aged?: boolean; crossed?: boolean; [k: string]: unknown } };
type Link = { id: string; from: string; to: string; color: string;
  tension: number; style?: LineStyle; label?: string };
```
Board world is a fixed 4000×3000 coordinate space.

**Data flow:** UI/pointer event ⇒ `dispatch(action)` ⇒ reducer returns new board ⇒ store notifies ⇒ views diff and update DOM; autosave persists; history records (drag commits one entry on pointerup, not per frame). During a drag the item's transform and its links' rope endpoints update per animation frame directly, committing to the store on release.

**Rendering:** items are absolutely positioned DOM nodes with `transform: translate3d() rotate()` inside a world container scaled by one CSS transform. Strings are one SVG layer above items (strings drape over photos, pins on top of strings). A single `requestAnimationFrame` loop runs rope physics only while any rope is awake.

## 4. Responsive & interaction

- App shell `100dvh` (fallback `100vh`), `viewport-fit=cover`, safe-area padding.
- Pointer Events only; `setPointerCapture`; always handle `pointercancel`.
- One finger/mouse on empty board = pan; on item = drag; two pointers = pinch-zoom around midpoint; ctrl/trackpad-pinch wheel = zoom; plain wheel = pan. Scale clamp 0.2–3. Pan clamped to keep board visible. "Fit" button.
- `touch-action: none` on board only; `overscroll-behavior: none` on root; long-press = item menu; `user-scalable` not disabled.
- Hit targets ≥ 44 px on coarse pointers; pins/ends get enlarged invisible hit areas, constant on-screen size regardless of zoom.
- `@media (pointer: coarse)` or narrow width ⇒ bottom toolbar + bottom-sheet properties; otherwise floating top/side toolbar.
- Keyboard: Tab through items; arrows move (Shift = ×10); Delete; Ctrl+Z/Y; +/− zoom; `C` start connect then pick target with Tab/Enter; Esc cancels.
- Connect on touch: tap "Connect" tool, tap item A, tap item B.

## 5. Safety & accessibility of effects

- Flicker is a slow, low-contrast dim, never > 3 flashes/sec, never saturated red flashes; occasional (random interval 8–40 s).
- `prefers-reduced-motion: reduce` ⇒ flicker, rope wobble, rain, grain animation off. In-app "Atmosphere: full / gentle / off" (default gentle) and per-effect toggles, saved in prefs.
- Focus ring: yellow grease-pencil dashed outline, identical in every mood, never tinted by overlays.
- UI chrome text contrast ≥ 4.5:1; overlays never cover chrome.
- Lighting floor: no board area darker than ~35% lightness; the selected/focused item is always lit (lamp pool eases toward it); grain/blinds ≤ 6% opacity over item text. "Gentle" also stops venetian-blind sweep.
- Distressed/marker fonts never used for body text, inputs, or < 18 px.

## 6. Error handling

- Invalid/unsupported image (e.g. HEIC not decodable): toast "Couldn't read that image", nothing added.
- Import failure: specific message (not JSON / wrong format / newer version / corrupted asset); current board untouched.
- Storage quota error on save: toast + suggest export; in-memory state kept.
- IndexedDB unavailable (private mode quirks): app runs in-memory with a banner.

## 7. Testing

- **Vitest** unit tests for risky logic: reducers, history, rope sim, viewport maths (screen⇄world, clamp, pinch), transfer validation/id remap.
- Browser check of each phase in Chrome (desktop + mobile emulation) before calling it done; real-iPhone check recommended in phase 5.
- No snapshot/UI test suite (YAGNI for a fun project).

## 8. Deployment

Vite `base: './'` (works under any repo path). GitHub Actions: build ⇒ `actions/upload-pages-artifact` ⇒ `actions/deploy-pages`. PWA (`vite-plugin-pwa`, prompt-to-update) in phase 5.

## 9. Phases

| # | Deliverable |
|---|---|
| 1 | Core: cork board, Noir Office lighting (lamp + flicker + settings), viewport, photo/polaroid/sticky/index items, pins, drag-from-pin strings with rope + tension gesture/slider + colour, drag, undo/redo, autosave, folder-tab multi-board, JSON import/export, in-world desk chrome (responsive), fonts, SFX, micro-interactions, demo case, keyboard basics, GH Pages deploy |
| 2 | 5 surfaces + fasteners + line styles; 5 mood presets; grain/blinds/rain/neon/dust; ambient sound + own music |
| 3 | Template generators, sketch pad (perfect-freehand), stamps (incl. red-X crossout, CASE CLOSED archives board), small objects, string labels, aged look |
| 4 | Torch with UV toggle, focus (1 hop), pull-the-thread, PNG export, screen-reader list view |
| 5 | PWA/offline, perf pass (100 items on mid phone), real-device fixes, polish |

Phases 2 and 3 are largely independent and may run concurrently after phase 1.

## 10. Execution model

- Spec and per-phase plans written by Opus 5.5; phase-end reviews by Opus.
- Implementation tasks executed by Sonnet 5.5 subagents; purely mechanical tasks (config, CI workflow, asset wiring) by Haiku 5.5.
- Independent tasks within a phase run in parallel.
