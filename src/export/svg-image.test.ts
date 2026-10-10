import { describe, expect, it } from 'vitest';
import { svgDataUrl } from './svg-image';

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
