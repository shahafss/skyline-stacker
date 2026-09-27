import { abs, div, max, min } from './fixed';
import { recomputeSwayTarget, updateLean } from './sway';
import {
  PHASE_ENDED,
  PHASE_SPAWN_DELAY,
  RESULT_BUILT,
  RESULT_COMPLETED,
  RESULT_GAME_OVER,
  TIER_GOOD,
  TIER_MISS,
  TIER_PERFECT,
} from './types';
import type { SimEvent, SimState, TuningValues, TypeTuning } from './types';

/** Classifies a signed landing offset `d` by `PERFECT_MAX` / `GOOD_MAX` (PRD §3.5). */
export function classifyOffset(d: number, tuning: TuningValues): number {
  const ad = abs(d);
  if (ad <= tuning.global.PERFECT_MAX) return TIER_PERFECT;
  if (ad <= tuning.global.GOOD_MAX) return TIER_GOOD;
  return TIER_MISS;
}

/** Ends the run: sets `result`/`finalScore`, ends the phase, and emits the closing event. */
export function endRun(
  state: SimState,
  result: typeof RESULT_COMPLETED | typeof RESULT_BUILT | typeof RESULT_GAME_OVER,
  tuning: TuningValues,
  events: SimEvent[],
): void {
  state.result = result;
  state.finalScore =
    result === RESULT_COMPLETED
      ? state.score + div(state.score * tuning.global.COMPLETION_BONUS, 1000)
      : state.score;
  state.phase = PHASE_ENDED;

  if (result === RESULT_GAME_OVER) {
    events.push({ kind: 'gameOver', score: state.finalScore, floors: state.floors });
  } else {
    events.push({
      kind: 'finished',
      result: result === RESULT_COMPLETED ? 'completed' : 'built',
      score: state.finalScore,
      floors: state.floors,
    });
  }
}

/**
 * Evaluates the landing of the block released this run (data-model §4 "evaluate landing"). Called
 * exactly once, on the tick `tick === landingTick`.
 */
export function evaluateLanding(
  state: SimState,
  tuning: TuningValues,
  typeTuning: TypeTuning,
  events: SimEvent[],
): void {
  const global = tuning.global;
  const n = state.floors;
  const topX = (state.restX[n] ?? 0) + state.swayS;
  const d = state.releaseX - topX;
  const tier = classifyOffset(d, tuning);

  state.lastOffset = d;
  state.lastTier = tier;

  if (tier === TIER_MISS) {
    state.strikes += 1;
    const comboChanged = state.combo !== 0;
    state.combo = 0;
    state.comboMult = 1000;
    events.push({ kind: 'miss', tick: state.tick, offset: d, strikes: state.strikes });
    if (comboChanged) {
      events.push({ kind: 'comboChanged', combo: state.combo, multiplier: state.comboMult });
    }
    if (state.strikes >= global.LIVES) {
      endRun(state, RESULT_GAME_OVER, tuning, events);
    } else {
      state.phase = PHASE_SPAWN_DELAY;
      state.phaseTimer = global.SPAWN_DELAY_TICKS;
    }
    return;
  }

  const tierName: 'perfect' | 'good' = tier === TIER_PERFECT ? 'perfect' : 'good';

  if (state.isRoof === 1) {
    events.push({
      kind: 'land',
      tick: state.tick,
      tier: tierName,
      offset: d,
      floor: state.floors,
      pop: 0,
      roof: true,
    });
    const result = state.floors >= typeTuning.targetFloors ? RESULT_COMPLETED : RESULT_BUILT;
    endRun(state, result, tuning, events);
    return;
  }

  let pop: number;
  if (tier === TIER_PERFECT) {
    state.combo += 1;
    state.comboMult = min(global.COMBO_CAP, 1000 + global.COMBO_STEP * state.combo);
    pop = div(typeTuning.perfectPop * state.comboMult, 1000);
    state.restX.push(state.restX[n] ?? 0);
    state.stabilizer = max(
      global.STABILIZER_FLOOR,
      div(state.stabilizer * global.STABILIZER_STEP, 1000),
    );
  } else {
    state.combo = 0;
    state.comboMult = 1000;
    pop = typeTuning.goodPop;
    state.restX.push((state.restX[n] ?? 0) + d);
    state.stabilizer = 1000;
    state.goodCount += 1;
  }

  state.floors += 1;
  state.score += pop;
  updateLean(state);
  if (state.floors === 1) {
    state.swayPhase = 0;
  }
  recomputeSwayTarget(state, tuning, typeTuning);

  events.push({
    kind: 'land',
    tick: state.tick,
    tier: tierName,
    offset: d,
    floor: state.floors,
    pop,
    roof: false,
  });
  events.push({ kind: 'comboChanged', combo: state.combo, multiplier: state.comboMult });

  state.phaseTimer = global.SPAWN_DELAY_TICKS;
  state.phase = PHASE_SPAWN_DELAY;
}
