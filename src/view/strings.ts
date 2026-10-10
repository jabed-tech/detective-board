import { BOARD_H, BOARD_W, type Board, type Item, type Link } from '../model/types';
import { anchorPoint, clamp } from '../model/geometry';
import { arrowHead, hashSeed, markerPath, pathMidpoint } from './linePaths';
import { createRope, ropePath, staticPath, stepRope, type Rope } from './rope';

type Pt = { x: number; y: number };

export interface StringsDeps {
  reducedMotion(): boolean;
  scale(): number;
  onSelect(linkId: string): void;
  erasing(): boolean;
  onErase(linkId: string): void;
  onTensionCommit(linkId: string, tension: number): void;
}
export interface StringsView {
  sync(board: Board, settle?: boolean): void;
  override(itemId: string, pos: Override | null): void;
  preview(from: Pt | null, to?: Pt, color?: string, snapped?: boolean, thickness?: number): void;
  setSelected(linkId: string | null): void;
}

type Override = Pt & { rot?: number; w?: number; h?: number };

const NS = 'http://www.w3.org/2000/svg';

interface Entry {
  link: Link; g: SVGGElement; hg: SVGGElement; paths: SVGPathElement[]; main: SVGPathElement; halo: SVGPathElement;
  rope: Rope; tension: number; awake: boolean; d: string;
  arrows: [SVGPathElement, SVGPathElement]; label: { g: SVGGElement; rect: SVGRectElement; text: SVGTextElement } | null;
}

export function createStrings(svg: SVGSVGElement, hitSvg: SVGSVGElement, deps: StringsDeps): StringsView {
  for (const s of [svg, hitSvg]) {
    s.setAttribute('viewBox', `0 0 ${BOARD_W} ${BOARD_H}`);
    s.setAttribute('width', String(BOARD_W));
    s.setAttribute('height', String(BOARD_H));
  }
  const entries = new Map<string, Entry>();
  const overrides = new Map<string, Override>();
  let items = new Map<string, Item>();
  let raf = 0;
  let selected: string | null = null;

  const path = (cls: string) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); return p; };
  const previewPath = path('str-preview');
  svg.append(previewPath);

  function ends(l: Link): [Pt, Pt] | null {
    const a = items.get(l.from);
    const b = items.get(l.to);
    if (!a || !b) return null;
    return [anchorPoint({ ...a, ...overrides.get(a.id) }, l.fromAt), anchorPoint({ ...b, ...overrides.get(b.id) }, l.toAt)];
  }
  function style(e: Entry) {
    e.main.style.stroke = e.link.color;
    const dash = e.link.style === 'dashed' ? '14 8' : e.link.style === 'dotted' ? '1 8' : '';
    const mat = e.link.material ?? 'yarn';
    e.main.style.strokeDasharray = dash || (mat === 'twine' ? '7 1.2' : '');
    e.halo.style.strokeDasharray = dash;
    for (const m of ['yarn', 'twine', 'marker']) e.g.classList.toggle(`mat-${m}`, m === mat);
    e.g.style.setProperty('--sw', String(e.link.thickness ?? 1));
    e.hg.style.setProperty('--sw', String(e.link.thickness ?? 1));
    const arrow = e.link.arrow;
    e.arrows[0].toggleAttribute('hidden', arrow !== 'both');
    e.arrows[1].toggleAttribute('hidden', !arrow);
    for (const p of e.arrows) p.style.fill = e.link.color;
    const lab = e.link.label;
    if (lab) {
      if (!e.label) {
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'str-label');
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('rx', '3');
        const text = document.createElementNS(NS, 'text');
        g.append(rect, text);
        e.g.append(g);
        e.label = { g, rect, text };
      }
      if (e.label.text.textContent !== lab) e.label.text.textContent = lab;
    } else if (e.label) { e.label.g.remove(); e.label = null; }
  }
  /** Arrowheads and label follow the drawn path (skipped where SVG geometry APIs are missing, e.g. jsdom). */
  function decorate(e: Entry) {
    const m = e.main;
    if (typeof m.getTotalLength !== 'function' || !e.d) return;
    try {
      const L = m.getTotalLength();
      if (L > 0 && e.link.arrow) {
        const size = 14 * (e.link.thickness ?? 1);
        const end = m.getPointAtLength(L), endFrom = m.getPointAtLength(L * 0.92);
        e.arrows[1].setAttribute('d', arrowHead(end, endFrom, size));
        const st = m.getPointAtLength(0), stFrom = m.getPointAtLength(L * 0.08);
        e.arrows[0].setAttribute('d', arrowHead(st, stFrom, size));
      }
    } catch { /* geometry unavailable */ }
    if (e.label && e.link.label && typeof e.label.text.getBBox === 'function') {
      const mid = pathMidpoint(m);
      if (!mid) return;
      try {
        const bb = e.label.text.getBBox();
        e.label.g.setAttribute('transform', `translate(${mid.x} ${mid.y})`);
        e.label.rect.setAttribute('x', String(bb.x - 4));
        e.label.rect.setAttribute('y', String(bb.y - 4));
        e.label.rect.setAttribute('width', String(bb.width + 8));
        e.label.rect.setAttribute('height', String(bb.height + 8));
      } catch { /* not laid out */ }
    }
  }
  function draw(e: Entry, d: string) {
    if (d === e.d) return;
    e.d = d;
    for (const p of e.paths) p.setAttribute('d', d);
    decorate(e);
  }
  function tick() {
    raf = 0;
    const rm = deps.reducedMotion();
    let any = false;
    for (const e of entries.values()) {
      if (!e.awake) continue;
      const pts = ends(e.link);
      if (!pts) { e.awake = false; continue; }
      const [a, b] = pts;
      const mat = e.link.material ?? 'yarn';
      if (mat === 'marker') { draw(e, markerPath(a, b, hashSeed(e.link.id))); e.awake = false; continue; }
      const tn = mat === 'twine' ? e.tension * 0.5 : e.tension;
      if (rm) { draw(e, staticPath(a.x, a.y, b.x, b.y, tn)); e.awake = false; continue; }
      e.awake = stepRope(e.rope, a.x, a.y, b.x, b.y, tn);
      draw(e, ropePath(e.rope));
      any ||= e.awake;
    }
    if (any) raf = requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  function wake(itemId: string) {
    for (const e of entries.values()) if (e.link.from === itemId || e.link.to === itemId) e.awake = true;
    kick();
  }

  // Midpoint drag changes tension; a tap selects.
  let tdrag: { id: string; pointerId: number; sy: number; start: number; t: number; moved: boolean } | null = null;
  const setHot = (id: string, on: boolean) => entries.get(id)?.g.classList.toggle('hot', on && deps.erasing());
  function onHitDown(ev: PointerEvent, id: string) {
    const e = entries.get(id);
    if (!e || ev.button !== 0) return;
    ev.stopPropagation();
    setHot(id, true);
    tdrag = { id, pointerId: ev.pointerId, sy: ev.clientY, start: e.tension, t: e.tension, moved: false };
    (ev.target as Element).setPointerCapture(ev.pointerId);
  }
  hitSvg.addEventListener('pointermove', ev => {
    if (!tdrag || ev.pointerId !== tdrag.pointerId) return;
    const dy = (ev.clientY - tdrag.sy) / deps.scale();
    if (deps.erasing()) return; // in Erase mode a tap deletes; no tension drag
    if (Math.abs(dy) > 4 && entries.get(tdrag.id)?.link.material !== 'marker') tdrag.moved = true;
    const e = entries.get(tdrag.id);
    if (!e || !tdrag.moved || e.link.material === 'marker') return;
    tdrag.t = clamp(tdrag.start + dy / 250, 0, 1);
    e.tension = tdrag.t;
    e.awake = true;
    kick();
  });
  const up = (ev: PointerEvent) => {
    if (!tdrag || ev.pointerId !== tdrag.pointerId) return;
    const d = tdrag;
    tdrag = null;
    setHot(d.id, false);
    if (ev.type === 'pointercancel') return;
    const over = document.elementFromPoint?.(ev.clientX, ev.clientY)?.closest<SVGElement>('[data-link-id]');
    const slidOff = !!document.elementFromPoint && over?.dataset.linkId !== d.id; // sliding off cancels an erase
    if (d.moved) deps.onTensionCommit(d.id, d.t);
    else if (deps.erasing()) { if (!slidOff) deps.onErase(d.id); }
    else deps.onSelect(d.id);
  };
  hitSvg.addEventListener('pointerup', up);
  hitSvg.addEventListener('pointercancel', up);

  let initialised = false;

  return {
    sync(board, settle = false) {
      items = new Map(board.items.map(i => [i.id, i]));
      const seen = new Set<string>();
      const startSettled = settle || !initialised;
      initialised = true;
      for (const l of board.links) {
        seen.add(l.id);
        let e = entries.get(l.id);
        if (!e) {
          const pts = ends(l);
          if (!pts) continue;
          const g = document.createElementNS(NS, 'g');
          g.setAttribute('class', 'str');
          g.dataset.linkId = l.id;
          const shadow = path('str-shadow'), halo = path('str-halo'), main = path('str-main'), hit = path('str-hit');
          const arrows: [SVGPathElement, SVGPathElement] = [path('str-arrow'), path('str-arrow')];
          for (const p of arrows) p.setAttribute('hidden', '');
          g.append(shadow, halo, main, ...arrows);
          svg.insertBefore(g, previewPath);
          const hg = document.createElementNS(NS, 'g');
          hg.dataset.linkId = l.id;
          hg.append(hit);
          hitSvg.append(hg);
          hit.addEventListener('pointerdown', ev => onHitDown(ev, l.id));
          hit.addEventListener('pointerenter', () => setHot(l.id, true));
          hit.addEventListener('pointerleave', () => { if (tdrag?.id !== l.id) setHot(l.id, false); });
          e = {
            link: l, g, hg, paths: [shadow, halo, main, hit], main, halo,
            rope: createRope(pts[0].x, pts[0].y, pts[1].x, pts[1].y, l.tension, startSettled),
            tension: l.tension, awake: true, d: '', arrows, label: null,
          };
          entries.set(l.id, e);
        }
        if (e.link !== l) { e.link = l; if (!tdrag || tdrag.id !== l.id) e.tension = l.tension; }
        e.g.classList.toggle('selected', l.id === selected);
        style(e);
        decorate(e);
        e.awake = true;
      }
      for (const [id, e] of entries) if (!seen.has(id)) { e.g.remove(); e.hg.remove(); entries.delete(id); }
      kick();
    },
    override(itemId, pos) {
      if (pos) overrides.set(itemId, pos); else overrides.delete(itemId);
      wake(itemId);
    },
    preview(from, to, color = '#b3261e', snapped = false, thickness = 1) {
      previewPath.classList.toggle('snapped', snapped);
      previewPath.style.setProperty('--sw', String(thickness));
      if (!from || !to) { previewPath.removeAttribute('d'); return; }
      previewPath.style.stroke = color;
      previewPath.setAttribute('d', staticPath(from.x, from.y, to.x, to.y, 0.3));
    },
    setSelected(id) {
      selected = id;
      for (const [k, e] of entries) e.g.classList.toggle('selected', k === id);
    },
  };
}
