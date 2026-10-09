import { describe, it, expect } from 'vitest';
import { createDemoBoard } from './demo';
import { validateBoard } from './storage/transfer';

describe('demo case', () => {
  it('is a valid board with items and strings', () => {
    const b = createDemoBoard();
    expect(b.name).toBe('The Case of the Missing Stapler');
    expect(b.items.length).toBeGreaterThanOrEqual(6);
    expect(b.links).toHaveLength(4);
    const v = validateBoard(JSON.parse(JSON.stringify(b)))!;
    expect(v.items).toHaveLength(b.items.length);
    expect(v.links).toHaveLength(4);
  });
  it('teaches the gestures', () => {
    const text = createDemoBoard().items.map(i => i.data.text ?? '').join(' ').toLowerCase();
    expect(text).toContain('drag');
    expect(text).toContain('string');
    expect(text).toContain('zoom');
  });
});
