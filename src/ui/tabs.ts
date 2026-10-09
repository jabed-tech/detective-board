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
