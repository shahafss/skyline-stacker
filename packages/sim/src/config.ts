import { DEFAULT_TUNING, GLOBAL_TUNING_BOUNDS, TYPE_TUNING_BOUNDS } from './tuning';
import type { GlobalTuning, SimConfig, TowerType, TuningValues, TypeTuning } from './types';

const TOWER_TYPES: readonly TowerType[] = ['residential', 'commercial', 'office', 'luxury'];
const GLOBAL_KEYS = Object.keys(GLOBAL_TUNING_BOUNDS) as (keyof GlobalTuning)[];
const TYPE_KEYS = Object.keys(TYPE_TUNING_BOUNDS) as (keyof TypeTuning)[];

/** Thrown by `createSim` / `validateConfig` for any invalid `SimConfig` (research R10). */
export class SimConfigError extends Error {}

function checkInt(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new SimConfigError(`${name} must be a safe integer, got ${JSON.stringify(value)}`);
  }
}

function checkBounds(value: number, name: string, lo: number, hi: number): void {
  if (value < lo || value > hi) {
    throw new SimConfigError(
      `${name} must be between ${String(lo)} and ${String(hi)}, got ${String(value)}`,
    );
  }
}

/**
 * Throws `SimConfigError` unless every tuning field is present, is a safe integer, and is within
 * its documented bounds (data-model §1.1–§1.2). `config` is validated as untrusted input: its
 * static `SimConfig` type is a contract for callers, not a guarantee about the value at runtime.
 */
export function validateConfig(config: SimConfig): void {
  // Reinterpreted as unknown: this function's job is to prove the runtime shape, not assume it.
  const raw = config as unknown as Record<string, unknown>;

  if (raw['mode'] === 'quick' && raw['type'] !== 'residential') {
    throw new SimConfigError("mode 'quick' requires type 'residential'");
  }
  if (typeof raw['assist'] !== 'boolean') {
    throw new SimConfigError('assist must be a boolean');
  }
  checkInt(raw['seed'], 'seed');
  checkBounds(raw['seed'], 'seed', 0, 4294967295);

  const tuning = raw['tuning'] as Record<string, unknown> | undefined;
  if (tuning == null || typeof tuning !== 'object') {
    throw new SimConfigError('tuning is required');
  }
  const global = tuning['global'] as Record<string, unknown> | undefined;
  if (global == null || typeof global !== 'object') {
    throw new SimConfigError('tuning.global is required');
  }
  for (const key of GLOBAL_KEYS) {
    const value = global[key];
    if (value === undefined) throw new SimConfigError(`tuning.global.${key} is required`);
    checkInt(value, `tuning.global.${key}`);
    const [lo, hi] = GLOBAL_TUNING_BOUNDS[key];
    checkBounds(value, `tuning.global.${key}`, lo, hi);
  }
  const global_ = global as unknown as GlobalTuning;
  checkBounds(global_.PERFECT_MAX, 'tuning.global.PERFECT_MAX', 0, global_.GOOD_MAX);
  checkBounds(global_.GOOD_MAX, 'tuning.global.GOOD_MAX', global_.PERFECT_MAX, 100_000);

  const types = tuning['types'] as Record<string, unknown> | undefined;
  if (types == null || typeof types !== 'object') {
    throw new SimConfigError('tuning.types is required');
  }
  for (const type of TOWER_TYPES) {
    const t = types[type] as Record<string, unknown> | undefined;
    if (t == null || typeof t !== 'object') {
      throw new SimConfigError(`tuning.types.${type} is required`);
    }
    for (const key of TYPE_KEYS) {
      const value = t[key];
      if (value === undefined) throw new SimConfigError(`tuning.types.${type}.${key} is required`);
      checkInt(value, `tuning.types.${type}.${key}`);
      const [lo, hi] = TYPE_TUNING_BOUNDS[key];
      checkBounds(value, `tuning.types.${type}.${key}`, lo, hi);
    }
    const t_ = t as unknown as TypeTuning;
    checkBounds(t_.minRoofFloors, `tuning.types.${type}.minRoofFloors`, 1, t_.targetFloors);
  }
}

function globalEquals(a: GlobalTuning, b: GlobalTuning): boolean {
  return GLOBAL_KEYS.every((k) => a[k] === b[k]);
}

function typeEquals(a: TypeTuning, b: TypeTuning): boolean {
  return TYPE_KEYS.every((k) => a[k] === b[k]);
}

/** True only when every field of `t` equals `DEFAULT_TUNING`. */
export function isDefaultTuning(t: TuningValues): boolean {
  if (!globalEquals(t.global, DEFAULT_TUNING.global)) return false;
  for (const type of TOWER_TYPES) {
    if (!typeEquals(t.types[type], DEFAULT_TUNING.types[type])) return false;
  }
  return true;
}

/** Deep, unfrozen copy of a `TuningValues`, for the dev panel and test helpers. */
export function cloneTuning(t: TuningValues): TuningValues {
  return {
    global: { ...t.global },
    types: {
      residential: { ...t.types.residential },
      commercial: { ...t.types.commercial },
      office: { ...t.types.office },
      luxury: { ...t.types.luxury },
    },
  };
}
