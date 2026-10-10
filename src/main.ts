import './styles/fonts';
import './styles/base.css';
import './styles/board.css';
import './styles/items.css';
import './styles/strings.css';
import './styles/mood.css';
import './styles/chrome.css';

import { SURFACES, YARN_COLORS, type Board, type Item, type ItemType, type Mode } from './model/types';
import { createStore } from './model/store';
import { addItem, makeItem, newBoard, newId, removeItem, removeLink, updateItem, updateLink } from './model/actions';
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
import { applySurface } from './view/surface';
import { pickFastener, moodPatch } from './model/surfaces';
import { createSfx } from './audio/sfx';
import { createAmbience } from './audio/ambience';
import { createMusic } from './audio/music';
import { pickMood } from './ui/newcase';
import { createDesk } from './ui/desk';
import { createDrawer, type Selection } from './ui/drawer';
import { createTabs } from './ui/tabs';
import { createSettings } from './ui/settings';
import { toast } from './ui/toast';
import { confirmDialog } from './ui/confirm';
import { showMemo } from './ui/memo';
import { bindKeys } from './ui/keys';
import { createDemoBoard } from './demo';
import { toAnchor } from './model/geometry';
import { offsetCopy, parseClipboardText, serializeItem } from './clipboard';

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
  const ambience = createAmbience();
  const music = createMusic();
  const viewport = createViewport($('viewport'), $('world'));
  const mood = createMood($('mood'), prefs.atmosphere);
  const live = $('sr-live');
  const announce = (msg: string) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); };
  let sel: Selection = { kind: 'none' };
  let yarn: string = YARN_COLORS[0];
  let mode: Mode = 'move';

  function setPrefs(patch: Partial<Prefs>) {
    prefs = { ...prefs, ...patch };
    savePrefs(prefs);
    document.documentElement.classList.toggle('neat-hand', prefs.neatHand);
    sfx.setEnabled(prefs.sfx && !prefs.muted);
    sfx.setVolume(prefs.volume);
    ambience.setEnabled(prefs.ambience);
    ambience.setVolume(prefs.ambienceVolume);
    ambience.setMuted(prefs.muted);
    music.setVolume(prefs.ambienceVolume);
    music.setMuted(prefs.muted);
    music.setOn(prefs.musicOn);
    ambience.setMusicPlaying(music.playing());
    mood.setEffects(prefs.effects);
    if (patch.atmosphere) mood.setAtmosphere(patch.atmosphere);
    refreshDesk();
  }

  const storageError = () => toast('The evidence locker is full.', 'Your browser refused to save. Export this case to keep it safe.');
  const autosave = createAutosave(b => db.saveBoard(b), storageError);

  const strings = createStrings($('strings') as unknown as SVGSVGElement, $('string-hits') as unknown as SVGSVGElement, {
    reducedMotion,
    scale: () => viewport.get().scale,
    onSelect: id => select({ kind: 'link', id }),
    erasing: () => mode === 'erase',
    onErase: id => erase(b => removeLink(b, id)),
    onTensionCommit: (id, tension) => store.commit(updateLink(store.get(), id, { tension })),
  });
  const items = createItems($('items'), $('pins'), {
    store, viewport, strings, sfx, reducedMotion,
    getImageUrl: id => imageUrl(id, db.getBlob),
    onSelect: id => select({ kind: 'item', id }),
    onItemTap: id => connect.tap(id),
    mode: () => mode,
    onErase: id => erase(b => removeItem(b, id)),
    onStringPointerDown: (id, e) => {
      const it = store.get().items.find(i => i.id === id);
      const w = viewport.toWorld(e.clientX, e.clientY);
      const onPin = !!(e.target as Element).closest('.pin');
      connect.stringDrag(id, e, it && !onPin && prefs.freeAnchors ? toAnchor(it, w.x, w.y) : undefined);
    },
  });
  const connect = createConnect({
    store, viewport, strings, items, sfx,
    color: () => yarn,
    material: () => SURFACES[store.get().surface].material,
    thickness: () => prefs.lastThickness,
    tension: () => prefs.defaultTension,
    freeAnchors: () => prefs.freeAnchors,
    announce,
    onModeChange: () => {
      $('world').dataset.mode = mode;
      items.refreshHandles();
      if (mode === 'string') toast('String mode.', prefs.freeAnchors ? 'Drag from one item to another — the string sticks where you let go.' : 'Drag from one item to another to string them together.');
      if (mode === 'erase') toast('Erase mode.', 'Tap anything to take it down. Ctrl+Z puts it back.');
      refreshDesk();
    },
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
    pickPhoto: id => void pickPhoto(id),
    fitHeight: (id, data) => items.fitHeight(id, data),
    setYarn: c => { yarn = c; refreshDesk(); },
    setLastFastener: id => setPrefs({ lastFastener: id }),
    setLastThickness: v => setPrefs({ lastThickness: v }),
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
    chooseMusic,
    removeMusic,
  });
  const desk = createDesk($('desk'), {
    addItem: t => void addNew(t),
    setMode,
    fit: () => viewport.fit(),
    zoom: f => viewport.zoomBy(f),
    undo: () => store.undo(),
    redo: () => store.redo(),
    toggleMute: () => setPrefs({ muted: !prefs.muted }),
    openCaseFile: () => select({ kind: 'board' }),
    openSettings: () => settings.open(),
  });
  function setMode(m: Mode) {
    if (m === mode) return;
    mode = m;
    connect.setMode(m === 'string'); // also runs onModeChange
  }
  function erase(fn: (b: Board) => Board) {
    store.commit(fn(store.get()));
    sfx.rustle();
    announce('Removed.');
  }
  function refreshDesk() {
    desk.update({ canUndo: store.canUndo(), canRedo: store.canRedo(), mode, yarn, muted: prefs.muted });
  }

  let look: { surface: Board['surface']; mood: Board['mood'] } | null = null;
  function syncLook(b: Board) {
    if (look && look.surface === b.surface && look.mood === b.mood) return;
    look = { surface: b.surface, mood: b.mood };
    applySurface($('surface'), b.surface);
    mood.setMood(b.mood);
    ambience.setMood(b.mood);
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

  function renderDrawer(force = false) {
    const had = $('drawer').contains(document.activeElement);
    drawer.render(force);
    if (had && $('drawer').hidden) $('viewport').focus();
  }

  function select(s: Selection) {
    sel = s;
    items.select(s.kind === 'item' ? s.id : null);
    strings.setSelected(s.kind === 'link' ? s.id : null);
    renderDrawer(true);
    updateLight();
  }

  store.subscribe((b, reason) => {
    syncLook(b);
    strings.sync(b, reason === 'load');
    items.sync(b);
    const s = sel;
    const gone = (s.kind === 'item' && !b.items.some(i => i.id === s.id)) || (s.kind === 'link' && !b.links.some(l => l.id === s.id));
    if (gone) select({ kind: 'none' }); else renderDrawer(reason === 'undo' || reason === 'redo');
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

  // File picker → processed blob stored under a new id. Toasts and returns null on failure.
  async function uploadPhoto(): Promise<{ imageId: string; w: number; h: number } | null> {
    const file = await pickFile('image/*');
    return file ? storeImage(file) : null;
  }

  async function storeImage(file: Blob): Promise<{ imageId: string; w: number; h: number } | null> {
    try {
      const img = await processImage(file);
      const imageId = newId();
      await db.putBlob(imageId, img.blob);
      return { imageId, w: img.w, h: img.h };
    } catch (e) {
      if (e instanceof ImageReadError) toast("Photo won't develop.", "That file type isn't supported (HEIC?). Try a JPG or PNG.");
      else storageError();
      return null;
    }
  }

  async function pickPhoto(itemId: string) {
    const up = await uploadPhoto();
    if (!up) return;
    const cur = store.get().items.find(i => i.id === itemId);
    if (!cur) return;
    const { unknown: _unknown, ...data } = cur.data;
    items.markFresh(itemId);
    store.commit(updateItem(store.get(), itemId, { data: { ...data, imageId: up.imageId } }));
  }

  async function addNew(type: ItemType | 'unknown') {
    const c = viewport.centerWorld();
    const opts = { attach: pickFastener(store.get().surface, prefs.lastFastener), tilt: prefs.tiltNew };
    let it: Item;
    if (type === 'unknown') {
      it = makeItem('polaroid', c.x, c.y, { unknown: true, caption: 'Unknown suspect' }, undefined, Math.random, opts);
    } else if (type === 'photo' || type === 'polaroid') {
      const up = await uploadPhoto();
      if (!up) return;
      const size = type === 'photo' ? { w: 260, h: Math.round((260 * up.h) / up.w) + 16 } : undefined;
      it = makeItem(type, c.x, c.y, { imageId: up.imageId }, size, Math.random, opts);
    } else {
      it = makeItem(type, c.x, c.y, { text: type === 'sticky' ? 'New lead…' : 'Notes:' }, undefined, Math.random, opts);
    }
    place(it);
  }

  function place(it: Item) {
    items.markFresh(it.id);
    store.commit(addItem(store.get(), it));
    sfx.thunk();
    select({ kind: 'item', id: it.id });
  }

  // Copy / paste / duplicate
  let clip: { item: Item; blob?: Blob } | null = null;

  async function copySelected(): Promise<boolean> {
    const s = sel;
    const item = s.kind === 'item' ? store.get().items.find(i => i.id === s.id) : undefined;
    if (!item) { toast('Nothing to copy.', 'Select an item first.'); return false; }
    navigator.clipboard?.writeText(serializeItem(item)).catch(() => {}); // must run inside the gesture, before any await (Safari)
    const id = item.data.imageId;
    clip = { item, blob: id ? await db.getBlob(id) : undefined };
    toast('Copied.');
    announce('Copied.');
    return true;
  }

  async function pasteItem(src: Item, blob?: Blob) {
    const c = offsetCopy(src);
    const data = { ...c.data };
    if (data.imageId) {
      if (blob) {
        const imageId = newId();
        try { await db.putBlob(imageId, blob); } catch { storageError(); return; }
        data.imageId = imageId;
      } else delete data.imageId;
    }
    place({ ...c, data });
  }

  async function pasteImage(blob: Blob) {
    const up = await storeImage(blob);
    if (!up) return;
    const c = viewport.centerWorld();
    place(makeItem('photo', c.x, c.y, { imageId: up.imageId }, { w: 260, h: Math.round((260 * up.h) / up.w) + 16 }, Math.random, { attach: pickFastener(store.get().surface, prefs.lastFastener), tilt: prefs.tiltNew }));
  }

  async function pasteFrom(image: Blob | undefined, text: string) {
    if (image) return pasteImage(image);
    const p = parseClipboardText(text);
    if (p.kind === 'item') return pasteItem(p.item, clip?.item.id === p.item.id ? clip.blob : undefined);
    if (p.kind === 'text') {
      const c = viewport.centerWorld();
      return place(makeItem('sticky', c.x, c.y, { text: p.text.slice(0, 5000) }, undefined, Math.random, { attach: pickFastener(store.get().surface, prefs.lastFastener), tilt: prefs.tiltNew }));
    }
    toast('Nothing to paste.', 'Copy an item, an image or some text first.');
  }

  document.addEventListener('paste', e => {
    if (!prefs.clipboardKeys) return;
    if ((e.target as Element).closest('input, textarea, select, dialog, [contenteditable]')) return;
    e.preventDefault();
    const image = [...(e.clipboardData?.items ?? [])].find(i => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile() ?? undefined;
    void pasteFrom(image, e.clipboardData?.getData('text/plain') ?? '');
  });

  async function duplicateSelected() {
    if (await copySelected() && clip) await pasteItem(clip.item, clip.blob);
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
    setMode('move');
    revokeAllImageUrls();
    select({ kind: 'none' });
    store.load(b);
    setPrefs({ lastBoardId: id });
    viewport.fit();
  }

  async function newCase() {
    await autosave.flush();
    const m = await pickMood($('newcase') as HTMLDialogElement);
    if (!m) return;
    const b = { ...newBoard('Untitled case', nextCaseNo()), ...moodPatch(m) };
    try { await db.saveBoard(b); } catch { storageError(); return; }
    metas = await db.listBoards();
    await openBoard(b.id);
    select({ kind: 'board' });
  }

  async function chooseMusic() {
    const file = await pickFile('audio/*');
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) { toast("That tape's too long.", 'Pick a file under 60 MB.'); return; }
    if (!(await music.load(file))) { toast("That tape won't play.", 'Try an MP3, M4A or OGG file.'); return; }
    const musicId = 'music-' + newId();
    try { await db.putBlob(musicId, file); } catch { music.clear(); storageError(); return; }
    const old = prefs.musicId;
    if (old) await db.deleteBlob(old).catch(() => {});
    setPrefs({ musicId, musicName: file.name.slice(0, 80), musicOn: true });
  }

  async function removeMusic() {
    music.clear();
    const old = prefs.musicId;
    if (old) await db.deleteBlob(old).catch(() => {});
    setPrefs({ musicId: undefined, musicName: undefined, musicOn: false });
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

  bindKeys({ store, viewport, connect, setMode, clipboardKeys: () => prefs.clipboardKeys, selection: () => sel, select, deleteSelected, copy: () => void copySelected(), duplicate: () => void duplicateSelected(), fitHeight: (id, data) => items.fitHeight(id, data) });

  addEventListener('pagehide', () => void autosave.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void autosave.flush(); });

  const unlock = () => { ambience.unlock(); music.unlock(); setPrefs({}); };
  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  document.addEventListener('keydown', unlock, { once: true, capture: true });

  // First paint
  setPrefs({ lastBoardId: board.id, ...(prefs.lastExportAt ? {} : { lastExportAt: Date.now() }) });
  $('world').dataset.mode = mode;
  syncLook(board);
  strings.sync(board, true);
  items.sync(board);
  tabs.render();
  refreshDesk();
  viewport.fit();

  if (prefs.musicId) {
    const blob = await db.getBlob(prefs.musicId).catch(() => undefined);
    if (!blob || !(await music.load(blob))) {
      toast("The tape's gone missing.", 'Choose your track again in Settings.');
      setPrefs({ musicId: undefined, musicName: undefined, musicOn: false });
    } else setPrefs({});
  }

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
