import type { Board, Item, Link } from '../model/types';
import { anchorPoint } from '../model/geometry';
import { staticPath } from '../view/rope';
import { arrowHead, hashSeed, markerPath, pathMidpoint } from '../view/linePaths';
import { handFont, roundRectPath } from './draw-core';
import type { Rect } from './region';

type Pt = { x: number; y: number };
const DASH = { solid: [] as number[], dashed: [14, 8], dotted: [1, 8] };

export function linkEnds(l: Link, items: Map<string, Item>): { a: Pt; b: Pt } | null {
  const f = items.get(l.from), t = items.get(l.to);
  if (!f || !t) return null;
  return { a: anchorPoint(f, l.fromAt), b: anchorPoint(t, l.toAt) };
}

/** Settled (no physics) path for a link. */
export function linkPath(l: Link, a: Pt, b: Pt): string {
  const mat = l.material ?? 'yarn';
  if (mat === 'marker') return markerPath(a, b, hashSeed(l.id));
  return staticPath(a.x, a.y, b.x, b.y, l.tension * (mat === 'twine' ? 0.5 : 1));
}

function svgPath(d: string): SVGPathElement | null {
  try {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    return p;
  } catch { return null; }
}

function pathLen(el: SVGPathElement | null): number {
  try { return el && typeof el.getTotalLength === 'function' ? el.getTotalLength() : 0; } catch { return 0; }
}

const inside = (r: Rect, p: Pt) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** sx/sy are the mood's shadow direction (the --sx/--sy table). */
export function drawStrings(ctx: CanvasRenderingContext2D, b: Board, region: Rect, onlyInside: boolean, sx: number, sy: number): void {
  const items = new Map(b.items.map(i => [i.id, i]));
  for (const l of b.links) {
    const e = linkEnds(l, items);
    if (!e) continue;
    if (onlyInside && !(inside(region, e.a) && inside(region, e.b))) continue;
    drawLink(ctx, l, e.a, e.b, sx, sy);
  }
}

function drawLink(ctx: CanvasRenderingContext2D, l: Link, a: Pt, b: Pt, sx: number, sy: number): void {
  const mat = l.material ?? 'yarn';
  const t = typeof l.thickness === 'number' && l.thickness > 0 ? Math.min(l.thickness, 4) : 1;
  const d = linkPath(l, a, b);
  const path = new Path2D(d);
  const dash = mat === 'twine' ? [7, 1.2] : DASH[l.style ?? 'solid'] ?? [];
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  if (mat !== 'marker') {
    ctx.save();
    ctx.translate(sx * 2, sy * 4);
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 4 * t;
    ctx.stroke(path);
    ctx.restore();
    ctx.strokeStyle = 'rgba(12,8,4,.6)'; ctx.lineWidth = 6 * t;
    ctx.stroke(path);
  }
  ctx.strokeStyle = l.color;
  ctx.lineWidth = (mat === 'twine' ? 2.2 : mat === 'marker' ? 4 : 3) * t;
  ctx.stroke(path);
  ctx.setLineDash([]);

  const el = svgPath(d);
  const len = pathLen(el);
  if (l.arrow) {
    const size = 12 + 6 * t;
    const near = (atEnd: boolean): Pt => {
      if (el && len > size) { const p = el.getPointAtLength(atEnd ? len - size : size); return { x: p.x, y: p.y }; }
      return atEnd ? a : b;
    };
    ctx.fillStyle = l.color;
    ctx.fill(new Path2D(arrowHead(b, near(true), size)));
    if (l.arrow === 'both') ctx.fill(new Path2D(arrowHead(a, near(false), size)));
  }
  if (l.label) {
    const mid = (el && pathMidpoint(el)) || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    ctx.font = handFont(22);
    const pw = ctx.measureText(l.label).width + 16, ph = 30;
    roundRectPath(ctx, mid.x - pw / 2, mid.y - ph / 2, pw, ph, 4);
    ctx.fillStyle = '#fbf8ef'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#22201a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(l.label, mid.x, mid.y + 1);
  }
  ctx.restore();
}
