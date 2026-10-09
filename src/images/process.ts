export const MAX_EDGE = 1600;

export class ImageReadError extends Error {}

export function fitWithin(w: number, h: number, max = MAX_EDGE): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(res => canvas.toBlob(res, type, quality));
}

export async function processImage(file: Blob): Promise<{ blob: Blob; w: number; h: number }> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageReadError('Could not decode image');
  }
  const { w, h } = fitWithin(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) { bmp.close(); throw new ImageReadError('No 2D context'); }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  let blob = await toBlob(canvas, 'image/webp', 0.8);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85);
  if (!blob) throw new ImageReadError('Could not encode image');
  return { blob, w, h };
}
