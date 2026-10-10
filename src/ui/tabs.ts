import type { BoardMeta } from '../storage/db';
import { button, h } from './dom';

export interface TabsDeps { list(): BoardMeta[]; current(): string; open(id: string): void; create(): void }

let archiveOpen = false; // kept for the session

export function createTabs(el: HTMLElement, deps: TabsDeps): { render(): void } {
  function tab(m: BoardMeta, current: string): HTMLButtonElement {
    const b = h('button', { type: 'button', className: m.closed ? 'tab tab-closed' : 'tab', title: m.closed ? `${m.name} (closed)` : m.name },
      h('span', { className: 'tab-no' }, `CASE #${String(m.caseNo).padStart(4, '0')}`),
      h('span', { className: 'tab-name' }, m.name));
    if (m.closed) b.append(h('span', { className: 'tab-stamp', textContent: 'CLOSED' }));
    if (m.id === current) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => deps.open(m.id));
    return b;
  }
  const api = {
    render() {
      el.replaceChildren();
      const cur = deps.current();
      const all = deps.list();
      const open = all.filter(m => !m.closed);
      const closed = all.filter(m => m.closed);
      for (const m of open) el.append(tab(m, cur));
      if (closed.length) {
        const toggle = button(`Archive (${closed.length}) ${archiveOpen ? '▾' : '▸'}`, () => { archiveOpen = !archiveOpen; api.render(); el.querySelector<HTMLElement>('.tab-archive')?.focus(); }, 'tab tab-archive');
        toggle.setAttribute('aria-expanded', String(archiveOpen));
        el.append(toggle);
        for (const m of closed) if (archiveOpen || m.id === cur) el.append(tab(m, cur));
      }
      el.append(button('+ Open new case', deps.create, 'tab tab-new'));
      el.querySelector('[aria-current="true"]')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    },
  };
  return api;
}
