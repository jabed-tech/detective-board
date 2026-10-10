// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStrings, type StringsView } from './strings';
import { connect, makeItem, addItem, newBoard, updateLink } from '../model/actions';
import type { Board } from '../model/types';

const NS = 'http://www.w3.org/2000/svg';
let svg: SVGSVGElement, hit: SVGSVGElement, view: StringsView;

function base(): { b: Board; id: string } {
  let b = newBoard('t', 1);
  const i1 = makeItem('sticky', 300, 300), i2 = makeItem('sticky', 800, 500);
  b = addItem(addItem(b, i1), i2);
  b = connect(b, i1.id, i2.id, { color: '#b3261e', tension: 0.5 });
  return { b, id: b.links[0].id };
}
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
  hit = document.createElementNS(NS, 'svg') as SVGSVGElement;
  view = createStrings(svg, hit, { reducedMotion: () => true, scale: () => 1, onSelect() {}, erasing: () => false, onErase() {}, onTensionCommit() {} });
});

describe('strings view materials, arrows, labels', () => {
  it('renders the label as literal text, and the material class', () => {
    const { b, id } = base();
    const evil = '<img src=x onerror=alert(1)>';
    view.sync(updateLink(b, id, { label: evil, material: 'marker' }));
    expect(svg.querySelector('.str-label text')!.textContent).toBe(evil);
    expect(svg.querySelector('img')).toBeNull();
    expect(svg.querySelector('.str')!.classList.contains('mat-marker')).toBe(true);
  });
  it('sets --sw from thickness', () => {
    const { b, id } = base();
    view.sync(updateLink(b, id, { thickness: 2.4 }));
    expect((svg.querySelector('.str') as SVGGElement).getAttribute('style')).toContain('--sw: 2.4');
  });
  it('shows arrows per link.arrow', () => {
    const { b, id } = base();
    const vis = () => [...svg.querySelectorAll('.str-arrow')].filter(p => !p.hasAttribute('hidden')).length;
    view.sync(b); expect(vis()).toBe(0);
    view.sync(updateLink(b, id, { arrow: 'end' })); expect(vis()).toBe(1);
    view.sync(updateLink(b, id, { arrow: 'both' })); expect(vis()).toBe(2);
  });
  it('removes the label when cleared and the string when the link goes', () => {
    const { b, id } = base();
    const b2 = updateLink(b, id, { label: 'hi' });
    view.sync(b2); expect(svg.querySelector('.str-label')).not.toBeNull();
    view.sync(updateLink(b2, id, { label: undefined })); expect(svg.querySelector('.str-label')).toBeNull();
    view.sync({ ...b2, links: [] }); expect(svg.querySelector('.str')).toBeNull();
  });
});
