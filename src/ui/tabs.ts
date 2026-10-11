import type { BoardMeta } from '../storage/db';
import { button, h } from './dom';

export interface TabsDeps { list(): BoardMeta[]; current(): string; open(id: string): void; create(): void; putAway(id: string): void; reopen(id: string): void }

let archiveOpen = false; // kept for the session
let awayOpen = false;

export function createTabs(el: HTMLElement, deps: TabsDeps): { render(): void } {
  function tab(m: BoardMeta, current: string, onClick: () => void = () => deps.open(m.id)): HTMLButtonElement {
    const b = h('button', { type: 'button', className: m.closed ? 'tab tab-closed' : 'tab', title: m.closed ? `${m.name} (closed)` : m.name },
      h('span', { className: 'tab-no' }, `CASE #${String(m.caseNo).padStart(4, '0')}`),
      h('span', { className: 'tab-name' }, m.name));
    if (m.closed) b.append(h('span', { className: 'tab-stamp', textContent: 'CLOSED' }));
    if (m.id === current) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', onClick);
    return b;
  }
  const api = {
    render() {
      el.replaceChildren();
      const cur = deps.current();
      const all = deps.list();
      const shown = (m: BoardMeta) => !m.away || m.id === cur; // the case you're in is never hidden
      const open = all.filter(m => !m.closed && shown(m));
      const closed = all.filter(m => m.closed);
      const away = all.filter(m => m.away && !m.closed && m.id !== cur);
      for (const m of open) {
        const t = tab(m, cur);
        if (open.length < 2) { el.append(t); continue; }
        const x = h('button', { type: 'button', className: 'tab-away', textContent: '×', title: 'Put away this case' });
        x.setAttribute('aria-label', `Put away case #${String(m.caseNo).padStart(4, '0')} ${m.name}`);
        x.addEventListener('click', e => { e.stopPropagation(); deps.putAway(m.id); });
        el.append(h('div', { className: 'tab-wrap' }, t, x));
      }
      if (closed.length) {
        const toggle = button(`Archive (${closed.length}) ${archiveOpen ? '▾' : '▸'}`, () => { archiveOpen = !archiveOpen; api.render(); el.querySelector<HTMLElement>('.tab-archive')?.focus(); }, 'tab tab-archive');
        toggle.setAttribute('aria-expanded', String(archiveOpen));
        el.append(toggle);
        for (const m of closed) if (archiveOpen || m.id === cur) el.append(tab(m, cur));
      }
      if (away.length) {
        const toggle = button(`Put away (${away.length}) ${awayOpen ? '▾' : '▸'}`, () => { awayOpen = !awayOpen; api.render(); el.querySelector<HTMLElement>('.tab-awaytoggle')?.focus(); }, 'tab tab-awaytoggle');
        toggle.setAttribute('aria-expanded', String(awayOpen));
        el.append(toggle);
        if (awayOpen) for (const m of away) {
          const b = tab(m, cur, () => deps.reopen(m.id));
          b.classList.add('tab-awayitem');
          b.title = `${m.name} (put away) - click to bring it back`;
          el.append(b);
        }
      }
      el.append(button('+ Open new case', deps.create, 'tab tab-new'));
      el.querySelector('[aria-current="true"]')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    },
  };
  return api;
}
