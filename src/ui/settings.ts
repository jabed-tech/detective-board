import { EFFECT_IDS, type Prefs } from '../prefs';
import { button, field, h } from './dom';

export interface SettingsDeps { prefs(): Prefs; setPrefs(p: Partial<Prefs>): void; burnAll(): void; chooseMusic(): Promise<void>; removeMusic(): Promise<void> }

export function createSettings(dialog: HTMLDialogElement, deps: SettingsDeps): { open(): void } {
  const tool = {
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
      const before = p.musicId;
      const rerender = () => { if (deps.prefs().musicId !== before) { dialog.close(); tool.open(); } };
      const amb = h('input', { type: 'checkbox', checked: p.ambience });
      amb.addEventListener('change', () => deps.setPrefs({ ambience: amb.checked }));
      const ambVol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(p.ambienceVolume) });
      ambVol.addEventListener('change', () => deps.setPrefs({ ambienceVolume: Number(ambVol.value) }));
      const musicOn = h('input', { type: 'checkbox', checked: p.musicOn && !!p.musicId, disabled: !p.musicId });
      musicOn.addEventListener('change', () => deps.setPrefs({ musicOn: musicOn.checked }));
      const choose = button('Choose a track…', () => void deps.chooseMusic().then(rerender));
      const remove = button('Remove track', () => void deps.removeMusic().then(rerender));
      remove.disabled = !p.musicId;
      const sound = h('fieldset', {}, h('legend', {}, 'Sound'));
      const eff = h('fieldset', {}, h('legend', {}, 'Effects'));
      const EFFECT_NAMES: Record<string, string> = { blinds: 'Venetian blinds', rain: 'Rain', grain: 'Film grain', neon: 'Neon glow', dust: 'Dust', flicker: 'Light flicker' };
      for (const id of EFFECT_IDS) {
        const c = h('input', { type: 'checkbox', checked: p.effects[id] });
        c.addEventListener('change', () => deps.setPrefs({ effects: { ...deps.prefs().effects, [id]: c.checked } }));
        eff.append(h('label', { className: 'opt' }, c, EFFECT_NAMES[id]));
      }
      eff.append(h('p', { className: 'hint' }, 'Each mood uses some of these. Reduced-motion settings turn moving ones off.'));
      const sfx = h('input', { type: 'checkbox', checked: p.sfx });
      sfx.addEventListener('change', () => deps.setPrefs({ sfx: sfx.checked }));
      const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(p.volume) });
      vol.addEventListener('change', () => deps.setPrefs({ volume: Number(vol.value) }));
      const neat = h('input', { type: 'checkbox', checked: p.neatHand });
      neat.addEventListener('change', () => deps.setPrefs({ neatHand: neat.checked }));
      const tilt = h('input', { type: 'checkbox', checked: p.tiltNew });
      tilt.addEventListener('change', () => deps.setPrefs({ tiltNew: tilt.checked }));
      const clipKeys = h('input', { type: 'checkbox', checked: p.clipboardKeys });
      clipKeys.addEventListener('change', () => deps.setPrefs({ clipboardKeys: clipKeys.checked }));
      const freeAnchors = h('input', { type: 'checkbox', checked: p.freeAnchors });
      freeAnchors.addEventListener('change', () => deps.setPrefs({ freeAnchors: freeAnchors.checked }));
      const droop = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(p.defaultTension) });
      droop.addEventListener('change', () => deps.setPrefs({ defaultTension: Number(droop.value) }));
      const usage = h('p', { className: 'hint' }, 'Storage size unavailable in this browser.');
      navigator.storage?.estimate?.().then(e => {
        if (e.usage != null && e.quota) usage.textContent = `Evidence locker: ${(e.usage / 1e6).toFixed(1)} MB used of ${Math.round(e.quota / 1e6)} MB.`;
      }).catch(() => { /* keep fallback text */ });

      sound.append(
        h('label', { className: 'opt' }, sfx, 'Sound effects (pins, string, paper)'),
        field('Effects volume', vol),
        h('label', { className: 'opt' }, amb, 'Room ambience (rain, jazz, hum… depends on the mood)'),
        field('Ambience & music volume', ambVol),
        h('div', { className: 'field' }, h('span', { className: 'field-lbl' }, 'Your music'),
          h('p', {}, p.musicName ?? 'No tape loaded'),
          h('div', { className: 'sound-music' }, choose, remove)),
        h('label', { className: 'opt' }, musicOn, 'Play my track'),
        h('p', { className: 'hint' }, 'Your track stays on this device and is never uploaded or exported.'),
      );
      dialog.replaceChildren(
        h('h2', {}, 'Settings'),
        atm,
        sound,
        eff,
        h('label', { className: 'opt' }, neat, 'Neat handwriting (easier to read)'),
        h('label', { className: 'opt' }, tilt, 'Tilt new items slightly (more natural look)'),
        h('label', { className: 'opt' }, clipKeys, 'Copy & paste shortcuts (Ctrl/⌘+C, V, D)'),
        field('New string droop', droop),
        h('h3', {}, 'Advanced'),
        h('label', { className: 'opt' }, freeAnchors, 'Pin strings where I drop them'),
        h('p', { className: 'hint' }, 'Everything stays on this device. Nothing is uploaded, ever.'),
        usage,
        h('div', { className: 'row' }, button('Burn the files', () => { dialog.close(); deps.burnAll(); }, 'btn danger'), button('Close', () => dialog.close())),
      );
      dialog.showModal();
    },
  };
  return tool;
}
