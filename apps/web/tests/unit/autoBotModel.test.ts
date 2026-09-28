import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, PHASE_SWINGING, cloneTuning, createSim } from '@skyline/sim';
import {
  predictedLandingOffset,
  predictedLandingOffsetAtDrop,
  predictSwayAfterTicks,
  shouldDropNow,
  ticksUntilLanding,
} from '../../src/dev/autoBotModel';

describe('predictedLandingOffset', () => {
  it('is craneX minus the top floor rest position adjusted by sway (matches landing.ts d)', () => {
    // packages/sim/src/landing.ts: d = releaseX - (restX[n] + swayS); releaseX becomes craneX on drop.
    expect(predictedLandingOffset(105, 100, 3)).toBe(2);
    expect(predictedLandingOffset(90, 100, 0)).toBe(-10);
    expect(predictedLandingOffset(100, 100, 0)).toBe(0);
  });
});

describe('ticksUntilLanding', () => {
  it('is DROP_FALL_TICKS plus the one-tick pending-input delay (W3)', () => {
    expect(ticksUntilLanding(24)).toBe(25);
    expect(ticksUntilLanding(0)).toBe(1);
  });
});

describe('predictSwayAfterTicks', () => {
  it('returns the current swayS unchanged when 0 ticks ahead and phase is at the sine origin', () => {
    // index 0 -> sin(0) == 0, so swayS is 0 regardless of amplitude.
    expect(predictSwayAfterTicks(0, 1000, 1000, 100, 0)).toBe(0);
  });

  it('changes swayS as the phase advances toward a non-zero part of the sine wave', () => {
    // phase >>> 20 walks through SIN_LUT's 4096 entries; a large enough increment over enough
    // ticks moves the index away from 0, where sin is no longer 0.
    const swayIncrement = 2 ** 24; // reaches index (phase >>> 20) == 16 after 16 ticks
    const predicted = predictSwayAfterTicks(0, 1000, 1000, swayIncrement, 16);
    expect(predicted).not.toBe(0);
  });

  it('ramps the amplitude toward swayTarget by the smoothing-divisor step each tick (matches sway.ts)', () => {
    // amp 0 -> target 1600, divisor 16: diff/16 truncated each tick, same order as sway.ts's
    // advanceSway (100, then 93, then 87 -> amp 280 after 3 ticks). Phase held at a quarter turn
    // (sin == 1 exactly, index 1024) so swayS reads the amplitude directly (Q15_SCALE 32768,
    // SIN_LUT[1024] == 32767, so swayS == trunc(amp * 32767 / 32768)).
    const quarterTurnPhase = 1024 * 2 ** 20;
    const predicted = predictSwayAfterTicks(quarterTurnPhase, 0, 1600, 0, 3);
    expect(predicted).toBe(Math.trunc((280 * 32767) / 32768));
  });
});

describe('predictedLandingOffsetAtDrop', () => {
  it('matches predictedLandingOffset when sway is not moving (swayIncrement 0, amp already at target)', () => {
    // With swayIncrement 0 and swayAmp already equal to swayTarget, sway.ts's advanceSway leaves
    // both the phase-driven swayS and the amplitude unchanged, so the forward-simulated value
    // should equal a naive same-instant prediction.
    const offset = predictedLandingOffsetAtDrop(110, 100, 0, 0, 0, 0, 24);
    expect(offset).toBe(predictedLandingOffset(110, 100, 0));
  });
});

describe('shouldDropNow', () => {
  it('drops when the predicted landing offset is within PERFECT_MAX (swayIncrement 0)', () => {
    expect(shouldDropNow(102, 100, 0, 0, 0, 0, 24, 50)).toBe(true);
  });

  it('does not drop when the predicted landing offset exceeds PERFECT_MAX', () => {
    expect(shouldDropNow(200, 100, 0, 0, 0, 0, 24, 50)).toBe(false);
  });

  it('treats exactly PERFECT_MAX as still perfect (boundary, matches classifyOffset <=)', () => {
    expect(shouldDropNow(150, 100, 0, 0, 0, 0, 24, 50)).toBe(true); // offset exactly 50
    expect(shouldDropNow(151, 100, 0, 0, 0, 0, 24, 50)).toBe(false); // offset 51
  });

  it('predicts sway that has moved by landing time rather than using the current sway (C1 regression)', () => {
    // swayAmp is far from swayTarget and swayIncrement moves the phase off the sin(0) origin, so a
    // bot using *current* sway (0 at phase 0) would misjudge this drop; the landing-time
    // prediction must differ from the naive current-sway prediction.
    const dropFallTicks = 24;
    const naive = predictedLandingOffset(100, 100, 0);
    const predicted = predictedLandingOffsetAtDrop(
      100,
      100,
      0,
      2000,
      4000,
      5_000_000,
      dropFallTicks,
    );
    expect(predicted).not.toBe(naive);
  });
});

describe('a default-tuned Luxury run driven by shouldDropNow (integration, C1)', () => {
  it('completes all 60 floors, mirroring the sim state a real AutoBot would read (the perf capture in GameScene only starts once floors > 50, so a run that merely reaches 50 would never be captured)', () => {
    const sim = createSim({
      type: 'luxury',
      mode: 'city',
      seed: 424242,
      assist: false,
      tuning: cloneTuning(DEFAULT_TUNING),
    });

    const { global } = sim.getConfig().tuning;
    const maxTicks = 2_000_000;
    let ticks = 0;

    while (sim.getResult() === null && ticks < maxTicks) {
      const state = sim.getState();
      if (state.phase === PHASE_SWINGING) {
        const restX = state.restX[state.floors] ?? 0;
        if (
          shouldDropNow(
            state.craneX,
            restX,
            state.swayPhase,
            state.swayAmp,
            state.swayTarget,
            state.swayIncrement,
            global.DROP_FALL_TICKS,
            global.PERFECT_MAX,
          )
        ) {
          sim.requestDrop();
        }
      }
      sim.step();
      ticks += 1;
    }

    const result = sim.getResult();
    const finalState = sim.getState();
    expect(result?.result).toBe('completed');
    expect(finalState.floors).toBe(60);
  });
});
