import { BOARD_H, BOARD_W, PIN_COLORS, YARN_COLORS, type Board, type Item, type ItemType, type Link, type LineStyle } from '../model/types';
import { newId } from '../model/actions';

export const FORMAT = 'detective-board';
export type ImportError = 'not-json' | 'wrong-format' | 'newer-version' | 'bad-shape' | 'bad-asset';
export type ImportResult = { ok: true; board: Board; assets: Record<string, Blob> } | { ok: false; error: ImportError };

export const IMPORT_MESSAGES: Record<ImportError, [string, string]> = {
  'not-json': ['That file is smudged beyond reading.', "It isn't a valid JSON file."],
  'wrong-format': ["That's not one of our case files.", 'Pick a .json file exported from Detective Board.'],
  'newer-version': ['This file is from the future.', 'It was made by a newer version of Detective Board. Reload the page and try again.'],
  'bad-shape': ['The case file is damaged.', 'Its contents are missing or corrupted, so nothing was imported.'],
  'bad-asset': ['A photo in this file is damaged.', 'One of the embedded images is corrupted, so nothing was imported.'],
};

const ITEM_TYPES = new Set<ItemType>(['photo', 'polaroid', 'sticky', 'index']);
const STYLES = new Set<LineStyle>(['solid', 'dashed', 'dotted']);
const HEX = /^#[0-9a-f]{6}$/i;
const DATA_URL = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]*={0,2})$/;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const color = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v : d);

function validateItem(raw: unknown): Item | null {
  if (!isRec(raw)) return null;
  const id = str(raw.id, 100);
  const type = raw.type as ItemType;
  if (!id || !ITEM_TYPES.has(type)) return null;
  const w = num(raw.w, 40, 1200, 220);
  const h = num(raw.h, 40, 1200, 220);
  const d = isRec(raw.data) ? raw.data : {};
  const data: Item['data'] = {};
  const imageId = str(d.imageId, 100);
  const text = str(d.text, 5000);
  const caption = str(d.caption, 200);
  if (imageId) data.imageId = imageId;
  if (text !== undefined) data.text = text;
  if (caption !== undefined) data.caption = caption;
  return {
    id, type, w, h,
    x: num(raw.x, 0, BOARD_W - w, 0),
    y: num(raw.y, 0, BOARD_H - h, 0),
    rot: num(raw.rot, -180, 180, 0),
    z: Math.round(num(raw.z, 0, 1e6, 0)),
    attach: 'pin',
    attachColor: color(raw.attachColor, PIN_COLORS[0]),
    data,
  };
}

function validateLink(raw: unknown, ids: Set<string>): Link | null {
  if (!isRec(raw)) return null;
  const id = str(raw.id, 100);
  const from = str(raw.from, 100);
  const to = str(raw.to, 100);
  if (!id || !from || !to || from === to || !ids.has(from) || !ids.has(to)) return null;
  const link: Link = { id, from, to, color: color(raw.color, YARN_COLORS[0]), tension: num(raw.tension, 0, 1, 0.5) };
  if (STYLES.has(raw.style as LineStyle)) link.style = raw.style as LineStyle;
  const label = str(raw.label, 80);
  if (label) link.label = label;
  return link;
}

export function validateBoard(raw: unknown): Board | null {
  if (!isRec(raw) || !Array.isArray(raw.items) || !Array.isArray(raw.links)) return null;
  const items: Item[] = [];
  const ids = new Set<string>();
  for (const r of raw.items) {
    const it = validateItem(r);
    if (it && !ids.has(it.id)) { ids.add(it.id); items.push(it); }
  }
  const links: Link[] = [];
  const linkIds = new Set<string>();
  for (const r of raw.links) {
    const l = validateLink(r, ids);
    if (l && !linkIds.has(l.id)) { linkIds.add(l.id); links.push(l); }
  }
  return {
    id: str(raw.id, 100) || newId(),
    name: str(raw.name, 80)?.trim() || 'Untitled case',
    caseNo: Math.round(num(raw.caseNo, 1, 9999, 1)),
    surface: 'cork', mood: 'noir-office',
    items, links, version: 1,
    updatedAt: num(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

async function blobToDataUrl(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${b.type};base64,${btoa(s)}`;
}

function dataUrlToBlob(url: string): Blob | null {
  const m = DATA_URL.exec(url);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  } catch {
    return null;
  }
}

export async function exportBoard(board: Board, getBlob: (id: string) => Promise<Blob | undefined>): Promise<Blob> {
  const assets: Record<string, string> = {};
  for (const it of board.items) {
    const id = it.data.imageId;
    if (!id || Object.hasOwn(assets, id)) continue;
    const blob = await getBlob(id);
    if (blob) assets[id] = await blobToDataUrl(blob);
  }
  return new Blob([JSON.stringify({ format: FORMAT, version: 1, board, assets })], { type: 'application/json' });
}

function remapIds(board: Board, assets: Map<string, Blob>): { board: Board; assets: Record<string, Blob> } {
  const itemMap = new Map<string, string>();
  const imgMap = new Map<string, string>();
  const outAssets: Record<string, Blob> = {};
  for (const [old, blob] of assets) { const n = newId(); imgMap.set(old, n); outAssets[n] = blob; }
  const items = board.items.map(it => {
    const id = newId();
    itemMap.set(it.id, id);
    const data = { ...it.data };
    if (data.imageId) data.imageId = imgMap.get(data.imageId);
    return { ...it, id, data };
  });
  const links = board.links.map(l => ({ ...l, id: newId(), from: itemMap.get(l.from)!, to: itemMap.get(l.to)! }));
  return { board: { ...board, id: newId(), items, links }, assets: outAssets };
}

export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'not-json' }; }
  if (!isRec(raw) || raw.format !== FORMAT || typeof raw.version !== 'number') return { ok: false, error: 'wrong-format' };
  if (raw.version > 1) return { ok: false, error: 'newer-version' };
  const board = validateBoard(raw.board);
  if (!board) return { ok: false, error: 'bad-shape' };
  const src = isRec(raw.assets) ? raw.assets : {};
  const assets = new Map<string, Blob>();
  for (const it of board.items) {
    const id = it.data.imageId;
    if (!id) continue;
    if (assets.has(id)) continue;
    const url = Object.hasOwn(src, id) ? src[id] : undefined;
    if (typeof url !== 'string') { delete it.data.imageId; continue; } // item shows "photo missing"
    const blob = dataUrlToBlob(url);
    if (!blob) return { ok: false, error: 'bad-asset' };
    assets.set(id, blob);
  }
  return { ok: true, ...remapIds(board, assets) };
}
