import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../../src/config';
import { advance, output } from '../../src/prng';
import { replay } from '../../src/replay';
import { createSim } from '../../src/sim';
import { recomputeSwayTarget } from '../../src/sway';
import { DEFAULT_TUNING } from '../../src/tuning';
import type { SimConfig } from '../../src/types';
import { playScript } from '../helpers/bot';
import { makeState } from '../helpers/state';

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

describe('assist (FR-047, FR-048)', () => {
  it('state.assist is 1 when config.assist is true', () => {
    const sim = createSim(config({ assist: true }));
    expect(sim.getState().assist).toBe(1);
    const off = createSim(config({ assist: false }));
    expect(off.getState().assist).toBe(0);
  });

  it('the same seed and log with the opposite assist value always gives a different hash', () => {
    let rngState = 999;
    for (let i = 0; i < 50; i += 1) {
      rngState = advance(rngState);
      const seed = output(rngState);
      const scripts: Array<'P' | 'G' | 'M'>[] = [['P'], ['G'], ['M'], ['P', 'G'], ['G', 'M']];
      const script = scripts[i % scripts.length] ?? ['P'];

      const { log } = playScript(config({ seed, assist: false }), script);

      const off = replay(config({ seed, assist: false }), log);
      const on = replay(config({ seed, assist: true }), log);

      expect(on.hash).not.toBe(off.hash);
    }
  });

  it('with assist, swayTarget equals div(targetWithoutAssist * 500, 1000) before the cap', () => {
    const residential = DEFAULT_TUNING.types.residential;
    const base = { floors: 5, lean: 10, goodCount: 1, stabilizer: 1000 };

    const off = makeState({ ...base, assist: 0 });
    recomputeSwayTarget(off, DEFAULT_TUNING, residential);

    const on = makeState({ ...base, assist: 1 });
    recomputeSwayTarget(on, DEFAULT_TUNING, residential);

    expect(on.swayTarget).toBe(Math.trunc((off.swayTarget * 500) / 1000));
  });
});
