import { createSim, DEFAULT_TUNING } from '@skyline/sim';
import { describe, expect, it, vi } from 'vitest';
import { InputCore } from '../../src/input/InputController';

function makeRequester() {
  return {
    requestDrop: vi.fn(() => true),
    requestRoof: vi.fn(() => true),
  };
}

describe('InputCore', () => {
  it('gives requestDrop() on a pointer down', () => {
    const requester = makeRequester();
    const core = new InputCore(requester);
    core.pointerDown();
    expect(requester.requestDrop).toHaveBeenCalledTimes(1);
  });

  it('gives requestDrop() on a non-repeat Space keydown, and ignores repeats', () => {
    const requester = makeRequester();
    const core = new InputCore(requester);
    core.keyDown({ repeat: false });
    expect(requester.requestDrop).toHaveBeenCalledTimes(1);
    core.keyDown({ repeat: true });
    expect(requester.requestDrop).toHaveBeenCalledTimes(1);
  });

  it('roofButtonDown() calls requestRoof() only', () => {
    const requester = makeRequester();
    const core = new InputCore(requester);
    core.roofButtonDown();
    expect(requester.requestRoof).toHaveBeenCalledTimes(1);
    expect(requester.requestDrop).not.toHaveBeenCalled();
  });

  it('SC-009: an input applied between steps lands on tick + 1', () => {
    const sim = createSim({
      type: 'residential',
      mode: 'city',
      seed: 1,
      assist: false,
      tuning: DEFAULT_TUNING,
    });
    const core = new InputCore(sim);
    sim.step(); // spawn at tick 1; now swinging
    const tickBefore = sim.getState().tick;
    core.pointerDown();
    sim.step();
    const log = sim.getInputLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toEqual({ tick: tickBefore + 1, type: 'drop' });
  });

  it('a rejected request is not buffered', () => {
    const sim = createSim({
      type: 'residential',
      mode: 'city',
      seed: 1,
      assist: false,
      tuning: DEFAULT_TUNING,
    });
    const core = new InputCore(sim);
    sim.step(); // spawn; swinging
    core.pointerDown();
    sim.step(); // applies the drop; now falling

    // Rejected: already falling, no input pending buffer should carry over.
    core.pointerDown();
    sim.step();
    const log = sim.getInputLog();
    expect(log).toHaveLength(1);
  });
});
