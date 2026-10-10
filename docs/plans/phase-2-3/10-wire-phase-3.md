# Task 10: Wire phase 3 — Add menu, item panels, sketch, archive (Sonnet) — wave D

Read `00-overview.md`. Depends on T1–T9 (all committed). Read each file before editing. Runs alone (shared hot files).

**Files:**
- Create: `src/ui/tabs.test.ts` (jsdom)
- Modify: `src/ui/desk.ts`, `src/main.ts`, `src/ui/drawer.ts`, `src/ui/tabs.ts`, `src/storage/db.ts`, `src/storage/db.test.ts`, `src/view/items.ts`, `src/view/renderers.ts` (dedupe money helpers only), `src/styles/chrome.css`

**Interfaces:**
- Consumes: generators + `newSeed` (T6), renderers (T7), `openSketchPad` (T8), `STAMPS`, `OBJECTS`, `ITEM_SIZES` (T1), `pickFastener` (T2), `withFit`/`fitHeight` (phase-1 Task 21), `pickPhoto` (main).
- Produces: `export type AddChoice = ItemType | 'unknown' | \`stamp:${StampId}\` | \`object:${ObjectId}\``; `DeskDeps.addItem(c: AddChoice)`; `BoardMeta.closed?: boolean`.

- [ ] **Step 1: Failing tests**
- `db.test.ts`: a saved board with `closed: true` lists with `closed: true`; without it, the meta has no `closed` key (or `false`).
- `tabs.test.ts`: render with metas `[open A (current), open B, closed C, closed D]` → buttons for A and B, an "Archive (2)" toggle with `aria-expanded="false"`, and no C/D tabs; click the toggle → C and D tabs appear with class `tab-closed`; when C is current it is always shown even with the archive collapsed.
Run — FAIL. Implement `meta()` carrying `closed` and the tabs change (below). Run — PASS.

- [ ] **Step 2: Add menu** — `desk.ts`, `chrome.css`

Replace the flat `choices` with labelled groups (`<div role="group" aria-label="…">` + a visible small-caps heading), all items still `role="menuitem"` and in one arrow-key cycle:
- Evidence: Photograph, Polaroid, Unknown person, Sticky note, Index card
- Paperwork: Mugshot, Newspaper clipping, Receipt, Case file
- Draw: Sketch…
- Stamps: one per `STAMPS` (`stamp:<id>`, label = STAMPS label, "?" shown as "Question mark")
- Objects: one per `OBJECTS` (`object:<id>`)
Menu: `max-height: min(70vh, 560px); overflow-y: auto`; on ≥ 640px lay groups out in 2 columns. Typing a letter jumps to the next item starting with it (simple typeahead).

- [ ] **Step 3: Creating items** — `main.ts` `addNew(c: AddChoice)`

All use `attach: pickFastener(surface, prefs.lastFastener)` and `tilt: prefs.tiltNew`. Seeds via `newSeed()`, `now = Date.now()`.
- `mugshot` → `{ seed, ...genMugshot(seed) }` (no photo prompt; "Add photo" is in the drawer).
- `newspaper` / `receipt` / `casefile` → `{ seed, ...genX(seed, now) }`.
- `sketch` → `const s = await openSketchPad($('sketchpad'))`; `null` ⇒ return; `[]` ⇒ toast `"Blank page."` / `"Nothing was drawn, so nothing was pinned."`; else `{ strokes: s }`.
- `stamp:<id>` → type `stamp`, size from `STAMPS`, `{ stamp: id }`, rot random ±8° when tilt is on.
- `object:<id>` → type `object`, size from `OBJECTS`, `{ object: id }`.
- `renderers.ts`: replace its local money helpers with `formatMoney`/`receiptTotal` from `model/generators` (tests must still pass).

- [ ] **Step 4: Item panels** — `drawer.ts`

Keep the existing common controls (Held by, colour, Rotation, Size, Bring to front, Take it down). Text inputs use the debounced `patchData` (text edits on `text`/`caption` already grow the card via `withFit`). Per type:
- **mugshot**: Name (80), Booking no. (20), "Add photo"/"Replace photo" (`deps.pickPhoto`), "New random details" (keeps `imageId`, new seed ⇒ new name + booking no.).
- **newspaper**: Masthead (60), Date (40), Headline (140), Story (textarea → `text`), "New random story".
- **receipt**: Shop (60), Time (40), a lines editor — one row per line: name input (60) + price input (`type=number`, `min 0`, `step 0.01`, shown in pounds, stored as integer pence via `Math.round(v * 100)`) + "✕" remove button (aria-label "Remove <name>"); "Add line" (disabled at 40); a read-only "Total £x.xx"; "New random receipt". Each edit is one commit (debounced for typing).
- **casefile**: Subject (80), Officer (60), Status (40), Date (40), Notes (textarea → `text`), "New random file".
- **sketch**: "Edit sketch" → `openSketchPad(dialog, it.data.strokes)` → non-null ⇒ commit `strokes`.
- **stamp**: "Stamp" select (`STAMPS`). Hide the "Held by"/colour section for stamps.
- **object**: "Object" select (`OBJECTS`), "Tag" (caption, 200).
- **All types**: checkboxes "Aged look (yellowed, foxed paper)" → `aged`, "Cross it out (red X)" → `crossed` (set `undefined` when unchecked).
- **Text size row** (from Task 20) for: sticky, index, polaroid, mugshot, newspaper, receipt, casefile, object.
- "New random …" buttons: one commit via `updateItem(…, { data: { ...cur.data, seed, ...genX(seed, now) } })`, so Ctrl+Z restores the old text.

- [ ] **Step 5: Stamps have no fastener** — `items.ts`

`e.pin.hidden = it.type === 'stamp'` in `update()` (strings can still attach — the attach point is unchanged). Add `.pin[hidden] { display: none; }` if not already covered.

- [ ] **Step 6: CASE CLOSED archive** — `drawer.ts` board panel, `main.ts`, `tabs.ts`, `chrome.css`

- Board panel: if `!b.closed`, button "Close the case" → `deps.closeCase()`; else "Reopen the case" → `commit(b => ({ ...b, closed: undefined }))`.
- `main.ts` `closeCase()`: one commit that sets `closed: true` **and** adds a `stamp` item `case-closed` at the viewport centre, rot −8, on top; sfx thunk; toast `"Case closed."` / `"It's filed in the archive tab. Reopen it any time from the case file."`. Update `metas` so the tab moves.
- `tabs.ts`: open cases first; if any closed cases exist, an "Archive (n)" toggle button (`aria-expanded`, state kept in a module variable for the session) that reveals closed cases as `.tab.tab-closed` (sepia, small red "CLOSED" corner mark, still ≥ 44px tall). The current case is always shown even if closed and collapsed. "+ Open new case" stays last.

- [ ] **Step 7: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build`. Report `.superpowers/sdd/phase-2-3/task-10-report.md` (list each new control with file:line).
