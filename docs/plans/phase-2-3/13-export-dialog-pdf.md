# Task 13: Export dialog — PNG / JPEG / WebP / PDF, whole board / view / item (Sonnet) — wave E

User request 2026-10-10: an export button to image formats and PDF, for the whole board or single elements. Read `00-overview.md`. Depends on T1–T12 (all committed). Runs alone.

**Files:**
- Create: `src/export/pdf.ts`, `src/export/pdf.test.ts`, `src/export/save.ts`, `src/export/save.test.ts`, `src/ui/exportdialog.ts`
- Modify: `index.html` (`<dialog id="exporter" class="exporter" aria-label="Export a picture"></dialog>`), `src/ui/desk.ts`, `src/ui/drawer.ts`, `src/ui/keys.ts`, `src/main.ts`, `src/styles/chrome.css`

**Interfaces:**
- Consumes: `composeBoard`, `regionFor`, `fitScale`, `Scope` (T11); `Selection` (drawer).
- Produces:
```ts
// pdf.ts (pure)
export type PageSize = 'fit' | 'a4';
export function jpegToPdf(jpeg: Uint8Array, wPx: number, hPx: number, page: PageSize): Uint8Array;
// save.ts
export type Format = 'png' | 'jpeg' | 'webp' | 'pdf';
export function exportName(caseNo: number, caseName: string, scope: Scope['kind'], itemType: string | undefined, f: Format): string;
export async function canvasToFile(c: HTMLCanvasElement, f: Format, page: PageSize, name: string): Promise<{ file: File; fellBack: boolean }>;
// ui/exportdialog.ts
export interface ExportRequest { scope: Scope; format: Format; scale: number; mood: boolean; strings: boolean; background: boolean; page: PageSize; action: 'download' | 'share' | 'copy' }
export function openExportDialog(dialog: HTMLDialogElement, init: { hasSelection: boolean; scope?: Scope['kind']; canShare: boolean; canCopy: boolean; describe(r: ExportRequest): string }): Promise<ExportRequest | null>;
```

- [ ] **Step 1: Failing tests** — `pdf.test.ts`

Use a fake JPEG `new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9])`. Decode the output with `new TextDecoder('latin1')`:
1. starts with `%PDF-1.4`, ends with `%%EOF\n`, contains `/Filter /DCTDecode`, `/Width 800`, `/Height 600`, and the 7 JPEG bytes verbatim.
2. `fit`: `/MediaBox [0 0 600 450]` for 800×600 px (px × 0.75 pt).
3. `a4`: landscape for 800×600 → `/MediaBox [0 0 842 595]`; portrait for 600×800 → `[0 0 595 842]`; image fitted inside 36pt margins, centred (check the `cm` operands in the content stream: scale ≤ 770×523, offsets ≥ 36).
4. xref: parse `startxref` → offset points at `xref`; each of the 5 object offsets in the table points at `N 0 obj`.
Run — FAIL. Implement: objects 1 Catalog, 2 Pages, 3 Page (`/Resources << /XObject << /Im0 4 0 R >> >>`, `/Contents 5 0 R`), 4 image XObject (`/Type /XObject /Subtype /Image /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length n`), 5 content `q W 0 0 H X Y cm /Im0 Do Q`; build as byte chunks tracking offsets; `trailer << /Size 6 /Root 1 0 R >>`. Run — PASS.

- [ ] **Step 2: Failing tests** — `save.test.ts`
- `exportName(7, 'The Missing Stapler!', 'board', undefined, 'png')` → `case-0007-the-missing-stapler.png`; `('item', 'receipt', 'pdf')` → `case-0007-the-missing-stapler-receipt.pdf`; `view` → `…-view.jpg` for `jpeg`.
- (jsdom) `canvasToFile` with a stub canvas whose `toBlob(cb, type)` returns a blob of `type` except for `image/webp`, where it returns `image/png` (as old Safari does) → `fellBack: true` and the file is `.png`.
Run — FAIL; implement (`jpeg`/`pdf` → draw onto a white-filled copy first so transparency doesn't turn black; quality .92; `pdf` → `jpegToPdf` with the JPEG bytes, `application/pdf`); run — PASS.

- [ ] **Step 3: Dialog** — `ui/exportdialog.ts`, `chrome.css`

Static text only. Heading "Develop a print" (Special Elite) + plain line "Save a picture of this case. Nothing is uploaded." Controls (all ≥ 44px):
- **What**: radio "Whole board" / "What's on screen" / "Selected item" (disabled with hint "Select an item first" when `!hasSelection`; preselected when `scope === 'item'`).
- **Format**: PNG (best quality) / JPEG (smaller) / WebP (smallest) / PDF (for printing).
- **Size**: Standard (1×) / Large (2×) / Print (3×). Below it a live line from `describe(req)` such as "4000 × 3000 px · capped to fit this browser" (main computes with `regionFor` + `fitScale`).
- **Options**: "Mood lighting" (on), "Strings" (on), "Board background" (on; only shown for Selected item — off gives a transparent PNG; JPEG/PDF fill white).
- **PDF page** (only for PDF): "Same size as the picture" / "A4 page".
- Buttons: "Download" (primary), "Share…" (only if `canShare`), "Copy picture" (only if `canCopy`; copies PNG), "Cancel". Resolve the request or `null`.

- [ ] **Step 4: Wiring** — `main.ts`, `desk.ts`, `drawer.ts`, `keys.ts`
- Desk: new button `deskBtn('camera', 'Export', 'Export a picture or PDF', deps.openExport)` after "Case" (add a small camera `.obj-camera` icon in `chrome.css` drawn like the other desk objects).
- Drawer item panel: "Export this item…" button → `deps.exportItem(it.id)` (opens with `scope: 'item'`). Board panel: "Export a picture…" next to "Export case file".
- Keys: `Ctrl/⌘+Shift+E` opens the dialog (not inside inputs).
- `main.ts runExport(req)`: `view` scope rect = `viewport.toWorld` of the viewport's corners; toast "Developing…" while composing; `composeBoard(store.get(), { ...req, scale: fitScale(region, req.scale), getBlob: db.getBlob })` → `null` ⇒ toast `"Nothing to print."`; `canvasToFile` (`fellBack` ⇒ toast `"WebP isn't supported here."` / `"Saved as PNG instead."`). Actions: download via `<a download>` + object URL (revoked after 1 s); share via `navigator.share({ files: [file], title: board.name })` (AbortError ignored); copy via `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])` → toast `"Copied to the clipboard."`. Any thrown error ⇒ toast `"The print didn't develop."` / `"Try a smaller size or another format."`.
- `canShare = !!navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] })`; `canCopy = 'ClipboardItem' in window && !!navigator.clipboard?.write`.

- [ ] **Step 5: Verify** — `npm test`, `npx tsc --noEmit`, `npm run build`. Report `.superpowers/sdd/phase-2-3/task-13-report.md`.
