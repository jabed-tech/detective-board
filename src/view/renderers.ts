import { OBJECTS, SKETCH_VIEW, STAMPS } from '../model/types';
import type { Item, ItemType } from '../model/types';
import { objectSvg, stampSvg } from './art';
import '../styles/content.css';

const NAMES: Record<ItemType, string> = { photo: 'Photograph', polaroid: 'Polaroid', sticky: 'Sticky note', index: 'Index card',
  mugshot: 'Mugshot', newspaper: 'Newspaper clipping', receipt: 'Receipt', casefile: 'Case file', sketch: 'Sketch', stamp: 'Stamp', object: 'Object' };

const SVG_NS = 'http://www.w3.org/2000/svg';
const money = (p: number) => '£' + (p / 100).toFixed(2);

function add<K extends keyof HTMLElementTagNameMap>(parent: Element, tag: K, cls: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  n.className = cls;
  parent.append(n);
  return n;
}
function span(parent: Element, cls: string, text: string): HTMLSpanElement {
  const n = add(parent, 'span', cls);
  n.textContent = text;
  return n;
}
function row(parent: Element, label: string, value: string): void {
  const r = add(parent, 'div', 'cf-row');
  const b = document.createElement('b');
  b.textContent = label;
  r.append(b);
  r.append(Object.assign(document.createElement('span'), { textContent: value }));
}
function photo(parent: HTMLElement): void {
  const img = add(parent, 'img', 'it-img');
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
}

export function renderItemContent(body: HTMLElement, it: Item): void {
  body.replaceChildren();
  const d = it.data;
  switch (it.type) {
    case 'photo': {
      const frame = add(body, 'div', 'ph-frame');
      if (d.imageId) photo(frame);
      break;
    }
    case 'polaroid': {
      const win = add(body, 'div', 'pol-window');
      if (d.imageId) photo(win);
      else {
        add(win, 'div', 'pol-silhouette');
        if (d.unknown) {
          const q = add(win, 'span', 'pol-unknown');
          q.textContent = '?';
          q.setAttribute('aria-hidden', 'true');
        }
      }
      add(body, 'p', 'pol-cap').textContent = d.caption ?? '';
      break;
    }
    case 'sticky':
    case 'index':
      add(body, 'p', 'it-text').textContent = d.text ?? '';
      break;
    case 'mugshot': {
      const chart = add(body, 'div', 'mug-chart');
      for (const l of ['7\'', '6\'', '5\'', '4\'']) span(chart, 'mug-tick', l);
      const ph = add(body, 'div', 'mug-photo');
      if (d.imageId) photo(ph);
      else add(ph, 'div', 'pol-silhouette');
      add(ph, 'div', 'mug-grain');
      const board = add(body, 'div', 'mug-board');
      add(board, 'div', 'mug-name').textContent = d.name ?? '';
      add(board, 'div', 'mug-no').textContent = d.bookingNo ?? '';
      break;
    }
    case 'newspaper':
      add(body, 'div', 'np-masthead').textContent = d.masthead ?? '';
      add(body, 'div', 'np-date').textContent = d.date ?? '';
      add(body, 'div', 'np-headline').textContent = d.headline ?? '';
      add(body, 'div', 'np-body it-text').textContent = d.text ?? '';
      break;
    case 'receipt': {
      const lines = d.lines ?? [];
      add(body, 'div', 'rc-store').textContent = d.store ?? '';
      add(body, 'div', 'rc-time').textContent = d.time ?? '';
      const ul = add(body, 'ul', 'rc-lines');
      for (const l of lines) {
        const li = add(ul, 'li', 'rc-line');
        span(li, 'rc-name', l.name);
        span(li, 'rc-price', money(l.price));
      }
      add(body, 'div', 'rc-rule');
      const t = add(body, 'div', 'rc-total');
      span(t, 'rc-name', 'TOTAL');
      span(t, 'rc-price', money(lines.reduce((s, l) => s + l.price, 0)));
      break;
    }
    case 'casefile': {
      add(body, 'div', 'cf-tab').textContent = 'CASE FILE';
      const f = add(body, 'div', 'cf-folder');
      row(f, 'Subject', d.subject ?? '');
      row(f, 'Officer', d.officer ?? '');
      row(f, 'Status', d.status ?? '');
      row(f, 'Date', d.date ?? '');
      add(f, 'div', 'cf-notes it-text').textContent = d.text ?? '';
      if (d.status) add(body, 'div', 'cf-status').textContent = d.status;
      break;
    }
    case 'sketch': {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'sk');
      svg.setAttribute('viewBox', `0 0 ${SKETCH_VIEW.w} ${SKETCH_VIEW.h}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      for (const s of d.strokes ?? []) {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', s.d);
        p.setAttribute('fill', s.color);
        svg.append(p);
      }
      body.append(svg);
      break;
    }
    case 'stamp': {
      const id = d.stamp ?? 'evidence';
      const wrap = add(body, 'div', `stamp stamp-${id}`);
      if (id === 'red-x' || id === 'coffee-ring') wrap.innerHTML = stampSvg(id); // static art, no user data
      else span(wrap, id === 'question' ? 'stamp-q' : 'stamp-text', STAMPS.find(s => s.id === id)?.label ?? '');
      break;
    }
    case 'object': {
      const art = add(body, 'div', 'obj-art');
      art.innerHTML = objectSvg(d.object ?? 'keys'); // static art, no user data
      if (d.caption) add(body, 'div', 'obj-tag').textContent = d.caption;
      break;
    }
  }
  if (d.aged) add(body, 'div', 'aged-overlay');
  if (d.crossed) add(body, 'div', 'cross-overlay').innerHTML = stampSvg('red-x'); // static art
}

const trim = (s: string | undefined): string => (s ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);

export function itemLabel(it: Item): string {
  const d = it.data;
  const join = (n: string, t: string) => (t ? `${n}: ${t}` : n);
  switch (it.type) {
    case 'mugshot': return join('Mugshot', trim(d.name));
    case 'newspaper': return join('Newspaper', trim(d.headline));
    case 'receipt': return join('Receipt', trim(d.store));
    case 'casefile': return join('Case file', trim(d.subject));
    case 'sketch': return 'Sketch';
    case 'stamp': return join('Stamp', STAMPS.find(s => s.id === (d.stamp ?? 'evidence'))?.label ?? '');
    case 'object': return join(OBJECTS.find(o => o.id === d.object)?.name ?? NAMES.object, trim(d.caption));
  }
  const t = trim(d.text ?? d.caption);
  const name = d.unknown && !d.imageId ? 'Unknown person' : NAMES[it.type];
  return t ? `${name}: ${t}` : name;
}
