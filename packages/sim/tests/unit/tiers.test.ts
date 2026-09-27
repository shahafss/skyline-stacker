import { describe, expect, it } from 'vitest';
import { classifyOffset } from '../../src/landing';
import { cloneTuning } from '../../src/config';
import { DEFAULT_TUNING } from '../../src/tuning';
import { TIER_GOOD, TIER_MISS, TIER_PERFECT } from '../../src/types';
import type { SimConfig } from '../../src/types';
import { findDropTick } from '../helpers/bot';
import { createSim } from '../../src/sim';

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

describe('classifyOffset (SC-004)', () => {
  it.each([0, 50, -50])('classifies d = %i as Perfect', (d) => {
    expect(classifyOffset(d, DEFAULT_TUNING)).toBe(TIER_PERFECT);
  });

  it.each([51, -51, 250, -250])('classifies d = %i as Good', (d) => {
    expect(classifyOffset(d, DEFAULT_TUNING)).toBe(TIER_GOOD);
  });

  it.each([251, -251])('classifies d = %i as Miss', (d) => {
    expect(classifyOffset(d, DEFAULT_TUNING)).toBe(TIER_MISS);
  });
});

describe('classifyOffset end-to-end (SC-004)', () => {
  it('a Perfect-tick drop lands Perfect', () => {
    const sim = createSim(config());
    const tick = findDropTick(sim, 'perfect');
    expect(tick).not.toBeNull();
    while (sim.getState().tick < (tick ?? 0)) sim.step();
    sim.requestDrop();
    for (let i = 0; i < DEFAULT_TUNING.global.DROP_FALL_TICKS + 1; i += 1) sim.step();
    expect(sim.getState().lastTier).toBe(TIER_PERFECT);
  });

  it('a Good-tick drop lands Good', () => {
    const sim = createSim(config({ seed: 2 }));
    const tick = findDropTick(sim, 'good');
    expect(tick).not.toBeNull();
    while (sim.getState().tick < (tick ?? 0)) sim.step();
    sim.requestDrop();
    for (let i = 0; i < DEFAULT_TUNING.global.DROP_FALL_TICKS + 1; i += 1) sim.step();
    expect(sim.getState().lastTier).toBe(TIER_GOOD);
  });

  it('a Miss-tick drop lands Miss', () => {
    const sim = createSim(config({ seed: 3 }));
    const tick = findDropTick(sim, 'miss');
    expect(tick).not.toBeNull();
    while (sim.getState().tick < (tick ?? 0)) sim.step();
    sim.requestDrop();
    for (let i = 0; i < DEFAULT_TUNING.global.DROP_FALL_TICKS + 1; i += 1) sim.step();
    expect(sim.getState().lastTier).toBe(TIER_MISS);
  });
});
