import { MAX_TICKS_PER_FRAME, TICK_RATE } from '@skyline/sim';

/** Milliseconds per sim tick at the fixed 60 Hz rate. */
export const TICK_MS = 1000 / TICK_RATE;

/** Absorbs floating-point error in the `1000 / 60` comparison (research R8). */
const EPSILON = 1e-6;

/**
 * Render-only values interpolated between the previous and current tick (data-model §9). Never
 * fed back into the simulation.
 */
export interface RenderSnapshot {
  /** Crane hook X, su. */
  craneX: number;
  /** Top-floor shear displacement S, su. */
  swayS: number;
  /** Ticks elapsed since the current drop's release; 0 while not falling. */
  fallTicks: number;
  /** Vertical camera target, su. */
  cameraTargetY: number;
}

function createSnapshot(): RenderSnapshot {
  return { craneX: 0, swayS: 0, fallTicks: 0, cameraTargetY: 0 };
}

export interface FixedStepLoopCallbacks {
  /** Advances the sim by exactly one tick and returns that tick's events (forwarded, not copied). */
  step: () => readonly unknown[];
  /** Fills `out` with the render-relevant values read from the sim after a step. */
  readSnapshot: (out: RenderSnapshot) => void;
  /** Receives each step's events. Called once per step, in order. */
  onEvents?: (events: readonly unknown[]) => void;
}

/**
 * A fixed-timestep accumulator loop (research R8), free of Phaser so it can be tested headless.
 * `advance(elapsedMs)` runs at most `MAX_TICKS_PER_FRAME` sim ticks and reports how many ran;
 * leftover time beyond the cap is discarded rather than carried over (PRD §5.6). `prev`/`curr`
 * are preallocated and reused, so a frame with no steps costs no allocation.
 */
export class FixedStepLoop {
  /** Values as of the previous sim tick, for interpolation. */
  readonly prev: RenderSnapshot = createSnapshot();
  /** Values as of the current sim tick, for interpolation. */
  readonly curr: RenderSnapshot = createSnapshot();
  /** Fraction of a tick elapsed since `curr`, in [0, 1). */
  alpha = 0;

  private accumulatorMs = 0;
  private paused = false;

  constructor(private readonly callbacks: FixedStepLoopCallbacks) {}

  /** Advances by `elapsedMs` of wall-clock time. Returns the number of sim ticks run. */
  advance(elapsedMs: number): number {
    if (this.paused) {
      return 0;
    }
    this.accumulatorMs += elapsedMs;
    let steps = 0;
    while (steps < MAX_TICKS_PER_FRAME && this.accumulatorMs >= TICK_MS - EPSILON) {
      this.stepOnce();
      this.accumulatorMs -= TICK_MS;
      steps += 1;
    }
    if (steps === MAX_TICKS_PER_FRAME && this.accumulatorMs >= TICK_MS - EPSILON) {
      this.accumulatorMs = 0;
    }
    this.alpha = this.accumulatorMs / TICK_MS;
    return steps;
  }

  /** Stops tick advancement. `advance()` returns 0 while paused (FR-035). */
  pause(): void {
    this.paused = true;
  }

  /** Resumes ticking and resets the accumulator, so paused time is never fast-forwarded (FR-035). */
  resume(): void {
    this.paused = false;
    this.accumulatorMs = 0;
  }

  private stepOnce(): void {
    this.copyCurrToPrev();
    const events = this.callbacks.step();
    this.callbacks.readSnapshot(this.curr);
    this.callbacks.onEvents?.(events);
  }

  private copyCurrToPrev(): void {
    this.prev.craneX = this.curr.craneX;
    this.prev.swayS = this.curr.swayS;
    this.prev.fallTicks = this.curr.fallTicks;
    this.prev.cameraTargetY = this.curr.cameraTargetY;
  }
}
