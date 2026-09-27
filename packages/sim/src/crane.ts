import { U32, div, min, toU32 } from './fixed';
import { advance, output } from './prng';
import { SIN_LUT } from './sinLut';
import { Q15_SCALE } from './tuning';
import type { SimState, TuningValues, TypeTuning } from './types';

/** Horizontal crane offset from its center, in su (PRD §3.3). */
function craneOffset(cranePhase: number, amplitude: number): number {
  const index = cranePhase >>> 20;
  return div(amplitude * (SIN_LUT[index] ?? 0), Q15_SCALE);
}

/**
 * Sets up the crane for a freshly spawned block: center, start phase (from the PRNG), speed and
 * increment for this floor count, then the initial `craneX` (PRD §3.3).
 */
export function spawnCrane(state: SimState, tuning: TuningValues, typeTuning: TypeTuning): void {
  const n = state.floors;
  state.craneCenterX = state.restX[n] ?? 0;

  state.rngState = advance(state.rngState);
  state.cranePhase = output(state.rngState);

  const global = tuning.global;
  state.craneSpeed = min(global.CRANE_SPEED_CAP, 1000 + global.CRANE_SPEED_PER_FLOOR * n);
  const baseIncrement = div(U32, typeTuning.cranePeriodTicks);
  state.craneIncrement = div(baseIncrement * state.craneSpeed, 1000);

  state.craneX = state.craneCenterX + craneOffset(state.cranePhase, global.CRANE_AMPLITUDE);
}

/** Advances the crane by one swinging tick: phase, then recomputed `craneX` (PRD §3.3). */
export function advanceCrane(state: SimState, tuning: TuningValues): void {
  state.cranePhase = toU32(state.cranePhase + state.craneIncrement);
  state.craneX = state.craneCenterX + craneOffset(state.cranePhase, tuning.global.CRANE_AMPLITUDE);
}
