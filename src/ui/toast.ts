// toast.ts
import { h } from './dom';

export function toast(title: string, body?: string): void {
  const host = document.getElementById('toasts');
  if (!host) return;
  const n = h('div', { className: 'toast' }, h('strong', {}, title));
  if (body) n.append(h('span', {}, body));
  host.append(n);
  setTimeout(() => n.remove(), 6000);
}
