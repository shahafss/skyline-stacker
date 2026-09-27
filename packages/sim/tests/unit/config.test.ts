import { describe, expect, it } from 'vitest';
import { SimConfigError, cloneTuning, isDefaultTuning, validateConfig } from '../../src/config';
import { DEFAULT_TUNING, GLOBAL_TUNING_BOUNDS, TYPE_TUNING_BOUNDS } from '../../src/tuning';
import type { GlobalTuning, SimConfig, TowerType, TypeTuning } from '../../src/types';

function validConfig(): SimConfig {
  return {
    type: 'residential',
    mode: 'city',
    seed: 12345,
    assist: false,
    tuning: cloneTuning(DEFAULT_TUNING),
  };
}

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    expect(() => {
      validateConfig(validConfig());
    }).not.toThrow();
  });

  it('throws for a missing tuning field', () => {
    const config = validConfig();
    // @ts-expect-error deliberately deleting a required field
    delete config.tuning.global.CRANE_AMPLITUDE;
    expect(() => {
      validateConfig(config);
    }).toThrow(SimConfigError);
  });

  it('throws when assist is not a boolean', () => {
    const config = validConfig();
    // @ts-expect-error deliberately wrong type
    config.assist = 'yes';
    expect(() => {
      validateConfig(config);
    }).toThrow(SimConfigError);
  });

  it('throws when tuning is missing entirely', () => {
    const config = validConfig();
    // @ts-expect-error deliberately deleting a required field
    delete config.tuning;
    expect(() => {
      validateConfig(config);
    }).toThrow(SimConfigError);
  });

  it('throws when tuning.global is missing', () => {
    const config = validConfig();
    // @ts-expect-error deliberately deleting a required field
    delete config.tuning.global;
    expect(() => {
      validateConfig(config);
    }).toThrow(SimConfigError);
  });

  it('throws when tuning.types is missing', () => {
    const config = validConfig();
    // @ts-expect-error deliberately deleting a required field
    delete config.tuning.types;
    expect(() => {
      validateConfig(config);
    }).toThrow(SimConfigError);
  });

  it('throws when a specific tower type is missing from tuning.types', () => {
    const config = validConfig();
    // @ts-expect-error deliberately deleting a required field
    delete config.tuning.types.luxury;
    expect(() => {
      validateConfig(config);
    }).toThrow(SimConfigError);
  });

  it('throws for a non-integer value', () => {
    const config = validConfig();
    config.tuning.global.CRANE_AMPLITUDE = 1.5;
    expect(() => {
      validateConfig(config);
    }).toThrow(SimConfigError);
  });

  it('throws for an unsafe integer', () => {
    const config = validConfig();
    config.tuning.global.CRANE_AMPLITUDE = Number.MAX_SAFE_INTEGER + 2;
    expect(() => {
      validateConfig(config);
    }).toThrow(SimConfigError);
  });

  it('throws for each global bound exceeded by 1 on both sides', () => {
    for (const key of Object.keys(GLOBAL_TUNING_BOUNDS) as (keyof GlobalTuning)[]) {
      if (key === 'PERFECT_MAX' || key === 'GOOD_MAX') continue;
      const [lo, hi] = GLOBAL_TUNING_BOUNDS[key];

      const below = validConfig();
      below.tuning.global[key] = lo - 1;
      expect(
        () => {
          validateConfig(below);
        },
        `${key} below ${String(lo)}`,
      ).toThrow(SimConfigError);

      const above = validConfig();
      above.tuning.global[key] = hi + 1;
      expect(
        () => {
          validateConfig(above);
        },
        `${key} above ${String(hi)}`,
      ).toThrow(SimConfigError);
    }
  });

  it('enforces PERFECT_MAX 0 – GOOD_MAX', () => {
    const below = validConfig();
    below.tuning.global.PERFECT_MAX = -1;
    expect(() => {
      validateConfig(below);
    }).toThrow(SimConfigError);

    const above = validConfig();
    above.tuning.global.PERFECT_MAX = above.tuning.global.GOOD_MAX + 1;
    expect(() => {
      validateConfig(above);
    }).toThrow(SimConfigError);
  });

  it('enforces STABILIZER_STEP 0 – 1000', () => {
    const below = validConfig();
    below.tuning.global.STABILIZER_STEP = -1;
    expect(() => {
      validateConfig(below);
    }).toThrow(SimConfigError);

    const above = validConfig();
    above.tuning.global.STABILIZER_STEP = 1001;
    expect(() => {
      validateConfig(above);
    }).toThrow(SimConfigError);
  });

  it('throws for each type bound exceeded by 1 on both sides', () => {
    const types: TowerType[] = ['residential', 'commercial', 'office', 'luxury'];
    for (const type of types) {
      for (const key of Object.keys(TYPE_TUNING_BOUNDS) as (keyof TypeTuning)[]) {
        if (key === 'minRoofFloors') continue;
        const [lo, hi] = TYPE_TUNING_BOUNDS[key];

        const below = validConfig();
        below.tuning.types[type][key] = lo - 1;
        expect(
          () => {
            validateConfig(below);
          },
          `${type}.${key} below ${String(lo)}`,
        ).toThrow(SimConfigError);

        const above = validConfig();
        above.tuning.types[type][key] = hi + 1;
        expect(
          () => {
            validateConfig(above);
          },
          `${type}.${key} above ${String(hi)}`,
        ).toThrow(SimConfigError);
      }
    }
  });

  it('enforces minRoofFloors 1 – targetFloors', () => {
    const below = validConfig();
    below.tuning.types.residential.minRoofFloors = 0;
    expect(() => {
      validateConfig(below);
    }).toThrow(SimConfigError);

    const above = validConfig();
    above.tuning.types.residential.minRoofFloors = above.tuning.types.residential.targetFloors + 1;
    expect(() => {
      validateConfig(above);
    }).toThrow(SimConfigError);
  });

  it('throws for a seed outside uint32', () => {
    const negative = validConfig();
    negative.seed = -1;
    expect(() => {
      validateConfig(negative);
    }).toThrow(SimConfigError);

    const tooLarge = validConfig();
    tooLarge.seed = 4294967296;
    expect(() => {
      validateConfig(tooLarge);
    }).toThrow(SimConfigError);
  });

  it("throws for mode: 'quick' with a type other than 'residential'", () => {
    const config = validConfig();
    config.mode = 'quick';
    config.type = 'commercial';
    expect(() => {
      validateConfig(config);
    }).toThrow(SimConfigError);
  });
});

describe('isDefaultTuning', () => {
  it('is true for a clone of DEFAULT_TUNING', () => {
    expect(isDefaultTuning(cloneTuning(DEFAULT_TUNING))).toBe(true);
  });

  it('is false after changing any single global field', () => {
    for (const key of Object.keys(GLOBAL_TUNING_BOUNDS) as (keyof GlobalTuning)[]) {
      const t = cloneTuning(DEFAULT_TUNING);
      t.global[key] = t.global[key] + 1;
      expect(isDefaultTuning(t), key).toBe(false);
    }
  });

  it('is false after changing any single per-type field', () => {
    const types: TowerType[] = ['residential', 'commercial', 'office', 'luxury'];
    for (const type of types) {
      for (const key of Object.keys(TYPE_TUNING_BOUNDS) as (keyof TypeTuning)[]) {
        const t = cloneTuning(DEFAULT_TUNING);
        t.types[type][key] = t.types[type][key] + 1;
        expect(isDefaultTuning(t), `${type}.${key}`).toBe(false);
      }
    }
  });
});

describe('cloneTuning', () => {
  it('returns a deep, unfrozen copy', () => {
    const clone = cloneTuning(DEFAULT_TUNING);
    expect(clone).toEqual(DEFAULT_TUNING);
    expect(clone).not.toBe(DEFAULT_TUNING);
    expect(clone.global).not.toBe(DEFAULT_TUNING.global);
    expect(clone.types.residential).not.toBe(DEFAULT_TUNING.types.residential);
    expect(Object.isFrozen(clone)).toBe(false);
    expect(Object.isFrozen(clone.global)).toBe(false);
    expect(Object.isFrozen(clone.types.residential)).toBe(false);
  });
});
