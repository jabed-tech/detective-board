import type { Prefs } from '../prefs';
import { button, field, h } from './dom';

export interface SettingsDeps { prefs(): Prefs; setPrefs(p: Partial<Prefs>): void; burnAll(): void }

export function createSettings(dialog: HTMLDialogElement, deps: SettingsDeps): { open(): void } {
  return {
    open() {
      const p = deps.prefs();
      const atm = h('fieldset', {}, h('legend', {}, 'Atmosphere'));
      for (const [v, label, desc] of [
        ['full', 'Full', 'the lamp flickers now and then'],
        ['gentle', 'Gentle', 'slow, soft dimming only'],
        ['off', 'Off', 'steady light, no flicker'],
      ] as const) {
        const r = h('input', { type: 'radio', name: 'atmos', value: v, checked: p.atmosphere === v });
        r.addEventListener('change', () => deps.setPrefs({ atmosphere: v }));
        atm.append(h('label', { className: 'opt' }, r, h('span', {}, h('strong', {}, label), ` — ${desc}`)));
      }
      const sfx = h('input', { type: 'checkbox', checked: p.sfx });
      sfx.addEventListener('change', () => deps.setPrefs({ sfx: sfx.checked }));
      const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(p.volume) });
      vol.addEventListener('change', () => deps.setPrefs({ volume: Number(vol.value) }));
      const neat = h('input', { type: 'checkbox', checked: p.neatHand });
      neat.addEventListener('change', () => deps.setPrefs({ neatHand: neat.checked }));
      const droop = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(p.defaultTension) });
      droop.addEventListener('change', () => deps.setPrefs({ defaultTension: Number(droop.value) }));
      const usage = h('p', { className: 'hint' }, 'Storage size unavailable in this browser.');
      navigator.storage?.estimate?.().then(e => {
        if (e.usage != null && e.quota) usage.textContent = `Evidence locker: ${(e.usage / 1e6).toFixed(1)} MB used of ${Math.round(e.quota / 1e6)} MB.`;
      }).catch(() => { /* keep fallback text */ });

      dialog.replaceChildren(
        h('h2', {}, 'Settings'),
        atm,
        h('label', { className: 'opt' }, sfx, 'Sound effects'),
        field('Volume', vol),
        h('label', { className: 'opt' }, neat, 'Neat handwriting (easier to read)'),
        field('New string droop', droop),
        h('p', { className: 'hint' }, 'Everything stays on this device. Nothing is uploaded, ever.'),
        usage,
        h('div', { className: 'row' }, button('Burn the files', () => { dialog.close(); deps.burnAll(); }, 'btn danger'), button('Close', () => dialog.close())),
      );
      dialog.showModal();
    },
  };
}
