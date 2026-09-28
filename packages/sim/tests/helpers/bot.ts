import { createSim } from '../../src/sim';
import type { TowerSim } from '../../src/sim';
import { PHASE_SWINGING, RESULT_NONE, TIER_GOOD, TIER_MISS, TIER_PERFECT } from '../../src/types';
import type { InputEvent, SimConfig } from '../../src/types';
import { restore, snapshot } from './snapshot';

/** Ticks searched ahead of the snapshot before giving up (comfortably over one crane period). */
const SEARCH_WINDOW = 4000;

/**
 * Finds the next tick at which dropping would land with the wanted tier (and offset sign, if
 * given), by forking a fresh copy of `sim` from one snapshot for each candidate tick (research
 * R13). Each candidate costs only the ticks up to its own landing — no replay from tick 0.
 */
export function findDropTick(
  sim: TowerSim,
  want: 'perfect' | 'good' | 'miss',
  side?: -1 | 1,
): number | null {
  const snap = snapshot(sim);
  const startTick = snap.state.tick;
  const fallTicks = snap.config.tuning.global.DROP_FALL_TICKS;
  const wantTier = want === 'perfect' ? TIER_PERFECT : want === 'good' ? TIER_GOOD : TIER_MISS;

  for (let candidate = startTick; candidate <= startTick + SEARCH_WINDOW; candidate += 1) {
    const probe = restore(snap);
    for (let i = 0; i < candidate - startTick; i += 1) {
      if (probe.getState().result !== RESULT_NONE) break;
      probe.step();
    }
    if (probe.getState().result !== RESULT_NONE) continue;
    if (!probe.requestDrop()) continue;
    for (let i = 0; i < fallTicks + 1; i += 1) probe.step();

    const finalState = probe.getState();
    if (finalState.lastTier !== wantTier) continue;
    if (side !== undefined && Math.sign(finalState.lastOffset) !== side) continue;
    return candidate;
  }
  return null;
}

/** A script step: tier letters, `'GL'`/`'GR'` for a sided Good, or `'R'` for the early roof. */
export type ScriptStep = 'P' | 'G' | 'M' | 'R' | 'GL' | 'GR';

/** Plays one script on a fresh sim. `'R'` places the early roof before the next drop. */
export function playScript(
  config: SimConfig,
  script: readonly ScriptStep[],
): { log: readonly InputEvent[]; sim: TowerSim } {
  const sim = createSim(config);

  for (const c of script) {
    if (sim.getState().result !== RESULT_NONE) {
      throw new Error(`playScript: run already ended before script step '${c}'`);
    }

    if (c === 'R') {
      while (sim.getState().phase !== PHASE_SWINGING) {
        if (sim.getState().result !== RESULT_NONE) {
          throw new Error("playScript: run ended before 'R' could be placed");
        }
        sim.step();
      }
      if (!sim.requestRoof()) {
        throw new Error(
          `playScript: requestRoof() rejected at tick ${String(sim.getState().tick)}`,
        );
      }
      sim.step();
      continue;
    }

    const want = c === 'P' ? 'perfect' : c === 'M' ? 'miss' : 'good';
    const side = c === 'GL' ? -1 : c === 'GR' ? 1 : undefined;
    const tick = findDropTick(sim, want, side);
    if (tick === null) {
      throw new Error(`playScript: could not find a ${want} drop tick`);
    }
    while (sim.getState().tick < tick) {
      sim.step();
    }
    if (!sim.requestDrop()) {
      throw new Error(`playScript: requestDrop() rejected at tick ${String(tick)}`);
    }
    const fallTicks = sim.getConfig().tuning.global.DROP_FALL_TICKS;
    for (let i = 0; i < fallTicks + 1; i += 1) {
      sim.step();
    }
  }

  return { log: sim.getInputLog(), sim };
}
