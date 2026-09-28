import { cloneTuning, isDefaultTuning } from './config';
import { hashState } from './hash';
import type { TowerSim } from './sim';
import { SIM_VERSION } from './version';
import { TUNING_VERSION } from './tuning';
import type {
  GlobalTuning,
  InputEvent,
  Mode,
  RunResult,
  RunResultKind,
  SimConfig,
  TowerType,
  TuningValues,
  TypeTuning,
} from './types';

/** A run export / golden fixture document (data-model §8, contracts/run-export.schema.json). */
export interface RunExport {
  format: 'skyline-stacker/run';
  exportVersion: 1;
  simVersion: string;
  tuningVersion: string;
  tuningOverridden: boolean;
  config: SimConfig;
  inputLog: InputEvent[];
  result: RunResult;
  hash: number;
}

const TOWER_TYPES: readonly TowerType[] = ['residential', 'commercial', 'office', 'luxury'];
const MODES: readonly Mode[] = ['city', 'quick'];
const RESULT_KINDS: readonly RunResultKind[] = ['completed', 'built', 'gameOver'];

const GLOBAL_KEYS: readonly (keyof GlobalTuning)[] = [
  'CRANE_AMPLITUDE',
  'DROP_FALL_TICKS',
  'SPAWN_DELAY_TICKS',
  'PERFECT_MAX',
  'GOOD_MAX',
  'LIVES',
  'CRANE_SPEED_PER_FLOOR',
  'CRANE_SPEED_CAP',
  'SENSITIVITY_STEP',
  'SENSITIVITY_CAP',
  'BASE_SWAY_PER_FLOOR',
  'LEAN_GAIN',
  'SWAY_AMP_CAP',
  'STABILIZER_STEP',
  'STABILIZER_FLOOR',
  'COMBO_STEP',
  'COMBO_CAP',
  'COMPLETION_BONUS',
  'BONUS_CAP',
  'ASSIST_SWAY',
  'CAMERA_HOOK_CLEARANCE',
  'VISUAL_TILT_MAX_DEG',
];

const TYPE_KEYS: readonly (keyof TypeTuning)[] = [
  'targetFloors',
  'minRoofFloors',
  'cranePeriodTicks',
  'swayPeriodTicks',
  'swayMult',
  'perfectPop',
  'goodPop',
  'blockVisualHeight',
];

function fail(message: string): never {
  throw new Error(`parseRunExport: ${message}`);
}

function expectObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectKeys(obj: Record<string, unknown>, name: string, allowed: readonly string[]): void {
  const allowedSet = new Set<string>(allowed);
  for (const key of Object.keys(obj)) {
    if (!allowedSet.has(key)) fail(`${name} has an unexpected field "${key}"`);
  }
  for (const key of allowed) {
    if (!(key in obj)) fail(`${name} is missing required field "${key}"`);
  }
}

function expectInt(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) fail(`${name} must be an integer`);
  return value;
}

function expectUint32(value: unknown, name: string): number {
  const n = expectInt(value, name);
  if (n < 0 || n > 4294967295) fail(`${name} must be a uint32`);
  return n;
}

function expectString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length < 1) fail(`${name} must be a non-empty string`);
  return value;
}

function expectBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') fail(`${name} must be a boolean`);
  return value;
}

function expectEnum<T extends string>(value: unknown, name: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(`${name} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function parseGlobalTuning(value: unknown): GlobalTuning {
  const obj = expectObject(value, 'config.tuning.global');
  expectKeys(obj, 'config.tuning.global', GLOBAL_KEYS);
  const result = {} as Record<keyof GlobalTuning, number>;
  for (const key of GLOBAL_KEYS) {
    result[key] = expectInt(obj[key], `config.tuning.global.${key}`);
  }
  return result;
}

function parseTypeTuning(value: unknown, type: TowerType): TypeTuning {
  const obj = expectObject(value, `config.tuning.types.${type}`);
  expectKeys(obj, `config.tuning.types.${type}`, TYPE_KEYS);
  const result = {} as Record<keyof TypeTuning, number>;
  for (const key of TYPE_KEYS) {
    result[key] = expectInt(obj[key], `config.tuning.types.${type}.${key}`);
  }
  return result;
}

function parseTuning(value: unknown): TuningValues {
  const obj = expectObject(value, 'config.tuning');
  expectKeys(obj, 'config.tuning', ['global', 'types']);
  const global = parseGlobalTuning(obj['global']);
  const typesObj = expectObject(obj['types'], 'config.tuning.types');
  expectKeys(typesObj, 'config.tuning.types', TOWER_TYPES);
  const types = {} as Record<TowerType, TypeTuning>;
  for (const type of TOWER_TYPES) {
    types[type] = parseTypeTuning(typesObj[type], type);
  }
  return { global, types };
}

function parseConfig(value: unknown): SimConfig {
  const obj = expectObject(value, 'config');
  expectKeys(obj, 'config', ['type', 'mode', 'seed', 'assist', 'tuning']);
  const type = expectEnum(obj['type'], 'config.type', TOWER_TYPES);
  const mode = expectEnum(obj['mode'], 'config.mode', MODES);
  if (mode === 'quick' && type !== 'residential') {
    fail("config.type must be 'residential' when config.mode is 'quick'");
  }
  const seed = expectUint32(obj['seed'], 'config.seed');
  const assist = expectBoolean(obj['assist'], 'config.assist');
  const tuning = parseTuning(obj['tuning']);
  return { type, mode, seed, assist, tuning };
}

function parseInputLog(value: unknown): InputEvent[] {
  if (!Array.isArray(value)) fail('inputLog must be an array');
  return value.map((item, index) => {
    const obj = expectObject(item, `inputLog[${String(index)}]`);
    expectKeys(obj, `inputLog[${String(index)}]`, ['tick', 'type']);
    const tick = expectInt(obj['tick'], `inputLog[${String(index)}].tick`);
    if (tick < 1) fail(`inputLog[${String(index)}].tick must be >= 1`);
    const type = expectEnum(obj['type'], `inputLog[${String(index)}].type`, ['drop', 'roof']);
    return { tick, type };
  });
}

function parseResult(value: unknown): RunResult {
  const obj = expectObject(value, 'result');
  expectKeys(obj, 'result', ['result', 'score', 'floors']);
  const result = expectEnum(obj['result'], 'result.result', RESULT_KINDS);
  const score = expectInt(obj['score'], 'result.score');
  if (score < 0) fail('result.score must be >= 0');
  const floors = expectInt(obj['floors'], 'result.floors');
  if (floors < 0) fail('result.floors must be >= 0');
  return { result, score, floors };
}

/** Builds a `RunExport` from a finished `TowerSim`. Throws if the run has no result yet. */
export function createRunExport(sim: TowerSim): RunExport {
  const result = sim.getResult();
  if (result === null) {
    throw new Error('createRunExport: the run has no result yet');
  }
  const config = sim.getConfig();
  return {
    format: 'skyline-stacker/run',
    exportVersion: 1,
    simVersion: SIM_VERSION,
    tuningVersion: TUNING_VERSION,
    tuningOverridden: !isDefaultTuning(config.tuning),
    config: { ...config, tuning: cloneTuning(config.tuning) },
    inputLog: sim.getInputLog().map((e) => ({ ...e })),
    result,
    hash: hashState(sim.getState()),
  };
}

/** Validates and parses an unknown value as a `RunExport`, by hand against the JSON Schema. */
export function parseRunExport(value: unknown): RunExport {
  const obj = expectObject(value, 'run export');
  expectKeys(obj, 'run export', [
    'format',
    'exportVersion',
    'simVersion',
    'tuningVersion',
    'tuningOverridden',
    'config',
    'inputLog',
    'result',
    'hash',
  ]);
  if (obj['format'] !== 'skyline-stacker/run') fail('format must be "skyline-stacker/run"');
  if (obj['exportVersion'] !== 1) fail('exportVersion must be 1');
  const simVersion = expectString(obj['simVersion'], 'simVersion');
  const tuningVersion = expectString(obj['tuningVersion'], 'tuningVersion');
  const tuningOverridden = expectBoolean(obj['tuningOverridden'], 'tuningOverridden');
  const config = parseConfig(obj['config']);
  const inputLog = parseInputLog(obj['inputLog']);
  const result = parseResult(obj['result']);
  const hash = expectUint32(obj['hash'], 'hash');

  return {
    format: 'skyline-stacker/run',
    exportVersion: 1,
    simVersion,
    tuningVersion,
    tuningOverridden,
    config,
    inputLog,
    result,
    hash,
  };
}
