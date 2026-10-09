// memo.ts
import { h, button } from './dom';

export function showMemo(onExport: () => void, onLater: () => void): void {
  const room = document.getElementById('room');
  if (!room || room.querySelector('.memo')) return;
  const m = h('aside', { className: 'memo' });
  m.setAttribute('role', 'note');
  const close = () => m.remove();
  m.append(
    h('h3', {}, 'MEMO — from the Chief'),
    h('p', {}, 'File a copy of this case. Browsers can throw out evidence after about a week without a visit.'),
    h('div', { className: 'row' }, button('Export now', () => { close(); onExport(); }), button('Later', () => { close(); onLater(); })),
  );
  room.append(m);
}
