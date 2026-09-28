import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  MAX_TICKS_PER_FRAME,
  Q15_SCALE,
  SIN_LUT_SIZE,
  SWAY_SMOOTHING_DIVISOR,
  TICK_RATE,
  BLOCK_WIDTH,
} from '../../src/tuning';
import type { TuningValues } from '../../src/types';

describe('DEFAULT_TUNING', () => {
  it('matches the PRD §7.1 global values', () => {
    expect(DEFAULT_TUNING.global).toEqual({
      CRANE_AMPLITUDE: 1100,
      DROP_FALL_TICKS: 24,
      SPAWN_DELAY_TICKS: 36,
      PERFECT_MAX: 50,
      GOOD_MAX: 250,
      LIVES: 3,
      CRANE_SPEED_PER_FLOOR: 20,
      CRANE_SPEED_CAP: 2000,
      SENSITIVITY_STEP: 50,
      SENSITIVITY_CAP: 2000,
      BASE_SWAY_PER_FLOOR: 3,
      LEAN_GAIN: 600,
      SWAY_AMP_CAP: 350,
      STABILIZER_STEP: 800,
      STABILIZER_FLOOR: 500,
      COMBO_STEP: 250,
      COMBO_CAP: 3000,
      COMPLETION_BONUS: 200,
      BONUS_CAP: 1000,
      ASSIST_SWAY: 500,
      CAMERA_HOOK_CLEARANCE: 5,
      VISUAL_TILT_MAX_DEG: 6,
    });
  });

  it('matches the PRD §7.2 per-type values', () => {
    expect(DEFAULT_TUNING.types).toEqual({
      residential: {
        targetFloors: 30,
        minRoofFloors: 15,
        cranePeriodTicks: 144,
        swayPeriodTicks: 180,
        swayMult: 1000,
        perfectPop: 10,
        goodPop: 5,
        blockVisualHeight: 1000,
      },
      commercial: {
        targetFloors: 40,
        minRoofFloors: 20,
        cranePeriodTicks: 144,
        swayPeriodTicks: 120,
        swayMult: 1000,
        perfectPop: 15,
        goodPop: 7,
        blockVisualHeight: 1000,
      },
      office: {
        targetFloors: 50,
        minRoofFloors: 25,
        cranePeriodTicks: 120,
        swayPeriodTicks: 180,
        swayMult: 1200,
        perfectPop: 20,
        goodPop: 10,
        blockVisualHeight: 1400,
      },
      luxury: {
        targetFloors: 60,
        minRoofFloors: 30,
        cranePeriodTicks: 132,
        swayPeriodTicks: 156,
        swayMult: 2000,
        perfectPop: 30,
        goodPop: 15,
        blockVisualHeight: 1200,
      },
    });
  });

  it('is deeply frozen', () => {
    expect(Object.isFrozen(DEFAULT_TUNING)).toBe(true);
    expect(Object.isFrozen(DEFAULT_TUNING.global)).toBe(true);
    expect(Object.isFrozen(DEFAULT_TUNING.types)).toBe(true);
    for (const type of Object.values(DEFAULT_TUNING.types)) {
      expect(Object.isFrozen(type)).toBe(true);
    }
  });
});

describe('fixed engine constants', () => {
  it('have the documented values', () => {
    expect(TICK_RATE).toBe(60);
    expect(BLOCK_WIDTH).toBe(1000);
    expect(MAX_TICKS_PER_FRAME).toBe(5);
    expect(SIN_LUT_SIZE).toBe(4096);
    expect(Q15_SCALE).toBe(32768);
    expect(SWAY_SMOOTHING_DIVISOR).toBe(16);
  });

  it('are not keys of TuningValues', () => {
    const globalKeys = new Set(Object.keys(DEFAULT_TUNING.global));
    const engineConstantNames = [
      'TICK_RATE',
      'BLOCK_WIDTH',
      'MAX_TICKS_PER_FRAME',
      'SIN_LUT_SIZE',
      'Q15_SCALE',
      'SWAY_SMOOTHING_DIVISOR',
    ];
    for (const name of engineConstantNames) {
      expect(globalKeys.has(name)).toBe(false);
    }
    // Compile-time check: TuningValues has no such fields either.
    const check: TuningValues = DEFAULT_TUNING;
    expect(check).toBeDefined();
  });
});
