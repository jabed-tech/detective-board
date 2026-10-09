import { FASTENERS, PIN_COLORS, type FastenerId, YARN_COLORS, type Board, type Item, type LineStyle, type Link } from '../model/types';
import { bringToFront, removeItem, removeLink, updateItem, updateLink } from '../model/actions';
import type { Store } from '../model/store';
import { button, debounce, field, group, h } from './dom';

export type Selection = { kind: 'none' } | { kind: 'board' } | { kind: 'item'; id: string } | { kind: 'link'; id: string };
export interface DrawerDeps {
  store: Store; selection(): Selection; close(): void;
  exportBoard(): void; importBoard(f: File): void; clearBoard(): void; deleteCase(): void;
  setYarn(c: string): void; setLastFastener(id: FastenerId): void;
}

const PIN_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'White', 'Purple'];
const YARN_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'White', 'Black', 'Purple', 'Orange'];
const TYPE_NAMES = { photo: 'Photograph', polaroid: 'Polaroid', sticky: 'Sticky note', index: 'Index card' } as const;

export function createDrawer(el: HTMLElement, deps: DrawerDeps): { render(force?: boolean): void } {
  let shownKey = '';
  const commit = (fn: (b: Board) => Board) => deps.store.commit(fn(deps.store.get()));

  function mark(row: Element, c: string) {
    row.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-checked', String((b as HTMLElement).style.getPropertyValue('--c').toLowerCase() === c.toLowerCase())));
  }

  function swatches(colors: readonly string[], current: string, name: string, pick: (c: string) => void): HTMLDivElement {
    const row = h('div', { className: 'swatches' });
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', name);
    const names = colors === PIN_COLORS ? PIN_NAMES : YARN_NAMES;
    colors.forEach((c, i) => {
      const b = button('', () => { mark(row, c); pick(c); }, 'swatch');
      b.style.setProperty('--c', c);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(c.toLowerCase() === current.toLowerCase()));
      b.setAttribute('aria-label', names[i] ?? c);
      row.append(b);
    });
    return row;
  }

  function itemPanel(it: Item): Node[] {
    const out: Node[] = [h('h2', { className: 'drawer-title' }, TYPE_NAMES[it.type])];
    const patchData = (patch: Partial<Item['data']>) => commit(b => {
      const cur = b.items.find(i => i.id === it.id);
      return cur ? updateItem(b, it.id, { data: { ...cur.data, ...patch } }) : b;
    });
    if (it.type === 'sticky' || it.type === 'index') {
      const ta = h('textarea', { value: it.data.text ?? '', rows: 4, maxLength: 5000 });
      ta.addEventListener('input', debounce(() => patchData({ text: ta.value })));
      out.push(field('Writing', ta));
    }
    if (it.type === 'polaroid') {
      const cap = h('input', { type: 'text', value: it.data.caption ?? '', maxLength: 200 });
      cap.addEventListener('input', debounce(() => patchData({ caption: cap.value })));
      out.push(field('Caption', cap));
    }
    const held = h('div', { className: 'fasteners' });
    held.setAttribute('role', 'radiogroup');
    held.setAttribute('aria-label', 'Held by');
    for (const f of FASTENERS) {
      const icon = h('span', { className: 'pin' });
      icon.dataset.kind = f.id;
      icon.style.setProperty('--pin', it.attachColor);
      const b = h('button', { type: 'button', className: 'btn fastener' }, icon, f.name);
      b.dataset.kind = f.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(it.attach === f.id));
      b.addEventListener('click', () => {
        held.querySelectorAll('.fastener').forEach(x => x.setAttribute('aria-checked', String(x === b)));
        deps.setLastFastener(f.id);
        commit(bd => updateItem(bd, it.id, { attach: f.id }));
      });
      held.append(b);
    }
    out.push(group('Held by', held));
    out.push(group('Colour', swatches(PIN_COLORS, it.attachColor, 'Pin colour', c => commit(b => updateItem(b, it.id, { attachColor: c })))));
    const tilt = h('input', { type: 'range', min: '-180', max: '180', step: '1', value: String(Math.round(it.rot)) });
    tilt.addEventListener('change', () => commit(b => updateItem(b, it.id, { rot: Number(tilt.value) })));
    out.push(field('Rotation', tilt));
    out.push(h('div', { className: 'row' },
      button('Bring to front', () => commit(b => bringToFront(b, it.id))),
      button('Take it down', () => commit(b => removeItem(b, it.id)), 'btn danger')));
    return out;
  }

  function linkPanel(l: Link): Node[] {
    const setColor = (c: string) => { deps.setYarn(c); commit(b => updateLink(b, l.id, { color: c })); };
    const sw = swatches(YARN_COLORS, l.color, 'String colour', setColor);
    const custom = h('input', { type: 'color', value: l.color, className: 'swatch-custom', title: 'Custom colour' });
    custom.setAttribute('aria-label', 'Custom colour');
    custom.addEventListener('change', () => { mark(sw, custom.value); setColor(custom.value); });
    sw.append(custom);
    const droop = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(l.tension) });
    droop.addEventListener('change', () => commit(b => updateLink(b, l.id, { tension: Number(droop.value) })));
    const style = h('select');
    for (const [v, t] of [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']] as [LineStyle, string][]) {
      style.append(h('option', { value: v, textContent: t, selected: (l.style ?? 'solid') === v }));
    }
    style.addEventListener('change', () => commit(b => updateLink(b, l.id, { style: style.value as LineStyle })));
    return [
      h('h2', { className: 'drawer-title' }, 'String'),
      group('Colour', sw),
      field('Droop (taut ↔ saggy)', droop),
      h('p', { className: 'hint' }, 'Tip: drag the string itself up or down.'),
      field('Pattern', style),
      h('div', { className: 'row' }, button('Cut the string', () => commit(b => removeLink(b, l.id)), 'btn danger')),
    ];
  }

  function boardPanel(b: Board): Node[] {
    const name = h('input', { type: 'text', value: b.name, maxLength: 80 });
    name.addEventListener('input', debounce(() => commit(x => ({ ...x, name: name.value.trim() || 'Untitled case' }))));
    const file = h('input', { type: 'file', accept: '.json,application/json', className: 'visually-hidden', tabIndex: -1 });
    file.addEventListener('change', () => { const f = file.files?.[0]; if (f) deps.importBoard(f); file.value = ''; });
    return [
      h('h2', { className: 'drawer-title' }, `Case #${String(b.caseNo).padStart(4, '0')}`),
      field('Case name', name),
      h('div', { className: 'row' }, button('Export case file', deps.exportBoard), button('Import case file', () => file.click()), file),
      h('p', { className: 'hint' }, 'A case file is one .json file with the photos inside. Everything stays on this device.'),
      h('div', { className: 'row' }, button('Clear the board', deps.clearBoard), button('Burn this case', deps.deleteCase, 'btn danger')),
    ];
  }

  return {
    render(force = false) {
      const sel = deps.selection();
      const b = deps.store.get();
      if (sel.kind === 'none') { el.hidden = true; shownKey = ''; return; }
      const key = sel.kind === 'board' ? `board:${b.id}` : `${sel.kind}:${sel.id}`;
      // Don't rebuild under the user's cursor while they edit this same thing.
      if (!force && key === shownKey && el.contains(document.activeElement)) return;
      let parts: Node[];
      if (sel.kind === 'board') parts = boardPanel(b);
      else if (sel.kind === 'item') {
        const it = b.items.find(i => i.id === sel.id);
        if (!it) { el.hidden = true; shownKey = ''; return; }
        parts = itemPanel(it);
      } else {
        const l = b.links.find(x => x.id === sel.id);
        if (!l) { el.hidden = true; shownKey = ''; return; }
        parts = linkPanel(l);
      }
      shownKey = key;
      const close = button('Close ✕', deps.close, 'drawer-close');
      close.setAttribute('aria-label', 'Close drawer');
      el.replaceChildren(close, ...parts);
      el.hidden = false;
    },
  };
}
