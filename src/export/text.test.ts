import { describe, it, expect } from 'vitest';
import { wrapLines } from './text';

const m = (s: string) => s.length;
describe('wrapLines', () => {
  it('wraps at word boundaries', () => { expect(wrapLines('aa bb cc', 5, m)).toEqual(['aa bb', 'cc']); });
  it('keeps explicit newlines', () => { expect(wrapLines('aa\nbb', 10, m)).toEqual(['aa', 'bb']); });
  it('hard-breaks long words', () => { expect(wrapLines('abcdefghij', 4, m)).toEqual(['abcd', 'efgh', 'ij']); });
  it('empty string', () => { expect(wrapLines('', 5, m)).toEqual(['']); });
});
