import { describe, it, expect } from 'vitest';
import { fitWithin } from './process';

describe('fitWithin', () => {
  it('leaves small images alone', () => expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 }));
  it('scales the long edge to the max', () => expect(fitWithin(4000, 3000)).toEqual({ w: 1600, h: 1200 }));
  it('handles portrait', () => expect(fitWithin(3000, 6000)).toEqual({ w: 800, h: 1600 }));
  it('never returns zero', () => expect(fitWithin(10000, 1)).toEqual({ w: 1600, h: 1 }));
});
