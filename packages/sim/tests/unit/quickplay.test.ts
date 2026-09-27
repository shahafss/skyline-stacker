import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../../src/config';
import { createSim } from '../../src/sim';
import { DEFAULT_TUNING } from '../../src/tuning';
import { RESULT_GAME_OVER } from '../../src/types';
import type { SimConfig, SimEvent } from '../../src/types';
import { findDropTick } from '../helpers/bot';

function quickConfig(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    type: 'residential',
    mode: 'quick',
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

describe('Quick Play', () => {
  it('never spawns a roof and never emits roofAvailable or roofPlaced', () => {
    const sim = createSim(quickConfig());
    const allEvents: SimEvent[] = [];
    for (let i = 0; i < 40; i += 1) {
      allEvents.push(...dropTier(sim, 'perfect'));
      for (let j = 0; j < DEFAULT_TUNING.global.SPAWN_DELAY_TICKS + 2; j += 1) {
        const events = sim.step();
        allEvents.push(...events);
        if (events.some((e) => e.kind === 'spawn')) break;
      }
    }
    expect(allEvents.some((e) => e.kind === 'roofAvailable')).toBe(false);
    expect(allEvents.some((e) => e.kind === 'roofPlaced')).toBe(false);
    for (const e of allEvents) {
      if (e.kind === 'spawn') expect(e.isRoof).toBe(false);
    }
    expect(sim.getState().isRoof).toBe(0);
  });

  it('ends only at 3 strikes with result = gameOver and score = sum of population', () => {
    const sim = createSim(quickConfig({ seed: 2 }));
    dropTier(sim, 'perfect');
    dropTier(sim, 'good');
    const scoreSoFar = sim.getState().score;
    dropTier(sim, 'miss');
    dropTier(sim, 'miss');
    const events = dropTier(sim, 'miss');
    expect(events.some((e) => e.kind === 'gameOver')).toBe(true);
    expect(sim.getState().result).toBe(RESULT_GAME_OVER);
    expect(sim.getState().score).toBe(scoreSoFar);
    expect(sim.getState().finalScore).toBe(scoreSoFar);
  });

  it('keeps craneSpeed <= 2000 and swayAmp <= 350 on a 300-floor run, finishing under 30s', () => {
    const start = Date.now();
    const sim = createSim(quickConfig({ seed: 3 }));
    let floorsPlaced = 0;
    let guard = 0;
    while (floorsPlaced < 300 && guard < 5000) {
      guard += 1;
      const want = guard % 5 === 0 ? 'good' : 'perfect';
      dropTier(sim, want);
      floorsPlaced = sim.getState().floors;
      expect(sim.getState().craneSpeed).toBeLessThanOrEqual(2000);
      expect(sim.getState().swayAmp).toBeLessThanOrEqual(350);
    }
    expect(floorsPlaced).toBeGreaterThanOrEqual(300);
    expect(sim.getState().result).toBe(0);
    expect(Date.now() - start).toBeLessThan(30_000);
  }, 30_000);
});
