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
    const s = sel;
    const gone = (s.kind === 'item' && !b.items.some(i => i.id === s.id)) || (s.kind === 'link' && !b.links.some(l => l.id === s.id));
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
