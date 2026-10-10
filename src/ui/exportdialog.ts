import type { PageSize } from '../export/pdf';
import type { Scope } from '../export/region';
import type { Format } from '../export/save';
import { button, group, h } from './dom';

export interface ExportRequest { scope: Scope; format: Format; scale: number; mood: boolean; strings: boolean; background: boolean; page: PageSize; action: 'download' | 'share' | 'copy' }
export interface ExportInit {
  hasSelection: boolean; scope?: Scope['kind']; canShare: boolean; canCopy: boolean;
  /** Scope is a placeholder here; main resolves the real view rect / item id. */
  describe(r: ExportRequest): string;
}

let seq = 0;

function radios<T extends string | number>(name: string, opts: { v: T; label: string; disabled?: boolean; hint?: string }[], cur: T, on: (v: T) => void): HTMLElement {
  const box = h('div', { className: 'export-opts' });
  for (const o of opts) {
    const inp = h('input', { type: 'radio', name, checked: o.v === cur, disabled: !!o.disabled });
    inp.addEventListener('change', () => { if (inp.checked) on(o.v); });
    const lbl = h('label', { className: 'opt' }, inp, h('span', {}, o.label));
    if (o.hint) lbl.append(h('span', { className: 'hint' }, o.hint));
    box.append(lbl);
  }
  return box;
}

function check(label: string, value: boolean, on: (v: boolean) => void): HTMLLabelElement {
  const cb = h('input', { type: 'checkbox', checked: value });
  cb.addEventListener('change', () => on(cb.checked));
  return h('label', { className: 'check' }, cb, ` ${label}`);
}

/** Ask what to print. Resolves the request, or null on Cancel/Escape/backdrop. */
export function openExportDialog(dialog: HTMLDialogElement, init: ExportInit): Promise<ExportRequest | null> {
  return new Promise(resolve => {
    const id = `exp${++seq}`;
    let result: ExportRequest | null = null;
    const kind: Scope['kind'] = init.scope === 'item' && init.hasSelection ? 'item' : init.scope === 'view' ? 'view' : 'board';
    const st = { kind, format: 'png' as Format, scale: 1, mood: true, strings: true, background: true, page: 'fit' as PageSize };
    const req = (action: ExportRequest['action']): ExportRequest => {
      const scope: Scope = st.kind === 'item' ? { kind: 'item', id: '' } : st.kind === 'view' ? { kind: 'view', rect: { x: 0, y: 0, w: 0, h: 0 } } : { kind: 'board' };
      return { scope, format: st.format, scale: st.scale, mood: st.mood, strings: st.strings, background: st.kind === 'item' ? st.background : true, page: st.page, action };
    };
    const info = h('p', { className: 'hint export-info' });
    info.setAttribute('role', 'status');
    const bgRow = check('Board background', true, v => { st.background = v; refresh(); });
    const pageRow = group('PDF page', radios(`${id}-page`, [
      { v: 'fit' as PageSize, label: 'Same size as the picture' }, { v: 'a4' as PageSize, label: 'A4 page' },
    ], st.page, v => { st.page = v; }));
    const refresh = () => {
      bgRow.hidden = st.kind !== 'item';
      pageRow.hidden = st.format !== 'pdf';
      info.textContent = init.describe(req('download'));
    };
    const scopeOpts = radios(`${id}-scope`, [
      { v: 'board' as Scope['kind'], label: 'Whole board' },
      { v: 'view' as Scope['kind'], label: "What's on screen" },
      { v: 'item' as Scope['kind'], label: 'Selected item', disabled: !init.hasSelection, hint: init.hasSelection ? undefined : 'Select an item first' },
    ], st.kind, v => { st.kind = v; refresh(); });
    const done = (action: ExportRequest['action']) => { result = req(action); dialog.close(); };
    const primary = button('Download', () => done('download'), 'btn primary');
    const actions = h('div', { className: 'row' }, primary);
    if (init.canShare) actions.append(button('Share…', () => done('share')));
    if (init.canCopy) actions.append(button('Copy picture', () => done('copy')));
    actions.append(button('Cancel', () => dialog.close()));
    dialog.replaceChildren(
      h('h2', {}, 'Develop a print'),
      h('p', {}, 'Save a picture of this case. Nothing is uploaded.'),
      group('What', scopeOpts),
      group('Format', radios(`${id}-fmt`, [
        { v: 'png' as Format, label: 'PNG (best quality)' }, { v: 'jpeg' as Format, label: 'JPEG (smaller)' },
        { v: 'webp' as Format, label: 'WebP (smallest)' }, { v: 'pdf' as Format, label: 'PDF (for printing)' },
      ], st.format, v => { st.format = v; refresh(); })),
      group('Size', radios(`${id}-size`, [
        { v: 1, label: 'Standard (1×)' }, { v: 2, label: 'Large (2×)' }, { v: 3, label: 'Print (3×)' },
      ], st.scale, v => { st.scale = v; refresh(); })),
      info,
      group('Options', h('div', { className: 'export-opts' },
        check('Mood lighting', true, v => { st.mood = v; }),
        check('Strings', true, v => { st.strings = v; }),
        bgRow)),
      pageRow,
      actions,
    );
    refresh();
    const onClose = () => { dialog.removeEventListener('close', onClose); dialog.removeEventListener('click', onBackdrop); resolve(result); };
    const onBackdrop = (e: MouseEvent) => {
      if (e.target !== dialog || e.detail === 0) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    };
    dialog.addEventListener('close', onClose);
    dialog.addEventListener('click', onBackdrop);
    dialog.showModal();
  });
}
