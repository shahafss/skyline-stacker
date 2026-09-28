import { abs, div, min, sign, toU32 } from './fixed';
import { SIN_LUT } from './sinLut';
import { Q15_SCALE, SWAY_SMOOTHING_DIVISOR } from './tuning';
import type { SimState, TuningValues, TypeTuning } from './types';

/**
 * Advances tower sway by one tick (PRD §4.1, §4.3): the phase accumulator, the amplitude
 * smoothing step toward `swayTarget`, and the shear displacement `swayS`. The caller only invokes
 * this while `floors >= 1` (data-model §4).
 */
export function advanceSway(state: SimState): void {
  state.swayPhase = toU32(state.swayPhase + state.swayIncrement);

  const diff = state.swayTarget - state.swayAmp;
  let step = div(diff, SWAY_SMOOTHING_DIVISOR);
  if (step === 0 && diff !== 0) step = sign(diff);
  state.swayAmp += step;

  const index = state.swayPhase >>> 20;
  state.swayS = div(state.swayAmp * (SIN_LUT[index] ?? 0), Q15_SCALE);
}

/**
 * Recomputes the sway amplitude target after a successful landing (PRD §4.3), in the exact
 * written order of truncations. Also updates `sensitivity`, which this formula defines.
 */
export function recomputeSwayTarget(
  state: SimState,
  tuning: TuningValues,
  typeTuning: TypeTuning,
): void {
  const global = tuning.global;
  const sens = min(global.SENSITIVITY_CAP, 1000 + global.SENSITIVITY_STEP * state.goodCount);
  state.sensitivity = sens;

  const rawAmp =
    global.BASE_SWAY_PER_FLOOR * state.floors +
    div(abs(state.lean) * global.LEAN_GAIN * sens, 1_000_000);

  let targetAmp = div(rawAmp * typeTuning.swayMult, 1000);
  targetAmp = div(targetAmp * state.stabilizer, 1000);
  const assistPermille = state.assist === 1 ? global.ASSIST_SWAY : 1000;
  targetAmp = div(targetAmp * assistPermille, 1000);
  targetAmp = min(global.SWAY_AMP_CAP, targetAmp);

  state.swayTarget = targetAmp;
}

/** Recomputes `leanSum` and the signed `lean` from `restX` (PRD §4.2). */
export function updateLean(state: SimState): void {
  let sum = 0;
  for (let i = 1; i < state.restX.length; i += 1) {
    sum += state.restX[i] ?? 0;
  }
  state.leanSum = sum;
  state.lean = state.floors === 0 ? 0 : div(sum, state.floors);
}

/** Displayed X of floor `i` (0..N), in su: `restX[i] + div(swayS * i, N)` (PRD §4.1). */
export function floorDisplayX(state: Readonly<SimState>, i: number): number {
  const n = state.floors;
  const base = state.restX[i] ?? 0;
  if (n === 0) return base;
  return base + div(state.swayS * i, n);
}
