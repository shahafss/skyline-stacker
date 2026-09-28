import { describe, expect, it } from 'vitest';
import { advanceSway, floorDisplayX, recomputeSwayTarget, updateLean } from '../../src/sway';
import { SIN_LUT } from '../../src/sinLut';
import { DEFAULT_TUNING, Q15_SCALE } from '../../src/tuning';
import { makeState } from '../helpers/state';

const tuning = DEFAULT_TUNING;
const residential = tuning.types.residential;

function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

describe('advanceSway', () => {
  it('advances swayPhase by div(2^32, swayPeriodTicks) each call, wrapped to uint32', () => {
    const increment = div(4294967296, residential.swayPeriodTicks);
    const state = makeState({ floors: 1, swayIncrement: increment, swayPhase: 0 });
    advanceSway(state);
    expect(state.swayPhase).toBe(increment >>> 0);
    advanceSway(state);
    expect(state.swayPhase).toBe((increment * 2) >>> 0);
  });

  it('computes S = div(swayAmp * SIN_LUT[swayPhase >>> 20], Q15_SCALE)', () => {
    const state = makeState({
      floors: 1,
      swayIncrement: 1_000_000,
      swayAmp: 100,
      swayTarget: 100,
    });
    advanceSway(state);
    const expected = div(100 * (SIN_LUT[state.swayPhase >>> 20] ?? 0), Q15_SCALE);
    expect(state.swayS).toBe(expected);
  });

  it('stays at 0 while never advanced (N = 0 is never ticked by the caller)', () => {
    const state = makeState({ floors: 0 });
    expect(state.swayPhase).toBe(0);
    expect(state.swayS).toBe(0);
  });

  describe('amplitude smoothing', () => {
    it.each([
      [1, 1],
      [15, 1],
      [16, 1],
      [-1, -1],
      [-17, -1],
    ])('diff = %i steps by %i', (diff, expectedStep) => {
      const state = makeState({ floors: 1, swayAmp: 0, swayTarget: diff });
      advanceSway(state);
      expect(state.swayAmp).toBe(expectedStep);
    });
  });
});

describe('recomputeSwayTarget', () => {
  it('follows PRD §4.3 in order, including the assist step and the cap', () => {
    const state = makeState({
      floors: 10,
      lean: 40,
      goodCount: 3,
      stabilizer: 800,
      assist: 0,
    });
    recomputeSwayTarget(state, tuning, residential);

    const sens = Math.min(2000, 1000 + 50 * 3);
    const rawAmp = 3 * 10 + div(40 * 600 * sens, 1_000_000);
    let targetAmp = div(rawAmp * residential.swayMult, 1000);
    targetAmp = div(targetAmp * 800, 1000);
    targetAmp = div(targetAmp * 1000, 1000);
    targetAmp = Math.min(350, targetAmp);

    expect(state.sensitivity).toBe(sens);
    expect(state.swayTarget).toBe(targetAmp);
  });

  it('applies the assist 500‰ multiplier when assist is on', () => {
    const off = makeState({ floors: 30, lean: 100, goodCount: 5, stabilizer: 1000, assist: 0 });
    const on = makeState({ floors: 30, lean: 100, goodCount: 5, stabilizer: 1000, assist: 1 });
    recomputeSwayTarget(off, tuning, residential);
    recomputeSwayTarget(on, tuning, residential);
    expect(on.swayTarget).toBeLessThan(off.swayTarget);
  });

  it('caps sensitivity at 2000 once goodCount reaches 20', () => {
    const state = makeState({ floors: 1, goodCount: 20 });
    recomputeSwayTarget(state, tuning, residential);
    expect(state.sensitivity).toBe(2000);
  });

  it('never returns more than SWAY_AMP_CAP (350) even at extreme lean', () => {
    const state = makeState({
      floors: 10_000,
      lean: 100_000,
      goodCount: 1000,
      stabilizer: 1000,
      assist: 0,
    });
    recomputeSwayTarget(state, tuning, tuning.types.luxury);
    expect(state.swayTarget).toBeLessThanOrEqual(350);
  });
});

describe('updateLean', () => {
  it('computes leanSum and the signed, truncated lean', () => {
    const state = makeState({ floors: 3, restX: [0, 10, -5, 8] });
    updateLean(state);
    expect(state.leanSum).toBe(13);
    expect(state.lean).toBe(div(13, 3));
  });

  it('is 0 when N = 0', () => {
    const state = makeState({ floors: 0, restX: [0] });
    updateLean(state);
    expect(state.leanSum).toBe(0);
    expect(state.lean).toBe(0);
  });
});

describe('floorDisplayX', () => {
  it('never moves the foundation and moves the top floor by the full S', () => {
    const state = makeState({ floors: 4, restX: [0, 10, 20, 30, 40], swayS: 20 });
    expect(floorDisplayX(state, 0)).toBe(0);
    expect(floorDisplayX(state, 4)).toBe(40 + 20);
  });

  it('interpolates intermediate floors by div(S * i, N)', () => {
    const state = makeState({ floors: 4, restX: [0, 10, 20, 30, 40], swayS: 20 });
    expect(floorDisplayX(state, 2)).toBe(20 + div(20 * 2, 4));
  });

  it('is safe when N = 0', () => {
    const state = makeState({ floors: 0, restX: [0], swayS: 0 });
    expect(floorDisplayX(state, 0)).toBe(0);
  });
});
