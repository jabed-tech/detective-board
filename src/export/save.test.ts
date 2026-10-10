// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { canvasToFile, exportName } from './save';

describe('exportName', () => {
  it('builds slugged names', () => {
    expect(exportName(7, 'The Missing Stapler!', 'board', undefined, 'png')).toBe('case-0007-the-missing-stapler.png');
    expect(exportName(7, 'The Missing Stapler!', 'item', 'receipt', 'pdf')).toBe('case-0007-the-missing-stapler-receipt.pdf');
    expect(exportName(7, 'The Missing Stapler!', 'view', undefined, 'jpeg')).toBe('case-0007-the-missing-stapler-view.jpg');
  });
});

describe('canvasToFile', () => {
  it('falls back to png when webp is unsupported', async () => {
    const c = {
      width: 4, height: 4,
      toBlob(cb: (b: Blob | null) => void, type?: string) { cb(new Blob(['x'], { type: type === 'image/webp' ? 'image/png' : type })); },
    } as unknown as HTMLCanvasElement;
    const r = await canvasToFile(c, 'webp', 'fit', 'a.webp');
    expect(r.fellBack).toBe(true);
    expect(r.file.name).toBe('a.png');
    expect(r.file.type).toBe('image/png');
    const ok = await canvasToFile(c, 'png', 'fit', 'a.png');
    expect(ok.fellBack).toBe(false);
  });
});
