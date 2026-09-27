import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../../src/config';
import { spawnCrane } from '../../src/crane';
import { createSim } from '../../src/sim';
import { recomputeSwayTarget } from '../../src/sway';
import { DEFAULT_TUNING } from '../../src/tuning';
import type { SimConfig, SimEvent, TowerType } from '../../src/types';
import { findDropTick } from '../helpers/bot';
import { makeState } from '../helpers/state';

const TYPES: readonly TowerType[] = ['residential', 'commercial', 'office', 'luxury'];
const EXPECTED_TARGET_FLOORS: Record<TowerType, number> = {
  residential: 30,
  commercial: 40,
  office: 50,
  luxury: 60,
};
const EXPECTED_MIN_ROOF: Record<TowerType, number> = {
  residential: 15,
  commercial: 20,
  office: 25,
  luxury: 30,
};

function config(type: TowerType, overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    type,
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
): SimEvent[] {
  const tick = findDropTick(sim, tier);
  if (tick === null) throw new Error(`no ${tier} tick found`);
  while (sim.getState().tick < tick) sim.step();
  if (!sim.requestDrop()) throw new Error('requestDrop rejected');
  const fallTicks = sim.getConfig().tuning.global.DROP_FALL_TICKS;
  const collected: SimEvent[] = [];
  for (let i = 0; i < fallTicks + 1; i += 1) collected.push(...sim.step());
  return collected;
}

describe.each(TYPES)('%s tuning', (type) => {
  const typeTuning = DEFAULT_TUNING.types[type];

  it('uses cranePeriodTicks for the crane increment', () => {
    const state = makeState({ floors: 0, restX: [0] });
    spawnCrane(state, DEFAULT_TUNING, typeTuning);
    const baseIncrement = Math.trunc(4294967296 / typeTuning.cranePeriodTicks);
    expect(state.craneIncrement).toBe(Math.trunc((baseIncrement * state.craneSpeed) / 1000));
  });

  it('uses swayPeriodTicks for the sway increment at run creation', () => {
    const sim = createSim(config(type));
    expect(sim.getState().swayIncrement).toBe(Math.trunc(4294967296 / typeTuning.swayPeriodTicks));
  });

  it('scales the sway target by swayMult', () => {
    const state = makeState({ floors: 10, lean: 50, goodCount: 2, stabilizer: 1000, assist: 0 });
    recomputeSwayTarget(state, DEFAULT_TUNING, typeTuning);
    const other = makeState({ floors: 10, lean: 50, goodCount: 2, stabilizer: 1000, assist: 0 });
    const doubledMult = { ...typeTuning, swayMult: typeTuning.swayMult * 2 };
    recomputeSwayTarget(other, DEFAULT_TUNING, doubledMult);
    if (typeTuning.swayMult > 0) {
      expect(other.swayTarget).toBeGreaterThanOrEqual(state.swayTarget);
    }
  });

  it('awards perfectPop and goodPop', () => {
    const perfectSim = createSim(config(type, { seed: 21 }));
    dropTier(perfectSim, 'perfect');
    expect(perfectSim.getState().score).toBe(
      Math.trunc((typeTuning.perfectPop * 1250) / 1000), // combo 1 -> comboMult 1250
    );

    const goodSim = createSim(config(type, { seed: 22 }));
    dropTier(goodSim, 'good');
    expect(goodSim.getState().score).toBe(typeTuning.goodPop);
  });

  it(`triggers the automatic roof at targetFloors (${String(EXPECTED_TARGET_FLOORS[type])})`, () => {
    expect(typeTuning.targetFloors).toBe(EXPECTED_TARGET_FLOORS[type]);
    const sim = createSim(config(type, { seed: 23 }));
    for (let i = 0; i < typeTuning.targetFloors; i += 1) dropTier(sim, 'perfect');
    let sawRoofSpawn = false;
    for (let i = 0; i < DEFAULT_TUNING.global.SPAWN_DELAY_TICKS + 2; i += 1) {
      const events = sim.step();
      const spawnEvent = events.find((e) => e.kind === 'spawn');
      if (spawnEvent) {
        sawRoofSpawn = spawnEvent.isRoof;
        break;
      }
    }
    expect(sawRoofSpawn).toBe(true);
  });

  it(`has an early-roof minimum of ${String(EXPECTED_MIN_ROOF[type])}`, () => {
    expect(typeTuning.minRoofFloors).toBe(EXPECTED_MIN_ROOF[type]);
  });
});
