// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDesk, type DeskDeps } from './desk';

function setup() {
  document.body.innerHTML = '<div id="app"><div id="desk"></div></div>';
  const addItem = vi.fn();
  const noop = () => {};
  const deps = { addItem, setMode: noop, fit: noop, zoom: noop, undo: noop, redo: noop, toggleMute: noop, openCaseFile: noop, openExport: noop, openSettings: noop } as DeskDeps;
  createDesk(document.getElementById('desk')!, deps);
  const menu = document.querySelector<HTMLElement>('.desk-menu')!;
  const add = document.querySelector<HTMLButtonElement>('.desk-add button')!;
  const tabs = () => [...menu.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const items = () => [...menu.querySelectorAll<HTMLButtonElement>('[role=tabpanel] button')].map(b => b.textContent);
  return { addItem, menu, add, tabs, items };
}

describe('add menu tabs', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  it('shows only the first group on open', () => {
    const { add, tabs, items, menu } = setup();
    add.click();
    expect(menu.hidden).toBe(false);
    expect(tabs().map(t => t.textContent)).toEqual(['Evidence', 'Paperwork', 'Draw', 'Stamps', 'Objects']);
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(items()).toEqual(['Photograph', 'Polaroid', 'Unknown person', 'Sticky note', 'Index card']);
  });
  it('clicking a tab swaps the list', () => {
    const { add, tabs, items } = setup();
    add.click();
    tabs()[1].click();
    expect(items()).toEqual(['Mugshot', 'Newspaper clipping', 'Receipt', 'Case file']);
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs()[0].getAttribute('aria-selected')).toBe('false');
  });
  it('ArrowRight moves to the next tab and shows its list', () => {
    const { add, tabs, items } = setup();
    add.click();
    tabs()[1].click();
    tabs()[1].focus();
    tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(tabs()[2]);
    expect(items()).toEqual(['Sketch\u2026']);
  });
  it('an entry click still adds that item', () => {
    const { add, tabs, addItem, menu } = setup();
    add.click();
    tabs()[2].click();
    menu.querySelector<HTMLButtonElement>('[role=tabpanel] button')!.click();
    expect(addItem).toHaveBeenCalledWith('sketch');
    expect(menu.hidden).toBe(true);
  });
  it('reopens on the last used group', () => {
    const { add, items } = setup(); // module state kept from the previous test
    add.click();
    expect(items()).toEqual(['Sketch\u2026']);
  });
});
