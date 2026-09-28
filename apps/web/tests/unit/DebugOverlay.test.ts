import { describe, expect, it } from 'vitest';
import { TIER_GOOD, TIER_MISS, TIER_NONE, TIER_PERFECT, type SimState } from '@skyline/sim';
import {
  createDebugSnapshot,
  fillDebugSnapshot,
  formatFieldValue,
  refreshDebugSnapshot,
  tierName,
  type DebugSnapshot,
} from '../../src/dev/DebugOverlay';
import { STRINGS } from '../../src/strings';

function makeState(overrides: Partial<SimState> = {}): SimState {
  return {
    tick: 0,
    lastOffset: 0,
    lastTier: TIER_NONE,
    swayTarget: 0,
    swayAmp: 0,
    lean: 0,
    craneSpeed: 0,
    sensitivity: 0,
    stabilizer: 0,
    comboMult: 0,
    ...overrides,
  } as SimState;
}

describe('fillDebugSnapshot', () => {
  it('fills the provided object in place without allocating a new one', () => {
    const out: DebugSnapshot = createDebugSnapshot();

    fillDebugSnapshot(
      out,
      makeState({
        tick: 42,
        lastOffset: 5,
        lastTier: TIER_PERFECT,
        swayTarget: 1,
        swayAmp: 2,
        lean: 3,
        craneSpeed: 4,
        sensitivity: 6,
        stabilizer: 7,
        comboMult: 1500,
      }),
      59.6,
    );

    expect(out).toEqual({
      tick: 42,
      lastOffset: 5,
      lastTier: TIER_PERFECT,
      swayTarget: 1,
      swayAmp: 2,
      lean: 3,
      craneSpeed: 4,
      sensitivity: 6,
      stabilizer: 7,
      combo: 1500,
      fps: 60,
    });
  });

  it('overwrites every field on a second fill, reusing the same object', () => {
    const out = createDebugSnapshot();
    fillDebugSnapshot(out, makeState({ tick: 1, lastTier: TIER_GOOD }), 30);
    fillDebugSnapshot(out, makeState({ tick: 2, lastTier: TIER_MISS }), 60);

    expect(out.tick).toBe(2);
    expect(out.lastTier).toBe(TIER_MISS);
    expect(out.fps).toBe(60);
  });
});

describe('refreshDebugSnapshot', () => {
  it('leaves the snapshot untouched while the overlay is hidden', () => {
    const out = createDebugSnapshot();
    fillDebugSnapshot(out, makeState({ tick: 1, lastTier: TIER_GOOD }), 30);
    const before = { ...out };

    refreshDebugSnapshot(out, false, makeState({ tick: 99, lastTier: TIER_MISS }), 60);

    expect(out).toEqual(before);
  });

  it('fills the same (pre-allocated) object in place when the overlay is visible', () => {
    const out = createDebugSnapshot();
    const identity = out;

    refreshDebugSnapshot(
      out,
      true,
      makeState({ tick: 7, lastOffset: 2, lastTier: TIER_PERFECT }),
      59.6,
    );

    expect(Object.is(out, identity)).toBe(true);
    expect(out.tick).toBe(7);
    expect(out.lastOffset).toBe(2);
    expect(out.lastTier).toBe(TIER_PERFECT);
    expect(out.fps).toBe(60);
  });
});

describe('tierName', () => {
  it('maps each TIER_* code to its STRINGS name', () => {
    expect(tierName(TIER_NONE)).toBe(STRINGS.debug.tiers.none);
    expect(tierName(TIER_PERFECT)).toBe(STRINGS.debug.tiers.perfect);
    expect(tierName(TIER_GOOD)).toBe(STRINGS.debug.tiers.good);
    expect(tierName(TIER_MISS)).toBe(STRINGS.debug.tiers.miss);
  });

  it('falls back to the "none" name for an unrecognized code', () => {
    expect(tierName(-1)).toBe(STRINGS.debug.tiers.none);
  });
});

describe('formatFieldValue', () => {
  it('routes lastTier through tierName instead of stringifying the raw code', () => {
    expect(formatFieldValue('lastTier', TIER_PERFECT)).toBe(STRINGS.debug.tiers.perfect);
    expect(formatFieldValue('lastTier', TIER_GOOD)).toBe(STRINGS.debug.tiers.good);
    expect(formatFieldValue('lastTier', TIER_GOOD)).not.toBe(String(TIER_GOOD));
  });

  it('stringifies non-tier fields directly', () => {
    expect(formatFieldValue('tick', 42)).toBe('42');
    expect(formatFieldValue('fps', 60)).toBe('60');
  });
});
