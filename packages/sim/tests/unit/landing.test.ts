import { describe, expect, it } from 'vitest';
import { evaluateLanding } from '../../src/landing';
import { DEFAULT_TUNING } from '../../src/tuning';
import { RESULT_NONE, TIER_GOOD, TIER_MISS, TIER_PERFECT } from '../../src/types';
import type { SimEvent } from '../../src/types';
import { makeState } from '../helpers/state';

const tuning = DEFAULT_TUNING;
const residential = tuning.types.residential;

describe('evaluateLanding', () => {
  it('Perfect: snaps the floor, grows the combo and applies the stabilizer', () => {
    const state = makeState({ floors: 0, restX: [0], releaseX: 0, swayS: 0 });
    const events: SimEvent[] = [];
    evaluateLanding(state, tuning, residential, events);

    expect(state.lastTier).toBe(TIER_PERFECT);
    expect(state.restX).toEqual([0, 0]);
    expect(state.combo).toBe(1);
    expect(state.comboMult).toBe(1250);
    expect(state.score).toBe(12); // trunc(10 * 1250 / 1000)
    expect(state.stabilizer).toBe(800); // max(500, trunc(1000*800/1000))
    expect(state.floors).toBe(1);
    expect(state.result).toBe(RESULT_NONE);
    expect(events.some((e) => e.kind === 'land')).toBe(true);
  });

  it('Good: keeps the offset, resets combo, awards flat population', () => {
    const state = makeState({ floors: 0, restX: [0], releaseX: 100, swayS: 0 });
    const events: SimEvent[] = [];
    evaluateLanding(state, tuning, residential, events);

    expect(state.lastTier).toBe(TIER_GOOD);
    expect(state.restX).toEqual([0, 100]);
    expect(state.combo).toBe(0);
    expect(state.comboMult).toBe(1000);
    expect(state.score).toBe(5);
    expect(state.stabilizer).toBe(1000);
    expect(state.goodCount).toBe(1);
    expect(state.floors).toBe(1);
  });

  it('Miss: adds no floor, costs a strike, resets combo, emits miss', () => {
    const state = makeState({ floors: 0, restX: [0], releaseX: 300, swayS: 0, combo: 2 });
    const events: SimEvent[] = [];
    evaluateLanding(state, tuning, residential, events);

    expect(state.lastTier).toBe(TIER_MISS);
    expect(state.restX).toEqual([0]);
    expect(state.strikes).toBe(1);
    expect(state.combo).toBe(0);
    expect(state.stabilizer).toBe(1000);
    expect(state.floors).toBe(0);
    const missEvent = events.find((e) => e.kind === 'miss');
    expect(missEvent).toMatchObject({ kind: 'miss', offset: 300, strikes: 1 });
  });

  it('does not touch stabilizer on a Miss', () => {
    const state = makeState({ floors: 0, restX: [0], releaseX: 300, swayS: 0, stabilizer: 640 });
    evaluateLanding(state, tuning, residential, []);
    expect(state.stabilizer).toBe(640);
  });

  describe('formula-level caps', () => {
    it('caps comboMult at 3000 for combo 8, 9 and 20', () => {
      const state = makeState({ floors: 0, restX: [0] });
      for (let i = 0; i < 20; i += 1) {
        state.releaseX = state.restX[state.floors] ?? 0;
        evaluateLanding(state, tuning, residential, []);
        if (state.combo === 8 || state.combo === 9 || state.combo === 20) {
          expect(state.comboMult).toBe(3000);
        }
      }
    });

    it('never lets the stabilizer drop below 500', () => {
      const state = makeState({ floors: 0, restX: [0] });
      for (let i = 0; i < 30; i += 1) {
        state.releaseX = state.restX[state.floors] ?? 0;
        evaluateLanding(state, tuning, residential, []);
        expect(state.stabilizer).toBeGreaterThanOrEqual(500);
      }
    });
  });
});
