import type { Item, ItemType } from '../model/types';

const NAMES: Record<ItemType, string> = { photo: 'Photograph', polaroid: 'Polaroid', sticky: 'Sticky note', index: 'Index card' };

function add<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, cls: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  n.className = cls;
  parent.append(n);
  return n;
}
function photo(parent: HTMLElement): void {
  const img = add(parent, 'img', 'it-img');
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
}

export function renderItemContent(body: HTMLElement, it: Item): void {
  body.replaceChildren();
  switch (it.type) {
    case 'photo': {
      const frame = add(body, 'div', 'ph-frame');
      if (it.data.imageId) photo(frame);
      break;
    }
    case 'polaroid': {
      const win = add(body, 'div', 'pol-window');
      if (it.data.imageId) photo(win); else add(win, 'div', 'pol-silhouette');
      add(body, 'p', 'pol-cap').textContent = it.data.caption ?? '';
      break;
    }
    case 'sticky':
    case 'index':
      add(body, 'p', 'it-text').textContent = it.data.text ?? '';
      break;
  }
}

export function itemLabel(it: Item): string {
  const t = (it.data.text ?? it.data.caption ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return t ? `${NAMES[it.type]}: ${t}` : NAMES[it.type];
}
