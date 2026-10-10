import { jpegToPdf, type PageSize } from './pdf';
import type { Scope } from './region';

export type Format = 'png' | 'jpeg' | 'webp' | 'pdf';

const EXT: Record<Format, string> = { png: 'png', jpeg: 'jpg', webp: 'webp', pdf: 'pdf' };
const MIME: Record<Format, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'case';

export function exportName(caseNo: number, caseName: string, scope: Scope['kind'], itemType: string | undefined, f: Format): string {
  const base = `case-${String(caseNo).padStart(4, '0')}-${slug(caseName)}`;
  const part = scope === 'view' ? '-view' : scope === 'item' ? `-${slug(itemType ?? 'item')}` : '';
  return `${base}${part}.${EXT[f]}`;
}

function toBlob(c: HTMLCanvasElement, type: string, q?: number): Promise<Blob | null> {
  return new Promise(res => c.toBlob(res, type, q));
}

function onWhite(c: HTMLCanvasElement): HTMLCanvasElement {
  const o = document.createElement('canvas');
  o.width = c.width; o.height = c.height;
  const ctx = o.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, o.width, o.height);
  ctx.drawImage(c, 0, 0);
  return o;
}

export async function canvasToFile(c: HTMLCanvasElement, f: Format, page: PageSize, name: string): Promise<{ file: File; fellBack: boolean }> {
  if (f === 'jpeg' || f === 'pdf') {
    const blob = await toBlob(onWhite(c), 'image/jpeg', 0.92);
    if (!blob) throw new Error('encode failed');
    if (f === 'jpeg') return { file: new File([blob], name, { type: 'image/jpeg' }), fellBack: false };
    const pdf = jpegToPdf(new Uint8Array(await blob.arrayBuffer()), c.width, c.height, page);
    return { file: new File([pdf as BlobPart], name, { type: 'application/pdf' }), fellBack: false };
  }
  const blob = await toBlob(c, MIME[f], f === 'webp' ? 0.92 : undefined);
  if (!blob) throw new Error('encode failed');
  if (blob.type === MIME[f]) return { file: new File([blob], name, { type: MIME[f] }), fellBack: false };
  return { file: new File([blob], name.replace(/\.[a-z0-9]+$/i, '.png'), { type: 'image/png' }), fellBack: true };
}
