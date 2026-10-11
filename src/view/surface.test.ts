// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applySurface } from './surface';

describe('applySurface', () => {
  const setup = () => { const world = document.createElement('div'); const s = document.createElement('div'); world.append(s); return { world, s }; };
  it('marks the world with the surface so item shadows can adapt', () => {
    const { world, s } = setup();
    applySurface(s, 'glass');
    expect(world.dataset.surface).toBe('glass');
    expect(s.getAttribute('aria-label')).toBe('Acrylic panel');
    applySurface(s, 'cork');
    expect(world.dataset.surface).toBe('cork');
  });
  it('sets the brick tile only on brick', () => {
    const { s } = setup();
    applySurface(s, 'brick');
    expect(s.style.getPropertyValue('--brick-tile')).toMatch(/^url\("data:image\/svg\+xml/);
    applySurface(s, 'glass');
    expect(s.style.getPropertyValue('--brick-tile')).toBe('');
  });
});
