import { describe, expect, it } from 'vitest';
import { HASH_FIELD_ORDER, hashState, numberToHashBytes } from '../../src/hash';
import type { SimState } from '../../src/types';

function fnv1a(bytes: readonly number[]): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function makeState(overrides: Partial<SimState> = {}): SimState {
  return {
    typeCode: 0,
    modeCode: 0,
    assist: 0,
    seed: 42,
    tick: 10,
    rngState: 123456,
    phase: 1,
    phaseTimer: 0,
    result: 0,
    finalScore: 0,
    strikes: 0,
    score: 25,
    floors: 2,
    restX: [0, 5, -3],
    leanSum: 2,
    lean: 1,
    isRoof: 0,
    roofCommitted: 0,
    craneCenterX: -3,
    cranePhase: 999,
    craneIncrement: 12345,
    craneSpeed: 1000,
    craneX: -10,
    releaseX: 0,
    releaseTick: 0,
    landingTick: 0,
    combo: 1,
    comboMult: 1250,
    goodCount: 1,
    sensitivity: 1050,
    stabilizer: 800,
    swayPhase: 500,
    swayIncrement: 2000,
    swayAmp: 5,
    swayTarget: 10,
    swayS: 2,
    pendingInput: 0,
    lastOffset: 3,
    lastTier: 2,
    ...overrides,
  };
}

describe('numberToHashBytes', () => {
  it('matches the FNV-1a offset basis for an empty stream', () => {
    expect(fnv1a([])).toBe(0x811c9dc5);
  });

  it('encodes 0, 1, -1, 2^32, -2^32-5 and MAX_SAFE_INTEGER exactly', () => {
    expect(numberToHashBytes(0)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(numberToHashBytes(1)).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(numberToHashBytes(-1)).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
    expect(numberToHashBytes(4294967296)).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
    expect(numberToHashBytes(-4294967296 - 5)).toEqual([251, 255, 255, 255, 254, 255, 255, 255]);
    expect(numberToHashBytes(Number.MAX_SAFE_INTEGER)).toEqual([
      255, 255, 255, 255, 255, 255, 31, 0,
    ]);
  });
});

describe('hashState', () => {
  it('is length-prefixed for restX', () => {
    const short = makeState({ restX: [0] });
    const long = makeState({ restX: [0, 0] });
    expect(hashState(short)).not.toBe(hashState(long));
  });

  it('changes when any single field changes', () => {
    const base = makeState();
    const baseHash = hashState(base);
    for (const field of HASH_FIELD_ORDER) {
      if (field === 'restX') {
        const changed = makeState({ restX: [0, 5, -4] });
        expect(hashState(changed), field).not.toBe(baseHash);
        continue;
      }
      const changed = makeState({ [field]: base[field] + 1 });
      expect(hashState(changed), field).not.toBe(baseHash);
    }
  });

  it('is stable for the same state', () => {
    const state = makeState();
    expect(hashState(state)).toBe(hashState(makeState()));
  });
});
