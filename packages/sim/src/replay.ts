import { hashState } from './hash';
import { createSim } from './sim';
import { RESULT_NONE } from './types';
import type { InputEvent, RunResult, SimConfig, SimEvent, SimState } from './types';

/** Thrown by `replay` when a log is malformed or an input would be rejected. */
export class ReplayError extends Error {
  readonly tick: number;

  constructor(message: string, tick: number) {
    super(message);
    this.name = 'ReplayError';
    this.tick = tick;
  }
}

/**
 * Replays `log` against a fresh sim built from `config`, from tick 0 until a result is set or
 * `DROP_FALL_TICKS + 1` ticks after the last input (contracts/sim-api.md).
 */
export function replay(
  config: SimConfig,
  log: readonly InputEvent[],
): { state: SimState; hash: number; events: SimEvent[]; result: RunResult | null } {
  const sim = createSim(config);
  const events: SimEvent[] = [];
  const fallTicks = sim.getConfig().tuning.global.DROP_FALL_TICKS;

  let previousTick = 0;
  let lastAppliedTick = 0;

  for (const entry of log) {
    if (entry.tick <= previousTick) {
      throw new ReplayError('input log ticks must be strictly increasing', entry.tick);
    }
    previousTick = entry.tick;

    while (sim.getState().result === RESULT_NONE && sim.getState().tick < entry.tick - 1) {
      events.push(...sim.step());
    }
    if (sim.getState().result !== RESULT_NONE) break;

    const accepted = entry.type === 'drop' ? sim.requestDrop() : sim.requestRoof();
    if (!accepted) {
      throw new ReplayError(`${entry.type} at tick ${String(entry.tick)} was rejected`, entry.tick);
    }
    events.push(...sim.step());
    lastAppliedTick = entry.tick;
  }

  const stopTick = lastAppliedTick + fallTicks;
  while (sim.getState().result === RESULT_NONE && sim.getState().tick < stopTick) {
    events.push(...sim.step());
  }

  const state = sim.getState();
  return { state, hash: hashState(state), events, result: sim.getResult() };
}
