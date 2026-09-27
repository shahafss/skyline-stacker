import { describe, expect, it } from 'vitest';
import { U32, div, toU32 } from '../../src/fixed';

describe('div', () => {
  it('truncates toward zero', () => {
    expect(div(7, 2)).toBe(3);
    expect(div(-7, 2)).toBe(-3);
    expect(div(7, -2)).toBe(-3);
    expect(div(0, 5)).toBe(0);
  });
});

describe('U32', () => {
  it('is 2^32', () => {
    expect(U32).toBe(4294967296);
  });
});

describe('toU32', () => {
  it('wraps into uint32 range', () => {
    expect(toU32(-1)).toBe(4294967295);
  });
});
