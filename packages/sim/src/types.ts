/** One of the four buildable tower types. */
export type TowerType = 'residential' | 'commercial' | 'office' | 'luxury';

/** `city`: target height, roof and completion bonus. `quick`: endless, Residential only. */
export type Mode = 'city' | 'quick';

/** `typeCode` value for residential. */
export const TYPE_RESIDENTIAL = 0;
/** `typeCode` value for commercial. */
export const TYPE_COMMERCIAL = 1;
/** `typeCode` value for office. */
export const TYPE_OFFICE = 2;
/** `typeCode` value for luxury. */
export const TYPE_LUXURY = 3;

/** `modeCode` value for city mode. */
export const MODE_CITY = 0;
/** `modeCode` value for quick play. */
export const MODE_QUICK = 1;

/** `phase` value: waiting for the next block to spawn. */
export const PHASE_SPAWN_DELAY = 0;
/** `phase` value: a block is attached to the crane. */
export const PHASE_SWINGING = 1;
/** `phase` value: a released block is falling. */
export const PHASE_FALLING = 2;
/** `phase` value: the run has a result; nothing changes from here on. */
export const PHASE_ENDED = 3;

/** `result` value: no result yet. */
export const RESULT_NONE = 0;
/** `result` value: the tower reached `targetFloors` and the roof landed. */
export const RESULT_COMPLETED = 1;
/** `result` value: the roof was placed early and landed. */
export const RESULT_BUILT = 2;
/** `result` value: three strikes ended the run. */
export const RESULT_GAME_OVER = 3;

/** `lastTier` / landing tier: no landing yet. */
export const TIER_NONE = 0;
/** `lastTier` / landing tier: offset within `PERFECT_MAX`. */
export const TIER_PERFECT = 1;
/** `lastTier` / landing tier: offset between `PERFECT_MAX` and `GOOD_MAX`. */
export const TIER_GOOD = 2;
/** `lastTier` / landing tier: offset beyond `GOOD_MAX`. */
export const TIER_MISS = 3;

/** `pendingInput` value: no input queued. */
export const INPUT_NONE = 0;
/** `pendingInput` value: a drop is queued for the next tick. */
export const INPUT_DROP = 1;
/** `pendingInput` value: an early roof placement is queued for the next tick. */
export const INPUT_ROOF = 2;

/** Global tuning fields shared by every tower type (data-model §1.1). All integers. */
export interface GlobalTuning {
  /** Horizontal half-swing of the crane, in su. */
  CRANE_AMPLITUDE: number;
  /** Ticks a dropped block spends falling. */
  DROP_FALL_TICKS: number;
  /** Ticks between a landing and the next spawn. */
  SPAWN_DELAY_TICKS: number;
  /** Largest `|d|`, in su, still classified Perfect. */
  PERFECT_MAX: number;
  /** Largest `|d|`, in su, still classified Good. */
  GOOD_MAX: number;
  /** Strikes allowed before game over. */
  LIVES: number;
  /** Crane speed increase per floor, in ‰. */
  CRANE_SPEED_PER_FLOOR: number;
  /** Crane speed cap, in ‰. */
  CRANE_SPEED_CAP: number;
  /** Sensitivity increase per Good landing, in ‰. */
  SENSITIVITY_STEP: number;
  /** Sensitivity cap, in ‰. */
  SENSITIVITY_CAP: number;
  /** Base sway amplitude added per floor, in su. */
  BASE_SWAY_PER_FLOOR: number;
  /** Weight of `|lean|` in the sway target, in ‰. */
  LEAN_GAIN: number;
  /** Sway amplitude cap, in su. */
  SWAY_AMP_CAP: number;
  /** Stabilizer multiplier applied per consecutive Perfect, in ‰. */
  STABILIZER_STEP: number;
  /** Lowest the stabilizer can reduce sway to, in ‰. */
  STABILIZER_FLOOR: number;
  /** Combo multiplier increase per consecutive Perfect, in ‰. */
  COMBO_STEP: number;
  /** Combo multiplier cap, in ‰. */
  COMBO_CAP: number;
  /** Completion bonus rate on total population, in ‰. */
  COMPLETION_BONUS: number;
  /** Reserved cap on the completion bonus, in ‰ (used from Phase 4). */
  BONUS_CAP: number;
  /** Steady Tower sway multiplier, in ‰. */
  ASSIST_SWAY: number;
  /** Camera hook clearance above the top floor, in block heights (render only). */
  CAMERA_HOOK_CLEARANCE: number;
  /** Maximum visual tilt of a floor, in degrees (render only). */
  VISUAL_TILT_MAX_DEG: number;
}

/** Per-type tuning fields (data-model §1.2). All integers. */
export interface TypeTuning {
  /** Floors at which the automatic roof spawns. */
  targetFloors: number;
  /** Minimum floors before the early roof becomes available. */
  minRoofFloors: number;
  /** Ticks for one full crane swing period at the base speed. */
  cranePeriodTicks: number;
  /** Ticks for one full sway oscillation period. */
  swayPeriodTicks: number;
  /** Sway amplitude multiplier for this type, in ‰. */
  swayMult: number;
  /** Population awarded for a Perfect landing (before the combo multiplier). */
  perfectPop: number;
  /** Population awarded for a Good landing. */
  goodPop: number;
  /** Rendered block height relative to the standard height, in ‰ (render only). */
  blockVisualHeight: number;
}

/** The complete tunable gameplay values, carried in full by every `SimConfig` (Principle V). */
export interface TuningValues {
  global: GlobalTuning;
  types: Record<TowerType, TypeTuning>;
}

/** Configuration a `TowerSim` is created from. */
export interface SimConfig {
  /** Must be `'residential'` when `mode === 'quick'`. */
  type: TowerType;
  mode: Mode;
  /** uint32 PRNG seed. */
  seed: number;
  /** Steady Tower. Fixed for the run and folded into the state (FR-047, FR-048). */
  assist: boolean;
  /** Complete tuning values. Defaults are `DEFAULT_TUNING`. */
  tuning: TuningValues;
}

/** One drop or roof input, recorded by the tick it was applied on. */
export interface InputEvent {
  tick: number;
  type: 'drop' | 'roof';
}

/** How a run ended: reached the target height, finished an early roof, or three strikes. */
export type RunResultKind = 'completed' | 'built' | 'gameOver';

/** The outcome of a finished run, derived from the final state. */
export interface RunResult {
  result: RunResultKind;
  score: number;
  floors: number;
}

/** Events emitted by `step()`. The array itself is reused (research R12). */
export type SimEvent =
  | { kind: 'spawn'; tick: number; isRoof: boolean }
  | { kind: 'release'; tick: number; x: number }
  | {
      kind: 'land';
      tick: number;
      tier: 'perfect' | 'good';
      offset: number;
      floor: number;
      pop: number;
      roof: boolean;
    }
  | { kind: 'miss'; tick: number; offset: number; strikes: number }
  | { kind: 'comboChanged'; combo: number; multiplier: number }
  | { kind: 'roofAvailable' }
  | { kind: 'roofPlaced'; tick: number }
  | { kind: 'finished'; result: 'completed' | 'built'; score: number; floors: number }
  | { kind: 'gameOver'; score: number; floors: number };

/**
 * The complete simulation state (data-model §3). Every field and every `restX[i]` is a safe
 * integer. Field order here is also the hash order (data-model "Hash order").
 */
export interface SimState {
  /** 0 residential, 1 commercial, 2 office, 3 luxury. */
  typeCode: number;
  /** 0 city, 1 quick. */
  modeCode: number;
  /** 0 or 1; Steady Tower, fixed for the run. */
  assist: number;
  /** uint32 PRNG seed the run started with. */
  seed: number;
  /** Ticks completed so far. */
  tick: number;
  /** uint32 mulberry32 state. */
  rngState: number;
  /** 0 spawnDelay, 1 swinging, 2 falling, 3 ended. */
  phase: number;
  /** Remaining spawn-delay ticks. */
  phaseTimer: number;
  /** 0 none, 1 completed, 2 built, 3 gameOver. */
  result: number;
  /** Final score once `result !== 0`; 0 until then. */
  finalScore: number;
  /** Misses so far, 0..LIVES. */
  strikes: number;
  /** Sum of floor population so far (no bonus). */
  score: number;
  /** Floors placed so far (N). */
  floors: number;
  /** Rest X of each floor, su; length `floors + 1`; `restX[0] = 0` is the foundation. */
  restX: number[];
  /** Sum of `restX[1..N]`, su. */
  leanSum: number;
  /** `div(leanSum, N)`, su, signed; 0 when N = 0. */
  lean: number;
  /** 0 or 1; the block on the crane (or last placed) is the roof. */
  isRoof: number;
  /** 0 or 1; an early roof was placed, so later spawns are roofs too. */
  roofCommitted: number;
  /** Crane center X at the last spawn, su. */
  craneCenterX: number;
  /** uint32 crane phase accumulator. */
  cranePhase: number;
  /** uint32 crane phase increment per tick, set at spawn. */
  craneIncrement: number;
  /** Crane speed at the last spawn, ‰. */
  craneSpeed: number;
  /** Crane hook X after this tick, su. */
  craneX: number;
  /** Frozen X of the falling block, su. */
  releaseX: number;
  /** Tick the current/last drop was applied. */
  releaseTick: number;
  /** `releaseTick + DROP_FALL_TICKS`. */
  landingTick: number;
  /** Consecutive Perfect landings. */
  combo: number;
  /** Current combo multiplier, ‰. */
  comboMult: number;
  /** Good landings this run; never decreases. */
  goodCount: number;
  /** Current sensitivity, ‰. */
  sensitivity: number;
  /** Current stabilizer, ‰. */
  stabilizer: number;
  /** uint32 sway phase accumulator; starts at 0 when floor 1 is placed. */
  swayPhase: number;
  /** uint32 sway phase increment per tick, from `swayPeriodTicks`. */
  swayIncrement: number;
  /** Current smoothed sway amplitude, su. */
  swayAmp: number;
  /** Target sway amplitude, su. */
  swayTarget: number;
  /** Current top-floor shear displacement, su. */
  swayS: number;
  /** 0 none, 1 drop, 2 roof; queued by `requestDrop` / `requestRoof`. */
  pendingInput: number;
  /** Signed offset `d` of the last landing, su. */
  lastOffset: number;
  /** 0 none, 1 perfect, 2 good, 3 miss; tier of the last landing. */
  lastTier: number;
}
