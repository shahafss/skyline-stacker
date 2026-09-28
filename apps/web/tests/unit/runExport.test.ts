import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  PHASE_SWINGING,
  RESULT_NONE,
  cloneTuning,
  createRunExport,
  createSim,
  type SimConfig,
  type TowerSim,
} from '@skyline/sim';
import { buildDownload } from '../../src/export/runExport';

/** Runs `sim` until it has a result, requesting a drop as soon as the crane starts swinging. */
function runToResult(sim: TowerSim): void {
  const cap = 100_000;
  for (let i = 0; i < cap && sim.getState().result === RESULT_NONE; i += 1) {
    if (sim.getState().phase === PHASE_SWINGING) {
      sim.requestDrop();
    }
    sim.step();
  }
  if (sim.getState().result === RESULT_NONE) {
    throw new Error('runToResult: sim never reached a result');
  }
}

function baseConfig(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    type: 'residential',
    mode: 'city',
    seed: 42,
    assist: false,
    tuning: cloneTuning(DEFAULT_TUNING),
    ...overrides,
  };
}

describe('buildDownload', () => {
  it('is unavailable before a result', () => {
    const sim = createSim(baseConfig());
    expect(buildDownload(sim)).toBeNull();
  });

  it('returns filename run-<type>-<seed>.json and JSON text equal to createRunExport(sim)', () => {
    const sim = createSim(baseConfig({ type: 'commercial', seed: 777 }));
    runToResult(sim);

    const download = buildDownload(sim);
    expect(download).not.toBeNull();
    expect(download?.filename).toBe('run-commercial-777.json');
    expect(JSON.parse(download?.text ?? '')).toEqual(createRunExport(sim));
  });

  it('sets tuningOverridden true for a sim created with modified tuning', () => {
    const overriddenTuning = cloneTuning(DEFAULT_TUNING);
    overriddenTuning.global.LIVES = DEFAULT_TUNING.global.LIVES + 1;
    const sim = createSim(baseConfig({ tuning: overriddenTuning }));
    runToResult(sim);

    const download = buildDownload(sim);
    expect(download).not.toBeNull();
    const parsed = JSON.parse(download?.text ?? '') as { tuningOverridden: boolean };
    expect(parsed.tuningOverridden).toBe(true);
  });
});
