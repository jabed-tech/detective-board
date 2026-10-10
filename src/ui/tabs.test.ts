// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createTabs } from './tabs';
import type { BoardMeta } from '../storage/db';

const m = (id: string, caseNo: number, closed?: boolean): BoardMeta => ({ id, name: `Case ${id}`, caseNo, updatedAt: 0, ...(closed ? { closed } : {}) });
const names = (el: HTMLElement) => [...el.querySelectorAll('.tab:not(.tab-new):not(.tab-archive)')].map(t => t.querySelector('.tab-name')!.textContent);

describe('tabs archive group', () => {
  const metas = [m('A', 1), m('B', 2), m('C', 3, true), m('D', 4, true)];
  const make = (cur: string) => {
    const el = document.createElement('div');
    const tabs = createTabs(el, { list: () => metas, current: () => cur, open: () => {}, create: () => {} });
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
