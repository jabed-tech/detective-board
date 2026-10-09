# Task 18: Copy / paste / duplicate (Sonnet) — added mid-phase at user request

Read `00-overview.md` Global Constraints. Depends on Tasks 1–17 (committed). Read each file before changing it.

User ask (2026-10-09): "a native copy paste button".

**Files:** `src/clipboard.ts` (new), `src/clipboard.test.ts` (new), `src/ui/desk.ts`, `src/ui/keys.ts`, `src/styles/chrome.css`, `src/main.ts`

## Behaviour
- **Copy** (desk button "Copy" with a carbon-paper/`obj-carbon` CSS icon, and Ctrl/⌘+C when an item is selected and focus is not in an input): copy the selected item.
  - Internal clipboard: keep `{ item, blob? }` in memory (blob = the item's image blob, if any).
  - System clipboard: `navigator.clipboard.writeText(JSON.stringify({ format: 'detective-board-item', version: 1, item }))` — text only (no image bytes); ignore failures silently.
  - Toast: `Copied.` (no body). Announce for screen readers too.
- **Paste** (desk button "Paste" with `obj-paste` icon, and Ctrl/⌘+V via the document `paste` event — never call `navigator.clipboard.read()` for keyboard paste):
  1. If `ClipboardEvent.clipboardData` (keyboard) or `navigator.clipboard.read()` (button) contains an **image** (`image/*`) → treat as an upload: `processImage(blob)` → new `photo` item at the viewport centre (same code path as Add → Photograph; factor a helper in main.ts if needed).
  2. Else if text parses as `detective-board-item` v1 and passes validation (reuse transfer.ts `validateBoard` by wrapping: `validateBoard({ items: [item], links: [] })?.items[0]`) → duplicate: new id, position +40/+40 world px (clamped), z on top. If the internal clipboard holds the same item id with a blob, store a copy of that blob under a new image id; if there is no blob available (e.g. pasted in another tab), drop `imageId` (polaroid shows silhouette / photo shows "Photo missing").
  3. Else if plain text (trimmed, non-empty) → new sticky note with that text (max 5000 chars).
  4. Else toast `Nothing to paste.` / `Copy an item, an image or some text first.`
  - Paste button when `navigator.clipboard.read` is missing or throws (Firefox/Safari/permission denied) → fall back to the internal clipboard if it has an item; otherwise toast `The browser kept the clipboard locked.` / `Press Ctrl+V (⌘+V on Mac) to paste instead.`
  - Never paste while focus is in an input/textarea (let the browser paste text normally).
- **Duplicate:** Ctrl/⌘+D = copy + paste in one step (preventDefault the browser bookmark shortcut).
- Each paste is one undo step; new item becomes selected; `sfx.thunk()`.

## clipboard.ts (pure, testable)
```ts
export const ITEM_FORMAT = 'detective-board-item';
export function serializeItem(item: Item): string;
export function parseClipboardText(text: string): { kind: 'item'; item: Item } | { kind: 'text'; text: string } | { kind: 'empty' };
export function offsetCopy(item: Item, dx?: number, dy?: number): Item; // new id, +40/+40 default, data copied (imageId kept — caller decides)
```
Tests: serialize→parse round trip yields kind 'item' with same fields; hostile JSON (`attachColor: 'red;x'`, unknown type) is sanitised/rejected (falls to kind 'text' only if it isn't our format; our format with a bad item → 'empty'); plain text → 'text'; whitespace → 'empty'; `offsetCopy` changes id and position only.

## Verify
`npm test` all pass, `npx tsc --noEmit` clean, `npm run build` OK. Report `.superpowers/sdd/phase-1/task-18-report.md`.
