import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../../src/config';
import { createRunExport, parseRunExport } from '../../src/export';
import { hashState } from '../../src/hash';
import { replay } from '../../src/replay';
import { createSim } from '../../src/sim';
import { DEFAULT_TUNING, TUNING_VERSION } from '../../src/tuning';
import { SIM_VERSION } from '../../src/version';
import type { SimConfig } from '../../src/types';
import { playScript } from '../helpers/bot';

function config(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    type: 'residential',
    mode: 'city',
    seed: 1,
    assist: false,
    tuning: cloneTuning(DEFAULT_TUNING),
    ...overrides,
  };
}

function finishedRun(overrides: Partial<SimConfig> = {}) {
  return playScript(config(overrides), ['M', 'M', 'M']);
}

describe('createRunExport', () => {
  it('returns every schema field with the right values', () => {
    const { sim } = finishedRun({ seed: 201 });
    const exported = createRunExport(sim);

    expect(exported.format).toBe('skyline-stacker/run');
    expect(exported.exportVersion).toBe(1);
    expect(exported.simVersion).toBe(SIM_VERSION);
    expect(exported.tuningVersion).toBe(TUNING_VERSION);
    expect(exported.tuningOverridden).toBe(false);
    expect(exported.config).toEqual(sim.getConfig());
    expect(exported.inputLog).toEqual(sim.getInputLog());
    expect(exported.result).toEqual(sim.getResult());
    expect(exported.hash).toBe(hashState(sim.getState()));
  });

  it('sets tuningOverridden = true for a modified tuning', () => {
    const tuning = cloneTuning(DEFAULT_TUNING);
    tuning.global.CRANE_AMPLITUDE = 1200;
    const { sim } = finishedRun({ seed: 202, tuning });
    expect(createRunExport(sim).tuningOverridden).toBe(true);
  });

  it('throws if the run has no result', () => {
    const sim = createSim(config({ seed: 203 }));
    sim.step();
    expect(() => createRunExport(sim)).toThrow();
  });
});

describe('parseRunExport', () => {
  it('round-trips through JSON', () => {
    const { sim } = finishedRun({ seed: 204 });
    const exported = createRunExport(sim);
    const roundTripped = parseRunExport(JSON.parse(JSON.stringify(exported)) as unknown);
    expect(roundTripped).toEqual(exported);
  });

  it('rejects a missing field', () => {
    const { sim } = finishedRun({ seed: 205 });
    const exported = createRunExport(sim) as unknown as Record<string, unknown>;
    const { hash: _hash, ...withoutHash } = exported;
    expect(() => parseRunExport(withoutHash)).toThrow();
  });

  it('rejects an extra field', () => {
    const { sim } = finishedRun({ seed: 206 });
    const exported = createRunExport(sim) as unknown as Record<string, unknown>;
    expect(() => parseRunExport({ ...exported, extra: 1 })).toThrow();
  });

  it("rejects mode: 'quick' with type 'office'", () => {
    const { sim } = finishedRun({ seed: 207 });
    const exported = createRunExport(sim);
    const bad = {
      ...exported,
      config: { ...exported.config, mode: 'quick', type: 'office' },
    };
    expect(() => parseRunExport(bad)).toThrow();
  });

  it('rejects a non-integer tuning value', () => {
    const { sim } = finishedRun({ seed: 208 });
    const exported = createRunExport(sim);
    const bad = {
      ...exported,
      config: {
        ...exported.config,
        tuning: {
          ...exported.config.tuning,
          global: { ...exported.config.tuning.global, CRANE_AMPLITUDE: 1.5 },
        },
      },
    };
    expect(() => parseRunExport(bad)).toThrow();
  });

  it('rejects a hash outside uint32', () => {
    const { sim } = finishedRun({ seed: 209 });
    const exported = createRunExport(sim);
    expect(() => parseRunExport({ ...exported, hash: 4294967296 })).toThrow();
    expect(() => parseRunExport({ ...exported, hash: -1 })).toThrow();
  });

  it('replays an export with overridden tuning to its recorded hash using its own tuning (FR-050)', () => {
    const tuning = cloneTuning(DEFAULT_TUNING);
    tuning.global.DROP_FALL_TICKS = 30;
    const { sim } = finishedRun({ seed: 210, tuning });
    const exported = createRunExport(sim);
    const parsed = parseRunExport(JSON.parse(JSON.stringify(exported)) as unknown);
    const replayed = replay(parsed.config, parsed.inputLog);
    expect(replayed.hash).toBe(parsed.hash);
    expect(replayed.result).toEqual(parsed.result);
  });
});
