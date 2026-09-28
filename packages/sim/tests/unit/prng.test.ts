import { describe, expect, it } from 'vitest';
import { advance, output } from '../../src/prng';

/** Reference mulberry32, written independently of src/prng.ts, split the same way. */
function referenceAdvance(state: number): number {
  return (state + 0x6d2b79f5) >>> 0;
}

function referenceOutput(state: number): number {
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) | 0;
  return (t ^ (t >>> 14)) >>> 0;
}

describe('mulberry32 (advance/output)', () => {
  it.each([0, 1, 0xdeadbeef])('matches a reference implementation for seed %i', (seed) => {
    let state = seed;
    let refState = seed;
    for (let i = 0; i < 1000; i += 1) {
      state = advance(state);
      refState = referenceAdvance(refState);
      const draw = output(state);
      const refDraw = referenceOutput(refState);
      expect(draw).toBe(refDraw);
      expect(Number.isInteger(draw)).toBe(true);
      expect(draw).toBeGreaterThanOrEqual(0);
      expect(draw).toBeLessThan(4294967296);
    }
  });

  it('produces the same sequence for the same seed', () => {
    let a = 42;
    let b = 42;
    for (let i = 0; i < 100; i += 1) {
      a = advance(a);
      b = advance(b);
      expect(output(a)).toBe(output(b));
    }
  });
});
