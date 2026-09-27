import { describe, expect, it } from 'vitest';
import { advanceCrane, spawnCrane } from '../../src/crane';
import { advance, output } from '../../src/prng';
import { SIN_LUT } from '../../src/sinLut';
import { DEFAULT_TUNING, Q15_SCALE } from '../../src/tuning';
import { makeState } from '../helpers/state';

const tuning = DEFAULT_TUNING;
const residential = tuning.types.residential;

describe('spawnCrane', () => {
  it('sets craneCenterX to restX[N] (excluding sway) and cranePhase to the next PRNG output', () => {
    const state = makeState({ floors: 2, restX: [0, 40, 90], rngState: 777 });
    spawnCrane(state, tuning, residential);
    expect(state.craneCenterX).toBe(90);
    expect(state.cranePhase).toBe(output(advance(777)));
    expect(state.rngState).toBe(advance(777));
  });

  it('computes craneSpeed = min(2000, 1000 + 20*N)', () => {
    for (const n of [0, 1, 10, 49]) {
      const state = makeState({ floors: n, restX: Array(n + 1).fill(0) });
      spawnCrane(state, tuning, residential);
      expect(state.craneSpeed).toBe(Math.min(2000, 1000 + 20 * n));
    }
  });

  it('caps craneSpeed at 2000 for N = 50, 51 and 200', () => {
    for (const n of [50, 51, 200]) {
      const state = makeState({ floors: n, restX: Array(n + 1).fill(0) });
      spawnCrane(state, tuning, residential);
      expect(state.craneSpeed).toBe(2000);
    }
  });

  it('computes craneIncrement = trunc(trunc(2^32/period) * craneSpeed / 1000)', () => {
    const state = makeState({ floors: 5, restX: Array(6).fill(0) });
    spawnCrane(state, tuning, residential);
    const baseIncrement = Math.trunc(4294967296 / residential.cranePeriodTicks);
    const expected = Math.trunc((baseIncrement * state.craneSpeed) / 1000);
    expect(state.craneIncrement).toBe(expected);
  });

  it('sets the initial craneX from the fresh cranePhase', () => {
    const state = makeState({ floors: 0, restX: [0], rngState: 42 });
    spawnCrane(state, tuning, residential);
    const phase = output(advance(42));
    const expectedX =
      state.craneCenterX +
      Math.trunc((tuning.global.CRANE_AMPLITUDE * (SIN_LUT[phase >>> 20] ?? 0)) / Q15_SCALE);
    expect(state.craneX).toBe(expectedX);
  });
});

describe('advanceCrane', () => {
  it('advances cranePhase and recomputes craneX each swinging tick', () => {
    const state = makeState({ floors: 0, restX: [0] });
    spawnCrane(state, tuning, residential);
    const before = { ...state };
    advanceCrane(state, tuning);
    expect(state.cranePhase).toBe((before.cranePhase + before.craneIncrement) >>> 0);
    const expectedX =
      state.craneCenterX +
      Math.trunc(
        (tuning.global.CRANE_AMPLITUDE * (SIN_LUT[state.cranePhase >>> 20] ?? 0)) / Q15_SCALE,
      );
    expect(state.craneX).toBe(expectedX);
  });
});
