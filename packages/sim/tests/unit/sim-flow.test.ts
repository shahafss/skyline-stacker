import { describe, expect, it } from 'vitest';
import { createSim } from '../../src/sim';
import { hashState } from '../../src/hash';
import { cloneTuning } from '../../src/config';
import { DEFAULT_TUNING } from '../../src/tuning';
import {
  PHASE_ENDED,
  PHASE_FALLING,
  PHASE_SPAWN_DELAY,
  RESULT_COMPLETED,
  RESULT_GAME_OVER,
} from '../../src/types';
import type { SimConfig, SimEvent } from '../../src/types';
import { findDropTick } from '../helpers/bot';
import { restore, snapshot } from '../helpers/snapshot';

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

/** Steps `sim` to the given drop tier, applying the drop and resolving the landing. */
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
  for (let i = 0; i < fallTicks + 1; i += 1) {
    collected.push(...sim.step());
  }
  return collected;
}

describe('start of run', () => {
  it('the first step() has tick 1 and emits spawn', () => {
    const sim = createSim(config());
    const events = sim.step();
    expect(sim.getState().tick).toBe(1);
    expect(events.some((e) => e.kind === 'spawn')).toBe(true);
  });

  it('requestDrop() before the spawn returns false', () => {
    const sim = createSim(config());
    expect(sim.requestDrop()).toBe(false);
  });
});

describe('drop, fall and spawn timing', () => {
  it('the logged tick = getState().tick + 1 at the time of the request (SC-009)', () => {
    const sim = createSim(config());
    sim.step(); // spawn on tick 1
    const expectedTick = sim.getState().tick + 1;
    expect(sim.requestDrop()).toBe(true);
    sim.step();
    const log = sim.getInputLog();
    expect(log[log.length - 1]).toEqual({ tick: expectedTick, type: 'drop' });
  });

  it('releaseX equals the craneX of the previous tick', () => {
    const sim = createSim(config());
    sim.step();
    const craneXBefore = sim.getState().craneX;
    sim.requestDrop();
    sim.step();
    expect(sim.getState().releaseX).toBe(craneXBefore);
  });

  it('the landing is evaluated at exactly releaseTick + DROP_FALL_TICKS', () => {
    const sim = createSim(config());
    sim.step();
    sim.requestDrop();
    sim.step();
    const { releaseTick, landingTick } = sim.getState();
    expect(landingTick).toBe(releaseTick + DEFAULT_TUNING.global.DROP_FALL_TICKS);
    while (sim.getState().tick < landingTick - 1) {
      sim.step();
      expect(sim.getState().phase).toBe(PHASE_FALLING);
    }
    const events = sim.step();
    expect(sim.getState().tick).toBe(landingTick);
    expect(events.some((e) => e.kind === 'land' || e.kind === 'miss')).toBe(true);
  });

  it('the next spawn happens exactly SPAWN_DELAY_TICKS after the landing tick', () => {
    const sim = createSim(config());
    dropTier(sim, 'perfect');
    const landingTick = sim.getState().tick;
    let spawnTick: number | null = null;
    for (let i = 0; i < DEFAULT_TUNING.global.SPAWN_DELAY_TICKS + 2; i += 1) {
      const events = sim.step();
      if (events.some((e) => e.kind === 'spawn')) {
        spawnTick = sim.getState().tick;
        break;
      }
    }
    expect(spawnTick).toBe(landingTick + DEFAULT_TUNING.global.SPAWN_DELAY_TICKS);
  });

  it('requestDrop() returns false while falling, during spawn delay, and with a pending input', () => {
    const sim = createSim(config());
    sim.step();
    sim.requestDrop();
    sim.step();
    expect(sim.getState().phase).toBe(PHASE_FALLING);
    expect(sim.requestDrop()).toBe(false);

    dropTier(sim, 'perfect');
    expect(sim.getState().phase).toBe(PHASE_SPAWN_DELAY);
    expect(sim.requestDrop()).toBe(false);

    // pending input: request once while swinging, then request again before it applies
    const tick = findDropTick(sim, 'perfect');
    if (tick === null) throw new Error('no tick found');
    while (sim.getState().tick < tick) sim.step();
    expect(sim.requestDrop()).toBe(true);
    expect(sim.requestDrop()).toBe(false);
  });
});

describe('roof and result', () => {
  it('after 30 floors, the next spawn has isRoof = true', () => {
    const sim = createSim(config());
    for (let i = 0; i < 30; i += 1) dropTier(sim, 'perfect');
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
    expect(sim.getState().isRoof).toBe(1);
  });

  it('a Perfect or Good roof ends with completed, the bonus, and floors = 30', () => {
    const sim = createSim(config());
    for (let i = 0; i < 30; i += 1) dropTier(sim, 'perfect');
    const scoreBeforeRoof = sim.getState().score;
    const events = dropTier(sim, 'perfect');
    const finishedEvent = events.find((e) => e.kind === 'finished');
    expect(finishedEvent).toBeDefined();
    expect(sim.getState().result).toBe(RESULT_COMPLETED);
    expect(sim.getState().floors).toBe(30);
    const expectedFinal =
      scoreBeforeRoof +
      Math.trunc((scoreBeforeRoof * DEFAULT_TUNING.global.COMPLETION_BONUS) / 1000);
    expect(sim.getState().finalScore).toBe(expectedFinal);
    expect(sim.getState().score).toBe(scoreBeforeRoof);
  });

  it('the roof adds no floor or population', () => {
    const sim = createSim(config());
    for (let i = 0; i < 30; i += 1) dropTier(sim, 'perfect');
    const scoreBefore = sim.getState().score;
    const floorsBefore = sim.getState().floors;
    dropTier(sim, 'perfect');
    expect(sim.getState().score).toBe(scoreBefore);
    expect(sim.getState().floors).toBe(floorsBefore);
  });

  it('a roof Miss costs a strike, and the next spawn is again a roof', () => {
    const sim = createSim(config());
    for (let i = 0; i < 30; i += 1) dropTier(sim, 'perfect');
    dropTier(sim, 'miss');
    expect(sim.getState().strikes).toBe(1);
    expect(sim.getState().result).toBe(0);

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
});

describe('strikes', () => {
  it('the 3rd Miss ends with gameOver, finalScore = score, and emits gameOver', () => {
    const sim = createSim(config());
    dropTier(sim, 'perfect');
    const scoreAfterOnePerfect = sim.getState().score;
    dropTier(sim, 'miss');
    dropTier(sim, 'miss');
    const events = dropTier(sim, 'miss');
    expect(events.some((e) => e.kind === 'gameOver')).toBe(true);
    expect(sim.getState().result).toBe(RESULT_GAME_OVER);
    expect(sim.getState().strikes).toBe(3);
    expect(sim.getState().finalScore).toBe(scoreAfterOnePerfect);
    expect(sim.getState().score).toBe(scoreAfterOnePerfect);
  });
});

describe('finality (FR-045)', () => {
  it('after a result, further step() calls return [] and change nothing', () => {
    const sim = createSim(config());
    dropTier(sim, 'miss');
    dropTier(sim, 'miss');
    dropTier(sim, 'miss');
    expect(sim.getState().phase).toBe(PHASE_ENDED);
    const hashAfterEnd = hashState(sim.getState());

    for (let i = 0; i < 100; i += 1) {
      const events = sim.step();
      expect(events).toEqual([]);
    }
    expect(hashState(sim.getState())).toBe(hashAfterEnd);
    expect(sim.requestDrop()).toBe(false);
    expect(sim.requestRoof()).toBe(false);
  });
});

describe('getResult', () => {
  it('is null before the end and populated after', () => {
    const sim = createSim(config());
    sim.step();
    expect(sim.getResult()).toBeNull();
    dropTier(sim, 'miss');
    dropTier(sim, 'miss');
    dropTier(sim, 'miss');
    expect(sim.getResult()).toEqual({
      result: 'gameOver',
      score: sim.getState().finalScore,
      floors: sim.getState().floors,
    });
  });
});

describe('step() array identity', () => {
  it('returns the same array instance on every call', () => {
    const sim = createSim(config());
    const first = sim.step();
    const second = sim.step();
    expect(first).toBe(second);
  });
});

describe('snapshot helper fidelity', () => {
  it('restore(snapshot(sim)) followed by the same inputs reaches the same final hash', () => {
    const sim = createSim(config());
    dropTier(sim, 'perfect');
    const snap = snapshot(sim);
    const restored = restore(snap);

    dropTier(sim, 'good');
    dropTier(sim, 'miss');
    dropTier(restored, 'good');
    dropTier(restored, 'miss');

    expect(hashState(restored.getState())).toBe(hashState(sim.getState()));
  });
});
