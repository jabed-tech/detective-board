// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createTabs } from './tabs';
import type { BoardMeta } from '../storage/db';

const m = (id: string, caseNo: number, closed?: boolean, away?: boolean): BoardMeta => ({ id, name: `Case ${id}`, caseNo, updatedAt: 0, ...(closed ? { closed } : {}), ...(away ? { away: true as const } : {}) });
const names = (el: HTMLElement) => [...el.querySelectorAll('.tab:not(.tab-new):not(.tab-archive):not(.tab-awaytoggle)')].map(t => t.querySelector('.tab-name')!.textContent);

describe('tabs archive group', () => {
  const metas = [m('A', 1), m('B', 2), m('C', 3, true), m('D', 4, true)];
  const make = (cur: string) => {
    const el = document.createElement('div');
    const tabs = createTabs(el, { list: () => metas, current: () => cur, open: () => {}, create: () => {}, putAway: () => {}, reopen: () => {} });
    tabs.render();
    return el;
  };
  it('shows open cases and a collapsed Archive toggle', () => {
    const el = make('A');
    expect(names(el)).toEqual(['Case A', 'Case B']);
    const toggle = el.querySelector<HTMLButtonElement>('.tab-archive')!;
    expect(toggle.textContent).toContain('Archive (2)');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
  it('reveals closed cases with tab-closed when toggled', () => {
    const el = make('A');
    el.querySelector<HTMLButtonElement>('.tab-archive')!.click();
    expect(names(el)).toEqual(['Case A', 'Case B', 'Case C', 'Case D']);
    expect(el.querySelectorAll('.tab.tab-closed').length).toBe(2);
    expect(el.querySelector('.tab-archive')!.getAttribute('aria-expanded')).toBe('true');
    el.querySelector<HTMLButtonElement>('.tab-archive')!.click(); // collapse again
    expect(names(el)).toEqual(['Case A', 'Case B']);
  });
  it('always shows the current case even when closed and collapsed', () => {
    const el = make('C');
    expect(names(el)).toEqual(['Case A', 'Case B', 'Case C']);
    expect(el.querySelector('[aria-current="true"]')!.classList.contains('tab-closed')).toBe(true);
  });
});

describe('tabs put away', () => {
  const setup = (metas: BoardMeta[], cur = 'A') => {
    const el = document.createElement('div');
    const calls = { open: [] as string[], away: [] as string[], reopen: [] as string[] };
    createTabs(el, { list: () => metas, current: () => cur, open: id => calls.open.push(id), create: () => {}, putAway: id => calls.away.push(id), reopen: id => calls.reopen.push(id) }).render();
    return { el, calls };
  };
  it('renders an x on each open tab with a descriptive label', () => {
    const { el } = setup([m('A', 1), m('B', 2)]);
    const xs = [...el.querySelectorAll<HTMLButtonElement>('.tab-away')];
    expect(xs.map(x => x.getAttribute('aria-label'))).toEqual(['Put away case #0001 Case A', 'Put away case #0002 Case B']);
  });
  it('has no x when only one visible open case remains', () => {
    expect(setup([m('A', 1)]).el.querySelector('.tab-away')).toBeNull();
    expect(setup([m('A', 1), m('B', 2, false, true)]).el.querySelector('.tab-away')).toBeNull();
    expect(setup([m('A', 1), m('C', 3, true)]).el.querySelector('.tab-away')).toBeNull();
  });
  it('x calls putAway with the id and does not open the tab', () => {
    const { el, calls } = setup([m('A', 1), m('B', 2)]);
    el.querySelectorAll<HTMLButtonElement>('.tab-away')[1].click();
    expect(calls.away).toEqual(['B']);
    expect(calls.open).toEqual([]);
  });
  it('hides put-away cases and lists them under the toggle', () => {
    const { el, calls } = setup([m('A', 1), m('B', 2), m('P', 3, false, true)]);
    expect(names(el)).toEqual(['Case A', 'Case B']);
    const toggle = el.querySelector<HTMLButtonElement>('.tab-awaytoggle')!;
    expect(toggle.textContent).toContain('Put away (1)');
    toggle.click();
    expect(names(el)).toEqual(['Case A', 'Case B', 'Case P']);
    el.querySelector<HTMLButtonElement>('.tab-awayitem')!.click();
    expect(calls.reopen).toEqual(['P']);
    expect(calls.open).toEqual([]);
  });
  it('shows no toggle when nothing is put away', () => {
    expect(setup([m('A', 1), m('B', 2)]).el.querySelector('.tab-awaytoggle')).toBeNull();
  });
});
