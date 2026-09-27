import { describe, expect, it } from 'vitest';
import { SIN_LUT, SIN_LUT_CHECKSUM } from '../../src/sinLut';

const EXPECTED_CHECKSUM = 3994114618;

function fnv1a(bytes: readonly number[]): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function recomputeChecksum(table: readonly number[]): number {
  const bytes: number[] = [];
  for (const v of table) {
    const u16 = v & 0xffff;
    bytes.push(u16 & 0xff, (u16 >>> 8) & 0xff);
  }
  return fnv1a(bytes);
}

describe('SIN_LUT', () => {
  it('has 4096 entries', () => {
    expect(SIN_LUT.length).toBe(4096);
  });

  it('holds only integers in [-32767, 32767]', () => {
    for (const v of SIN_LUT) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-32767);
      expect(v).toBeLessThanOrEqual(32767);
    }
  });

  it('matches the sine quadrants', () => {
    expect(SIN_LUT[0]).toBe(0);
    expect(SIN_LUT[1024]).toBe(32767);
    expect(SIN_LUT[2048]).toBe(0);
    expect(SIN_LUT[3072]).toBe(-32767);
  });

  it('matches its committed checksum and the hard-coded expectation', () => {
    const recomputed = recomputeChecksum(SIN_LUT);
    expect(recomputed).toBe(EXPECTED_CHECKSUM);
    expect(recomputed).toBe(SIN_LUT_CHECKSUM);
  });
});
