# Task 5: Image processing (Haiku)

Read `00-overview.md` Global Constraints. Depends on Task 1. Parallel with Tasks 3, 4, 6–8.

**Files:**
- Create: `src/images/process.ts`, `src/images/urls.ts`
- Test: `src/images/process.test.ts`

**Produces:**
```ts
export const MAX_EDGE = 1600;
export function fitWithin(w: number, h: number, max?: number): { w: number; h: number };
export class ImageReadError extends Error {}
export async function processImage(file: Blob): Promise<{ blob: Blob; w: number; h: number }>; // browser only
export async function imageUrl(id: string, getBlob: (id: string) => Promise<Blob | undefined>): Promise<string | undefined>;
export function revokeAllImageUrls(): void;
```
Re-encoding through a canvas strips EXIF/GPS (spec §Privacy).

- [ ] **Step 1: Failing test** — `src/images/process.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { fitWithin } from './process';

describe('fitWithin', () => {
  it('leaves small images alone', () => expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 }));
  it('scales the long edge to the max', () => expect(fitWithin(4000, 3000)).toEqual({ w: 1600, h: 1200 }));
  it('handles portrait', () => expect(fitWithin(3000, 6000)).toEqual({ w: 800, h: 1600 }));
  it('never returns zero', () => expect(fitWithin(10000, 1)).toEqual({ w: 1600, h: 1 }));
});
```

Run → FAIL.

- [ ] **Step 2: process.ts**

```ts
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
```

- [ ] **Step 3: urls.ts**

```ts
const cache = new Map<string, string>();

export async function imageUrl(id: string, getBlob: (id: string) => Promise<Blob | undefined>): Promise<string | undefined> {
  const hit = cache.get(id);
  if (hit) return hit;
  const blob = await getBlob(id);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  cache.set(id, url);
  return url;
}

export function revokeAllImageUrls(): void {
  for (const u of cache.values()) URL.revokeObjectURL(u);
  cache.clear();
}
```

Run: `npm test` → PASS. (`processImage` is verified in the browser in Task 14.)

- [ ] **Step 4: Commit** (controller) — `feat(images): resize + re-encode uploads, object url cache`
