import { U32, div, toU32 } from './fixed';
import type { SimState } from './types';

/**
 * Scalar field order hashed by `hashState` (data-model "Hash order"). `restX` is written as its
 * length then its elements, in its position here.
 */
export const HASH_FIELD_ORDER = [
  'typeCode',
  'modeCode',
  'assist',
  'seed',
  'tick',
  'rngState',
  'phase',
  'phaseTimer',
  'result',
  'finalScore',
  'strikes',
  'score',
  'floors',
  'restX',
  'leanSum',
  'lean',
  'isRoof',
  'roofCommitted',
  'craneCenterX',
  'cranePhase',
  'craneIncrement',
  'craneSpeed',
  'craneX',
  'releaseX',
  'releaseTick',
  'landingTick',
  'combo',
  'comboMult',
  'goodCount',
  'sensitivity',
  'stabilizer',
  'swayPhase',
  'swayIncrement',
  'swayAmp',
  'swayTarget',
  'swayS',
  'pendingInput',
  'lastOffset',
  'lastTier',
] as const;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1aByte(hash: number, byte: number): number {
  return Math.imul(hash ^ byte, FNV_PRIME) >>> 0;
}

/**
 * Encodes one safe-integer state value as 8 little-endian bytes (research R11): low 32 bits
 * `v >>> 0`, then high 32 bits `toU32(div(v - lo, U32))`. Exact for every safe integer, including
 * negative ones. Exported for the hash unit tests, not part of the public sim API.
 */
export function numberToHashBytes(v: number): readonly number[] {
  const lo = v >>> 0;
  const hi = toU32(div(v - lo, U32));
  return [
    lo & 0xff,
    (lo >>> 8) & 0xff,
    (lo >>> 16) & 0xff,
    (lo >>> 24) & 0xff,
    hi & 0xff,
    (hi >>> 8) & 0xff,
    (hi >>> 16) & 0xff,
    (hi >>> 24) & 0xff,
  ];
}

function hashNumber(hash: number, v: number): number {
  let h = hash;
  for (const byte of numberToHashBytes(v)) {
    h = fnv1aByte(h, byte);
  }
  return h;
}

/** FNV-1a 32-bit over the fields in `HASH_FIELD_ORDER`. Returns a uint32. */
export function hashState(state: Readonly<SimState>): number {
  let h = FNV_OFFSET_BASIS;
  for (const field of HASH_FIELD_ORDER) {
    if (field === 'restX') {
      h = hashNumber(h, state.restX.length);
      for (const x of state.restX) {
        h = hashNumber(h, x);
      }
    } else {
      h = hashNumber(h, state[field]);
    }
  }
  return h >>> 0;
}
