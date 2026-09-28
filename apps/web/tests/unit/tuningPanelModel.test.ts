import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TUNING, TUNING_VERSION, cloneTuning, isDefaultTuning } from '@skyline/sim';
import { describe, expect, it } from 'vitest';
import {
  TuningPanelModel,
  listTuningFields,
  tuningFieldLabel,
} from '../../src/dev/tuningPanelModel';

const BASE_CONFIG = {
  type: 'residential' as const,
  mode: 'city' as const,
  seed: 1,
  assist: false,
  tuning: cloneTuning(DEFAULT_TUNING),
};

const TOWER_TYPES = ['residential', 'commercial', 'office', 'luxury'] as const;

const FIXED_ENGINE_CONSTANTS = [
  'TICK_RATE',
  'BLOCK_WIDTH',
  'MAX_TICKS_PER_FRAME',
  'SIN_LUT_SIZE',
  'Q15_SCALE',
  'SWAY_SMOOTHING_DIVISOR',
];

describe('listTuningFields', () => {
  it('lists every GlobalTuning field (22) and every TypeTuning field per type (4 x 8)', () => {
    const fields = listTuningFields();
    const globalFields = fields.filter((f) => f.scope === 'global');
    expect(globalFields).toHaveLength(22);

    for (const type of TOWER_TYPES) {
      const typeFields = fields.filter((f) => f.scope === type);
      expect(typeFields).toHaveLength(8);
    }

    expect(fields).toHaveLength(22 + 4 * 8);
  });

  it('excludes the fixed engine constants (data-model §1.3)', () => {
    const fields = listTuningFields();
    for (const field of fields) {
      expect(FIXED_ENGINE_CONSTANTS).not.toContain(field.key);
    }
  });

  it('gives a readable label for global and per-type fields', () => {
    expect(tuningFieldLabel({ scope: 'global', key: 'CRANE_AMPLITUDE' })).toBe('CRANE_AMPLITUDE');
    expect(tuningFieldLabel({ scope: 'residential', key: 'targetFloors' })).toBe(
      'residential.targetFloors',
    );
  });
});

describe('TuningPanelModel: field text', () => {
  it('parses valid integer text and updates the field', () => {
    const model = new TuningPanelModel();
    const error = model.setFieldText({ scope: 'global', key: 'CRANE_AMPLITUDE' }, '2200');
    expect(error).toBeNull();
    expect(model.tuning.global.CRANE_AMPLITUDE).toBe(2200);
  });

  it('rejects a non-integer with a message and leaves the value unchanged', () => {
    const model = new TuningPanelModel();
    const error = model.setFieldText({ scope: 'global', key: 'CRANE_AMPLITUDE' }, '1.5');
    expect(error).not.toBeNull();
    expect(model.tuning.global.CRANE_AMPLITUDE).toBe(DEFAULT_TUNING.global.CRANE_AMPLITUDE);
  });

  it('rejects non-numeric text with a message', () => {
    const model = new TuningPanelModel();
    const error = model.setFieldText({ scope: 'residential', key: 'targetFloors' }, 'abc');
    expect(error).not.toBeNull();
    expect(model.tuning.types.residential.targetFloors).toBe(
      DEFAULT_TUNING.types.residential.targetFloors,
    );
  });

  it('reads back the current field value as text', () => {
    const model = new TuningPanelModel();
    expect(model.getFieldText({ scope: 'global', key: 'LIVES' })).toBe(
      String(DEFAULT_TUNING.global.LIVES),
    );
  });
});

describe('TuningPanelModel: isOverridden', () => {
  it('equals !isDefaultTuning', () => {
    const model = new TuningPanelModel();
    expect(model.isOverridden).toBe(!isDefaultTuning(model.tuning));
    expect(model.isOverridden).toBe(false);

    model.setFieldText({ scope: 'global', key: 'LIVES' }, '5');
    expect(model.isOverridden).toBe(!isDefaultTuning(model.tuning));
    expect(model.isOverridden).toBe(true);
  });
});

describe('TuningPanelModel: apply', () => {
  it('runs validation and returns the merged config on success', () => {
    const model = new TuningPanelModel();
    model.setFieldText({ scope: 'global', key: 'SWAY_AMP_CAP' }, '900');
    const result = model.apply(BASE_CONFIG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.tuning.global.SWAY_AMP_CAP).toBe(900);
      expect(result.config.type).toBe(BASE_CONFIG.type);
    }
  });

  it('surfaces a SimConfigError message for an invalid tuning value', () => {
    const model = new TuningPanelModel();
    // PERFECT_MAX must stay <= GOOD_MAX (data-model §1.1 bound).
    model.setFieldText(
      { scope: 'global', key: 'PERFECT_MAX' },
      String(DEFAULT_TUNING.global.GOOD_MAX + 1),
    );
    const result = model.apply(BASE_CONFIG);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

describe('TuningPanelModel: reset', () => {
  it('restores cloneTuning(DEFAULT_TUNING)', () => {
    const model = new TuningPanelModel();
    model.setFieldText({ scope: 'global', key: 'LIVES' }, '9');
    model.reset();
    expect(model.tuning).toEqual(cloneTuning(DEFAULT_TUNING));
    expect(model.isOverridden).toBe(false);
  });
});

describe('TuningPanelModel: exportJson', () => {
  it('returns the complete tuning plus TUNING_VERSION', () => {
    const model = new TuningPanelModel();
    model.setFieldText({ scope: 'global', key: 'LIVES' }, '9');
    const parsed = JSON.parse(model.exportJson()) as {
      tuningVersion: string;
      tuning: typeof DEFAULT_TUNING;
    };
    expect(parsed.tuningVersion).toBe(TUNING_VERSION);
    expect(parsed.tuning).toEqual(model.tuning);
  });
});

describe('TuningPanelModel: purity', () => {
  it('never imports Node fs or makes network calls', () => {
    const path = fileURLToPath(new URL('../../src/dev/tuningPanelModel.ts', import.meta.url));
    const source = readFileSync(path, 'utf8');
    expect(source).not.toMatch(/node:fs|require\(['"]fs['"]\)|\bfetch\(/);
  });
});
