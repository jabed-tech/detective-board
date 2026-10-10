// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { svgDataUrl, svgImage } from './svg-image';

const PREFIX = 'data:image/svg+xml;charset=utf-8,';
describe('svgDataUrl', () => {
  it('encodes the markup', () => {
    const m = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
    const u = svgDataUrl(m);
    expect(u.startsWith(PREFIX)).toBe(true);
    expect(decodeURIComponent(u.slice(PREFIX.length))).toBe(m);
  });
  it('adds xmlns when missing', () => {
    const u = svgDataUrl('<svg viewBox="0 0 1 1"><rect/></svg>');
    expect(decodeURIComponent(u.slice(PREFIX.length))).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect/></svg>');
  });
});

describe('svgImage cache', () => {
  it('caches by markup and evicts failures', async () => {
    let made = 0;
    let fail = false;
    vi.stubGlobal('Image', class {
      onload?: () => void; onerror?: () => void;
      constructor() { made++; }
      set src(_v: string) { setTimeout(() => (fail ? this.onerror?.() : this.onload?.()), 0); }
    });
    const a = svgImage('<svg id="ok"/>');
    expect(svgImage('<svg id="ok"/>')).toBe(a);
    await a;
    expect(made).toBe(1);
    fail = true;
    await expect(svgImage('<svg id="bad"/>')).rejects.toThrow();
    await Promise.resolve();
    fail = false;
    await svgImage('<svg id="bad"/>');
    expect(made).toBe(3);
  });
});
