import { cloneTuning } from '../../src/config';
import { restoreSim } from '../../src/sim';
import type { TowerSim } from '../../src/sim';
import type { InputEvent, SimConfig, SimState } from '../../src/types';

/** Test-only deep snapshot of a `TowerSim`'s config, state and input log (research R13). */
export interface SimSnapshot {
  config: SimConfig;
  state: SimState;
  inputLog: InputEvent[];
}

/** Deep-copies `getConfig()`, `getState()` (including `restX`) and `getInputLog()`. */
export function snapshot(sim: TowerSim): SimSnapshot {
  const config = sim.getConfig();
  const state = sim.getState();
  return {
    config: { ...config, tuning: cloneTuning(config.tuning) },
    state: { ...state, restX: [...state.restX] },
    inputLog: sim.getInputLog().map((e) => ({ ...e })),
  };
}

/** Rebuilds a live `TowerSim` from a snapshot, via the internal `restoreSim`. */
export function restore(snap: SimSnapshot): TowerSim {
  return restoreSim(snap.config, snap.state, snap.inputLog);
}
