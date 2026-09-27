import type Phaser from 'phaser';

/** The subset of `TowerSim` the input layer needs (research R9). */
export interface DropRoofRequester {
  requestDrop(): boolean;
  requestRoof(): boolean;
}

/** A raw keyboard event's shape, decoupled from the DOM `KeyboardEvent` type for testing. */
export interface KeyDownLike {
  repeat: boolean;
}

/**
 * Phaser-free input core (research R9): translates a pointer press or a non-repeat Space press
 * into a drop request, and a Place Roof press into a roof request. A request the sim rejects is
 * dropped silently, never buffered — the caller always calls `requestDrop`/`requestRoof` again on
 * the next real input.
 */
export class InputCore {
  constructor(private readonly sim: DropRoofRequester) {}

  /** A pointer down on the game canvas (not on the Place Roof button). */
  pointerDown(): void {
    this.sim.requestDrop();
  }

  /** A `keydown` event. Only a non-repeat Space requests a drop. */
  keyDown(event: KeyDownLike): void {
    if (!event.repeat) {
      this.sim.requestDrop();
    }
  }

  /** A pointer down on the Place Roof button. */
  roofButtonDown(): void {
    this.sim.requestRoof();
  }
}

/** Returns false; overridden in US3 once the Place Roof button exists (T079). */
export type RoofButtonHitTest = (pointer: Phaser.Input.Pointer) => boolean;

/**
 * Binds `InputCore` to a Phaser scene's `pointerdown` and Space `keydown`. The scene-level pointer
 * handler skips any pointer whose hit list contains the Place Roof button (the second of the two
 * independent guards from research R9; the button's own handler is the first).
 */
export class InputController {
  readonly core: InputCore;
  private isOverRoofButton: RoofButtonHitTest = () => false;

  constructor(
    private readonly scene: Phaser.Scene,
    sim: DropRoofRequester,
  ) {
    this.core = new InputCore(sim);
    this.scene.input.on('pointerdown', this.handlePointerDown);
    this.scene.input.keyboard?.on('keydown-SPACE', this.handleSpaceDown);
  }

  /** Registers the hit test used to skip pointer presses that land on the Place Roof button. */
  setRoofButtonHitTest(test: RoofButtonHitTest): void {
    this.isOverRoofButton = test;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown);
    this.scene.input.keyboard?.off('keydown-SPACE', this.handleSpaceDown);
  }

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.isOverRoofButton(pointer)) {
      return;
    }
    this.core.pointerDown();
  };

  private readonly handleSpaceDown = (event: KeyboardEvent): void => {
    this.core.keyDown({ repeat: event.repeat });
  };
}
