import { MOODS, type MoodId } from '../model/types';
import { button, h } from './dom';

/** Ask which room the new case is set in. Resolves the mood, or null on Cancel/Escape/backdrop. */
export function pickMood(dialog: HTMLDialogElement): Promise<MoodId | null> {
  return new Promise(resolve => {
    let result: MoodId | null = null;
    const grid = h('div', { className: 'newcase-grid' });
    for (const id of Object.keys(MOODS) as MoodId[]) {
      const m = MOODS[id];
      const swatch = h('span', { className: `newcase-swatch surface surface-${m.surface}` });
      swatch.setAttribute('aria-hidden', 'true');
      const b = h('button', { type: 'button', className: 'newcase-opt' },
        swatch,
        h('span', { className: 'newcase-text' }, h('strong', {}, m.name), h('span', { className: 'newcase-blurb' }, m.blurb)));
      b.addEventListener('click', () => { result = id; dialog.close(); });
      grid.append(b);
    }
    dialog.replaceChildren(
      h('h2', {}, 'Open a new case'),
      h('p', { className: 'hint' }, "Pick the room you'll work in. You can change it later in the case file."),
      grid,
      h('div', { className: 'row' }, button('Cancel', () => dialog.close())),
    );
    const onClose = () => { dialog.removeEventListener('close', onClose); dialog.removeEventListener('click', onBackdrop); resolve(result); };
    const onBackdrop = (e: MouseEvent) => { if (e.target === dialog) dialog.close(); };
    dialog.addEventListener('close', onClose);
    dialog.addEventListener('click', onBackdrop);
    dialog.showModal();
  });
}
