# Task 13: Demo case, keyboard, main wiring (Sonnet)

Read `00-overview.md` Global Constraints. Depends on Tasks 1–12.

**Files:**
- Create: `src/demo.ts`, `src/ui/keys.ts`
- Replace: `src/main.ts`
- Test: `src/demo.test.ts`
- Delete: `src/smoke.test.ts`

- [ ] **Step 1: Failing test** — `src/demo.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createDemoBoard } from './demo';
import { validateBoard } from './storage/transfer';

describe('demo case', () => {
  it('is a valid board with items and strings', () => {
    const b = createDemoBoard();
    expect(b.name).toBe('The Case of the Missing Stapler');
    expect(b.items.length).toBeGreaterThanOrEqual(6);
    expect(b.links).toHaveLength(4);
    const v = validateBoard(JSON.parse(JSON.stringify(b)))!;
    expect(v.items).toHaveLength(b.items.length);
    expect(v.links).toHaveLength(4);
  });
  it('teaches the gestures', () => {
    const text = createDemoBoard().items.map(i => i.data.text ?? '').join(' ').toLowerCase();
    expect(text).toContain('drag');
    expect(text).toContain('pin');
    expect(text).toContain('zoom');
  });
});
```

Run → FAIL.

- [ ] **Step 2: demo.ts**

```ts
import { YARN_COLORS, type Board, type ItemData, type ItemType } from './model/types';
import { addItem, connect, makeItem, newBoard } from './model/actions';

export function createDemoBoard(): Board {
  let b = newBoard('The Case of the Missing Stapler', 1);
  const mk = (type: ItemType, x: number, y: number, data: ItemData, rot: number) => ({ ...makeItem(type, x, y, data), rot });
  const title = mk('index', 2000, 1050, { text: 'CASE #0001 — The Missing Stapler\nRed Swingline. Last seen Tuesday, 4:52 pm.' }, -2);
  const suspect = mk('polaroid', 1560, 1420, { caption: 'Gary, Accounts' }, -4);
  const witness = mk('index', 2470, 1450, { text: 'Witness: Linda (Reception)\n"Heard stapling after hours."' }, 3);
  const tip1 = mk('sticky', 1300, 1850, { text: 'Drag me around!' }, 3);
  const tip2 = mk('sticky', 2000, 1900, { text: 'Pull string from my pin, drop it on another note.' }, -3);
  const tip3 = mk('sticky', 2700, 1850, { text: "Pinch or Ctrl+scroll to zoom. Drag a string's middle to make it droop." }, 2);
  for (const it of [title, suspect, witness, tip1, tip2, tip3]) b = addItem(b, it);
  b = connect(b, title.id, suspect.id, { color: YARN_COLORS[0], tension: 0.5 });
  b = connect(b, title.id, witness.id, { color: YARN_COLORS[0], tension: 0.4 });
  b = connect(b, suspect.id, witness.id, { color: YARN_COLORS[1], tension: 0.7 });
  b = connect(b, suspect.id, tip1.id, { color: YARN_COLORS[3], tension: 0.6 });
  return b;
}
```

Run → PASS. Delete `src/smoke.test.ts`.

- [ ] **Step 3: keys.ts**

```ts
import { updateItem } from '../model/actions';
import type { Store } from '../model/store';
import type { Viewport } from '../view/viewport';
import type { ConnectTool } from '../view/connect';
import type { Selection } from './drawer';

export interface KeyDeps {
  store: Store;
  viewport: Pick<Viewport, 'zoomBy' | 'fit'>;
  connect: ConnectTool;
  selection(): Selection;
  select(s: Selection): void;
  deleteSelected(): void;
}

export function bindKeys(d: KeyDeps): void {
  document.addEventListener('keydown', e => {
    const t = e.target as Element;
    if (t.closest('input, textarea, select, dialog, [role=menu]')) return;
    const k = e.key;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && k.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); d.store.undo(); return; }
    if (mod && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); d.store.redo(); return; }
    if (mod || e.altKey) return;
    const sel = d.selection();
    switch (k) {
      case '+': case '=': d.viewport.zoomBy(1.25); break;
      case '-': d.viewport.zoomBy(0.8); break;
      case '0': d.viewport.fit(); break;
      case 'Escape':
        if (d.connect.pending()) d.connect.cancel(); else d.select({ kind: 'none' });
        break;
      case 'Delete': case 'Backspace':
        if (sel.kind === 'item' || sel.kind === 'link') { e.preventDefault(); d.deleteSelected(); }
        break;
      case 'c': case 'C':
        if (sel.kind === 'item') d.connect.begin(sel.id);
        break;
      case 'Enter':
        if (sel.kind === 'item' && d.connect.pending() && d.connect.pending() !== sel.id) { e.preventDefault(); d.connect.complete(sel.id); }
        break;
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': {
        if (sel.kind !== 'item') break;
        e.preventDefault();
        const it = d.store.get().items.find(i => i.id === sel.id);
        if (!it) break;
        const step = e.shiftKey ? 50 : 10;
        const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0;
        const dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
        d.store.commit(updateItem(d.store.get(), it.id, { x: it.x + dx, y: it.y + dy }));
        break;
      }
    }
  });
}
```

- [ ] **Step 4: main.ts**

```ts
import './styles/fonts';
import './styles/base.css';
import './styles/board.css';
import './styles/items.css';
import './styles/strings.css';
import './styles/mood.css';
import './styles/chrome.css';

import { YARN_COLORS, type Board, type Item, type ItemType } from './model/types';
import { createStore } from './model/store';
import { addItem, makeItem, newBoard, newId, removeItem, removeLink, updateLink } from './model/actions';
import { clearPrefs, loadPrefs, savePrefs, type Prefs } from './prefs';
import { openDb, type BoardMeta } from './storage/db';
import { createAutosave } from './storage/autosave';
import { exportBoard, IMPORT_MESSAGES, parseImport } from './storage/transfer';
import { ImageReadError, processImage } from './images/process';
import { imageUrl, revokeAllImageUrls } from './images/urls';
import { createViewport } from './view/viewport';
import { createStrings } from './view/strings';
import { createItems } from './view/items';
import { createConnect } from './view/connect';
import { createMood } from './view/mood';
import { createSfx } from './audio/sfx';
import { createDesk } from './ui/desk';
import { createDrawer, type Selection } from './ui/drawer';
import { createTabs } from './ui/tabs';
import { createSettings } from './ui/settings';
import { toast } from './ui/toast';
import { confirmDialog } from './ui/confirm';
import { showMemo } from './ui/memo';
import { bindKeys } from './ui/keys';
import { createDemoBoard } from './demo';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const DAY = 86_400_000;

function pickFile(accept: string): Promise<File | null> {
  return new Promise(resolve => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'case';

async function boot() {
  let prefs = loadPrefs();
  const db = await openDb();
  let metas: BoardMeta[] = await db.listBoards();
  let board: Board | undefined;
  if (prefs.lastBoardId) board = await db.loadBoard(prefs.lastBoardId);
  if (!board && metas[0]) board = await db.loadBoard(metas[0].id);
  if (!board) { board = createDemoBoard(); await db.saveBoard(board); metas = await db.listBoards(); }

  const store = createStore(board);
  const sfx = createSfx({ enabled: prefs.sfx, volume: prefs.volume });
  const viewport = createViewport($('viewport'), $('world'));
  const mood = createMood($('mood'), prefs.atmosphere);
  const live = $('sr-live');
  const announce = (msg: string) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); };
  let sel: Selection = { kind: 'none' };
  let yarn: string = YARN_COLORS[0];

  function setPrefs(patch: Partial<Prefs>) {
    prefs = { ...prefs, ...patch };
    savePrefs(prefs);
    document.documentElement.classList.toggle('neat-hand', prefs.neatHand);
    sfx.setEnabled(prefs.sfx);
    sfx.setVolume(prefs.volume);
    if (patch.atmosphere) mood.setAtmosphere(patch.atmosphere);
    refreshDesk();
  }

  const storageError = () => toast('The evidence locker is full.', 'Your browser refused to save. Export this case to keep it safe.');
  const autosave = createAutosave(b => db.saveBoard(b), storageError);

  const strings = createStrings($('strings') as unknown as SVGSVGElement, {
    reducedMotion,
    scale: () => viewport.get().scale,
    onSelect: id => select({ kind: 'link', id }),
    onTensionCommit: (id, tension) => store.commit(updateLink(store.get(), id, { tension })),
  });
  const items = createItems($('items'), $('pins'), {
    store, viewport, strings, sfx, reducedMotion,
    getImageUrl: id => imageUrl(id, db.getBlob),
    onSelect: id => select({ kind: 'item', id }),
    onItemTap: id => connect.tap(id),
    onPinPointerDown: (id, e) => connect.pinDrag(id, e),
  });
  const connect = createConnect({
    store, viewport, strings, items, sfx,
    color: () => yarn,
    tension: () => prefs.defaultTension,
    announce,
    onModeChange: on => { if (on) toast('String mode.', 'Tap one item, then another, to string them together.'); refreshDesk(); },
    select: id => select({ kind: 'item', id }),
  });
  const drawer = createDrawer($('drawer'), {
    store,
    selection: () => sel,
    close: () => select({ kind: 'none' }),
    exportBoard: () => void doExport(),
    importBoard: f => void doImport(f),
    clearBoard: () => void clearBoard(),
    deleteCase: () => void deleteCase(),
    setYarn: c => { yarn = c; refreshDesk(); },
  });
  const tabs = createTabs($('tabs'), {
    list: () => metas,
    current: () => store.get().id,
    open: id => void openBoard(id),
    create: () => void newCase(),
  });
  const settings = createSettings($('settings') as HTMLDialogElement, {
    prefs: () => prefs,
    setPrefs,
    burnAll: () => void burnAll(),
  });
  const desk = createDesk($('desk'), {
    addItem: t => void addNew(t),
    toggleConnect: () => connect.setMode(!connect.mode()),
    fit: () => viewport.fit(),
    zoom: f => viewport.zoomBy(f),
    undo: () => store.undo(),
    redo: () => store.redo(),
    toggleMute: () => setPrefs({ sfx: !prefs.sfx }),
    openCaseFile: () => select({ kind: 'board' }),
    openSettings: () => settings.open(),
  });
  function refreshDesk() {
    desk.update({ canUndo: store.canUndo(), canRedo: store.canRedo(), connecting: connect.mode(), yarn, muted: !prefs.sfx });
  }

  function updateLight() {
    if (sel.kind !== 'item') { mood.setLightTarget(null); return; }
    const id = sel.id;
    const it = store.get().items.find(i => i.id === id);
    if (!it) { mood.setLightTarget(null); return; }
    const p = viewport.toScreen(it.x + it.w / 2, it.y + it.h / 2);
    const r = viewport.el.getBoundingClientRect();
    mood.setLightTarget((p.x / r.width) * 100, (p.y / r.height) * 100);
  }

  function select(s: Selection) {
    sel = s;
    items.select(s.kind === 'item' ? s.id : null);
    strings.setSelected(s.kind === 'link' ? s.id : null);
    drawer.render(true);
    updateLight();
  }

  store.subscribe((b, reason) => {
    strings.sync(b, reason === 'load');
    items.sync(b);
    const gone = (sel.kind === 'item' && !b.items.some(i => i.id === sel.id)) || (sel.kind === 'link' && !b.links.some(l => l.id === sel.id));
    if (gone) select({ kind: 'none' }); else drawer.render();
    metas = metas.map(m => (m.id === b.id ? { ...m, name: b.name } : m));
    tabs.render();
    refreshDesk();
    if (reason !== 'load') autosave.schedule(b);
  });

  viewport.onChange(updateLight);
  viewport.onTap(() => { if (connect.pending()) connect.cancel(); select({ kind: 'none' }); });

  $('lamp-chain').addEventListener('click', () => {
    const next = prefs.atmosphere === 'full' ? 'gentle' : prefs.atmosphere === 'gentle' ? 'off' : 'full';
    setPrefs({ atmosphere: next });
    sfx.pluck();
    toast(`Atmosphere: ${next}.`);
  });

  async function addNew(type: ItemType) {
    const c = viewport.centerWorld();
    let it: Item;
    if (type === 'photo' || type === 'polaroid') {
      const file = await pickFile('image/*');
      if (!file) return;
      try {
        const img = await processImage(file);
        const imageId = newId();
        await db.putBlob(imageId, img.blob);
        const size = type === 'photo' ? { w: 260, h: Math.round((260 * img.h) / img.w) + 16 } : undefined;
        it = makeItem(type, c.x, c.y, { imageId }, size);
      } catch (e) {
        if (e instanceof ImageReadError) toast("Photo won't develop.", "That file type isn't supported (HEIC?). Try a JPG or PNG.");
        else storageError();
        return;
      }
    } else {
      it = makeItem(type, c.x, c.y, { text: type === 'sticky' ? 'New lead…' : 'Notes:' });
    }
    items.markFresh(it.id);
    store.commit(addItem(store.get(), it));
    sfx.thunk();
    select({ kind: 'item', id: it.id });
  }

  function deleteSelected() {
    const b = store.get();
    if (sel.kind === 'item') store.commit(removeItem(b, sel.id));
    else if (sel.kind === 'link') store.commit(removeLink(b, sel.id));
    sfx.rustle();
  }

  const nextCaseNo = () => metas.reduce((m, x) => Math.max(m, x.caseNo), 0) + 1;

  async function openBoard(id: string) {
    if (id === store.get().id) return;
    await autosave.flush();
    const b = await db.loadBoard(id);
    if (!b) return;
    connect.setMode(false);
    revokeAllImageUrls();
    select({ kind: 'none' });
    store.load(b);
    setPrefs({ lastBoardId: id });
    viewport.fit();
  }

  async function newCase() {
    await autosave.flush();
    const b = newBoard('Untitled case', nextCaseNo());
    try { await db.saveBoard(b); } catch { storageError(); return; }
    metas = await db.listBoards();
    await openBoard(b.id);
    select({ kind: 'board' });
  }

  async function doExport() {
    const b = store.get();
    const blob = await exportBoard(b, db.getBlob);
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `case-${String(b.caseNo).padStart(4, '0')}-${slug(b.name)}.json`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setPrefs({ lastExportAt: Date.now() });
    toast('Filed with the Chief.', 'Case exported as a .json file.');
  }

  async function doImport(file: File) {
    const res = parseImport(await file.text());
    if (!res.ok) { const [t, body] = IMPORT_MESSAGES[res.error]; toast(t, body); return; }
    try {
      for (const [id, blob] of Object.entries(res.assets)) await db.putBlob(id, blob);
      const b = { ...res.board, caseNo: nextCaseNo() };
      await db.saveBoard(b);
      metas = await db.listBoards();
      await openBoard(b.id);
      toast('Case file received.', `Opened “${b.name}”.`);
    } catch {
      storageError();
    }
  }

  async function clearBoard() {
    if (!(await confirmDialog('Clear the board?', 'Remove every item and string from this case. You can undo this.', 'Clear the board'))) return;
    store.commit({ ...store.get(), items: [], links: [] });
  }

  async function deleteCase() {
    const b = store.get();
    if (!(await confirmDialog('Burn this case?', `Delete “${b.name}” and its photos from this device? This cannot be undone.`, 'Delete case'))) return;
    await db.deleteBoard(b.id);
    metas = await db.listBoards();
    if (!metas.length) {
      const fresh = newBoard('Untitled case', 1);
      await db.saveBoard(fresh);
      metas = await db.listBoards();
    }
    const target = await db.loadBoard(metas[0].id);
    if (!target) return;
    revokeAllImageUrls();
    select({ kind: 'none' });
    store.load(target);
    setPrefs({ lastBoardId: target.id });
    viewport.fit();
  }

  async function burnAll() {
    if (!(await confirmDialog('Burn the files?', 'Delete all cases, photos and settings from this device? This cannot be undone.', 'Delete everything'))) return;
    await db.clearAll();
    clearPrefs();
    location.reload();
  }

  bindKeys({ store, viewport, connect, selection: () => sel, select, deleteSelected });

  addEventListener('pagehide', () => void autosave.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void autosave.flush(); });

  // First paint
  setPrefs({ lastBoardId: board.id, ...(prefs.lastExportAt ? {} : { lastExportAt: Date.now() }) });
  strings.sync(board, true);
  items.sync(board);
  tabs.render();
  refreshDesk();
  viewport.fit();

  if (!db.persistent) toast('No evidence locker.', "This browser won't let us save. Your board lasts until you close the tab — export to keep it.");
  void navigator.storage?.persist?.().catch(() => {});
  navigator.storage?.estimate?.().then(e => {
    if (e.usage && e.quota && e.usage / e.quota > 0.8) toast('The evidence locker is nearly full.', 'Export or burn old cases to make room.');
  }).catch(() => {});
  const now = Date.now();
  if (now - prefs.lastExportAt > 7 * DAY && now - prefs.memoSnoozedAt > 3 * DAY) {
    showMemo(() => void doExport(), () => setPrefs({ memoSnoozedAt: Date.now() }));
  }
}

void boot();
```

Note: `connect` and `select` are referenced inside closures before their `const`/function declarations run; that is fine because those closures only execute after `boot` finishes wiring. Do not call them synchronously during construction.

- [ ] **Step 5: Verify**

Run: `npm test` → all PASS. Run: `npm run build` → success. Run `npm run dev`, open the printed URL, and check by hand:
1. Demo case appears with 6 items and 4 sagging strings under a warm lamp.
2. Drag an item: strings follow and wobble; release gives a thunk and settle bounce.
3. Drag from a pin to another item: new string drops in with a pluck.
4. Ctrl+Z / Ctrl+Y undo and redo the drag.
5. Reload: everything is still there.

Report anything that fails, with console errors.

- [ ] **Step 6: Commit** (controller) — `feat: wire app, demo case, keyboard shortcuts`
