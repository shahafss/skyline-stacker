import { describe, expect, it } from 'vitest';
import { createSim } from '../../src/sim';
import { cloneTuning } from '../../src/config';
import { DEFAULT_TUNING } from '../../src/tuning';
import type { SimConfig } from '../../src/types';
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

function dropTier(sim: ReturnType<typeof createSim>, tier: 'perfect' | 'good' | 'miss'): void {
  const tick = findDropTick(sim, tier);
  if (tick === null) throw new Error(`no ${tier} tick found`);
  while (sim.getState().tick < tick) sim.step();
  if (!sim.requestDrop()) throw new Error('requestDrop rejected');
  const fallTicks = sim.getConfig().tuning.global.DROP_FALL_TICKS;
  for (let i = 0; i < fallTicks + 1; i += 1) sim.step();
}

describe('caps roll-up (SC-005)', () => {
  it('crane speed is capped at 2000 for N >= 50 (Luxury run)', () => {
    const sim = createSim(config({ type: 'luxury', seed: 11 }));
    for (let i = 0; i < 55; i += 1) dropTier(sim, 'perfect');
    expect(sim.getState().floors).toBe(55);
    expect(sim.getState().craneSpeed).toBe(2000);
  });

  it('sensitivity is capped at 2000 once goodCount reaches 20', () => {
    const sim = createSim(config({ seed: 22 }));
    for (let i = 0; i < 20; i += 1) dropTier(sim, 'good');
    expect(sim.getState().goodCount).toBe(20);
    expect(sim.getState().sensitivity).toBe(2000);
  });

  it('sway amplitude stays within SWAY_AMP_CAP (350) on a Luxury run with maximum lean', () => {
    const sim = createSim(config({ type: 'luxury', seed: 33 }));
    // Alternate Good landings on the same side to build up lean.
    for (let i = 0; i < 15; i += 1) dropTier(sim, 'good');
    expect(sim.getState().swayTarget).toBeLessThanOrEqual(350);
    expect(sim.getState().swayAmp).toBeLessThanOrEqual(350);
  });

  it('comboMult is capped at 3000 after 8 or more consecutive Perfects', () => {
    const sim = createSim(config({ seed: 44 }));
    for (let i = 0; i < 8; i += 1) dropTier(sim, 'perfect');
    expect(sim.getState().combo).toBe(8);
    expect(sim.getState().comboMult).toBe(3000);
  });

  it('stabilizer never drops below STABILIZER_FLOOR (500)', () => {
    const sim = createSim(config({ seed: 55 }));
    for (let i = 0; i < 25; i += 1) {
      dropTier(sim, 'perfect');
      expect(sim.getState().stabilizer).toBeGreaterThanOrEqual(500);
    }
  });
});
