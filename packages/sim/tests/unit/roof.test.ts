import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../../src/config';
import { canPlaceRoof, createSim } from '../../src/sim';
import { DEFAULT_TUNING } from '../../src/tuning';
import { PHASE_SPAWN_DELAY, PHASE_SWINGING, RESULT_BUILT, RESULT_NONE } from '../../src/types';
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

/** Plays N Perfects, then drains the spawn delay so the (N+1)th block is swinging. */
function reachFloors(sim: ReturnType<typeof createSim>, n: number): void {
  for (let i = 0; i < n; i += 1) dropTier(sim, 'perfect');
  while (sim.getState().phase !== PHASE_SWINGING) sim.step();
}

describe('requestRoof()', () => {
  it('returns false below minRoofFloors (N = 14) and true at N = 15 while swinging (SC-006)', () => {
    const below = createSim(config({ seed: 2 }));
    reachFloors(below, 14);
    expect(below.getState().phase).toBe(PHASE_SWINGING);
    expect(below.requestRoof()).toBe(false);

    const at = createSim(config({ seed: 3 }));
    reachFloors(at, 15);
    expect(at.getState().phase).toBe(PHASE_SWINGING);
    expect(at.requestRoof()).toBe(true);
  });

  it('returns false while falling', () => {
    const sim = createSim(config({ seed: 4 }));
    reachFloors(sim, 15);
    sim.requestDrop();
    sim.step();
    expect(sim.requestRoof()).toBe(false);
  });

  it('returns false during the spawn delay', () => {
    const sim = createSim(config({ seed: 5 }));
    reachFloors(sim, 14);
    dropTier(sim, 'perfect'); // lands the 15th floor; leaves phase = spawnDelay
    expect(sim.getState().phase).toBe(PHASE_SPAWN_DELAY);
    expect(sim.requestRoof()).toBe(false);
  });

  it('returns false when the block is already the roof', () => {
    const sim = createSim(config({ seed: 6 }));
    reachFloors(sim, 15);
    expect(sim.requestRoof()).toBe(true);
    sim.step();
    expect(sim.getState().isRoof).toBe(1);
    expect(sim.requestRoof()).toBe(false);
  });

  it('returns false when an input is already pending', () => {
    const sim = createSim(config({ seed: 7 }));
    reachFloors(sim, 15);
    expect(sim.requestDrop()).toBe(true);
    expect(sim.requestRoof()).toBe(false);
  });

  it("returns false in 'quick' mode", () => {
    const sim = createSim(config({ mode: 'quick', seed: 8 }));
    reachFloors(sim, 15);
    expect(sim.requestRoof()).toBe(false);
  });
});

describe('applying an early roof', () => {
  it('is logged as {tick, type: roof} and emits roofPlaced exactly once on that tick', () => {
    const sim = createSim(config({ seed: 9 }));
    reachFloors(sim, 15);
    expect(sim.requestRoof()).toBe(true);
    const expectedTick = sim.getState().tick + 1;
    const events = sim.step();
    expect(events.filter((e) => e.kind === 'roofPlaced')).toEqual([
      { kind: 'roofPlaced', tick: expectedTick },
    ]);
    const log = sim.getInputLog();
    expect(log[log.length - 1]).toEqual({ tick: expectedTick, type: 'roof' });
  });

  it('keeps the block swinging with an unchanged craneX sequence', () => {
    const withRoof = createSim(config({ seed: 10 }));
    reachFloors(withRoof, 15);
    const xBefore = withRoof.getState().craneX;
    withRoof.requestRoof();
    withRoof.step();
    expect(withRoof.getState().phase).toBe(PHASE_SWINGING);
    expect(withRoof.getState().isRoof).toBe(1);

    const withoutRoof = createSim(config({ seed: 10 }));
    reachFloors(withoutRoof, 15);
    withoutRoof.step();
    expect(withRoof.getState().craneX).toBe(withoutRoof.getState().craneX);
    expect(xBefore).toBeDefined();
  });

  it('canPlaceRoof(sim) is false from that tick on', () => {
    const sim = createSim(config({ seed: 11 }));
    reachFloors(sim, 15);
    expect(canPlaceRoof(sim)).toBe(true);
    sim.requestRoof();
    sim.step();
    expect(canPlaceRoof(sim)).toBe(false);
  });
});

describe('early roof landing', () => {
  it('Perfect or Good gives result = built with finalScore = score (no bonus, SC-006)', () => {
    const sim = createSim(config({ seed: 12 }));
    reachFloors(sim, 15);
    sim.requestRoof();
    sim.step();
    const scoreBefore = sim.getState().score;
    const events = dropTier(sim, 'perfect');
    expect(events.some((e) => e.kind === 'finished' && e.result === 'built')).toBe(true);
    expect(sim.getState().result).toBe(RESULT_BUILT);
    expect(sim.getState().finalScore).toBe(scoreBefore);
    expect(sim.getState().score).toBe(scoreBefore);
  });

  it('a Miss respawns a roof (roofCommitted) with no second roofPlaced', () => {
    const sim = createSim(config({ seed: 13 }));
    reachFloors(sim, 15);
    sim.requestRoof();
    sim.step();
    expect(sim.getState().roofCommitted).toBe(1);

    const events = dropTier(sim, 'miss');
    expect(events.some((e) => e.kind === 'roofPlaced')).toBe(false);
    expect(sim.getState().result).toBe(RESULT_NONE);
    expect(sim.getState().strikes).toBe(1);

    let sawRoofSpawn = false;
    const collected: SimEvent[] = [];
    for (let i = 0; i < DEFAULT_TUNING.global.SPAWN_DELAY_TICKS + 2; i += 1) {
      collected.push(...sim.step());
    }
    for (const e of collected) {
      if (e.kind === 'spawn') sawRoofSpawn = e.isRoof;
      expect(e.kind).not.toBe('roofPlaced');
    }
    expect(sawRoofSpawn).toBe(true);
  });
});

describe('roofAvailable', () => {
  it('is emitted on every non-roof spawn with N >= minRoofFloors in city mode', () => {
    const sim = createSim(config({ seed: 14 }));
    reachFloors(sim, 14);
    // The 15th floor's spawn should carry roofAvailable (N = 14 >= minRoofFloors 15? no: 14 < 15)
    // so keep going one more floor to cross the threshold.
    dropTier(sim, 'perfect');
    let sawAvailable = false;
    for (let i = 0; i < DEFAULT_TUNING.global.SPAWN_DELAY_TICKS + 2; i += 1) {
      const events = sim.step();
      if (events.some((e) => e.kind === 'roofAvailable')) sawAvailable = true;
      if (events.some((e) => e.kind === 'spawn')) break;
    }
    expect(sawAvailable).toBe(true);
  });

  it('matches canPlaceRoof(sim) eligibility', () => {
    const sim = createSim(config({ seed: 15 }));
    reachFloors(sim, 15);
    expect(canPlaceRoof(sim)).toBe(sim.requestRoof());
  });
});

describe('once the automatic roof has spawned', () => {
  it('canPlaceRoof is false and roofPlaced is never emitted', () => {
    const sim = createSim(config({ seed: 16 }));
    reachFloors(sim, 30);
    let roofPlacedSeen = false;
    for (let i = 0; i < DEFAULT_TUNING.global.SPAWN_DELAY_TICKS + 2; i += 1) {
      const events = sim.step();
      if (events.some((e) => e.kind === 'roofPlaced')) roofPlacedSeen = true;
    }
    expect(sim.getState().isRoof).toBe(1);
    expect(canPlaceRoof(sim)).toBe(false);
    expect(roofPlacedSeen).toBe(false);
  });
});
