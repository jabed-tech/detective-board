// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderItemContent, itemLabel } from './renderers';
import { makeItem } from '../model/actions';
import type { ItemData } from '../model/types';

const evil = '<img src=x onerror="window.pwned=1"><b>bold</b>';

describe('renderers', () => {
  it('renders sticky text literally', () => {
    const body = document.createElement('div');
    renderItemContent(body, makeItem('sticky', 0, 0, { text: evil }));
    expect(body.querySelector('img, b')).toBeNull();
    expect(body.textContent).toBe(evil);
  });
  it('renders polaroid captions literally and adds an img only for imageId', () => {
    const body = document.createElement('div');
    renderItemContent(body, makeItem('polaroid', 0, 0, { caption: evil, imageId: 'abc' }));
    expect(body.querySelectorAll('img')).toHaveLength(1);
    expect(body.querySelector('b')).toBeNull();
    expect(body.querySelector('.pol-cap')!.textContent).toBe(evil);
  });
  it('polaroid without a photo shows a silhouette', () => {
    const body = document.createElement('div');
    renderItemContent(body, makeItem('polaroid', 0, 0, { caption: 'Gary' }));
    expect(body.querySelector('img')).toBeNull();
    expect(body.querySelector('.pol-silhouette')).not.toBeNull();
  });
  it('unknown polaroid shows a ? over the silhouette and is labelled', () => {
    const body = document.createElement('div');
    const it = makeItem('polaroid', 0, 0, { unknown: true, caption: 'Unknown suspect' });
    renderItemContent(body, it);
    expect(body.querySelector('.pol-silhouette')).not.toBeNull();
    expect(body.querySelector('.pol-unknown')!.textContent).toBe('?');
    expect(itemLabel(it)).toBe('Unknown person: Unknown suspect');
    expect(itemLabel(makeItem('polaroid', 0, 0, { unknown: true }))).toBe('Unknown person');
  });
  it('re-rendering replaces old content', () => {
    const body = document.createElement('div');
    renderItemContent(body, makeItem('sticky', 0, 0, { text: 'one' }));
    renderItemContent(body, makeItem('sticky', 0, 0, { text: 'two' }));
    expect(body.textContent).toBe('two');
  });
  it('labels items for screen readers', () => {
    expect(itemLabel(makeItem('sticky', 0, 0, { text: '  Gary did it  ' }))).toBe('Sticky note: Gary did it');
    expect(itemLabel(makeItem('photo', 0, 0, {}))).toBe('Photograph');
  });

  const EVIL = '<img src=x onerror=alert(1)>';
  const evilData = { name: EVIL, bookingNo: EVIL, masthead: EVIL, date: EVIL, headline: EVIL, text: EVIL,
    store: EVIL, time: EVIL, lines: [{ name: EVIL, price: 199 }], subject: EVIL, officer: EVIL, status: EVIL, caption: EVIL };
  for (const type of ['mugshot', 'newspaper', 'receipt', 'casefile', 'object'] as const) {
    it(`${type}: user text is literal`, () => {
      const body = document.createElement('div');
      renderItemContent(body, { ...makeItem(type, 0, 0), data: { ...evilData, object: 'keys' } });
      expect(body.querySelector('img[src="x"]')).toBeNull();
      expect(body.textContent).toContain(EVIL);
    });
  }
  const render = (type: Parameters<typeof makeItem>[0], data: Record<string, unknown>) => {
    const body = document.createElement('div');
    renderItemContent(body, makeItem(type, 0, 0, data as ItemData));
    return body;
  };
  it('receipt lists lines and totals', () => {
    const body = render('receipt', { lines: [{ name: 'Tea', price: 120 }, { name: 'Rope', price: 799 }] });
    expect(body.querySelectorAll('li')).toHaveLength(2);
    expect(body.querySelector('.rc-total')!.textContent).toContain('£9.19');
  });
  it('sketch draws strokes as filled paths', () => {
    const strokes = [{ d: 'M0 0L10 10Z', color: '#112233', width: 3 }, { d: 'M5 5L9 9Z', color: '#aa0000', width: 3 }];
    const body = render('sketch', { strokes });
    const paths = body.querySelectorAll('svg.sk path');
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute('d')).toBe(strokes[0].d);
    expect(paths[0].getAttribute('fill')).toBe(strokes[0].color);
    const empty = render('sketch', { strokes: [] });
    expect(empty.querySelector('svg.sk')).not.toBeNull();
    expect(empty.querySelectorAll('svg.sk path')).toHaveLength(0);
  });
  it('stamps', () => {
    expect(render('stamp', { stamp: 'case-closed' }).querySelector('.stamp-text')!.textContent).toBe('CASE CLOSED');
    expect(render('stamp', { stamp: 'red-x' }).querySelector('svg')).not.toBeNull();
  });
  it('objects render art', () => {
    for (const o of ['keys', 'matchbook', 'cassette', 'casing', 'evidence-bag', 'ticket', 'burner-phone'])
      expect(render('object', { object: o }).querySelector('.obj-art svg')).not.toBeNull();
  });
  it('aged and crossed overlays', () => {
    const a = render('sticky', { aged: true });
    expect(a.querySelector('.aged-overlay')).not.toBeNull();
    expect(a.querySelector('.cross-overlay')).toBeNull();
    const c = render('sticky', { crossed: true });
    expect(c.querySelector('.cross-overlay svg')).not.toBeNull();
    const n = render('sticky', {});
    expect(n.querySelector('.aged-overlay, .cross-overlay')).toBeNull();
  });
  it('mugshot silhouette vs image', () => {
    expect(render('mugshot', {}).querySelector('.pol-silhouette')).not.toBeNull();
    expect(render('mugshot', { imageId: 'a' }).querySelector('img.it-img')).not.toBeNull();
  });
  it('newspaper and casefile have one it-text', () => {
    expect(render('newspaper', {}).querySelectorAll('.it-text')).toHaveLength(1);
    expect(render('casefile', {}).querySelectorAll('.it-text')).toHaveLength(1);
  });
  it('labels new types', () => {
    expect(itemLabel(makeItem('mugshot', 0, 0, { name: 'Gary' }))).toBe('Mugshot: Gary');
    expect(itemLabel(makeItem('stamp', 0, 0, { stamp: 'classified' }))).toBe('Stamp: CLASSIFIED');
    expect(itemLabel(makeItem('object', 0, 0, { object: 'keys', caption: 'Found in sink' }))).toBe('Keys: Found in sink');
  });
});
