import type { GlobalTuning, SimConfig, TowerType, TuningValues, TypeTuning } from '@skyline/sim';
import {
  DEFAULT_TUNING,
  SimConfigError,
  TUNING_VERSION,
  cloneTuning,
  createSim,
  isDefaultTuning,
} from '@skyline/sim';

const TOWER_TYPES: readonly TowerType[] = ['residential', 'commercial', 'office', 'luxury'];
const GLOBAL_KEYS = Object.keys(DEFAULT_TUNING.global) as (keyof GlobalTuning)[];
const TYPE_KEYS = Object.keys(DEFAULT_TUNING.types.residential) as (keyof TypeTuning)[];

/** One editable tuning field: a `GlobalTuning` key, or a `TypeTuning` key scoped to one type. */
export type TuningField =
  | { readonly scope: 'global'; readonly key: keyof GlobalTuning }
  | { readonly scope: TowerType; readonly key: keyof TypeTuning };

/**
 * Every editable field (FR-038): the 22 `GlobalTuning` fields, then the 8 `TypeTuning` fields for
 * each of the 4 types. The fixed engine constants (data-model §1.3) are never `TuningValues` keys,
 * so they are excluded automatically.
 */
export function listTuningFields(): readonly TuningField[] {
  const fields: TuningField[] = [];
  for (const key of GLOBAL_KEYS) {
    fields.push({ scope: 'global', key });
  }
  for (const type of TOWER_TYPES) {
    for (const key of TYPE_KEYS) {
      fields.push({ scope: type, key });
    }
  }
  return fields;
}

/** A human-readable label for a field, e.g. `"CRANE_AMPLITUDE"` or `"residential.targetFloors"`. */
export function tuningFieldLabel(field: TuningField): string {
  return field.scope === 'global' ? field.key : `${field.scope}.${field.key}`;
}

function parseIntegerText(text: string): number {
  const trimmed = text.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`must be an integer, got ${JSON.stringify(text)}`);
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`must be a safe integer, got ${JSON.stringify(text)}`);
  }
  return value;
}

export type ApplyResult =
  | { readonly ok: true; readonly config: SimConfig }
  | { readonly ok: false; readonly error: string };

/**
 * Phaser-free and DOM-free model behind the dev-only tuning panel (T084). Edits stay in memory:
 * nothing here writes to `packages/sim/src/tuning.ts` or touches the network or the filesystem.
 */
export class TuningPanelModel {
  private values: TuningValues;

  constructor(initial: TuningValues = DEFAULT_TUNING) {
    this.values = cloneTuning(initial);
  }

  /** The tuning values as edited so far. */
  get tuning(): Readonly<TuningValues> {
    return this.values;
  }

  /** True whenever any field differs from `DEFAULT_TUNING`. */
  get isOverridden(): boolean {
    return !isDefaultTuning(this.values);
  }

  /** The current value of `field`, formatted for a text input. */
  getFieldText(field: TuningField): string {
    return String(this.readField(field));
  }

  /** Parses `text` as an integer and stores it. Returns an error message, or `null` on success. */
  setFieldText(field: TuningField, text: string): string | null {
    let value: number;
    try {
      value = parseIntegerText(text);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    this.writeField(field, value);
    return null;
  }

  /**
   * Validates the edited tuning against `baseConfig` by attempting `createSim` (which runs the
   * same `validateConfig` a real run would). On success returns the merged `SimConfig` the caller
   * can restart the scene with; on failure returns the `SimConfigError` message.
   */
  apply(baseConfig: SimConfig): ApplyResult {
    const config: SimConfig = { ...baseConfig, tuning: cloneTuning(this.values) };
    try {
      createSim(config);
    } catch (error) {
      if (error instanceof SimConfigError) {
        return { ok: false, error: error.message };
      }
      throw error;
    }
    return { ok: true, config };
  }

  /** Restores every field to `DEFAULT_TUNING`. */
  reset(): void {
    this.values = cloneTuning(DEFAULT_TUNING);
  }

  /** The complete tuning plus `TUNING_VERSION`, as downloadable JSON text. */
  exportJson(): string {
    return JSON.stringify({ tuningVersion: TUNING_VERSION, tuning: this.values }, null, 2);
  }

  private readField(field: TuningField): number {
    return field.scope === 'global'
      ? this.values.global[field.key]
      : this.values.types[field.scope][field.key];
  }

  private writeField(field: TuningField, value: number): void {
    if (field.scope === 'global') {
      this.values.global[field.key] = value;
    } else {
      this.values.types[field.scope][field.key] = value;
    }
  }
}
