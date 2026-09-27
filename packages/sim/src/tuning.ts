import type { GlobalTuning, TowerType, TuningValues, TypeTuning } from './types';

/** Bumped whenever a default tuning value changes (data-model §8, FR-043). */
export const TUNING_VERSION = '1.0.0';

/** Ticks per second. The sim advances only in whole ticks (Principle I). */
export const TICK_RATE = 60;
/** Width of one block, in su. `|d|` in su is therefore also ‰ of block width. */
export const BLOCK_WIDTH = 1000;
/** Most sim steps the render loop may run in one frame before discarding time. */
export const MAX_TICKS_PER_FRAME = 5;
/** Number of entries in `SIN_LUT`. */
export const SIN_LUT_SIZE = 4096;
/** Divisor applied to `SIN_LUT` products (Q15 fixed point). */
export const Q15_SCALE = 32768;
/** Divisor for sway amplitude smoothing steps (PRD §4.3). */
export const SWAY_SMOOTHING_DIVISOR = 16;

const DEFAULT_GLOBAL: GlobalTuning = Object.freeze({
  CRANE_AMPLITUDE: 1100,
  DROP_FALL_TICKS: 24,
  SPAWN_DELAY_TICKS: 36,
  PERFECT_MAX: 50,
  GOOD_MAX: 250,
  LIVES: 3,
  CRANE_SPEED_PER_FLOOR: 20,
  CRANE_SPEED_CAP: 2000,
  SENSITIVITY_STEP: 50,
  SENSITIVITY_CAP: 2000,
  BASE_SWAY_PER_FLOOR: 3,
  LEAN_GAIN: 600,
  SWAY_AMP_CAP: 350,
  STABILIZER_STEP: 800,
  STABILIZER_FLOOR: 500,
  COMBO_STEP: 250,
  COMBO_CAP: 3000,
  COMPLETION_BONUS: 200,
  BONUS_CAP: 1000,
  ASSIST_SWAY: 500,
  CAMERA_HOOK_CLEARANCE: 5,
  VISUAL_TILT_MAX_DEG: 6,
});

function typeTuning(t: TypeTuning): TypeTuning {
  return Object.freeze(t);
}

const DEFAULT_TYPES: Record<TowerType, TypeTuning> = Object.freeze({
  residential: typeTuning({
    targetFloors: 30,
    minRoofFloors: 15,
    cranePeriodTicks: 144,
    swayPeriodTicks: 180,
    swayMult: 1000,
    perfectPop: 10,
    goodPop: 5,
    blockVisualHeight: 1000,
  }),
  commercial: typeTuning({
    targetFloors: 40,
    minRoofFloors: 20,
    cranePeriodTicks: 144,
    swayPeriodTicks: 120,
    swayMult: 1000,
    perfectPop: 15,
    goodPop: 7,
    blockVisualHeight: 1000,
  }),
  office: typeTuning({
    targetFloors: 50,
    minRoofFloors: 25,
    cranePeriodTicks: 120,
    swayPeriodTicks: 180,
    swayMult: 1200,
    perfectPop: 20,
    goodPop: 10,
    blockVisualHeight: 1400,
  }),
  luxury: typeTuning({
    targetFloors: 60,
    minRoofFloors: 30,
    cranePeriodTicks: 132,
    swayPeriodTicks: 156,
    swayMult: 2000,
    perfectPop: 30,
    goodPop: 15,
    blockVisualHeight: 1200,
  }),
});

/** The default tuning values (PRD §7.1–§7.2), deeply frozen. The only gameplay literals in the repo. */
export const DEFAULT_TUNING: Readonly<TuningValues> = Object.freeze({
  global: DEFAULT_GLOBAL,
  types: DEFAULT_TYPES,
});

/** Inclusive validation bounds for `GlobalTuning` (data-model §1.1). */
export const GLOBAL_TUNING_BOUNDS: Record<keyof GlobalTuning, readonly [number, number]> = {
  CRANE_AMPLITUDE: [1, 100_000],
  DROP_FALL_TICKS: [1, 600],
  SPAWN_DELAY_TICKS: [0, 600],
  // PERFECT_MAX and GOOD_MAX bound each other; enforced separately in config.ts.
  PERFECT_MAX: [0, 100_000],
  GOOD_MAX: [0, 100_000],
  LIVES: [1, 99],
  CRANE_SPEED_PER_FLOOR: [0, 10_000],
  CRANE_SPEED_CAP: [1, 100_000],
  SENSITIVITY_STEP: [0, 10_000],
  SENSITIVITY_CAP: [0, 100_000],
  BASE_SWAY_PER_FLOOR: [0, 10_000],
  LEAN_GAIN: [0, 100_000],
  SWAY_AMP_CAP: [0, 100_000],
  STABILIZER_STEP: [0, 1000],
  STABILIZER_FLOOR: [0, 1000],
  COMBO_STEP: [0, 100_000],
  COMBO_CAP: [1000, 1_000_000],
  COMPLETION_BONUS: [0, 100_000],
  BONUS_CAP: [0, 100_000],
  ASSIST_SWAY: [0, 1000],
  CAMERA_HOOK_CLEARANCE: [1, 50],
  VISUAL_TILT_MAX_DEG: [0, 45],
};

/** Inclusive validation bounds for `TypeTuning` (data-model §1.2). */
export const TYPE_TUNING_BOUNDS: Record<keyof TypeTuning, readonly [number, number]> = {
  targetFloors: [1, 10_000],
  // minRoofFloors is also bounded above by targetFloors; enforced separately in config.ts.
  minRoofFloors: [1, 10_000],
  cranePeriodTicks: [1, 100_000],
  swayPeriodTicks: [1, 100_000],
  swayMult: [0, 100_000],
  perfectPop: [0, 1_000_000],
  goodPop: [0, 1_000_000],
  blockVisualHeight: [100, 10_000],
};
