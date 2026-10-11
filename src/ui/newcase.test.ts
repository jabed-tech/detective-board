// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { pickMood } from './newcase';

describe('new case dialog swatches', () => {
  it('the brick swatch carries --brick-tile; others do not', () => {
    const dlg = document.createElement('dialog');
    dlg.showModal = () => {};
    dlg.close = () => {};
    void pickMood(dlg);
    const brick = dlg.querySelector<HTMLElement>('.newcase-swatch.surface-brick')!;
    expect(brick.style.getPropertyValue('--brick-tile')).toMatch(/^url\(/);
    for (const s of dlg.querySelectorAll<HTMLElement>('.newcase-swatch:not(.surface-brick)')) expect(s.style.getPropertyValue('--brick-tile')).toBe('');
  });
});
