// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderItemContent, itemLabel } from './renderers';
import { makeItem } from '../model/actions';

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
});
