import { describe, expect, it } from 'vitest';
import { cloneTuning } from '../../src/config';
import { hashState } from '../../src/hash';
import { ReplayError, replay } from '../../src/replay';
import { DEFAULT_TUNING } from '../../src/tuning';
import type { SimConfig, TowerType } from '../../src/types';
import { playScript } from '../helpers/bot';

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

const TYPES: readonly TowerType[] = ['residential', 'commercial', 'office', 'luxury'];

describe('replay', () => {
  it.each(TYPES)('matches the live final hash, result and events for a %s run', (type) => {
    const { log, sim } = playScript(config({ type, seed: 101 }), ['P', 'G', 'M', 'P', 'P']);
    const live = { hash: hashState(sim.getState()), result: sim.getResult() };
    const replayed = replay(sim.getConfig(), log);
    expect(replayed.hash).toBe(live.hash);
    expect(replayed.result).toEqual(live.result);
  });

  it('matches the live final hash for a Quick Play run', () => {
    const quickConfig = config({ mode: 'quick', seed: 102 });
    const { log, sim } = playScript(quickConfig, ['P', 'G', 'M', 'M']);
    const replayed = replay(sim.getConfig(), log);
    expect(replayed.hash).toBe(hashState(sim.getState()));
    expect(replayed.result).toEqual(sim.getResult());
  });

  it('stops when the result is set', () => {
    const { log, sim } = playScript(config({ seed: 103 }), ['M', 'M', 'M']);
    const replayed = replay(sim.getConfig(), log);
    expect(replayed.result).not.toBeNull();
    expect(replayed.state.tick).toBe(sim.getState().tick);
  });

  it('stops DROP_FALL_TICKS + 1 (total) ticks after the last input when no result is set', () => {
    const { log, sim } = playScript(config({ seed: 104 }), ['P']);
    const replayed = replay(sim.getConfig(), log);
    const lastTick = log[log.length - 1]?.tick ?? 0;
    // lastTick is itself the first of the "+1" ticks (the tick the input was applied on); the
    // landing resolves DROP_FALL_TICKS ticks after that.
    expect(replayed.state.tick).toBe(lastTick + DEFAULT_TUNING.global.DROP_FALL_TICKS);
    expect(sim.getState().tick).toBe(replayed.state.tick);
  });

  it('throws ReplayError with .tick for a non-increasing log', () => {
    const cfg = config({ seed: 105 });
    try {
      replay(cfg, [
        { tick: 5, type: 'drop' },
        { tick: 5, type: 'drop' },
      ]);
      expect.unreachable('replay should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ReplayError);
      expect((err as ReplayError).tick).toBe(5);
    }
  });

  it('throws ReplayError with .tick for two inputs on one tick', () => {
    const cfg = config({ seed: 106 });
    try {
      replay(cfg, [
        { tick: 10, type: 'drop' },
        { tick: 10, type: 'roof' },
      ]);
      expect.unreachable('replay should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ReplayError);
      expect((err as ReplayError).tick).toBe(10);
    }
  });

  it('throws ReplayError with .tick for a drop rejected at its logged tick', () => {
    const cfg = config({ seed: 107 });
    try {
      // tick 1 is the spawn tick itself: no block is swinging yet on the spawn tick's input phase.
      replay(cfg, [{ tick: 1, type: 'drop' }]);
      expect.unreachable('replay should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ReplayError);
      expect((err as ReplayError).tick).toBe(1);
    }
  });

  it('throws ReplayError with .tick for a roof logged in quick mode', () => {
    const cfg = config({ mode: 'quick', seed: 108 });
    try {
      replay(cfg, [{ tick: 5, type: 'roof' }]);
      expect.unreachable('replay should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ReplayError);
      expect((err as ReplayError).tick).toBe(5);
    }
  });

  it('replaying one log 1000 times in one process gives one hash (SC-007, Node)', () => {
    const { log, sim } = playScript(config({ seed: 109 }), ['P', 'G', 'M', 'P']);
    const cfg = sim.getConfig();
    const hashes = new Set<number>();
    for (let i = 0; i < 1000; i += 1) {
      hashes.add(replay(cfg, log).hash);
    }
    expect(hashes.size).toBe(1);
  });
});
