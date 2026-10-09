# Task 10: Strings view (Sonnet)

Read `00-overview.md` Global Constraints. Depends on Tasks 2, 6, 7. Parallel with Task 9.

**Files:**
- Create: `src/view/strings.ts`, `src/styles/strings.css`

**Consumes:** `Board`, `Item`, `Link`, `BOARD_W`, `BOARD_H`; `pinPoint`, `clamp`; `createRope`, `stepRope`, `ropePath`, `staticPath`, `Rope` from `src/view/rope.ts`.

**Produces:**
```ts
type Pt = { x: number; y: number };
export interface StringsDeps {
  reducedMotion(): boolean;
  scale(): number;                                   // current viewport scale
  onSelect(linkId: string): void;                    // tap on a string (no drag)
  onTensionCommit(linkId: string, tension: number): void; // after a midpoint drag
}
export interface StringsView {
  sync(board: Board, settle?: boolean): void; // settle=true on board load: ropes start already hanging
  override(itemId: string, pos: Pt | null): void; // live item position during a drag
  preview(from: Pt | null, to?: Pt, color?: string): void; // pin-drag preview string
  setSelected(linkId: string | null): void;
}
export function createStrings(svg: SVGSVGElement, deps: StringsDeps): StringsView;
```
DOM contract: each link is `<g class="str" data-link-id>` with paths `.str-shadow`, `.str-halo`, `.str-main`, `.str-hit` (the hit path is the only one receiving pointer events). Tension gesture: drag the string down = droopier, up = tauter, 250 world px = full range.

New links created after the first sync start straight and drop (fun); links present at board load start settled.

- [ ] **Step 1: strings.ts**

```ts
import { BOARD_H, BOARD_W, type Board, type Item, type Link } from '../model/types';
import { clamp, pinPoint } from '../model/geometry';
import { createRope, ropePath, staticPath, stepRope, type Rope } from './rope';

type Pt = { x: number; y: number };

export interface StringsDeps {
  reducedMotion(): boolean;
  scale(): number;
  onSelect(linkId: string): void;
  onTensionCommit(linkId: string, tension: number): void;
}
export interface StringsView {
  sync(board: Board, settle?: boolean): void;
  override(itemId: string, pos: Pt | null): void;
  preview(from: Pt | null, to?: Pt, color?: string): void;
  setSelected(linkId: string | null): void;
}

const NS = 'http://www.w3.org/2000/svg';

interface Entry {
  link: Link; g: SVGGElement; paths: SVGPathElement[]; main: SVGPathElement; halo: SVGPathElement;
  rope: Rope; tension: number; awake: boolean; d: string;
}

export function createStrings(svg: SVGSVGElement, deps: StringsDeps): StringsView {
  svg.setAttribute('viewBox', `0 0 ${BOARD_W} ${BOARD_H}`);
  svg.setAttribute('width', String(BOARD_W));
  svg.setAttribute('height', String(BOARD_H));
  const entries = new Map<string, Entry>();
  const overrides = new Map<string, Pt>();
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
    return [pinPoint({ ...a, ...overrides.get(a.id) }), pinPoint({ ...b, ...overrides.get(b.id) })];
  }
  function style(e: Entry) {
    e.main.style.stroke = e.link.color;
    const dash = e.link.style === 'dashed' ? '14 8' : e.link.style === 'dotted' ? '1 8' : '';
    e.main.style.strokeDasharray = dash;
    e.halo.style.strokeDasharray = dash;
  }
  function draw(e: Entry, d: string) {
    if (d === e.d) return;
    e.d = d;
    for (const p of e.paths) p.setAttribute('d', d);
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
      if (rm) { draw(e, staticPath(a.x, a.y, b.x, b.y, e.tension)); e.awake = false; continue; }
      e.awake = stepRope(e.rope, a.x, a.y, b.x, b.y, e.tension);
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
  function onHitDown(ev: PointerEvent, id: string) {
    const e = entries.get(id);
    if (!e || ev.button !== 0) return;
    ev.stopPropagation();
    tdrag = { id, pointerId: ev.pointerId, sy: ev.clientY, start: e.tension, t: e.tension, moved: false };
    (ev.target as Element).setPointerCapture(ev.pointerId);
  }
  svg.addEventListener('pointermove', ev => {
    if (!tdrag || ev.pointerId !== tdrag.pointerId) return;
    const dy = (ev.clientY - tdrag.sy) / deps.scale();
    if (Math.abs(dy) > 4) tdrag.moved = true;
    const e = entries.get(tdrag.id);
    if (!e || !tdrag.moved) return;
    tdrag.t = clamp(tdrag.start + dy / 250, 0, 1);
    e.tension = tdrag.t;
    e.awake = true;
    kick();
  });
  const up = (ev: PointerEvent) => {
    if (!tdrag || ev.pointerId !== tdrag.pointerId) return;
    const d = tdrag;
    tdrag = null;
    if (ev.type === 'pointercancel') return;
    if (d.moved) deps.onTensionCommit(d.id, d.t);
    else deps.onSelect(d.id);
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);

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
          g.append(shadow, halo, main, hit);
          svg.insertBefore(g, previewPath);
          hit.addEventListener('pointerdown', ev => onHitDown(ev, l.id));
          e = {
            link: l, g, paths: [shadow, halo, main, hit], main, halo,
            rope: createRope(pts[0].x, pts[0].y, pts[1].x, pts[1].y, l.tension, startSettled),
            tension: l.tension, awake: true, d: '',
          };
          entries.set(l.id, e);
        }
        if (e.link !== l) { e.link = l; if (!tdrag || tdrag.id !== l.id) e.tension = l.tension; }
        e.g.classList.toggle('selected', l.id === selected);
        style(e);
        e.awake = true;
      }
      for (const [id, e] of entries) if (!seen.has(id)) { e.g.remove(); entries.delete(id); }
      kick();
    },
    override(itemId, pos) {
      if (pos) overrides.set(itemId, pos); else overrides.delete(itemId);
      wake(itemId);
    },
    preview(from, to, color = '#b3261e') {
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
```

- [ ] **Step 2: strings.css**

```css
.strings-layer { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.str path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.str-shadow { stroke: rgba(0, 0, 0, .28); stroke-width: 4; transform: translate(3px, 8px); }
.str-halo { stroke: rgba(12, 8, 4, .6); stroke-width: 6; }   /* keeps red visible on any surface */
.str-main { stroke-width: 3; }
.str-hit { stroke: transparent; stroke-width: calc(28px * var(--inv-scale, 1)); pointer-events: stroke; cursor: ns-resize; }
.str.selected .str-halo { stroke: var(--focus); stroke-width: 8; }
.str-preview { fill: none; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 6 6; opacity: .85; }
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npm test` PASS (rope logic is already unit-tested in Task 7; rendering is checked in Task 14).

- [ ] **Step 4: Commit** (controller) — `feat(view): svg strings with rope physics, halo, tension drag`
