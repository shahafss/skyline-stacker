import { cloneTuning, validateConfig } from './config';
import { advanceCrane, spawnCrane } from './crane';
import { evaluateLanding } from './landing';
import { U32, div } from './fixed';
import { advanceSway } from './sway';
import {
  INPUT_DROP,
  INPUT_NONE,
  INPUT_ROOF,
  MODE_CITY,
  MODE_QUICK,
  PHASE_FALLING,
  PHASE_SPAWN_DELAY,
  PHASE_SWINGING,
  RESULT_NONE,
  TIER_NONE,
  TYPE_COMMERCIAL,
  TYPE_LUXURY,
  TYPE_OFFICE,
  TYPE_RESIDENTIAL,
} from './types';
import type {
  InputEvent,
  Mode,
  RunResult,
  SimConfig,
  SimEvent,
  SimState,
  TowerType,
  TuningValues,
  TypeTuning,
} from './types';

function typeToCode(type: TowerType): number {
  switch (type) {
    case 'residential':
      return TYPE_RESIDENTIAL;
    case 'commercial':
      return TYPE_COMMERCIAL;
    case 'office':
      return TYPE_OFFICE;
    case 'luxury':
      return TYPE_LUXURY;
  }
}

function modeToCode(mode: Mode): number {
  return mode === 'city' ? MODE_CITY : MODE_QUICK;
}

/** The simulation instance returned by `createSim` / `restoreSim` (contracts/sim-api.md). */
export interface TowerSim {
  step(): readonly SimEvent[];
  requestDrop(): boolean;
  requestRoof(): boolean;
  getState(): Readonly<SimState>;
  getInputLog(): readonly InputEvent[];
  getResult(): RunResult | null;
  getConfig(): Readonly<SimConfig>;
}

function initialState(config: SimConfig, tuning: TuningValues, typeTuning: TypeTuning): SimState {
  return {
    typeCode: typeToCode(config.type),
    modeCode: modeToCode(config.mode),
    assist: config.assist ? 1 : 0,
    seed: config.seed,
    tick: 0,
    rngState: config.seed,
    phase: PHASE_SPAWN_DELAY,
    phaseTimer: 0,
    result: RESULT_NONE,
    finalScore: 0,
    strikes: 0,
    score: 0,
    floors: 0,
    restX: [0],
    leanSum: 0,
    lean: 0,
    isRoof: 0,
    roofCommitted: 0,
    craneCenterX: 0,
    cranePhase: 0,
    craneIncrement: 0,
    craneSpeed: 1000,
    craneX: 0,
    releaseX: 0,
    releaseTick: 0,
    landingTick: 0,
    combo: 0,
    comboMult: 1000,
    goodCount: 0,
    sensitivity: 1000,
    stabilizer: 1000,
    swayPhase: 0,
    swayIncrement: div(U32, typeTuning.swayPeriodTicks),
    swayAmp: 0,
    swayTarget: 0,
    swayS: 0,
    pendingInput: INPUT_NONE,
    lastOffset: 0,
    lastTier: TIER_NONE,
  };
}

/** Builds a `TowerSim` around the given (already-owned) config, state and input log. */
function buildSim(
  config: Readonly<SimConfig>,
  tuning: Readonly<TuningValues>,
  typeTuning: Readonly<TypeTuning>,
  state: SimState,
  inputLog: InputEvent[],
): TowerSim {
  const events: SimEvent[] = [];

  function spawn(): void {
    spawnCrane(state, tuning, typeTuning);
    const n = state.floors;
    const isCity = state.modeCode === MODE_CITY;
    state.isRoof = isCity && (n >= typeTuning.targetFloors || state.roofCommitted === 1) ? 1 : 0;
    state.phase = PHASE_SWINGING;
    events.push({ kind: 'spawn', tick: state.tick, isRoof: state.isRoof === 1 });
    if (isCity && state.isRoof === 0 && n >= typeTuning.minRoofFloors) {
      events.push({ kind: 'roofAvailable' });
    }
  }

  function step(): readonly SimEvent[] {
    events.length = 0;
    if (state.result !== RESULT_NONE) return events;
    state.tick += 1;

    if (state.pendingInput === INPUT_DROP) {
      state.releaseX = state.craneX;
      state.releaseTick = state.tick;
      state.landingTick = state.tick + tuning.global.DROP_FALL_TICKS;
      state.phase = PHASE_FALLING;
      inputLog.push({ tick: state.tick, type: 'drop' });
      events.push({ kind: 'release', tick: state.tick, x: state.releaseX });
    } else if (state.pendingInput === INPUT_ROOF) {
      state.isRoof = 1;
      state.roofCommitted = 1;
      inputLog.push({ tick: state.tick, type: 'roof' });
      events.push({ kind: 'roofPlaced', tick: state.tick });
    }
    state.pendingInput = INPUT_NONE;

    if (state.floors >= 1) {
      advanceSway(state);
    }

    switch (state.phase) {
      case PHASE_SPAWN_DELAY:
        if (state.phaseTimer === 0) {
          spawn();
        } else {
          state.phaseTimer -= 1;
          if (state.phaseTimer === 0) spawn();
        }
        break;
      case PHASE_SWINGING:
        advanceCrane(state, tuning);
        break;
      case PHASE_FALLING:
        if (state.tick === state.landingTick) {
          evaluateLanding(state, tuning, typeTuning, events);
        }
        break;
      default:
        break;
    }

    return events;
  }

  function requestDrop(): boolean {
    if (state.result !== RESULT_NONE) return false;
    if (state.phase !== PHASE_SWINGING) return false;
    if (state.pendingInput !== INPUT_NONE) return false;
    state.pendingInput = INPUT_DROP;
    return true;
  }

  function canRequestRoofNow(): boolean {
    return (
      state.modeCode === MODE_CITY &&
      state.phase === PHASE_SWINGING &&
      state.isRoof === 0 &&
      state.floors >= typeTuning.minRoofFloors &&
      state.pendingInput === INPUT_NONE &&
      state.result === RESULT_NONE
    );
  }

  function requestRoof(): boolean {
    if (!canRequestRoofNow()) return false;
    state.pendingInput = INPUT_ROOF;
    return true;
  }

  function getState(): Readonly<SimState> {
    return state;
  }

  function getInputLog(): readonly InputEvent[] {
    return inputLog;
  }

  function getResult(): RunResult | null {
    if (state.result === RESULT_NONE) return null;
    const resultKind = state.result === 3 ? 'gameOver' : state.result === 1 ? 'completed' : 'built';
    return { result: resultKind, score: state.finalScore, floors: state.floors };
  }

  function getConfig(): Readonly<SimConfig> {
    return config;
  }

  return { step, requestDrop, requestRoof, getState, getInputLog, getResult, getConfig };
}

/** Throws `SimConfigError` for an invalid config (research R10). */
export function createSim(config: SimConfig): TowerSim {
  validateConfig(config);
  const tuning = cloneTuning(config.tuning);
  const ownedConfig: SimConfig = { ...config, tuning };
  const typeTuning = tuning.types[config.type];
  const state = initialState(ownedConfig, tuning, typeTuning);
  return buildSim(ownedConfig, tuning, typeTuning, state, []);
}

/**
 * Rebuilds a `TowerSim` around copies of the given config, state and input log. Used only by the
 * test-only snapshot helper (`tests/helpers/snapshot.ts`); not exported from `index.ts`.
 */
export function restoreSim(
  config: Readonly<SimConfig>,
  state: Readonly<SimState>,
  inputLog: readonly InputEvent[],
): TowerSim {
  const tuning = cloneTuning(config.tuning);
  const ownedConfig: SimConfig = { ...config, tuning };
  const typeTuning = tuning.types[config.type];
  const stateCopy: SimState = { ...state, restX: [...state.restX] };
  const logCopy: InputEvent[] = inputLog.map((e) => ({ ...e }));
  return buildSim(ownedConfig, tuning, typeTuning, stateCopy, logCopy);
}

/** True when `sim.requestRoof()` would currently succeed (contracts/sim-api.md). Pure. */
export function canPlaceRoof(sim: TowerSim): boolean {
  const state = sim.getState();
  const config = sim.getConfig();
  const typeTuning = config.tuning.types[config.type];
  return (
    state.modeCode === MODE_CITY &&
    state.phase === PHASE_SWINGING &&
    state.isRoof === 0 &&
    state.floors >= typeTuning.minRoofFloors &&
    state.pendingInput === INPUT_NONE &&
    state.result === RESULT_NONE
  );
}
