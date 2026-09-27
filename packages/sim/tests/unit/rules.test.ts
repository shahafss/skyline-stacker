import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../../src/config';
import { createSim } from '../../src/sim';
import { DEFAULT_TUNING } from '../../src/tuning';
import { RESULT_BUILT, RESULT_COMPLETED, RESULT_GAME_OVER } from '../../src/types';
import type { SimConfig, SimEvent } from '../../src/types';
import { findDropTick } from '../helpers/bot';

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

function dropTier(
  sim: ReturnType<typeof createSim>,
  tier: 'perfect' | 'good' | 'miss',
  side?: -1 | 1,
): SimEvent[] {
  const tick = findDropTick(sim, tier, side);
  if (tick === null) throw new Error(`no ${tier} tick found`);
  while (sim.getState().tick < tick) sim.step();
  if (!sim.requestDrop()) throw new Error('requestDrop rejected');
  const fallTicks = sim.getConfig().tuning.global.DROP_FALL_TICKS;
  const collected: SimEvent[] = [];
  for (let i = 0; i < fallTicks + 1; i += 1) collected.push(...sim.step());
  return collected;
}

describe('SC-006 rules roll-up', () => {
  it('1. a Perfect snaps to the top floor position', () => {
    const sim = createSim(config());
    const xBefore = sim.getState().restX[sim.getState().floors];
    dropTier(sim, 'perfect');
    expect(sim.getState().restX[sim.getState().floors]).toBe(xBefore);
  });

  it('2. a Good keeps its offset', () => {
    const sim = createSim(config({ seed: 2 }));
    const nBefore = sim.getState().floors;
    const xBefore = sim.getState().restX[nBefore] ?? 0;
    dropTier(sim, 'good');
    const newX = sim.getState().restX[sim.getState().floors] ?? 0;
    expect(newX).toBe(xBefore + sim.getState().lastOffset);
    expect(newX).not.toBe(xBefore);
  });

  it('3. a left Good followed by an equal-and-opposite Good reduces |lean|', () => {
    const sim = createSim(config({ seed: 3 }));
    dropTier(sim, 'good', -1);
    const leanAfterLeft = Math.abs(sim.getState().lean);
    dropTier(sim, 'good', 1);
    const leanAfterRight = Math.abs(sim.getState().lean);
    expect(leanAfterRight).toBeLessThanOrEqual(leanAfterLeft);
  });

  it('4. the 3rd strike gives game over', () => {
    const sim = createSim(config({ seed: 4 }));
    dropTier(sim, 'miss');
    dropTier(sim, 'miss');
    const events = dropTier(sim, 'miss');
    expect(events.some((e) => e.kind === 'gameOver')).toBe(true);
    expect(sim.getState().result).toBe(RESULT_GAME_OVER);
  });

  it('5. the early roof is unavailable at minRoofFloors - 1 and available at minRoofFloors', () => {
    const minRoofFloors = DEFAULT_TUNING.types.residential.minRoofFloors;
    const sim = createSim(config({ seed: 5 }));
    for (let i = 0; i < minRoofFloors - 1; i += 1) dropTier(sim, 'perfect');
    let drained = false;
    while (!drained) {
      const events = sim.step();
      if (events.some((e) => e.kind === 'spawn')) drained = true;
    }
    expect(sim.getState().floors).toBe(minRoofFloors - 1);
    expect(sim.requestRoof()).toBe(false);

    dropTier(sim, 'perfect');
    let drained2 = false;
    while (!drained2) {
      const events = sim.step();
      if (events.some((e) => e.kind === 'spawn')) drained2 = true;
    }
    expect(sim.getState().floors).toBe(minRoofFloors);
    expect(sim.requestRoof()).toBe(true);
  });

  it('6. an early-roof finish has no bonus', () => {
    const minRoofFloors = DEFAULT_TUNING.types.residential.minRoofFloors;
    const sim = createSim(config({ seed: 6 }));
    for (let i = 0; i < minRoofFloors; i += 1) dropTier(sim, 'perfect');
    let drained = false;
    while (!drained) {
      const events = sim.step();
      if (events.some((e) => e.kind === 'spawn')) drained = true;
    }
    sim.requestRoof();
    sim.step();
    const scoreBefore = sim.getState().score;
    dropTier(sim, 'perfect');
    expect(sim.getState().result).toBe(RESULT_BUILT);
    expect(sim.getState().finalScore).toBe(scoreBefore);
  });

  it('7. a target-height finish gets exactly div(sum * 200, 1000)', () => {
    const targetFloors = DEFAULT_TUNING.types.residential.targetFloors;
    const sim = createSim(config({ seed: 7 }));
    for (let i = 0; i < targetFloors; i += 1) dropTier(sim, 'perfect');
    const scoreBefore = sim.getState().score;
    dropTier(sim, 'perfect');
    expect(sim.getState().result).toBe(RESULT_COMPLETED);
    expect(sim.getState().finalScore).toBe(
      scoreBefore + Math.trunc((scoreBefore * DEFAULT_TUNING.global.COMPLETION_BONUS) / 1000),
    );
  });
});
