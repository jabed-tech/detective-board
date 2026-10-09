# Task 12: UI chrome — desk, drawer, tabs, settings, toasts (Sonnet)

Read `00-overview.md` Global Constraints. Depends on Tasks 2, 3. Parallel with Task 11.

All controls are real `<button>`/`<input>` elements with visible text labels; desk "objects" are decorative CSS spans marked `aria-hidden`. Copy voice: flavour + plain meaning; destructive confirmations literal.

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/toast.ts`, `src/ui/confirm.ts`, `src/ui/memo.ts`, `src/ui/desk.ts`, `src/ui/drawer.ts`, `src/ui/tabs.ts`, `src/ui/settings.ts`, `src/styles/chrome.css`

**Consumes:** types, actions (`updateItem`, `updateLink`, `removeItem`, `removeLink`, `bringToFront`), `Store`, `Prefs`, `BoardMeta`.

**Produces:**
```ts
// dom.ts
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Partial<HTMLElementTagNameMap[K]>, ...kids: (Node | string)[]): HTMLElementTagNameMap[K];
export function field(label: string, control: HTMLElement): HTMLLabelElement;  // single control
export function group(label: string, control: HTMLElement): HTMLDivElement;    // multi-button control (no <label>, avoids click-forwarding)
export function button(text: string, onClick: () => void, cls?: string): HTMLButtonElement;
export function debounce(fn: () => void, ms?: number): () => void;
// toast.ts   toast(title: string, body?: string): void
// confirm.ts confirmDialog(title: string, body: string, okLabel: string): Promise<boolean>
// memo.ts    showMemo(onExport: () => void, onLater: () => void): void
// desk.ts
export interface DeskDeps { addItem(t: ItemType): void; toggleConnect(): void; fit(): void; zoom(f: number): void; undo(): void; redo(): void; toggleMute(): void; openCaseFile(): void; openSettings(): void }
export interface DeskState { canUndo: boolean; canRedo: boolean; connecting: boolean; yarn: string; muted: boolean }
export function createDesk(el: HTMLElement, deps: DeskDeps): { update(s: DeskState): void };
// drawer.ts
export type Selection = { kind: 'none' } | { kind: 'board' } | { kind: 'item'; id: string } | { kind: 'link'; id: string };
export interface DrawerDeps { store: Store; selection(): Selection; close(): void; exportBoard(): void; importBoard(f: File): void; clearBoard(): void; deleteCase(): void; setYarn(c: string): void }
export function createDrawer(el: HTMLElement, deps: DrawerDeps): { render(force?: boolean): void };
// tabs.ts
export interface TabsDeps { list(): BoardMeta[]; current(): string; open(id: string): void; create(): void }
export function createTabs(el: HTMLElement, deps: TabsDeps): { render(): void };
// settings.ts
export interface SettingsDeps { prefs(): Prefs; setPrefs(p: Partial<Prefs>): void; burnAll(): void }
export function createSettings(dialog: HTMLDialogElement, deps: SettingsDeps): { open(): void };
```

- [ ] **Step 1: dom.ts**

```ts
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}
export function field(label: string, control: HTMLElement): HTMLLabelElement {
  return h('label', { className: 'field' }, h('span', { className: 'field-lbl' }, label), control);
}
export function group(label: string, control: HTMLElement): HTMLDivElement {
  const g = h('div', { className: 'field' }, h('span', { className: 'field-lbl' }, label), control);
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', label);
  return g;
}
export function button(text: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  const b = h('button', { type: 'button', className: cls, textContent: text });
  b.addEventListener('click', onClick);
  return b;
}
export function debounce(fn: () => void, ms = 500): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}
```

- [ ] **Step 2: toast.ts, confirm.ts, memo.ts**

```ts
// toast.ts
import { h } from './dom';

export function toast(title: string, body?: string): void {
  const host = document.getElementById('toasts');
  if (!host) return;
  const n = h('div', { className: 'toast' }, h('strong', {}, title));
  if (body) n.append(h('span', {}, body));
  host.append(n);
  setTimeout(() => n.remove(), 6000);
}
```

```ts
// confirm.ts
import { h, button } from './dom';

export function confirmDialog(title: string, body: string, okLabel: string): Promise<boolean> {
  return new Promise(resolve => {
    const d = h('dialog', { className: 'confirm' });
    const done = (v: boolean) => { d.close(); d.remove(); resolve(v); };
    const cancel = button('Cancel', () => done(false));
    d.append(h('h2', {}, title), h('p', {}, body), h('div', { className: 'row' }, cancel, button(okLabel, () => done(true), 'btn danger')));
    d.addEventListener('cancel', e => { e.preventDefault(); done(false); });
    document.body.append(d);
    d.showModal();
    cancel.focus();
  });
}
```

```ts
// memo.ts
import { h, button } from './dom';

export function showMemo(onExport: () => void, onLater: () => void): void {
  const room = document.getElementById('room');
  if (!room || room.querySelector('.memo')) return;
  const m = h('aside', { className: 'memo' });
  m.setAttribute('role', 'note');
  const close = () => m.remove();
  m.append(
    h('h3', {}, 'MEMO — from the Chief'),
    h('p', {}, 'File a copy of this case. Browsers can throw out evidence after about a week without a visit.'),
    h('div', { className: 'row' }, button('Export now', () => { close(); onExport(); }), button('Later', () => { close(); onLater(); })),
  );
  room.append(m);
}
```

- [ ] **Step 3: desk.ts**

```ts
import type { ItemType } from '../model/types';
import { h } from './dom';

export interface DeskDeps { addItem(t: ItemType): void; toggleConnect(): void; fit(): void; zoom(f: number): void; undo(): void; redo(): void; toggleMute(): void; openCaseFile(): void; openSettings(): void }
export interface DeskState { canUndo: boolean; canRedo: boolean; connecting: boolean; yarn: string; muted: boolean }

function deskBtn(obj: string, label: string, aria: string, onClick: () => void): HTMLButtonElement {
  const o = h('span', { className: `obj obj-${obj}` });
  o.setAttribute('aria-hidden', 'true');
  const b = h('button', { type: 'button', className: 'desk-btn', title: aria }, o, h('span', { className: 'lbl' }, label));
  b.setAttribute('aria-label', aria);
  b.addEventListener('click', onClick);
  return b;
}

export function createDesk(el: HTMLElement, deps: DeskDeps): { update(s: DeskState): void } {
  const menu = h('div', { className: 'desk-menu', hidden: true });
  menu.setAttribute('role', 'menu');
  const add = deskBtn('tin', 'Add', 'Add evidence', () => {
    menu.hidden = !menu.hidden;
    add.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) (menu.firstElementChild as HTMLElement).focus();
  });
  add.setAttribute('aria-haspopup', 'menu');
  add.setAttribute('aria-expanded', 'false');
  const closeMenu = () => { menu.hidden = true; add.setAttribute('aria-expanded', 'false'); };
  const choices: [ItemType, string][] = [['photo', 'Photograph'], ['polaroid', 'Polaroid'], ['sticky', 'Sticky note'], ['index', 'Index card']];
  for (const [t, name] of choices) {
    const m = h('button', { type: 'button', textContent: name });
    m.setAttribute('role', 'menuitem');
    m.addEventListener('click', () => { closeMenu(); deps.addItem(t); });
    menu.append(m);
  }
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { closeMenu(); add.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !menu.contains(e.target as Node) && !add.contains(e.target as Node)) closeMenu();
  });

  const spool = deskBtn('spool', 'String', 'String mode: tap two items to connect them', deps.toggleConnect);
  spool.setAttribute('aria-pressed', 'false');
  const zoomOut = deskBtn('minus', 'Zoom out', 'Zoom out', () => deps.zoom(0.8));
  const zoomIn = deskBtn('plus', 'Zoom in', 'Zoom in', () => deps.zoom(1.25));
  zoomOut.classList.add('wide-only');
  zoomIn.classList.add('wide-only');
  const undo = deskBtn('eraser', 'Undo', 'Undo', deps.undo);
  const redo = deskBtn('pencil', 'Redo', 'Redo', deps.redo);
  const mute = deskBtn('radio', 'Sound', 'Mute sound effects', deps.toggleMute);
  mute.setAttribute('aria-pressed', 'false');

  el.append(
    h('div', { className: 'desk-add' }, add, menu),
    spool,
    deskBtn('glass', 'Fit', 'Fit board to screen', deps.fit),
    zoomOut, zoomIn, undo, redo,
    deskBtn('folder', 'Case', 'Case file: name, export, import', deps.openCaseFile),
    mute,
    deskBtn('match', 'Settings', 'Settings', deps.openSettings),
  );

  return {
    update(s) {
      undo.disabled = !s.canUndo;
      redo.disabled = !s.canRedo;
      spool.setAttribute('aria-pressed', String(s.connecting));
      spool.style.setProperty('--yarn', s.yarn);
      mute.setAttribute('aria-pressed', String(s.muted));
      mute.querySelector('.lbl')!.textContent = s.muted ? 'Muted' : 'Sound';
    },
  };
}
```

- [ ] **Step 4: drawer.ts**

```ts
import { PIN_COLORS, YARN_COLORS, type Board, type Item, type LineStyle, type Link } from '../model/types';
import { bringToFront, removeItem, removeLink, updateItem, updateLink } from '../model/actions';
import type { Store } from '../model/store';
import { button, debounce, field, group, h } from './dom';

export type Selection = { kind: 'none' } | { kind: 'board' } | { kind: 'item'; id: string } | { kind: 'link'; id: string };
export interface DrawerDeps {
  store: Store; selection(): Selection; close(): void;
  exportBoard(): void; importBoard(f: File): void; clearBoard(): void; deleteCase(): void;
  setYarn(c: string): void;
}

const TYPE_NAMES = { photo: 'Photograph', polaroid: 'Polaroid', sticky: 'Sticky note', index: 'Index card' } as const;

export function createDrawer(el: HTMLElement, deps: DrawerDeps): { render(force?: boolean): void } {
  let shownKey = '';
  const commit = (fn: (b: Board) => Board) => deps.store.commit(fn(deps.store.get()));

  function swatches(colors: readonly string[], current: string, name: string, pick: (c: string) => void): HTMLDivElement {
    const row = h('div', { className: 'swatches' });
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', name);
    for (const c of colors) {
      const b = button('', () => { shownKey = ''; pick(c); }, 'swatch');
      b.style.setProperty('--c', c);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(c.toLowerCase() === current.toLowerCase()));
      b.setAttribute('aria-label', c);
      row.append(b);
    }
    return row;
  }

  function itemPanel(it: Item): Node[] {
    const out: Node[] = [h('h2', { className: 'drawer-title' }, TYPE_NAMES[it.type])];
    const patchData = (patch: Partial<Item['data']>) => commit(b => {
      const cur = b.items.find(i => i.id === it.id);
      return cur ? updateItem(b, it.id, { data: { ...cur.data, ...patch } }) : b;
    });
    if (it.type === 'sticky' || it.type === 'index') {
      const ta = h('textarea', { value: it.data.text ?? '', rows: 4, maxLength: 5000 });
      ta.addEventListener('input', debounce(() => patchData({ text: ta.value })));
      out.push(field('Writing', ta));
    }
    if (it.type === 'polaroid') {
      const cap = h('input', { type: 'text', value: it.data.caption ?? '', maxLength: 200 });
      cap.addEventListener('input', debounce(() => patchData({ caption: cap.value })));
      out.push(field('Caption', cap));
    }
    out.push(group('Pin colour', swatches(PIN_COLORS, it.attachColor, 'Pin colour', c => commit(b => updateItem(b, it.id, { attachColor: c })))));
    const tilt = h('input', { type: 'range', min: '-20', max: '20', step: '1', value: String(Math.round(it.rot)) });
    tilt.addEventListener('change', () => commit(b => updateItem(b, it.id, { rot: Number(tilt.value) })));
    out.push(field('Tilt', tilt));
    out.push(h('div', { className: 'row' },
      button('Bring to front', () => commit(b => bringToFront(b, it.id))),
      button('Take it down', () => commit(b => removeItem(b, it.id)), 'btn danger')));
    return out;
  }

  function linkPanel(l: Link): Node[] {
    const setColor = (c: string) => { deps.setYarn(c); commit(b => updateLink(b, l.id, { color: c })); };
    const sw = swatches(YARN_COLORS, l.color, 'String colour', setColor);
    const custom = h('input', { type: 'color', value: l.color, className: 'swatch-custom', title: 'Custom colour' });
    custom.setAttribute('aria-label', 'Custom colour');
    custom.addEventListener('change', () => { shownKey = ''; setColor(custom.value); });
    sw.append(custom);
    const droop = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(l.tension) });
    droop.addEventListener('change', () => commit(b => updateLink(b, l.id, { tension: Number(droop.value) })));
    const style = h('select');
    for (const [v, t] of [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']] as [LineStyle, string][]) {
      style.append(h('option', { value: v, textContent: t, selected: (l.style ?? 'solid') === v }));
    }
    style.addEventListener('change', () => commit(b => updateLink(b, l.id, { style: style.value as LineStyle })));
    return [
      h('h2', { className: 'drawer-title' }, 'String'),
      group('Colour', sw),
      field('Droop (taut ↔ saggy)', droop),
      h('p', { className: 'hint' }, 'Tip: drag the string itself up or down.'),
      field('Pattern', style),
      h('div', { className: 'row' }, button('Cut the string', () => commit(b => removeLink(b, l.id)), 'btn danger')),
    ];
  }

  function boardPanel(b: Board): Node[] {
    const name = h('input', { type: 'text', value: b.name, maxLength: 80 });
    name.addEventListener('input', debounce(() => commit(x => ({ ...x, name: name.value.trim() || 'Untitled case' }))));
    const file = h('input', { type: 'file', accept: '.json,application/json', className: 'visually-hidden', tabIndex: -1 });
    file.addEventListener('change', () => { const f = file.files?.[0]; if (f) deps.importBoard(f); file.value = ''; });
    return [
      h('h2', { className: 'drawer-title' }, `Case #${String(b.caseNo).padStart(4, '0')}`),
      field('Case name', name),
      h('div', { className: 'row' }, button('Export case file', deps.exportBoard), button('Import case file', () => file.click()), file),
      h('p', { className: 'hint' }, 'A case file is one .json file with the photos inside. Everything stays on this device.'),
      h('div', { className: 'row' }, button('Clear the board', deps.clearBoard), button('Burn this case', deps.deleteCase, 'btn danger')),
    ];
  }

  return {
    render(force = false) {
      const sel = deps.selection();
      const b = deps.store.get();
      if (sel.kind === 'none') { el.hidden = true; shownKey = ''; return; }
      const key = sel.kind === 'board' ? `board:${b.id}` : `${sel.kind}:${sel.id}`;
      // Don't rebuild under the user's cursor while they edit this same thing.
      if (!force && key === shownKey && el.contains(document.activeElement)) return;
      let parts: Node[];
      if (sel.kind === 'board') parts = boardPanel(b);
      else if (sel.kind === 'item') {
        const it = b.items.find(i => i.id === sel.id);
        if (!it) { el.hidden = true; shownKey = ''; return; }
        parts = itemPanel(it);
      } else {
        const l = b.links.find(x => x.id === sel.id);
        if (!l) { el.hidden = true; shownKey = ''; return; }
        parts = linkPanel(l);
      }
      shownKey = key;
      const close = button('Close ✕', deps.close, 'drawer-close');
      close.setAttribute('aria-label', 'Close drawer');
      el.replaceChildren(close, ...parts);
      el.hidden = false;
    },
  };
}
```

- [ ] **Step 5: tabs.ts**

```ts
import type { BoardMeta } from '../storage/db';
import { button, h } from './dom';

export interface TabsDeps { list(): BoardMeta[]; current(): string; open(id: string): void; create(): void }

export function createTabs(el: HTMLElement, deps: TabsDeps): { render(): void } {
  return {
    render() {
      el.replaceChildren();
      for (const m of deps.list()) {
        const b = h('button', { type: 'button', className: 'tab', title: m.name },
          h('span', { className: 'tab-no' }, `CASE #${String(m.caseNo).padStart(4, '0')}`),
          h('span', { className: 'tab-name' }, m.name));
        if (m.id === deps.current()) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', () => deps.open(m.id));
        el.append(b);
      }
      el.append(button('+ Open new case', deps.create, 'tab tab-new'));
      el.querySelector('[aria-current="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    },
  };
}
```

- [ ] **Step 6: settings.ts**

```ts
import type { Prefs } from '../prefs';
import { button, field, h } from './dom';

export interface SettingsDeps { prefs(): Prefs; setPrefs(p: Partial<Prefs>): void; burnAll(): void }

export function createSettings(dialog: HTMLDialogElement, deps: SettingsDeps): { open(): void } {
  return {
    open() {
      const p = deps.prefs();
      const atm = h('fieldset', {}, h('legend', {}, 'Atmosphere'));
      for (const [v, label, desc] of [
        ['full', 'Full', 'the lamp flickers now and then'],
        ['gentle', 'Gentle', 'slow, soft dimming only'],
        ['off', 'Off', 'steady light, no flicker'],
      ] as const) {
        const r = h('input', { type: 'radio', name: 'atmos', value: v, checked: p.atmosphere === v });
        r.addEventListener('change', () => deps.setPrefs({ atmosphere: v }));
        atm.append(h('label', { className: 'opt' }, r, h('span', {}, h('strong', {}, label), ` — ${desc}`)));
      }
      const sfx = h('input', { type: 'checkbox', checked: p.sfx });
      sfx.addEventListener('change', () => deps.setPrefs({ sfx: sfx.checked }));
      const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(p.volume) });
      vol.addEventListener('change', () => deps.setPrefs({ volume: Number(vol.value) }));
      const neat = h('input', { type: 'checkbox', checked: p.neatHand });
      neat.addEventListener('change', () => deps.setPrefs({ neatHand: neat.checked }));
      const droop = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(p.defaultTension) });
      droop.addEventListener('change', () => deps.setPrefs({ defaultTension: Number(droop.value) }));
      const usage = h('p', { className: 'hint' }, 'Storage size unavailable in this browser.');
      navigator.storage?.estimate?.().then(e => {
        if (e.usage != null && e.quota) usage.textContent = `Evidence locker: ${(e.usage / 1e6).toFixed(1)} MB used of ${Math.round(e.quota / 1e6)} MB.`;
      }).catch(() => { /* keep fallback text */ });

      dialog.replaceChildren(
        h('h2', {}, 'Settings'),
        atm,
        h('label', { className: 'opt' }, sfx, 'Sound effects'),
        field('Volume', vol),
        h('label', { className: 'opt' }, neat, 'Neat handwriting (easier to read)'),
        field('New string droop', droop),
        h('p', { className: 'hint' }, 'Everything stays on this device. Nothing is uploaded, ever.'),
        usage,
        h('div', { className: 'row' }, button('Burn the files', () => { dialog.close(); deps.burnAll(); }, 'btn danger'), button('Close', () => dialog.close())),
      );
      dialog.showModal();
    },
  };
}
```

- [ ] **Step 7: chrome.css**

```css
/* Folder tabs */
.folder-tabs { display: flex; gap: 4px; align-items: flex-end; padding: 0 8px; overflow-x: auto; scrollbar-width: none; background: #120e0b; border-bottom: 3px solid #c9a86a; position: relative; z-index: 5; }
.tab { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; max-width: 220px; height: 38px; min-height: 38px; padding: 2px 14px; border: 0; border-radius: 8px 8px 0 0; background: #b89a62; color: #2a1f12; text-align: left; line-height: 1.05; }
.tab[aria-current="true"] { background: #e2c88f; height: 44px; }
.tab-no { font-family: var(--font-display); font-size: 12px; letter-spacing: .06em; }
.tab-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px; }
.tab-new { background: transparent; color: #e2c88f; border: 1px dashed #8a7246; border-bottom: 0; justify-content: center; }

/* Desk */
.desk { display: flex; gap: 4px; align-items: center; justify-content: center; overflow-x: auto; scrollbar-width: none; min-height: var(--desk-h); box-sizing: border-box; padding: 6px 10px calc(6px + env(safe-area-inset-bottom)); background: linear-gradient(#6b4a2f, #4a3220 30%, #3a2717); border-top: 4px solid #7d5a3a; box-shadow: 0 -8px 20px rgba(0, 0, 0, .5); position: relative; z-index: 5; }
.desk-btn { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 3px; background: transparent; border: 0; padding: 4px 6px; min-width: 58px; color: var(--chrome-text); border-radius: 6px; }
.desk-btn:hover { background: rgba(255, 255, 255, .06); }
.desk-btn:disabled { opacity: .4; cursor: default; }
.desk-btn[aria-pressed="true"] { background: rgba(255, 210, 63, .18); box-shadow: inset 0 0 0 2px var(--focus); }
.lbl { font-size: 12px; letter-spacing: .03em; }
.obj { display: block; position: relative; width: 34px; height: 30px; }
.obj-tin { width: 32px; height: 32px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #eee, #9aa0a6 55%, #5f6368); box-shadow: inset 0 0 0 3px #777, 0 2px 3px rgba(0, 0, 0, .5); }
.obj-tin::after { content: ''; position: absolute; inset: 9px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #e74c3c 0 4px, transparent 5px), radial-gradient(circle at 70% 40%, #3498db 0 4px, transparent 5px), radial-gradient(circle at 45% 75%, #f1c40f 0 4px, transparent 5px); }
.obj-spool { width: 26px; background: repeating-linear-gradient(170deg, var(--yarn, #b3261e) 0 3px, color-mix(in srgb, var(--yarn, #b3261e) 65%, #000) 3px 5px); border-top: 5px solid #c8a26b; border-bottom: 5px solid #c8a26b; border-radius: 3px; box-sizing: border-box; }
.obj-glass::before { content: ''; position: absolute; left: 3px; top: 1px; width: 16px; height: 16px; border: 4px solid #c9a45c; border-radius: 50%; background: rgba(180, 220, 255, .25); }
.obj-glass::after { content: ''; position: absolute; left: 20px; top: 21px; width: 13px; height: 5px; background: #3b2414; transform: rotate(45deg); border-radius: 2px; }
.obj-plus::before, .obj-minus::before { display: block; text-align: center; font: 700 26px/30px var(--font-ui); }
.obj-plus::before { content: '+'; }
.obj-minus::before { content: '−'; }
.obj-eraser { height: 16px; margin: 7px 0; background: linear-gradient(90deg, #e88a9a 0 60%, #2c5fa8 60%); border-radius: 3px; transform: rotate(-12deg); box-shadow: 0 2px 2px rgba(0, 0, 0, .4); }
.obj-pencil { height: 8px; margin: 11px 0; background: linear-gradient(90deg, #f0c040 0 78%, #e6c9a0 78% 92%, #333 92%); transform: rotate(-20deg); border-radius: 2px; }
.obj-folder { height: 26px; background: #d9b877; border-radius: 2px 6px 3px 3px; box-shadow: inset 0 6px 0 #c9a560; }
.obj-radio { height: 26px; background: #5b2d1c; border-radius: 6px; box-shadow: inset 0 0 0 2px #2a140c; }
.obj-radio::before { content: ''; position: absolute; left: 5px; top: 6px; width: 14px; height: 14px; border-radius: 50%; background: repeating-radial-gradient(#c9a45c 0 1px, #5b2d1c 1px 3px); }
.obj-radio::after { content: ''; position: absolute; right: 5px; top: 9px; width: 8px; height: 8px; border-radius: 50%; background: #c9a45c; }
.desk-btn[aria-pressed="true"] .obj-radio { filter: grayscale(1) brightness(.7); }
.obj-match { width: 24px; height: 32px; background: linear-gradient(#b3261e 0 70%, #efe6cf 70%); border-radius: 2px; box-shadow: 0 2px 3px rgba(0, 0, 0, .5); }
.desk-add { position: relative; }
.desk-menu { position: absolute; bottom: calc(100% + 10px); left: 0; display: flex; flex-direction: column; min-width: 180px; background: var(--paper); color: var(--ink); border-radius: 4px; box-shadow: 0 10px 30px rgba(0, 0, 0, .6); padding: 6px; z-index: 20; }
.desk-menu[hidden] { display: none; }
.desk-menu button { background: none; border: 0; border-bottom: 1px dashed #c8b98f; text-align: left; padding: 10px 12px; font-size: 16px; }
.desk-menu button:hover, .desk-menu button:focus-visible { background: #efe1b8; }
@media (max-width: 700px), (pointer: coarse) { .wide-only { display: none; } .desk { justify-content: flex-start; } }

/* Drawer: right-hand panel on wide screens, bottom sheet on phones */
.drawer { position: absolute; right: 12px; top: calc(var(--tab-h) + 12px); width: 320px; max-height: calc(100% - var(--tab-h) - var(--desk-h) - 40px); overflow: auto; box-sizing: border-box; background: var(--paper); color: var(--ink); border-radius: 4px; padding: 16px; box-shadow: 0 12px 40px rgba(0, 0, 0, .6); z-index: 10; font-size: 15px; }
.drawer[hidden] { display: none; }
@media (max-width: 700px) {
  .drawer { left: 0; right: 0; top: auto; bottom: calc(var(--desk-h) + env(safe-area-inset-bottom)); width: auto; max-height: 55dvh; border-radius: 14px 14px 0 0; padding-top: 26px; }
  .drawer::before { content: ''; position: absolute; top: 9px; left: 50%; width: 44px; height: 5px; margin-left: -22px; border-radius: 3px; background: #b9a77c; }
}
.drawer-title { font: 400 22px var(--font-display); margin: 0 0 12px; letter-spacing: .04em; padding-right: 80px; }
.drawer-close { position: absolute; top: 6px; right: 6px; background: none; border: 0; font-size: 14px; color: var(--ink); }
.field { display: block; margin: 0 0 14px; }
.field-lbl { display: block; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; color: #5a4a33; }
.drawer textarea, .drawer input[type="text"], .drawer select { width: 100%; box-sizing: border-box; font: 16px var(--font-ui); padding: 8px; border: 1px solid #b9a77c; background: #fffdf5; color: var(--ink); border-radius: 3px; min-height: 44px; }
.drawer input[type="range"], dialog input[type="range"] { width: 100%; min-height: 44px; accent-color: #7a1c14; }
.swatches { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.swatch { width: 44px; height: 44px; border-radius: 50%; border: 2px solid rgba(0, 0, 0, .35); background: var(--c); padding: 0; }
.swatch[aria-checked="true"] { box-shadow: 0 0 0 3px var(--paper), 0 0 0 6px var(--ink); }
.swatch-custom { width: 44px; height: 44px; padding: 0; border: 2px dashed #8a7246; border-radius: 50%; background: none; }
.row { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.btn { background: #efe1b8; border: 1px solid #8a7246; color: var(--ink); padding: 8px 14px; border-radius: 3px; }
.btn.danger { background: #7a1c14; color: #fff; border-color: #4a0f0a; }
.hint { font-size: 13px; color: #5a4a33; margin: 4px 0 12px; }

/* Toasts — typed slips */
.toasts { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--desk-h) + 16px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 8px; z-index: 50; pointer-events: none; width: min(92vw, 420px); }
.toast { background: var(--paper); color: var(--ink); padding: 10px 14px; border-radius: 2px; box-shadow: 0 8px 24px rgba(0, 0, 0, .6); transform: rotate(-.6deg); display: flex; flex-direction: column; gap: 2px; }
.toast strong { font: 400 18px var(--font-display); }

/* Memo from the Chief */
.memo { position: absolute; left: 16px; top: 16px; width: min(280px, 70vw); background: #f6f1e1; color: var(--ink); padding: 16px; box-shadow: 0 8px 20px rgba(0, 0, 0, .6); transform: rotate(-2deg); z-index: 6; }
.memo h3 { font: 400 18px var(--font-display); margin: 0 0 6px; }
.memo p { margin: 0 0 8px; font-size: 14px; }

/* Dialogs */
dialog { background: var(--paper); color: var(--ink); border: 0; border-radius: 4px; padding: 20px; width: min(92vw, 440px); box-sizing: border-box; box-shadow: 0 20px 60px rgba(0, 0, 0, .7); }
dialog::backdrop { background: rgba(5, 3, 2, .6); }
dialog h2 { font: 400 22px var(--font-display); margin: 0 0 12px; }
fieldset { border: 1px dashed #b9a77c; margin: 0 0 14px; padding: 8px 12px; }
.opt { display: flex; gap: 10px; align-items: center; min-height: 44px; }
.opt input { width: 20px; height: 20px; accent-color: #7a1c14; }

/* Lamp pull-chain */
.lamp-chain { position: absolute; top: 0; right: 28px; z-index: 7; width: 44px; height: 96px; background: none; border: 0; padding: 0; }
.lamp-chain .chain { position: absolute; left: 50%; top: 0; width: 2px; height: 70px; background: repeating-linear-gradient(#c9a45c 0 4px, #7a6233 4px 6px); transition: transform .15s; }
.lamp-chain .bead { position: absolute; left: 50%; top: 66px; width: 14px; height: 20px; margin-left: -6px; border-radius: 40%; background: radial-gradient(circle at 35% 30%, #f4dd9c, #a07a2c); transition: transform .15s; }
.lamp-chain:active .chain, .lamp-chain:active .bead { transform: translateY(8px); }
```

- [ ] **Step 8: Verify** — `npx tsc --noEmit` clean; `npm test` PASS.

- [ ] **Step 9: Commit** (controller) — `feat(ui): desk tools, drawer, folder tabs, settings, toasts`
