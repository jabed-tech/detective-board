// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDrawer } from './drawer';
import { createStore } from '../model/store';
import { addItem, makeItem, newBoard } from '../model/actions';
import type { Item } from '../model/types';

function setup(item: Item) {
  const store = createStore(addItem(newBoard('T', 1), item));
  const el = document.createElement('div');
  document.body.append(el);
  const noop = () => {};
  const drawer = createDrawer(el, {
    store, selection: () => ({ kind: 'item', id: item.id }), close: noop, exportBoard: noop, importBoard: noop, clearBoard: noop,
    deleteCase: noop, closeCase: noop, pickPhoto: noop, fitHeight: () => null, setYarn: noop, setLastFastener: noop, setLastThickness: noop,
  });
  drawer.render(true);
  return { store, el, drawer, get: () => store.get().items[0] };
}
const type = (inp: HTMLInputElement | HTMLTextAreaElement, v: string) => { inp.value = v; inp.dispatchEvent(new Event('input')); };
const btn = (el: HTMLElement, text: string) => [...el.querySelectorAll('button')].find(b => b.textContent === text)!;

describe('drawer debounced edits', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

  it('typing then New random before the timer: reroll wins, undo restores the typed value in one step', () => {
    const it = makeItem('mugshot', 500, 500, { seed: 1, name: 'Old Name', bookingNo: 'B1' });
    const { store, el, get } = setup(it);
    type(el.querySelector<HTMLInputElement>('input[type=text]')!, 'Typed Name');
    btn(el, 'New random details').click();
    const rerolled = get().data.name;
    expect(rerolled).not.toBe('Typed Name');
    vi.advanceTimersByTime(2000);
    expect(get().data.name).toBe(rerolled);
    store.undo();
    expect(get().data.name).toBe('Typed Name');
    expect(store.undo() && get().data.name).toBe('Old Name');
  });

  it('receipt: editing row 1 then removing row 0 before the timer does not corrupt rows', () => {
    const it = makeItem('receipt', 500, 500, { store: 'S', time: 'T', lines: [{ name: 'A', price: 100 }, { name: 'B', price: 200 }, { name: 'C', price: 300 }] });
    const { el, get } = setup(it);
    const names = el.querySelectorAll<HTMLInputElement>('.rc-ed-name');
    type(names[1], 'B2');
    btn(el, '✕' as string).click(); // remove row 0 (first ✕)
    vi.advanceTimersByTime(2000);
    expect(get().data.lines).toEqual([{ name: 'B2', price: 200 }, { name: 'C', price: 300 }]);
  });
});
