export interface View { x: number; y: number; scale: number }

export const MIN_SCALE = 0.08;
export const MAX_SCALE = 3;

export const screenToWorld = (v: View, sx: number, sy: number) => ({ x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale });
export const worldToScreen = (v: View, wx: number, wy: number) => ({ x: wx * v.scale + v.x, y: wy * v.scale + v.y });

export function zoomAt(v: View, sx: number, sy: number, factor: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  const w = screenToWorld(v, sx, sy);
  return { scale, x: sx - w.x * scale, y: sy - w.y * scale };
}

export function clampView(v: View, vw: number, vh: number, bw: number, bh: number, margin = 120): View {
  const sw = bw * v.scale;
  const sh = bh * v.scale;
  const mx = Math.min(margin, sw);
  const my = Math.min(margin, sh);
  return {
    ...v,
    x: Math.min(vw - mx, Math.max(mx - sw, v.x)),
    y: Math.min(vh - my, Math.max(my - sh, v.y)),
  };
}

export function fitView(vw: number, vh: number, bw: number, bh: number, pad = 24): View {
  const raw = Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
  return { scale, x: (vw - bw * scale) / 2, y: (vh - bh * scale) / 2 };
}
