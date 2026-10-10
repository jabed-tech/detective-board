import { OBJECTS, STAMPS, type ItemData, type ObjectId, type ReceiptLine, type StampId, FASTENERS, ITEM_SIZES, MATERIALS, MOODS, SURFACES, THICKNESSES, type MoodId, type StringMaterial, type SurfaceId, type LinkArrow, TEXT_STEP, stepTextScale, PIN_COLORS, type FastenerId, YARN_COLORS, type Board, type Item, type LineStyle, type Link } from '../model/types';
import { bringToFront, removeItem, removeLink, reverseLink, updateItem, updateLink } from '../model/actions';
import { moodPatch } from '../model/surfaces';
import type { Store } from '../model/store';
import { button, debounce, field, group, h } from './dom';
import { scaledGeom, withFit } from '../view/items';
import { formatMoney, genCaseFile, genMugshot, genNewspaper, genReceipt, newSeed, receiptTotal } from '../model/generators';
import { openSketchPad } from './sketchpad';

export type Selection = { kind: 'none' } | { kind: 'board' } | { kind: 'item'; id: string } | { kind: 'link'; id: string };
export interface DrawerDeps {
  store: Store; selection(): Selection; close(): void;
  exportBoard(): void; importBoard(f: File): void; clearBoard(): void; deleteCase(): void; closeCase(): void;
  pickPhoto(itemId: string): void; fitHeight(id: string, data: Item['data']): number | null; setYarn(c: string): void; setLastFastener(id: FastenerId): void; setLastThickness(v: number): void;
}

const PIN_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'White', 'Purple'];
const YARN_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'White', 'Black', 'Purple', 'Orange'];
const TYPE_NAMES = { photo: 'Photograph', polaroid: 'Polaroid', sticky: 'Sticky note', index: 'Index card',
  mugshot: 'Mugshot', newspaper: 'Newspaper clipping', receipt: 'Receipt', casefile: 'Case file', sketch: 'Sketch', stamp: 'Stamp', object: 'Object' } as const;

export function createDrawer(el: HTMLElement, deps: DrawerDeps): { render(force?: boolean): void } {
  let shownKey = '';
  const commit = (fn: (b: Board) => Board) => deps.store.commit(fn(deps.store.get()));
  /** Update a string, leaving the board untouched (no empty undo step) when nothing would change. */
  const patchLink = (id: string, patch: Partial<Omit<Link, 'id' | 'from' | 'to'>>) => commit(b => {
    const cur = b.links.find(x => x.id === id);
    if (!cur || Object.entries(patch).every(([k, v]) => (cur as unknown as Record<string, unknown>)[k] === v)) return b;
    return updateLink(b, id, patch);
  });

  /** Rebuild the open panel (a control changed which other controls show) and keep keyboard focus on it. */
  function rebuild(k: string) {
    api.render(true);
    el.querySelector<HTMLElement>(`[data-k="${k}"]`)?.focus();
  }

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
      if (!cur) return b;
      const same = (Object.entries(patch) as [keyof ItemData, unknown][]).every(([k, v]) => JSON.stringify(cur.data[k]) === JSON.stringify(v));
      if (same) return b;
      const data = { ...cur.data, ...patch };
      return updateItem(b, it.id, 'text' in patch || 'caption' in patch ? withFit(cur, data, deps.fitHeight) : { data });
    });
    const textSizeRow = (): HTMLElement => {
      let scale = it.data.textScale ?? 1;
      const readout = h('span', { className: 'ts-readout', textContent: `${Math.round(scale * 100)}%` });
      readout.setAttribute('aria-live', 'polite');
      const reset = button('Reset', () => setScale(1), 'btn ts-reset');
      const setScale = (next: number) => {
        scale = next;
        readout.textContent = `${Math.round(scale * 100)}%`;
        reset.hidden = scale === 1;
        commit(b => {
          const cur = b.items.find(i => i.id === it.id);
          if (!cur) return b;
          const data = { ...cur.data };
          if (scale === 1) delete data.textScale; else data.textScale = scale;
          return updateItem(b, it.id, withFit(cur, data, deps.fitHeight));
        });
      };
      reset.hidden = scale === 1;
      const smaller = button('A−', () => setScale(stepTextScale(scale, 1 / TEXT_STEP)), 'btn ts-step');
      smaller.setAttribute('aria-label', 'Smaller text');
      const larger = button('A+', () => setScale(stepTextScale(scale, TEXT_STEP)), 'btn ts-step');
      larger.setAttribute('aria-label', 'Larger text');
      for (const b of [smaller, larger]) b.style.cssText = 'min-width:44px;min-height:44px';
      reset.style.minHeight = '44px';
      return group('Text size', h('div', { className: 'row' }, smaller, readout, larger, reset));
    };
    type TextKey = 'name' | 'bookingNo' | 'masthead' | 'date' | 'headline' | 'store' | 'time' | 'subject' | 'officer' | 'status' | 'caption';
    /** Single-line text field bound to one data key; debounced while typing, committed on change (no-op skipped). */
    const textRow = (label: string, key: TextKey, max: number): HTMLElement => {
      const inp = h('input', { type: 'text', value: it.data[key] ?? '', maxLength: max });
      const go = () => patchData({ [key]: inp.value });
      inp.addEventListener('input', debounce(go));
      inp.addEventListener('change', go);
      return field(label, inp);
    };
    const areaRow = (label: string, rows: number): HTMLElement => {
      const ta = h('textarea', { value: it.data.text ?? '', rows, maxLength: 5000 });
      const go = () => patchData({ text: ta.value });
      ta.addEventListener('input', debounce(go));
      ta.addEventListener('change', go);
      return field(label, ta);
    };
    /** One commit: re-roll the generated fields (keeps any photo), so Ctrl+Z restores the old text. */
    const reroll = (label: string, gen: (seed: number, now: number) => Partial<ItemData>) => button(label, () => {
      const seed = newSeed();
      commit(b => {
        const cur = b.items.find(i => i.id === it.id);
        if (!cur) return b;
        return updateItem(b, it.id, withFit(cur, { ...cur.data, seed, ...gen(seed, Date.now()) }, deps.fitHeight));
      });
      api.render(true);
    });
    if (it.type === 'mugshot') {
      out.push(textRow('Name', 'name', 80), textRow('Booking no.', 'bookingNo', 20),
        h('div', { className: 'row' }, button(it.data.imageId ? 'Replace photo' : 'Add photo', () => deps.pickPhoto(it.id))),
        h('div', { className: 'row' }, reroll('New random details', s => genMugshot(s))), textSizeRow());
    }
    if (it.type === 'newspaper') {
      out.push(textRow('Masthead', 'masthead', 60), textRow('Date', 'date', 40), textRow('Headline', 'headline', 140), areaRow('Story', 5),
        h('div', { className: 'row' }, reroll('New random story', genNewspaper)), textSizeRow());
    }
    if (it.type === 'receipt') {
      out.push(textRow('Shop', 'store', 60), textRow('Time', 'time', 40));
      const lines = it.data.lines ?? [];
      const setLines = (fn: (l: ReceiptLine[]) => ReceiptLine[]) => commit(b => {
        const cur = b.items.find(i => i.id === it.id);
        if (!cur) return b;
        const before = cur.data.lines ?? [];
        const next = fn(before.map(l => ({ ...l })));
        if (JSON.stringify(next) === JSON.stringify(before)) return b;
        return updateItem(b, it.id, withFit(cur, { ...cur.data, lines: next }, deps.fitHeight));
      });
      const total = h('p', { className: 'rc-total-ro' }, `Total ${formatMoney(receiptTotal(lines))}`);
      total.setAttribute('aria-live', 'polite');
      const editor = h('div', { className: 'rc-edit' });
      editor.setAttribute('role', 'group');
      editor.setAttribute('aria-label', 'Receipt lines');
      lines.forEach((l, i) => {
        const name = h('input', { type: 'text', value: l.name, maxLength: 60, className: 'rc-ed-name' });
        name.setAttribute('aria-label', `Item ${i + 1} name`);
        const price = h('input', { type: 'number', min: '0', step: '0.01', value: (l.price / 100).toFixed(2), className: 'rc-ed-price' });
        price.setAttribute('aria-label', `Item ${i + 1} price in pounds`);
        const pence = () => { const v = Number(price.value); return price.value !== '' && Number.isFinite(v) ? Math.min(999_999, Math.max(0, Math.round(v * 100))) : l.price; };
        const edit = () => {
          const p = pence();
          total.textContent = `Total ${formatMoney(receiptTotal(lines.map((x, j) => (j === i ? { name: name.value, price: p } : x))))}`;
          setLines(ls => { if (ls[i]) ls[i] = { name: name.value, price: p }; return ls; });
        };
        const typing = debounce(edit);
        for (const inp of [name, price]) { inp.addEventListener('input', typing); inp.addEventListener('change', edit); }
        const x = button('✕', () => { setLines(ls => ls.filter((_, j) => j !== i)); api.render(true); }, 'btn rc-ed-x');
        x.setAttribute('aria-label', `Remove ${l.name || `item ${i + 1}`}`);
        editor.append(h('div', { className: 'rc-edit-row' }, name, price, x));
      });
      const addLine = button('Add line', () => { setLines(ls => (ls.length >= 40 ? ls : [...ls, { name: 'Item', price: 100 }])); api.render(true); });
      addLine.disabled = lines.length >= 40;
      out.push(group('Lines', editor), total, h('div', { className: 'row' }, addLine, reroll('New random receipt', genReceipt)), textSizeRow());
    }
    if (it.type === 'casefile') {
      out.push(textRow('Subject', 'subject', 80), textRow('Officer', 'officer', 60), textRow('Status', 'status', 40), textRow('Date', 'date', 40), areaRow('Notes', 4),
        h('div', { className: 'row' }, reroll('New random file', genCaseFile)), textSizeRow());
    }
    if (it.type === 'sketch') {
      out.push(h('div', { className: 'row' }, button('Edit sketch', () => {
        void openSketchPad(document.getElementById('sketchpad') as HTMLDialogElement, it.data.strokes).then(strokes => {
          if (!strokes) return;
          commit(b => {
            const cur = b.items.find(i => i.id === it.id);
            return cur ? updateItem(b, it.id, { data: { ...cur.data, strokes } }) : b;
          });
        });
      })));
    }
    if (it.type === 'stamp') {
      const sel = h('select');
      for (const st of STAMPS) sel.append(h('option', { value: st.id, textContent: st.label === '?' ? 'Question mark' : st.label, selected: (it.data.stamp ?? 'evidence') === st.id }));
      sel.addEventListener('change', () => patchData({ stamp: sel.value as StampId }));
      out.push(field('Stamp', sel));
    }
    if (it.type === 'object') {
      const sel = h('select');
      for (const o of OBJECTS) sel.append(h('option', { value: o.id, textContent: o.name, selected: (it.data.object ?? 'keys') === o.id }));
      sel.addEventListener('change', () => patchData({ object: sel.value as ObjectId }));
      out.push(field('Object', sel), textRow('Tag', 'caption', 200), textSizeRow());
    }
    const flag = (label: string, key: 'aged' | 'crossed') => {
      const cb = h('input', { type: 'checkbox', checked: !!it.data[key] });
      cb.addEventListener('change', () => patchData({ [key]: cb.checked ? true : undefined }));
      return h('label', { className: 'check' }, cb, ` ${label}`);
    };
    const looks = [flag('Aged look (yellowed, foxed paper)', 'aged'), flag('Cross it out (red X)', 'crossed')];
    if (it.type === 'sticky' || it.type === 'index') {
      const ta = h('textarea', { value: it.data.text ?? '', rows: 4, maxLength: 5000 });
      ta.addEventListener('input', debounce(() => patchData({ text: ta.value })));
      out.push(field('Writing', ta));
      out.push(textSizeRow());
    }
    if (it.type === 'polaroid') {
      const cap = h('input', { type: 'text', value: it.data.caption ?? '', maxLength: 200 });
      cap.addEventListener('input', debounce(() => patchData({ caption: cap.value })));
      out.push(field('Caption', cap));
      out.push(textSizeRow());
      out.push(h('div', { className: 'row' }, button(it.data.imageId ? 'Replace photo' : 'Add photo', () => deps.pickPhoto(it.id))));
      if (!it.data.imageId) {
        const unk = h('input', { type: 'checkbox', checked: !!it.data.unknown });
        unk.addEventListener('change', () => patchData({ unknown: unk.checked }));
        out.push(h('label', { className: 'check' }, unk, ' Unknown (show ?)'));
      }
    }
    const held = h('div', { className: 'fasteners' });
    held.setAttribute('role', 'radiogroup');
    held.setAttribute('aria-label', 'Held by');
    const surfaceFasteners = SURFACES[deps.store.get().surface].fasteners;
    const ordered = [...surfaceFasteners.flatMap(id => FASTENERS.filter(f => f.id === id)), ...FASTENERS.filter(f => !surfaceFasteners.includes(f.id))];
    for (const f of ordered) {
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
    out.push(...looks);
    if (it.type !== 'stamp') out.push(group('Held by', held));
    if (it.type !== 'stamp') out.push(group('Colour', swatches(PIN_COLORS, it.attachColor, 'Pin colour', c => commit(b => updateItem(b, it.id, { attachColor: c })))));
    const tilt = h('input', { type: 'range', min: '-180', max: '180', step: '1', value: String(Math.round(it.rot)) });
    tilt.addEventListener('change', () => commit(b => updateItem(b, it.id, { rot: Number(tilt.value) })));
    out.push(field('Rotation', tilt));
    const size = h('input', { type: 'range', min: '50', max: '300', step: '5', value: String(Math.round((it.w / ITEM_SIZES[it.type].w) * 100 / 5) * 5) });
    size.addEventListener('change', () => commit(b => {
      const cur = b.items.find(i => i.id === it.id);
      return cur ? updateItem(b, it.id, scaledGeom(cur, (Number(size.value) / 100 * ITEM_SIZES[cur.type].w) / cur.w)) : b;
    }));
    out.push(field('Size', size));
    out.push(h('p', { className: 'hint' }, 'Tip: drag the corner handle, or press , and . to shrink and grow, or Shift with them (< and >) for text size.'));
    out.push(h('div', { className: 'row' },
      button('Bring to front', () => commit(b => bringToFront(b, it.id))),
      button('Take it down', () => commit(b => removeItem(b, it.id)), 'btn danger')));
    return out;
  }

  function linkPanel(l: Link): Node[] {
    const setColor = (c: string) => { deps.setYarn(c); patchLink(l.id, { color: c }); };
    const sw = swatches(YARN_COLORS, l.color, 'String colour', setColor);
    const custom = h('input', { type: 'color', value: l.color, className: 'swatch-custom', title: 'Custom colour' });
    custom.setAttribute('aria-label', 'Custom colour');
    custom.addEventListener('change', () => { mark(sw, custom.value); setColor(custom.value); });
    sw.append(custom);
    const droop = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(l.tension) });
    droop.addEventListener('change', () => patchLink(l.id, { tension: Number(droop.value) }));
    const style = h('select');
    for (const [v, t] of [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']] as [LineStyle, string][]) {
      style.append(h('option', { value: v, textContent: t, selected: (l.style ?? 'solid') === v }));
    }
    style.addEventListener('change', () => patchLink(l.id, { style: style.value as LineStyle }));
    const material = h('select');
    for (const m of MATERIALS) material.append(h('option', { value: m.id, textContent: m.name, selected: (l.material ?? 'yarn') === m.id }));
    material.addEventListener('change', () => {
      const v = material.value as StringMaterial;
      patchLink(l.id, { material: v === 'yarn' ? undefined : v });
      rebuild('material');
    });
    material.dataset.k = 'material';
    const marker = l.material === 'marker';
    const thick = h('div', { className: 'thickness' });
    for (const t of THICKNESSES) {
      const sample = h('span', { className: 'thick-sample' });
      sample.style.setProperty('--sw', String(t.value));
      sample.setAttribute('aria-hidden', 'true');
      const b = h('button', { type: 'button', className: 'thick-btn' }, sample, t.name);
      b.setAttribute('aria-pressed', String((l.thickness ?? 1) === t.value));
      b.addEventListener('click', () => {
        thick.querySelectorAll('.thick-btn').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        deps.setLastThickness(t.value);
        patchLink(l.id, { thickness: t.value === 1 ? undefined : t.value });
      });
      thick.append(b);
    }
    const arrows = h('select');
    for (const [v, t] of [['', 'None'], ['end', 'Arrow at the end'], ['both', 'Arrows at both ends']] as [LinkArrow | '', string][]) {
      arrows.append(h('option', { value: v, textContent: t, selected: (l.arrow ?? '') === v }));
    }
    arrows.addEventListener('change', () => {
      patchLink(l.id, { arrow: (arrows.value || undefined) as LinkArrow | undefined });
      rebuild('arrows');
    });
    arrows.dataset.k = 'arrows';
    const label = h('input', { type: 'text', value: l.label ?? '', maxLength: 80 });
    const doLabel = () => patchLink(l.id, { label: label.value.trim() || undefined });
    label.addEventListener('input', debounce(doLabel));
    label.addEventListener('change', doLabel);
    const out: Node[] = [
      h('h2', { className: 'drawer-title' }, 'String'),
      group('Colour', sw),
      field('Material', material),
      group('Thickness', thick),
    ];
    if (marker) out.push(h('p', { className: 'hint' }, 'Marker lines are drawn straight.'));
    else out.push(field('Droop (taut ↔ saggy)', droop), h('p', { className: 'hint' }, 'Tip: drag the string itself up or down.'));
    out.push(field('Pattern', style), field('Arrows', arrows));
    if (l.arrow === 'end') out.push(h('div', { className: 'row' }, button('Swap direction', () => commit(b => reverseLink(b, l.id)))));
    out.push(field('Label', label), h('p', { className: 'hint' }, 'A few words shown on a tag at the middle of the string.'));
    out.push(h('div', { className: 'row' }, button('Cut the string', () => commit(b => removeLink(b, l.id)), 'btn danger')));
    return out;
  }

  function boardPanel(b: Board): Node[] {
    const name = h('input', { type: 'text', value: b.name, maxLength: 80 });
    const id = b.id; // only ever rename the case this input was built for
    const rename = () => commit(x => { const n = name.value.trim() || 'Untitled case'; return x.id !== id || x.name === n ? x : { ...x, name: n }; });
    name.addEventListener('input', debounce(rename));
    name.addEventListener('change', rename);
    const file = h('input', { type: 'file', accept: '.json,application/json', className: 'visually-hidden', tabIndex: -1 });
    file.addEventListener('change', () => { const f = file.files?.[0]; if (f) deps.importBoard(f); file.value = ''; });
    const moodSel = h('select');
    for (const m of Object.keys(MOODS) as MoodId[]) moodSel.append(h('option', { value: m, textContent: MOODS[m].name, selected: b.mood === m }));
    moodSel.addEventListener('change', () => { const m = moodSel.value as MoodId; commit(x => ({ ...x, ...moodPatch(m) })); });
    const surfSel = h('select');
    for (const s of Object.keys(SURFACES) as SurfaceId[]) surfSel.append(h('option', { value: s, textContent: SURFACES[s].name, selected: b.surface === s }));
    surfSel.addEventListener('change', () => { const surface = surfSel.value as SurfaceId; commit(x => ({ ...x, surface })); });
    return [
      h('h2', { className: 'drawer-title' }, `Case #${String(b.caseNo).padStart(4, '0')}`),
      field('Case name', name),
      field('Mood', moodSel),
      field('Board surface', surfSel),
      h('p', { className: 'hint' }, 'Mood sets the light, sound and board. Change the board on its own if you like.'),
      h('div', { className: 'row' }, b.closed ? button('Reopen the case', () => commit(x => ({ ...x, closed: undefined }))) : button('Close the case', deps.closeCase)),
      h('div', { className: 'row' }, button('Export case file', deps.exportBoard), button('Import case file', () => file.click()), file),
      h('p', { className: 'hint' }, 'A case file is one .json file with the photos inside. Everything stays on this device.'),
      h('div', { className: 'row' }, button('Clear the board', deps.clearBoard), button('Burn this case', deps.deleteCase, 'btn danger')),
    ];
  }

  const api = {
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
  return api;
}
