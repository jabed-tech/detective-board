import { updateItem } from '../model/actions';
import type { Store } from '../model/store';
import type { Viewport } from '../view/viewport';
import type { ConnectTool } from '../view/connect';
import type { Selection } from './drawer';
import { TEXT_STEP, stepTextScale, type Mode, type ItemData } from '../model/types';
import { scaledGeom, withFit } from '../view/items';

export interface KeyDeps {
  store: Store;
  viewport: Pick<Viewport, 'zoomBy' | 'fit'>;
  connect: ConnectTool;
  setMode(m: Mode): void;
  clipboardKeys(): boolean;
  selection(): Selection;
  select(s: Selection): void;
  deleteSelected(): void;
  copy(): void;
  duplicate(): void;
  openExport(): void;
  fitHeight(id: string, data: ItemData): number | null;
}

export function bindKeys(d: KeyDeps): void {
  document.addEventListener('keydown', e => {
    const t = e.target as Element;
    if (t.closest('input, textarea, select, dialog, [role=menu]')) return;
    const k = e.key;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && k.toLowerCase() === 'e') { e.preventDefault(); d.openExport(); return; }
    if (mod && k.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); d.store.undo(); return; }
    if (mod && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); d.store.redo(); return; }
    if (mod && !e.shiftKey && d.clipboardKeys() && d.selection().kind === 'item') {
      if (k.toLowerCase() === 'c') { e.preventDefault(); d.copy(); return; }
      if (k.toLowerCase() === 'd') { e.preventDefault(); d.duplicate(); return; }
    }
    if (mod || e.altKey) return;
    const sel = d.selection();
    switch (k) {
      case '+': case '=': d.viewport.zoomBy(1.25); break;
      case '-': d.viewport.zoomBy(0.8); break;
      case '0': d.viewport.fit(); break;
      case 'Escape':
        if (d.connect.pending()) d.connect.cancel(); else d.select({ kind: 'none' });
        break;
      case 'Delete': case 'Backspace':
        if (sel.kind === 'item' || sel.kind === 'link') { e.preventDefault(); d.deleteSelected(); }
        break;
      case 'm': case 'M': d.setMode('move'); break;
      case 's': case 'S': d.setMode('string'); break;
      case 'e': case 'E': d.setMode('erase'); break;
      case 'c': case 'C':
        if (sel.kind === 'item') d.connect.begin(sel.id);
        break;
      case '[': case ']': {
        if (sel.kind !== 'item') break;
        const it = d.store.get().items.find(i => i.id === sel.id);
        if (!it) break;
        const r = it.rot + (k === '[' ? -1 : 1) * (e.shiftKey ? 15 : 5);
        d.store.commit(updateItem(d.store.get(), it.id, { rot: ((r + 540) % 360) - 180 }));
        break;
      }
      case '>': case '<': { // Shift + . / ,  — text size
        if (sel.kind !== 'item') break;
        const it = d.store.get().items.find(i => i.id === sel.id);
        if (!it || it.type === 'photo') break;
        const ts = stepTextScale(it.data.textScale, k === '>' ? TEXT_STEP : 1 / TEXT_STEP);
        const data = { ...it.data };
        if (ts === 1) delete data.textScale; else data.textScale = ts;
        d.store.commit(updateItem(d.store.get(), it.id, withFit(it, data, d.fitHeight)));
        break;
      }
      case '.': case ',': { // '+'/'-' are zoom, so resize uses , and .
        if (sel.kind !== 'item') break;
        const it = d.store.get().items.find(i => i.id === sel.id);
        if (!it) break;
        d.store.commit(updateItem(d.store.get(), it.id, scaledGeom(it, k === '.' ? 1.1 : 1 / 1.1)));
        break;
      }
      case 'Enter':
        if (sel.kind === 'item' && d.connect.pending() && d.connect.pending() !== sel.id) { e.preventDefault(); d.connect.complete(sel.id); }
        break;
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': {
        if (sel.kind !== 'item') break;
        e.preventDefault();
        const it = d.store.get().items.find(i => i.id === sel.id);
        if (!it) break;
        const step = e.shiftKey ? 50 : 10;
        const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0;
        const dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
        d.store.commit(updateItem(d.store.get(), it.id, { x: it.x + dx, y: it.y + dy }));
        break;
      }
    }
  });
}
