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
