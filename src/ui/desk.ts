import type { ItemType } from '../model/types';
import { h } from './dom';

export interface DeskDeps { addItem(t: ItemType | 'unknown'): void; setMode(m: 'move' | 'string'): void; fit(): void; zoom(f: number): void; undo(): void; redo(): void; toggleMute(): void; openCaseFile(): void; openSettings(): void }
export interface DeskState { canUndo: boolean; canRedo: boolean; mode: 'move' | 'string'; yarn: string; muted: boolean }

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
    (menu.firstElementChild as HTMLElement).focus();
  });
  add.setAttribute('aria-haspopup', 'menu');
  add.setAttribute('aria-expanded', 'false');
  const closeMenu = () => { menu.hidden = true; add.setAttribute('aria-expanded', 'false'); };
  const choices: [ItemType | 'unknown', string][] = [['photo', 'Photograph'], ['polaroid', 'Polaroid'], ['unknown', 'Unknown person'], ['sticky', 'Sticky note'], ['index', 'Index card']];
  for (const [t, name] of choices) {
    const m = h('button', { type: 'button', textContent: name });
    m.setAttribute('role', 'menuitem');
    m.addEventListener('click', () => { closeMenu(); add.focus(); deps.addItem(t); });
    menu.append(m);
  }
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { closeMenu(); add.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
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
  hand.setAttribute('aria-pressed', 'true');
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
    h('div', { className: 'desk-add' }, add),
    hand, spool,
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
      spool.style.setProperty('--yarn', s.yarn);
      mute.setAttribute('aria-pressed', String(s.muted));
      mute.querySelector('.lbl')!.textContent = s.muted ? 'Muted' : 'Sound';
    },
  };
}
