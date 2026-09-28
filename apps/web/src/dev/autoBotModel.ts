/**
 * Phaser-free and DOM-free model behind the dev-only auto-drop bot (T090). Pure math only,
 * mirroring the landing/sway math in `packages/sim/src/landing.ts` and `packages/sim/src/sway.ts`:
 * `d = releaseX - topX`, where `releaseX` becomes `craneX` at the instant `requestDrop()` is
 * accepted, and `topX = restX[floors] + swayS`.
 *
 * `swayS` keeps changing for one tick (the pending-input delay between calling `requestDrop()`
 * and the sim actually capturing `releaseX`) plus `DROP_FALL_TICKS` more ticks while the block
 * falls (packages/sim/src/sim.ts `step`), so a bot that compares against the *current* `swayS`
 * misses by however much sway moves during that window. This module forward-simulates the sway
 * amplitude/phase update (`advanceSway` in packages/sim/src/sway.ts) for exactly that many ticks
 * to predict the `swayS` the sim will actually land against. It only reads its arguments and never
 * writes any state.
 */

import { Q15_SCALE, SWAY_SMOOTHING_DIVISOR } from '@skyline/sim';

/** Truncating integer division, matching `packages/sim/src/fixed.ts` `div` (research R3). */
function tdiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** Sign of a number: -1, 0 or 1, matching `packages/sim/src/fixed.ts` `sign`. */
function tsign(v: number): number {
  return Math.sign(v);
}

/** Wraps a number into uint32 range, matching `packages/sim/src/fixed.ts` `toU32`. */
function toU32(v: number): number {
  return v >>> 0;
}

/**
 * Q15 sine lookup, computed rather than duplicated from `packages/sim/src/sinLut.ts` (that table
 * is a package-private generated file, not part of `@skyline/sim`'s public API). Matches the
 * table's own generating formula exactly (`SIN_LUT[k] = round(32767 * sin(2*pi*k/4096))`), so the
 * two agree to within the rounding this formula already performs.
 */
const SIN_LUT_SIZE = 4096;
function sinLut(index: number): number {
  return Math.round(32767 * Math.sin((2 * Math.PI * index) / SIN_LUT_SIZE));
}

/**
 * Advances the sway phase/amplitude by one tick, mirroring `advanceSway` in
 * `packages/sim/src/sway.ts` exactly (minus the parts of that function unrelated to phase/amp:
 * `swayS` is derived from the returned phase/amp once the caller is done stepping).
 */
function stepSway(
  phase: number,
  amp: number,
  swayTarget: number,
  swayIncrement: number,
): { phase: number; amp: number } {
  const nextPhase = toU32(phase + swayIncrement);
  const diff = swayTarget - amp;
  let step = tdiv(diff, SWAY_SMOOTHING_DIVISOR);
  if (step === 0 && diff !== 0) step = tsign(diff);
  return { phase: nextPhase, amp: amp + step };
}

/**
 * Predicts `swayS` (packages/sim/src/sway.ts) `ticksAhead` ticks from now, given the sway state
 * read right now (`swayPhase`, `swayAmp`) and the run's read-only sway parameters (`swayTarget`,
 * `swayIncrement`, from the current type's `swayPeriodTicks`).
 */
export function predictSwayAfterTicks(
  swayPhase: number,
  swayAmp: number,
  swayTarget: number,
  swayIncrement: number,
  ticksAhead: number,
): number {
  let phase = swayPhase;
  let amp = swayAmp;
  for (let i = 0; i < ticksAhead; i += 1) {
    ({ phase, amp } = stepSway(phase, amp, swayTarget, swayIncrement));
  }
  const index = phase >>> 20;
  return tdiv(amp * sinLut(index), Q15_SCALE);
}

/**
 * The number of `advanceSway` ticks between reading state and the block's landing tick: one tick
 * for the pending-input delay before `requestDrop()` is captured as `releaseX`/`landingTick`
 * (packages/sim/src/sim.ts `step`), plus `dropFallTicks` (the run's `DROP_FALL_TICKS`) more while
 * it falls.
 */
export function ticksUntilLanding(dropFallTicks: number): number {
  return dropFallTicks + 1;
}

/** The offset the sim would compute right now if `requestDrop()` were called this instant, using
 * the *current* sway (kept only for reference / tests of the raw formula). */
export function predictedLandingOffset(craneX: number, restX: number, swayS: number): number {
  return craneX - (restX + swayS);
}

/**
 * The offset the sim will actually compute at landing if `requestDrop()` is called this instant:
 * `craneX` (frozen as `releaseX` once the drop is processed) minus the top floor's predicted
 * position at landing (`restX` plus the sway forward-simulated to the landing tick).
 */
export function predictedLandingOffsetAtDrop(
  craneX: number,
  restX: number,
  swayPhase: number,
  swayAmp: number,
  swayTarget: number,
  swayIncrement: number,
  dropFallTicks: number,
): number {
  const predictedSwayS = predictSwayAfterTicks(
    swayPhase,
    swayAmp,
    swayTarget,
    swayIncrement,
    ticksUntilLanding(dropFallTicks),
  );
  return predictedLandingOffset(craneX, restX, predictedSwayS);
}

/**
 * True when dropping now would land within `perfectMax` of center at the tick the block actually
 * lands (matches `classifyOffset`'s `<=`), predicting the sway at that future tick rather than the
 * sway right now.
 */
export function shouldDropNow(
  craneX: number,
  restX: number,
  swayPhase: number,
  swayAmp: number,
  swayTarget: number,
  swayIncrement: number,
  dropFallTicks: number,
  perfectMax: number,
): boolean {
  const offset = predictedLandingOffsetAtDrop(
    craneX,
    restX,
    swayPhase,
    swayAmp,
    swayTarget,
    swayIncrement,
    dropFallTicks,
  );
  return Math.abs(offset) <= perfectMax;
}
