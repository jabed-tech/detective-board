import { OBJECTS, STAMPS, type ItemType, type Mode, type ObjectId, type StampId } from '../model/types';
import { h } from './dom';

export type AddChoice = ItemType | 'unknown' | `stamp:${StampId}` | `object:${ObjectId}`;
export interface DeskDeps { addItem(c: AddChoice): void; setMode(m: Mode): void; fit(): void; zoom(f: number): void; undo(): void; redo(): void; toggleMute(): void; openCaseFile(): void; openSettings(): void }
export interface DeskState { canUndo: boolean; canRedo: boolean; mode: Mode; yarn: string; muted: boolean }

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
    if (menu.hidden) return;
    const r = add.getBoundingClientRect();
    menu.style.bottom = `${innerHeight - r.top + 8}px`;
    menu.style.left = `${Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8))}px`;
    menu.querySelector<HTMLElement>('[role=menuitem]')!.focus();
  });
  add.setAttribute('aria-haspopup', 'menu');
  add.setAttribute('aria-expanded', 'false');
  const closeMenu = () => { menu.hidden = true; add.setAttribute('aria-expanded', 'false'); };
  const groups: [string, [AddChoice, string][]][] = [
    ['Evidence', [['photo', 'Photograph'], ['polaroid', 'Polaroid'], ['unknown', 'Unknown person'], ['sticky', 'Sticky note'], ['index', 'Index card']]],
    ['Paperwork', [['mugshot', 'Mugshot'], ['newspaper', 'Newspaper clipping'], ['receipt', 'Receipt'], ['casefile', 'Case file']]],
    ['Draw', [['sketch', 'Sketch…']]],
    ['Stamps', STAMPS.map(st => [`stamp:${st.id}` as AddChoice, st.label === '?' ? 'Question mark' : st.label])],
    ['Objects', OBJECTS.map(o => [`object:${o.id}` as AddChoice, o.name])],
  ];
  for (const [title, list] of groups) {
    const g = h('div', { className: 'menu-group' });
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', title);
    const head = h('div', { className: 'menu-head', textContent: title });
    head.setAttribute('aria-hidden', 'true');
    g.append(head);
    for (const [c, name] of list) {
      const m = h('button', { type: 'button', textContent: name });
      m.setAttribute('role', 'menuitem');
      m.addEventListener('click', () => { closeMenu(); add.focus(); deps.addItem(c); });
      g.append(m);
    }
    menu.append(g);
  }
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { closeMenu(); add.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[i <= 0 ? items.length - 1 : i - 1].focus(); }
    if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = e.key.toLowerCase();
      for (let n = 1; n <= items.length; n++) {
        const it = items[(i + n) % items.length];
        if ((it.textContent ?? '').toLowerCase().startsWith(k)) { e.preventDefault(); it.focus(); break; }
      }
    }
  });
  const leave = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (!menu.hidden && !(to && (menu.contains(to) || add.contains(to)))) closeMenu();
  };
  menu.addEventListener('focusout', leave);
  add.addEventListener('focusout', leave);
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !menu.contains(e.target as Node) && !add.contains(e.target as Node)) closeMenu();
  });

  const hand = deskBtn('hand', 'Move', 'Move mode: drag items around', () => deps.setMode('move'));
  const spool = deskBtn('spool', 'String', 'String mode: drag from one item to another to connect them', () => deps.setMode('string'));
  const erase = deskBtn('eraser', 'Erase', 'Erase mode: tap an item or string to remove it', () => deps.setMode('erase'));
  hand.setAttribute('aria-pressed', 'true');
  spool.setAttribute('aria-pressed', 'false');
  erase.setAttribute('aria-pressed', 'false');
  const zoomOut = deskBtn('minus', 'Zoom out', 'Zoom out', () => deps.zoom(0.8));
  const zoomIn = deskBtn('plus', 'Zoom in', 'Zoom in', () => deps.zoom(1.25));
  zoomOut.classList.add('wide-only');
  zoomIn.classList.add('wide-only');
  const undo = deskBtn('undo', 'Undo', 'Undo', deps.undo);
  const redo = deskBtn('redo', 'Redo', 'Redo', deps.redo);
  undo.classList.add('touch-only'); // keyboards have Ctrl+Z
  redo.classList.add('touch-only');
  const mute = deskBtn('radio', 'Sound', 'Mute all sound', deps.toggleMute);
  mute.setAttribute('aria-pressed', 'false');

  el.append(
    h('div', { className: 'desk-add' }, add),
    hand, spool, erase,
    deskBtn('glass', 'Fit', 'Fit board to screen', deps.fit),
    zoomOut, zoomIn, undo, redo,
    deskBtn('folder', 'Case', 'Case file: name, export, import', deps.openCaseFile),
    mute,
    deskBtn('match', 'Settings', 'Settings', deps.openSettings),
  );

  document.getElementById('app')!.append(menu);

  return {
    update(s) {
      undo.disabled = !s.canUndo;
      redo.disabled = !s.canRedo;
      hand.setAttribute('aria-pressed', String(s.mode === 'move'));
      spool.setAttribute('aria-pressed', String(s.mode === 'string'));
      erase.setAttribute('aria-pressed', String(s.mode === 'erase'));
      spool.style.setProperty('--yarn', s.yarn);
      mute.setAttribute('aria-pressed', String(s.muted));
      mute.querySelector('.lbl')!.textContent = s.muted ? 'Muted' : 'Sound';
    },
  };
}
