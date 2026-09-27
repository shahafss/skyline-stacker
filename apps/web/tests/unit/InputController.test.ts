import type Phaser from 'phaser';
import { createSim, DEFAULT_TUNING } from '@skyline/sim';
import { describe, expect, it, vi } from 'vitest';
import { InputController, InputCore } from '../../src/input/InputController';

function makeRequester() {
  return {
    requestDrop: vi.fn(() => true),
    requestRoof: vi.fn(() => true),
  };
}

/** A minimal fake `Phaser.Scene.input` that records the handlers `InputController` registers. */
function makeScene() {
  const pointerHandlers: Array<(pointer: Phaser.Input.Pointer) => void> = [];
  const keyHandlers: Array<(event: KeyboardEvent) => void> = [];
  const scene = {
    input: {
      on: vi.fn((event: string, handler: (pointer: Phaser.Input.Pointer) => void) => {
        if (event === 'pointerdown') {
          pointerHandlers.push(handler);
        }
      }),
      off: vi.fn(),
      keyboard: {
        on: vi.fn((event: string, handler: (keyEvent: KeyboardEvent) => void) => {
          if (event === 'keydown-SPACE') {
            keyHandlers.push(handler);
          }
        }),
        off: vi.fn(),
      },
    },
  } as unknown as Phaser.Scene;
  return {
    scene,
    firePointerDown: (pointer: Phaser.Input.Pointer) => {
      for (const handler of pointerHandlers) handler(pointer);
    },
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

describe('InputController: Place Roof guards (FR-051, research R9)', () => {
  const pointer = {} as Phaser.Input.Pointer;

  it('a pointer down whose hit list contains the button calls requestRoof() only, button guard first', () => {
    const requester = makeRequester();
    const { scene, firePointerDown } = makeScene();
    const controller = new InputController(scene, requester);
    controller.setRoofButtonHitTest(() => true);

    // Guard 1: the button's own handler fires first.
    controller.core.roofButtonDown();
    // Guard 2: the scene-level handler, independently, skips the drop.
    firePointerDown(pointer);

    expect(requester.requestRoof).toHaveBeenCalledTimes(1);
    expect(requester.requestDrop).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('a pointer down whose hit list contains the button calls requestRoof() only, scene guard first', () => {
    const requester = makeRequester();
    const { scene, firePointerDown } = makeScene();
    const controller = new InputController(scene, requester);
    controller.setRoofButtonHitTest(() => true);

    // Guard 2 fires first this time; the outcome must not depend on order.
    firePointerDown(pointer);
    controller.core.roofButtonDown();

    expect(requester.requestRoof).toHaveBeenCalledTimes(1);
    expect(requester.requestDrop).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('a pointer down not over the button still requests a drop', () => {
    const requester = makeRequester();
    const { scene, firePointerDown } = makeScene();
    const controller = new InputController(scene, requester);
    controller.setRoofButtonHitTest(() => false);

    firePointerDown(pointer);

    expect(requester.requestDrop).toHaveBeenCalledTimes(1);
    expect(requester.requestRoof).not.toHaveBeenCalled();

    controller.destroy();
  });
});
