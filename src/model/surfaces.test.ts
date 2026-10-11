import { describe, expect, it } from 'vitest';
import { moodPatch, pickFastener } from './surfaces';
describe('pickFastener', () => {
  it('keeps the last fastener when the surface allows it', () => expect(pickFastener('brick', 'nail')).toBe('nail'));
  it("falls back to the surface's first fastener", () => expect(pickFastener('glass', 'pin')).toBe('tape'));
  it('keeps magnet on acrylic for boards that already use it', () => expect(pickFastener('glass', 'magnet')).toBe('magnet'));
  it('cork allows tack', () => expect(pickFastener('cork', 'tack')).toBe('tack'));
});
describe('moodPatch', () => {
  it('sets the mood and its surface', () => expect(moodPatch('motel')).toEqual({ mood: 'motel', surface: 'wood' }));
});
