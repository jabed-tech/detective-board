export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}
export function field(label: string, control: HTMLElement): HTMLLabelElement {
  return h('label', { className: 'field' }, h('span', { className: 'field-lbl' }, label), control);
}
export function group(label: string, control: HTMLElement): HTMLDivElement {
  const g = h('div', { className: 'field' }, h('span', { className: 'field-lbl' }, label), control);
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', label);
  return g;
}
export function button(text: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  const b = h('button', { type: 'button', className: cls, textContent: text });
  b.addEventListener('click', onClick);
  return b;
}
export interface Debounced { (): void; cancel(): void; flush(): void }
export function debounce(fn: () => void, ms = 500): Debounced {
  let t: ReturnType<typeof setTimeout> | undefined;
  const d = (() => { clearTimeout(t); t = setTimeout(() => { t = undefined; fn(); }, ms); }) as Debounced;
  d.cancel = () => { clearTimeout(t); t = undefined; };
  d.flush = () => { if (t === undefined) return; clearTimeout(t); t = undefined; fn(); };
  return d;
}
