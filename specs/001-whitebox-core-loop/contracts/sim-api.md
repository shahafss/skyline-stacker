# Contract: `@skyline/sim` public API

**Package**: `packages/sim` (name `@skyline/sim`), ESM, zero runtime dependencies.
**Base**: PRD §8.3. Additions are marked **[ext]**. They must be reflected back into the PRD
(constitution, Governance rule 2). Field-level details are in [data-model.md](../data-model.md).

Every exported item has TSDoc stating units (su, ticks, ‰), as Principle IX requires.

```ts
// ── Types ─────────────────────────────────────────────────────────────
export type TowerType = 'residential' | 'commercial' | 'office' | 'luxury';
export type Mode = 'city' | 'quick';

export interface GlobalTuning { /* fields of data-model §1.1, all integers */ }
export interface TypeTuning   { /* fields of data-model §1.2, all integers */ }
export interface TuningValues {                                   // [ext]
  global: GlobalTuning;
  types: Record<TowerType, TypeTuning>;
}

export interface SimConfig {
  type: TowerType;          // 'residential' when mode === 'quick'
  mode: Mode;
  seed: number;             // uint32
  assist: boolean;          // Steady Tower; fixed for the run and hashed
  tuning: TuningValues;     // [ext] complete values; defaults = DEFAULT_TUNING
}

export type InputEvent = { tick: number; type: 'drop' | 'roof' };

export type RunResultKind = 'completed' | 'built' | 'gameOver';
export interface RunResult { result: RunResultKind; score: number; floors: number } // [ext]

export type SimEvent =
  | { kind: 'spawn'; tick: number; isRoof: boolean }
  | { kind: 'release'; tick: number; x: number }
  | { kind: 'land'; tick: number; tier: 'perfect' | 'good'; offset: number; floor: number;
      pop: number; roof: boolean }                                          // roof: [ext]
  | { kind: 'miss'; tick: number; offset: number; strikes: number }
  | { kind: 'comboChanged'; combo: number; multiplier: number }
  | { kind: 'roofAvailable' }
  | { kind: 'roofPlaced'; tick: number }                    // [ext] early roof applied this tick
  | { kind: 'finished'; result: 'completed' | 'built'; score: number; floors: number } // floors: [ext]
  | { kind: 'gameOver'; score: number; floors: number };                             // floors: [ext]

export interface SimState { /* data-model §3; integers and one integer array */ }

// ── Simulation ────────────────────────────────────────────────────────
export interface TowerSim {
  /** Advance exactly one tick. The returned array is reused and valid until the next call
   *  [ext: lifetime]. Once a result is set, it returns [] and changes nothing. */
  step(): readonly SimEvent[];
  /** Queue a drop for the next tick. Returns false unless phase = swinging, no input is
   *  pending, and no result is set. */
  requestDrop(): boolean;
  /** Queue an early roof. Returns false unless mode = city, phase = swinging, !isRoof,
   *  floors ≥ minRoofFloors, no input is pending, and no result is set. */
  requestRoof(): boolean;
  /** Live, read-only state; copy anything you need to keep. */
  getState(): Readonly<SimState>;
  getInputLog(): readonly InputEvent[];
  /** Result of the finished run, or null while running. [ext] */
  getResult(): RunResult | null;
  /** The validated config this sim was created with. [ext] */
  getConfig(): Readonly<SimConfig>;
}

/** Throws SimConfigError for an invalid config (research R10). */
export function createSim(config: SimConfig): TowerSim;

/** Replays from tick 0 until a result is set, or until DROP_FALL_TICKS + 1 ticks after the last
 *  input. Throws ReplayError if the log is not strictly increasing or an input would be rejected
 *  on its tick [ext]. */
export function replay(config: SimConfig, log: readonly InputEvent[]):
  { state: SimState; hash: number; events: SimEvent[]; result: RunResult | null }; // result: [ext]

/** FNV-1a 32-bit over the fields in data-model "Hash order". Returns a uint32. */
export function hashState(state: Readonly<SimState>): number;

// ── Presentation helpers (pure; they read state and never write it) [ext] ─
/** Displayed X of floor i (0..N), in su: restX[i] + div(swayS × i, N). */
export function floorDisplayX(state: Readonly<SimState>, i: number): number;
/** True when requestRoof() would currently succeed. */
export function canPlaceRoof(sim: TowerSim): boolean;

// ── Tuning and versions ───────────────────────────────────────────────
export const TUNING_VERSION: string;
export const SIM_VERSION: string;                                   // [ext]
export const DEFAULT_TUNING: Readonly<TuningValues>;                // [ext]
export const TICK_RATE: 60;
export const BLOCK_WIDTH: 1000;
export const MAX_TICKS_PER_FRAME: number;
export const Q15_SCALE: 32768;                                      // [ext] fixed engine constant
export const SWAY_SMOOTHING_DIVISOR: 16;                            // [ext] fixed engine constant
export function isDefaultTuning(t: TuningValues): boolean;          // [ext]
export function cloneTuning(t: TuningValues): TuningValues;         // [ext] for the dev panel

// ── Errors [ext] ──────────────────────────────────────────────────────
export class SimConfigError extends Error {}
export class ReplayError extends Error { readonly tick: number }
```

## Not public

`sim.ts` also exports an internal `restoreSim(config, state, inputLog)`, used only by the
test-only snapshot helper (`packages/sim/tests/helpers/snapshot.ts`). It is **not** re-exported
from `index.ts`, and the package `exports` map exposes only `.`, so consumers cannot import it.

## Behavioral guarantees (tested)

1. **Determinism**: For any config and log, `replay` returns the same `hash`, `result` and events
   in Node, Chromium, WebKit and Firefox (SC-007).
2. **Latency**: If `requestDrop()` returns true, the drop's `InputEvent.tick` equals
   `getState().tick + 1` at the time of the request (SC-009).
3. **Live and replay agree**: For a live run, `replay(getConfig(), getInputLog())` gives the same
   final hash and result.
4. **Finality**: After a result is set, `step()` returns `[]` and the hash stays the same
   (FR-045).
5. **Assist sensitivity**: The same config and log with the opposite `assist` value always gives
   a different hash (FR-048).
6. **Roof placement**: When a `roof` input is applied, `step()` emits `roofPlaced` for that tick,
   and `canPlaceRoof` is false from then on for the run.
7. **Purity**: No function reads the clock, randomness outside mulberry32, or global state.
