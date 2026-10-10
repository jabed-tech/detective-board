import { describe, expect, it } from 'vitest';
import { pickFastener } from './surfaces';
describe('pickFastener', () => {
  it('keeps the last fastener when the surface allows it', () => expect(pickFastener('brick', 'nail')).toBe('nail'));
  it("falls back to the surface's first fastener", () => expect(pickFastener('glass', 'pin')).toBe('magnet'));
  it('cork allows tack', () => expect(pickFastener('cork', 'tack')).toBe('tack'));
});
