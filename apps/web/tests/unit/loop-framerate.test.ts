import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, cloneTuning, createSim, hashState, type InputEvent } from '@skyline/sim';
import { FixedStepLoop } from '../../src/loop/FixedStepLoop';

/** Ticks at which a drop is requested, one tick before each (research R8, SC-008). */
const TARGET_TICKS = [40, 100, 170, 250, 330] as const;
const TOTAL_TICKS = 400;
const HZ_VALUES = [30, 60, 120, 144] as const;

interface RunResult {
  readonly log: readonly InputEvent[];
  readonly hash: number;
}

/** Drives a real sim through `FixedStepLoop` at a fixed `hz`, injecting drops between frames. */
function runAtHz(hz: number): RunResult {
  const sim = createSim({
    type: 'residential',
    mode: 'city',
    seed: 0xc0ffee,
    assist: false,
    tuning: cloneTuning(DEFAULT_TUNING),
  });

  let nextTargetIndex = 0;

  const loop = new FixedStepLoop({
    step: () => sim.step(),
    readSnapshot: () => {},
    onEvents: () => {
      const tick = sim.getState().tick;
      const nextTarget = TARGET_TICKS[nextTargetIndex];
      if (nextTarget !== undefined && tick === nextTarget - 1) {
        sim.requestDrop();
        nextTargetIndex += 1;
      }
    },
  });

  const deltaMs = 1000 / hz;
  let ticksRun = 0;
  while (ticksRun < TOTAL_TICKS) {
    ticksRun += loop.advance(deltaMs);
  }

  return { log: sim.getInputLog(), hash: hashState(sim.getState()) };
}

describe('FixedStepLoop frame-rate independence (SC-008)', () => {
  it('gives identical input logs and final hashes at 30, 60, 120 and 144 Hz', () => {
    const runs = HZ_VALUES.map((hz) => runAtHz(hz));
    const [first, ...rest] = runs;
    if (!first) {
      throw new Error('no runs');
    }

    // Sanity: the tick-anchored script actually produced logged inputs. Not every target tick
    // necessarily lands while swinging (the sim rejects a drop request otherwise), but whichever
    // subset is accepted must be exactly the same at every frame rate.
    expect(first.log.length).toBeGreaterThan(0);

    for (const run of rest) {
      expect(run.log).toEqual(first.log);
      expect(run.hash).toBe(first.hash);
    }
  });
});
