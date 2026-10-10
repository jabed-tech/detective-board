const NS = 'http://www.w3.org/2000/svg';

/** Static SVG as a data URL (drawn through an <img> — no foreignObject — so Safari keeps the canvas untainted). */
export function svgDataUrl(markup: string): string {
  const m = /<svg\b[^>]*>/.exec(markup);
  const fixed = m && !/\sxmlns\s*=/.test(m[0]) ? markup.replace('<svg', `<svg xmlns="${NS}"`) : markup;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fixed);
}

const cache = new Map<string, Promise<HTMLImageElement>>();

/** Decoded image for the markup, cached by markup. Rejects if it fails to decode (callers catch). */
export function svgImage(markup: string): Promise<HTMLImageElement> {
  let p = cache.get(markup);
  if (!p) {
    p = new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      const t = setTimeout(() => rej(new Error('svg decode timeout')), 8000);
      im.onload = () => { clearTimeout(t); res(im); };
      im.onerror = () => { clearTimeout(t); rej(new Error('svg decode failed')); };
      im.src = svgDataUrl(markup);
    });
    p.catch(() => cache.delete(markup));
    cache.set(markup, p);
  }
  return p;
}
