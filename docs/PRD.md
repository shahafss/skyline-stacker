# Product Requirements Document: Skyline Stacker

**Document status:** Final, v2.0
**Scope of this document:** Complete functional and technical specification for MVP (v1.0), with defined follow-up releases (v1.1, v1.2).

---

## 1. Overview

### 1.1 Vision

Skyline Stacker is a 2.5D tower-stacking game for web and mobile, inspired by classic crane-stacking games. A block swings from a crane; the player releases it to stack a tower as high and as accurately as possible. Completed towers populate a grid-based city, where tower placement and adjacency determine the city's total population.

The core loop is a **deterministic, integer-only simulation**. The same inputs always produce the same result on every device and on the server. This enables replays, reliable testing, and server-side score validation.

### 1.2 Audience and business model

- **Audience:** Casual players on mobile and desktop browsers.
- **Monetization:** None. Free portfolio project. No ads, no in-app purchases.

### 1.3 Release scope

| Release | Contents |
| --- | --- |
| **v1.0 (MVP)** | Desktop and mobile web. Core stacking loop, City mode (grid, placement, adjacency, rebuild), Quick Play (endless) mode, local save, settings, accessibility options. |
| **v1.1** | Backend (NestJS + PostgreSQL), accounts, cloud save, server-validated global leaderboards. |
| **v1.2** | Capacitor native builds (iOS, Android), haptics, achievements. |

### 1.4 Non-goals

- Multiplayer or real-time competition.
- Monetization of any kind.
- Localization beyond English in MVP (all UI strings must still be externalized for later translation).
- Analytics or tracking in MVP.
- Real rigid-body physics for the standing tower.

### 1.5 Naming and IP

The product name is "Skyline Stacker". Verify availability (app stores, web, trademark search) before public release. The product must not use the names, art, audio, or visual trade dress of any existing stacking game.

---

## 2. Glossary

| Term | Definition |
| --- | --- |
| **Tick** | One fixed simulation step. 60 ticks per second. |
| **su** | Simulation unit, the integer distance unit. A standard block is 1000 su wide, so 1 su = 0.1% (1‰) of block width. |
| **Foundation** | The fixed base the first floor lands on. Index 0. Never moves. |
| **Floor** | A successfully placed block. Floors are indexed 1..N. |
| **N** | The current number of placed floors. |
| **Rest position (`restX[i]`)** | Horizontal position of floor *i*'s center relative to the foundation center, excluding sway. |
| **Sway (`S`)** | Current horizontal displacement of the top floor caused by tower sway. |
| **Offset (`d`)** | Horizontal distance between a landing block's center and the top floor's current center. |
| **Strike** | A missed drop. Three strikes end the run. |
| **Run** | One play session of the stacking minigame, from first spawn to completion or game over. |
| **‰ (per-mille)** | Fixed-point fraction where 1000 = 1.0. All multipliers in the simulation are stored as ‰ integers. |

---

## 3. Core Gameplay

### 3.1 Run flow

1. The run starts with the foundation on screen and the first block attached to the crane.
2. The crane swings the block horizontally.
3. The player releases the block (tap, click, or Spacebar).
4. The block falls straight down for a fixed number of ticks.
5. At landing, the offset is measured against the top floor's current (swaying) position and classified as **Perfect**, **Good**, or **Miss**.
6. Perfect and Good landings add a floor and population. A Miss adds a strike.
7. After a delay, a new block spawns and the loop repeats.
8. The run ends in one of three ways:
   - **Complete:** The roof lands after the target floor count is reached. Population is banked with a completion bonus.
   - **Early finish:** The player places the roof early (§3.8). Population is banked without the completion bonus.
   - **Game over:** Three strikes. In City mode, the tower is not built and its population is lost.

### 3.2 Input

- Accepted inputs: pointer down on the game canvas (mouse or touch), and the Spacebar key.
- Key auto-repeat is ignored.
- A drop request is accepted **only** while a block is attached to the crane and swinging. Inputs at any other time (falling, spawn delay, paused) are discarded, not buffered.
- An accepted drop is applied on the **next simulation tick** after the input event. That tick number is what gets recorded (§5.4).

### 3.3 Crane

- The crane center (`craneCenterX`) is set to `restX[N]` (the top floor's rest position, **not** including sway) when each block spawns. It stays fixed until the next spawn. The camera follows it horizontally with visual smoothing.
- Block horizontal position while attached:
  `craneX = craneCenterX + trunc(CRANE_AMPLITUDE × SIN_LUT[cranePhase >>> 20] / 32768)`
- `cranePhase` is a uint32 phase accumulator. At each spawn it is set to a value from the seeded PRNG (§5.3), so each block starts at an unpredictable point in the swing.
- Each tick: `cranePhase = (cranePhase + craneIncrement) >>> 0`
- `craneIncrement` is computed at each spawn:
  - `baseIncrement = trunc(2^32 / cranePeriodTicks[type])`
  - `craneSpeed‰ = min(CRANE_SPEED_CAP, 1000 + CRANE_SPEED_PER_FLOOR × N)`
  - `craneIncrement = trunc(baseIncrement × craneSpeed‰ / 1000)`

### 3.4 Drop and landing

- On release, the block's X position is frozen at `releaseX = craneX` at the release tick. The block has **no horizontal momentum** and falls straight down.
- The fall lasts exactly `DROP_FALL_TICKS` ticks. The landing is evaluated at `landingTick = releaseTick + DROP_FALL_TICKS`. Visually, the fall uses a quadratic ease-in between the hook and the top of the tower.
- At the landing tick:
  - `topX = restX[N] + S(landingTick)`
  - `d = releaseX − topX` (signed)
  - `|d|` is directly the offset in ‰ of block width, since W = 1000 su.

### 3.5 Placement tiers

| Tier | Condition | Effect |
| --- | --- | --- |
| **Perfect** | `|d| ≤ 50` (≤ 5% of width) | New floor snaps exactly: `restX[N+1] = restX[N]`. Combo +1. Stabilizer applied. Perfect population × combo multiplier. |
| **Good** | `51 ≤ |d| ≤ 250` (5.1%–25%) | New floor keeps its offset: `restX[N+1] = restX[N] + d`. Combo resets to 0. Stabilizer resets. Good population. Sensitivity counter +1. |
| **Miss** | `|d| > 250` (> 25%) | No floor is added. Strike +1. Combo resets to 0. The block slides off visually (§7.3). |

After a Perfect or Good landing, `N` increases by 1 and the sway target is recomputed (§4.3).

### 3.6 Scoring

- **Combo:**
  - Counter `c` starts at 0.
  - On Perfect, first `c += 1`, then `comboMult‰ = min(COMBO_CAP, 1000 + COMBO_STEP × c)`.
  - On Good or Miss, `c = 0`.
- **Floor population:**
  - Perfect: `trunc(perfectPop[type] × comboMult‰ / 1000)`
  - Good: `goodPop[type]`
- **Tower score:** The sum of all floor population, plus the completion bonus when the tower is completed at target height:
  `completionBonus = trunc(sum × COMPLETION_BONUS‰ / 1000)`
- The roof itself adds no floor population.

### 3.7 Strikes and game over

- The player has 3 lives. Each Miss costs one.
- At 3 strikes the run ends in **game over**:
  - The visible tower collapses (§7.3).
  - **City mode:** No tower is built on the tile, and the run's population is lost. When rebuilding, the existing tower is kept (§6.5).
  - **Quick Play:** The score is final, and the local best is updated if exceeded.

### 3.8 Roof and completion (City mode only)

- **Automatic roof:** When `N` reaches `targetFloors[type]`, the next spawned block is the roof.
- **Early roof:** When `N ≥ minRoofFloors[type]` and a block is swinging, a **Place Roof** button is shown. Pressing it turns the currently swinging block into the roof. This is logged as a `roof` input (§5.4).
- The roof lands under the normal tier rules:
  - Perfect or Good: the tower is finished.
  - Miss: costs a strike, and a new roof spawns.
- A tower finished at `targetFloors` is **Completed** and receives the completion bonus. A tower finished early is **Built** with no bonus.

### 3.9 Quick Play mode

- Endless mode using Residential parameters.
- No target height, no roof, no completion bonus.
- The run ends only at 3 strikes. The score is the sum of floor population.
- The crane speed and sway amplitude caps still apply, so play remains possible indefinitely.
- The local best score is stored.

### 3.10 Camera

- The camera keeps the crane hook `CAMERA_HOOK_CLEARANCE` block heights above the top floor. It pans upward smoothly after each landing.
- Floors below the viewport are not rendered (culled). They remain fully present in the simulation state. Culling is a rendering concern only.

---

## 4. Tower Sway Model (Horizontal Shear)

The tower is not simulated as rigid bodies. Its sway is a deterministic horizontal shear driven by a sine oscillator.

### 4.1 Shear displacement

- Each tick, `swayPhase = (swayPhase + swayIncrement) >>> 0`, where `swayIncrement = trunc(2^32 / swayPeriodTicks[type])`. `swayPhase` starts at 0 when the first floor is placed.
- `S = trunc(currentSwayAmp × SIN_LUT[swayPhase >>> 20] / 32768)`
- The displayed position of floor *i* (1..N) is:
  `displayX[i] = restX[i] + trunc(S × i / N)`
- The foundation (i = 0) never moves. The top floor is displaced by the full `S`.
- **Rotation is visual only.** Each floor may be drawn with a small tilt proportional to the local shear, capped at `VISUAL_TILT_MAX_DEG`. Tilt never affects the simulation or the landing check.

### 4.2 Lean (center of mass)

- `lean = trunc((restX[1] + … + restX[N]) / N)`, a signed value relative to the foundation center.
- Lean is signed, so offsets cancel. A left-offset floor followed by an equal right-offset floor returns the stack toward center. Recovering from a drift is an intended skill.

### 4.3 Sway amplitude

The sway amplitude target is recomputed after every successful landing:

```
sens‰        = min(SENSITIVITY_CAP, 1000 + SENSITIVITY_STEP × goodCount)
rawAmp       = BASE_SWAY_PER_FLOOR × N + trunc(|lean| × LEAN_GAIN‰ × sens‰ / 1_000_000)
targetAmp    = trunc(rawAmp × swayMult‰[type] / 1000)
targetAmp    = trunc(targetAmp × stabilizer‰ / 1000)
targetAmp    = trunc(targetAmp × assist‰ / 1000)      // 1000 normally, 500 with Steady Tower
targetAmp    = min(SWAY_AMP_CAP, targetAmp)
```

- `goodCount` is the number of Good landings in the run. It never decreases.
- **Stabilizer:**
  - Starts at 1000.
  - On Perfect: `stabilizer‰ = max(STABILIZER_FLOOR, trunc(stabilizer‰ × STABILIZER_STEP / 1000))`. Each consecutive Perfect reduces sway by 20%, down to at most 50% reduction.
  - On Good: resets to 1000.
  - On Miss: unchanged.
- **Amplitude smoothing:** The amplitude moves gradually toward the target to avoid visual pops. Each tick:

  ```
  diff = targetAmp − currentSwayAmp
  step = trunc(diff / 16)
  if (step === 0 && diff !== 0) step = sign(diff)
  currentSwayAmp += step
  ```

### 4.4 Collapse

Sway never causes a collapse by itself. The only loss condition is 3 strikes. Sway makes play harder by moving the landing target.

---

## 5. Determinism Requirements

### 5.1 Simulation rules

The simulation lives in a standalone package (`packages/sim`, §8.2) and must obey all of the following:

- **Integers only.** Every state value must satisfy `Number.isSafeInteger`. Every division is followed by `Math.trunc` or `>>> 0`. No floats are stored in the state.
- **No non-deterministic APIs.** Forbidden inside `packages/sim`: `Math.random`, `Math.sin`, `Math.cos`, `Math.tan`, `Math.atan2`, `Math.pow`, `Math.exp`, `Math.log`, `Math.sqrt`, `Date`, `performance`, and any timers. This is enforced by an ESLint `no-restricted-properties` / `no-restricted-globals` rule and a CI grep check.
- **Fixed timestep:** 60 ticks per second (`TICK_MS = 1000 / 60`). The simulation advances only in whole ticks.
- **No framework dependencies.** The package has zero runtime dependencies and is importable in both the browser and Node.

### 5.2 Precomputed sine lookup table

- `SIN_LUT` has **4096 entries** in Q15 format: `SIN_LUT[k] = round(32767 × sin(2π × k / 4096))`, stored as integers in [−32767, 32767].
- The table is generated **once by a build script** (`scripts/gen-sin-lut.ts`) and committed as a static source file (`packages/sim/src/sinLut.ts`). The runtime never computes sine.
- Index lookup uses the top 12 bits of a uint32 phase: `SIN_LUT[phase >>> 20]`.
- A unit test verifies the table against a committed checksum (FNV-1a 32-bit over all entries).

### 5.3 Seeded PRNG

- Algorithm: **mulberry32** (it uses `Math.imul` and uint32 operations, which are deterministic).
- The seed is a uint32.
  - MVP: generated client-side at run start.
  - v1.1: issued by the server for ranked runs (§9.2).
- The PRNG drives **only** the crane start phase at each block spawn. No other randomness exists in the simulation.

### 5.4 Tick-based input log

- Every run records an ordered input log:

  ```ts
  type InputEvent = { tick: number; type: 'drop' | 'roof' };
  ```

- `tick` is the simulation tick on which the input was **applied**, never a wall-clock timestamp.
- Replaying `(config, seed, inputLog)` from tick 0 must reproduce the identical final state on every platform.
- **Pausing:** Pausing stops tick advancement entirely. Paused time does not appear in the tick count.

### 5.5 State hash

- `hashState(state)` computes FNV-1a 32-bit over all state fields in a fixed, documented order.
- It is used in golden tests (§10.1) and in server validation (§9.2).

### 5.6 Rendering and interpolation

- The render loop runs at the display rate (60/90/120/144 Hz) using an accumulator:
  - While `accumulator ≥ TICK_MS`, step the simulation.
  - At most `MAX_TICKS_PER_FRAME` steps per frame. Excess accumulated time is discarded, which slows the game rather than fast-forwarding it.
- The renderer interpolates between the previous and current tick states for the crane position, sway displacement, falling block and camera, using `alpha = accumulator / TICK_MS`. Interpolated values are float-valued and render-only. They never feed back into the simulation.
- The simulation auto-pauses when the tab is hidden (`visibilitychange`) or the app is backgrounded.

---

## 6. City Mode (Meta-Game)

### 6.1 Grid

- The grid starts at 5×5.
- When every tile is built, the grid expands by one ring: 5×5 → 7×7 → 9×9 (maximum).
- Tiles use integer coordinates relative to the center:
  - 5×5: x, y ∈ [−2, 2]
  - 7×7: x, y ∈ [−3, 3]
  - 9×9: x, y ∈ [−4, 4]
  Expansion never re-indexes existing tiles.
- Adjacency is **orthogonal only** (N, S, E, W). There are no diagonals and no wrapping.

### 6.2 Tower types and placement requirements

| Type | Icon / silhouette | Placement requirement |
| --- | --- | --- |
| **Residential** | Pitched roof, balconies | None |
| **Commercial** | Storefront awning | At least 1 adjacent Residential |
| **Office** | Glass curtain-wall grid | At least 1 adjacent Commercial |
| **Luxury** | Spire / crown top | At least 1 adjacent Office **and** at least 1 adjacent Residential |

- Requirements are checked when the player selects a tile and type, **before** the minigame starts. Only valid type choices are enabled for the selected tile.
- Invalid choices are shown disabled, with a tooltip stating the unmet requirement.
- There are no separate unlocks. A type becomes usable as soon as a valid tile exists for it.

### 6.3 Adjacency bonuses

| Source tower | Applies to | Bonus |
| --- | --- | --- |
| Commercial | Each adjacent Residential | +10% |
| Office | Each adjacent Commercial | +10% |
| Luxury | Each adjacent tower of **any** type, including other Luxury | +20% |
| Residential | None | None |

### 6.4 Bonus stacking logic

- Bonuses are **additive** per tile and always computed from the tile's **base score** (its tower score from §3.6). There is no chaining: a bonus never increases another tile's bonus.
- Formulas:
  - `bonus‰ = min(BONUS_CAP, Σ applicable bonuses in ‰)`
  - `effectivePop = trunc(baseScore × (1000 + bonus‰) / 1000)`
- Example: a Residential tower next to two Commercial towers and one Luxury tower gets +10% +10% +20% = +40%.
- `cityPopulation = Σ effectivePop` over all built tiles.
- Every tile's bonus is recomputed whenever any tile changes (build, rebuild, demolish).
- The tile inspector shows the base score, each contributing bonus with its source tile, and the effective population.

### 6.5 Build, rebuild and demolish

- **Build:** Select an empty tile, then a valid type, then play the minigame.
  - Completed or Built: the tower is placed with its score.
  - Game over: the tile stays empty.
- **Rebuild:** Select a built tile and choose Rebuild. This starts a new run of the **same type**.
  - If the new run finishes (Completed or Built) with a higher score than the existing tower, it replaces the tower's score, floors and completion status, and the UI shows "New best".
  - Otherwise the existing tower is kept, and the UI shows the previous score as kept.
  - A game over during a rebuild leaves the existing tower unchanged.
- **Change type:** A tower's type can only be changed by demolishing it and building again.
- **Demolish:**
  - Allowed only if no remaining tower would violate its placement requirement afterwards. If it would, demolish is blocked, and a message lists the dependent tiles that must be demolished first.
  - Demolish requires a confirmation dialog and cannot be undone.

---

## 7. Tuning Parameters

All gameplay values have their **defaults** in a single file, `packages/sim/src/tuning.ts`, exported as `DEFAULT_TUNING` with a `TUNING_VERSION` string. The simulation receives a complete copy of the values in `SimConfig.tuning` (§8.3). Any change to a default value bumps `TUNING_VERSION` and requires regenerating the golden logs (§10.1).

- `tuning.ts` also exports the **fixed engine constants**. These are `TICK_RATE`, `BLOCK_WIDTH`, `MAX_TICKS_PER_FRAME`, `SIN_LUT_SIZE`, `Q15_SCALE` and `SWAY_SMOOTHING_DIVISOR`; see data-model §1.3 in `specs/001-whitebox-core-loop/data-model.md`. They are not tuning values and cannot be overridden.
- Type **colors** (§7.2) are presentation styling. They live in the web app's render configuration, not in `tuning.ts`.
- Block visual height is stored in `tuning.ts` as `blockVisualHeight` in ‰ (1000 = 1.0×).

### 7.1 Global parameters

| Constant | Value | Meaning |
| --- | --- | --- |
| `TICK_RATE` | 60 | Ticks per second |
| `MAX_TICKS_PER_FRAME` | 5 | Catch-up limit per rendered frame |
| `BLOCK_WIDTH` | 1000 su | Standard block width (all types) |
| `CRANE_AMPLITUDE` | 1100 su | Crane swing half-width |
| `DROP_FALL_TICKS` | 24 | Fall duration (0.4 s) |
| `SPAWN_DELAY_TICKS` | 36 | Delay from landing or strike to next spawn (0.6 s) |
| `PERFECT_MAX` | 50 su | ≤ 5% offset |
| `GOOD_MAX` | 250 su | ≤ 25% offset |
| `LIVES` | 3 | Strikes allowed per run |
| `CRANE_SPEED_PER_FLOOR` | 20‰ | +2% crane speed per floor (linear) |
| `CRANE_SPEED_CAP` | 2000‰ | **Hard cap:** 2.0× base crane speed (reached at floor 50) |
| `SENSITIVITY_STEP` | 50‰ | +5% sway sensitivity per Good landing (linear) |
| `SENSITIVITY_CAP` | 2000‰ | **Hard cap:** 2.0× sensitivity (reached at 20 Good landings) |
| `BASE_SWAY_PER_FLOOR` | 3 su | Minimum sway growth with height |
| `LEAN_GAIN` | 600‰ | Lean-to-sway conversion |
| `SWAY_AMP_CAP` | 350 su | **Hard cap:** maximum sway amplitude (35% of width) |
| `STABILIZER_STEP` | 800‰ | Each Perfect multiplies the stabilizer by 0.8 |
| `STABILIZER_FLOOR` | 500‰ | Stabilizer lower bound (at most 50% sway reduction) |
| `COMBO_STEP` | 250‰ | +0.25× multiplier per consecutive Perfect |
| `COMBO_CAP` | 3000‰ | **Hard cap:** 3.0× combo multiplier (reached at 8 Perfects in a row) |
| `COMPLETION_BONUS` | 200‰ | +20% tower score for finishing at target height |
| `BONUS_CAP` | 1000‰ | **Hard cap:** +100% adjacency bonus per tile |
| `ASSIST_SWAY` | 500‰ | Steady Tower assist multiplier on sway |
| `CAMERA_HOOK_CLEARANCE` | 5 | Hook height above the top floor, in block heights |
| `VISUAL_TILT_MAX_DEG` | 6 | Visual-only tilt cap |

### 7.2 Per-type parameters

| Parameter | Residential | Commercial | Office | Luxury |
| --- | --- | --- | --- | --- |
| `targetFloors` | 30 | 40 | 50 | 60 |
| `minRoofFloors` (early roof) | 15 | 20 | 25 | 30 |
| `cranePeriodTicks` (base) | 144 (2.4 s) | 144 (2.4 s) | 120 (2.0 s, 1.2× faster) | 132 (2.2 s) |
| `swayPeriodTicks` | 180 (3.0 s) | 120 (2.0 s, 1.5× faster) | 180 (3.0 s) | 156 (2.6 s) |
| `swayMult‰` | 1000 | 1000 | 1200 | 2000 |
| `perfectPop` (per floor, before combo) | 10 | 15 | 20 | 30 |
| `goodPop` (per floor) | 5 | 7 | 10 | 15 |
| Block visual height (× standard; stored as ‰: 1000 / 1000 / 1400 / 1200) | 1.0 | 1.0 | 1.4 | 1.2 |
| Color (render styling, not in `tuning.ts`) | Blue | Red | Green | Yellow |

Quick Play uses the Residential column with no target floors and no roof.

### 7.3 Visual-only physics ("juice")

Matter.js (bundled with Phaser 4) is used **only** for visual effects. Its results never feed back into the simulation, and it may use non-deterministic APIs.

- **Miss:** A Matter body is created at the block's landing position with a sideways velocity away from the tower, so the block slides and tumbles off. The body is removed once it leaves the viewport.
- **Game over:** Every visible floor is converted to a Matter body, inheriting its displayed position, visual tilt, and a horizontal velocity derived from the sway direction at that tick. The tower then falls. Culled floors are not converted.
- **Particles:** Dust on landing, sparks on Perfect, and debris on collapse use Phaser's particle system, not Matter.

---

## 8. Technical Architecture

### 8.1 Stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Simulation | TypeScript (strict), zero dependencies | Deterministic game rules, sway, scoring, replay, state hash |
| Game rendering | Phaser 4 (WebGL, Canvas fallback) | Rendering, interpolation, camera, particles, visual-only Matter.js |
| UI / app shell | Vue 3 (Composition API) + Vite | Menus, City grid, HUD overlay, settings, dialogs (all DOM) |
| State | Pinia | UI state; primitive game values mirrored from the simulation |
| Messaging | Typed event bus (`mitt`) | Bidirectional Vue ↔ Phaser commands and events |
| Testing | Vitest (unit), Playwright (cross-browser) | See §10 |
| Backend (v1.1) | NestJS + PostgreSQL | Auth, cloud save, run validation, leaderboards |
| Native (v1.2) | Capacitor | iOS/Android wrapper, Haptics API |

### 8.2 Repository layout (pnpm workspaces)

```
/packages/sim        Pure deterministic simulation (shared by client and server)
/apps/web            Vite + Phaser 4 (+ Vue 3 / Pinia from Phase 3)
/packages/golden-harness  Test-only Vite + Playwright page that replays the golden fixtures in
                          Chromium, WebKit and Firefox (no Phaser; never shipped; from Phase 1)
/apps/api            NestJS backend (v1.1)
/scripts             Build scripts (e.g. gen-sin-lut.ts)
```

Capacitor configuration lives in `/apps/web` from v1.2.

### 8.3 Simulation API

```ts
type TowerType = 'residential' | 'commercial' | 'office' | 'luxury';
type Mode = 'city' | 'quick';

interface TuningValues {
  global: GlobalTuning;                     // every §7.1 value except the fixed engine constants
  types: Record<TowerType, TypeTuning>;     // every §7.2 value (colors are render styling)
}

interface SimConfig {
  type: TowerType;          // 'residential' for Quick Play
  mode: Mode;
  seed: number;             // uint32
  assist: boolean;          // Steady Tower; fixed for the run and included in the state hash
  tuning: TuningValues;     // complete values; defaults are DEFAULT_TUNING from tuning.ts
}

type RunResultKind = 'completed' | 'built' | 'gameOver';
interface RunResult { result: RunResultKind; score: number; floors: number }

type SimEvent =
  | { kind: 'spawn'; tick: number; isRoof: boolean }
  | { kind: 'release'; tick: number; x: number }
  | { kind: 'land'; tick: number; tier: 'perfect' | 'good'; offset: number; floor: number; pop: number; roof: boolean }
  | { kind: 'miss'; tick: number; offset: number; strikes: number }
  | { kind: 'comboChanged'; combo: number; multiplier: number }
  | { kind: 'roofAvailable' }
  | { kind: 'roofPlaced'; tick: number }     // early roof applied this tick
  | { kind: 'finished'; result: 'completed' | 'built'; score: number; floors: number }
  | { kind: 'gameOver'; score: number; floors: number };

interface TowerSim {
  step(): readonly SimEvent[];      // advance exactly one tick; the array is reused until the next call
  requestDrop(): boolean;           // false if not accepted
  requestRoof(): boolean;           // false if not eligible
  getState(): Readonly<SimState>;   // integer-only, live read-only state
  getInputLog(): readonly InputEvent[];
  getResult(): RunResult | null;    // null while the run is in progress
  getConfig(): Readonly<SimConfig>;
}

function createSim(config: SimConfig): TowerSim;   // throws SimConfigError on invalid config
function replay(config: SimConfig, log: readonly InputEvent[]):
  { state: SimState; hash: number; events: SimEvent[]; result: RunResult | null };  // throws ReplayError
function hashState(state: SimState): number;

// Presentation helpers (pure; read state, never write it)
function floorDisplayX(state: Readonly<SimState>, i: number): number;
function canPlaceRoof(sim: TowerSim): boolean;

// Tuning and versions
const TUNING_VERSION: string;
const SIM_VERSION: string;
const DEFAULT_TUNING: Readonly<TuningValues>;
const TICK_RATE: 60;                 // fixed engine constant
const BLOCK_WIDTH: 1000;             // fixed engine constant
const MAX_TICKS_PER_FRAME: number;   // fixed engine constant
const Q15_SCALE: 32768;              // fixed engine constant (sine table scale)
const SWAY_SMOOTHING_DIVISOR: 16;    // fixed engine constant (§4.3 smoothing)
function isDefaultTuning(t: TuningValues): boolean;
function cloneTuning(t: TuningValues): TuningValues;

// Errors
class SimConfigError extends Error {}
class ReplayError extends Error { readonly tick: number }
```

- `requestDrop` and `requestRoof` queue the input. It is applied, and logged with the tick number, during the next `step()`.
- **Tuning:** `SimConfig.tuning` always holds the complete tuning values. The fixed engine constants (data-model §1.3 in `specs/001-whitebox-core-loop/data-model.md`: `TICK_RATE`, `BLOCK_WIDTH`, `MAX_TICKS_PER_FRAME`, `SIN_LUT_SIZE`, `Q15_SCALE`, `SWAY_SMOOTHING_DIVISOR`) are not part of `TuningValues` and cannot be overridden.
- **Run result:** Every run ends with exactly one result, which is part of the final state. Replaying a run reproduces it. After a result is set, `step()` returns no events and the state no longer changes.
- **Replay:** `replay` runs until a result is set, or until `DROP_FALL_TICKS + 1` ticks after the last input. It throws `ReplayError` if the log is not strictly increasing, or if an input would be rejected on its tick.
- **Roof landing:** A roof landing reports `roof: true`, `floor = N` and `pop = 0`.
- The full contract is in `specs/001-whitebox-core-loop/contracts/sim-api.md`.

### 8.4 Vue ↔ Phaser bridge

- **Never** place Phaser objects, scenes or simulation instances into reactive Vue or Pinia state. Vue's reactive proxies degrade engine performance.
- Pinia holds only primitive values mirrored from simulation events: `score`, `strikes`, `combo`, `multiplier`, `floors`, `targetFloors`, `roofAvailable`, `runState` (`idle | playing | paused | finished | gameOver`).
- **Phaser → Vue:** Simulation events are forwarded on the event bus. A Pinia action subscribes and updates the store.
- **Vue → Phaser:** Commands on the event bus: `startRun(config)`, `pause`, `resume`, `placeRoof`, `quit`, `settingsChanged(settings)`.
- Phaser is mounted inside a single Vue component (`GameCanvas.vue`), which creates the game on mount and destroys it on unmount.

### 8.5 HUD (DOM overlay)

Score, lives (3 icons), combo multiplier, floors / target, a Place Roof button (when eligible), and a pause button.

### 8.6 Local save (MVP)

Saved to `localStorage` under the key `skylineStacker.save`. Writes happen after every run and every city change. The schema is versioned from day one.

```ts
interface SaveV1 {
  saveVersion: 1;
  tuningVersion: string;
  simVersion: string;
  city: {
    gridSize: 5 | 7 | 9;
    tiles: Array<{
      x: number; y: number;
      type: TowerType;
      score: number;               // base score
      floors: number;
      status: 'completed' | 'built';
      seed: number;
      inputLog: InputEvent[];      // enables replay
      assist: boolean;
    }>;
  };
  bests: { quickPlay: number; byType: Record<TowerType, number> };
  settings: {
    bgmVolume: number;             // 0–100
    sfxVolume: number;             // 0–100
    reducedMotion: boolean;
    steadyTower: boolean;
  };
  stats: { runs: number; perfects: number; goods: number; misses: number; towersCompleted: number };
}
```

- **Tuning:** saved city towers always use the default tuning (`DEFAULT_TUNING`) of the `TUNING_VERSION` recorded in the save. So a tile stores `seed`, `inputLog` and `assist`, but no tuning values. A run played with overridden tuning (development builds only) is never saved as a city tower (constitution Principle V).
- A migration function `migrate(raw): SaveVLatest` must exist, even if it only handles v1 at first.
- A corrupted or unparseable save is backed up to `skylineStacker.save.corrupt` and replaced with a fresh save. The player is notified.

---

## 9. Online Features (v1.1)

### 9.1 Accounts

- Guest-first: a device-bound guest account is created automatically. It can later be upgraded to email (magic link) or Google sign-in.
- **Sign in with Apple** is added in v1.2, together with any social login on iOS (App Store requirement).
- In-app account deletion is required, including deletion of all server data.
- When an account is created, the local city is uploaded as **unranked** data. Local runs were not validated, so they never enter leaderboards.

### 9.2 Run validation

1. `POST /runs/start { type, mode }` → `{ runId, seed }`. The seed is generated server-side. The run expires after 30 minutes.
2. The client plays using the server seed.
3. `POST /runs/:runId/submit { inputLog, claimedScore, claimedHash, simVersion, assist }`.
4. The server runs `replay()` from the same `packages/sim` version:
   - `simVersion` mismatch → rejected with "update required".
   - Score or hash mismatch → rejected.
   - Match → accepted.
5. **Plausibility flags:** A run is flagged (hidden from leaderboards pending review, not rejected) if Perfect rate > 95% over ≥ 40 floors, or if more than 20 consecutive Perfects occur at crane speed ≥ 1800‰. Replay validation proves a run is *possible*, not that a human played it. These flags are a lightweight mitigation.
6. Runs with `assist: true` are stored but excluded from leaderboards.
7. **Tuning:** ranked runs always use the default tuning (`DEFAULT_TUNING`) of the current `TUNING_VERSION`.
   - The server replays with its own copy of that tuning and ignores any tuning values the client sends.
   - A run the client played with different tuning therefore fails the score/hash check and is rejected.

### 9.3 Leaderboards

- **Best tower score** per tower type (validated City runs).
- **Quick Play** best score.
- **City population:** Computed server-side from validated tower runs placed on a layout that satisfies all placement rules. It is recomputed on every accepted city change.

---

## 10. Non-Functional Requirements

### 10.1 Quality and testing

- `packages/sim` unit test coverage ≥ 90% (lines).
- **Golden tests:** At least 3 committed `(config, inputLog) → (score, hash)` fixtures, covering Completed, Early-roof and Game-over runs. They must pass in Node and in Chromium, WebKit and Firefox via Playwright.

### 10.2 Performance

- **Frame rate:** the game should run smoothly at 60 fps on current phones and desktops. Rendering runs at the display rate while the simulation remains at 60 ticks per second. Frame-rate independence is guaranteed by an automated test.
- **No per-phase device measurement:** there is no reference-device pass/fail gate. The dev perf tools (frame-time capture and auto-drop bot) are diagnostics, used when stutter is noticed or reported.
- **Real-device check:** before public release (§12 Phase 5), the game is played through once on a real phone (any current mid-range iOS or Android device) with no noticeable stutter.
- **Initial download:** ≤ 5 MB compressed for MVP.
- **Time to interactive:** < 4 s on a fast 4G connection.
- **Supported browsers:** Last 2 versions of Chrome, Edge, Firefox; Safari / iOS Safari 16+.

### 10.3 Layout

- Portrait orientation. Logical resolution 720×1280, scaled to fit.
- **Mobile:** Full-screen portrait. In landscape, a "rotate device" overlay is shown and the game pauses.
- **Desktop:** The canvas is centered and letterboxed. The side margins show animated background art (skyline, clouds).

### 10.4 Accessibility

- **Colorblind support:** Every tower type is distinguishable by silhouette, icon and text label, never by color alone.
- **Reduced Motion** (setting; defaults to the OS `prefers-reduced-motion` value): disables screen shake, background parallax and camera bob.
  - **Tower sway is always rendered accurately.** It is the gameplay itself, so the visual position must match the simulation position.
- **Steady Tower** (assist setting): halves sway in the simulation (`ASSIST_SWAY`). Runs are marked as assisted and excluded from leaderboards. The HUD shows a small assist badge.
- One-button input with keyboard support. All menus are navigable by keyboard, with visible focus states.
- Text contrast meets WCAG AA.

### 10.5 Audio

- Separate BGM and SFX volume sliders (0–100), plus a mute toggle.
- Audio is unlocked by the first user gesture. The title screen shows "Tap to Start" to satisfy iOS/Safari autoplay rules.
- Required SFX: crane swing loop, release, land (Good), land (Perfect, pitch rises with combo), miss, roof complete, collapse, UI click.

### 10.6 Privacy

- MVP: no analytics, no cookies, no personal data. `localStorage` holds game data only.
- v1.1: a privacy policy covering account data, and data export and deletion on request.

---

## 11. Assets and Visual Style

- **2.5D look:** Pre-rendered or vector art with 3D shading and perspective, on a strictly 2D simulation plane.
- **Programmatic animation (Phaser tweens):** Crane motion (from the simulation), clouds, parallax, screen shake, UI transitions.
- **Texture atlases:** Tower block sprites (per type: floor, roof, foundation), citizen reactions on balconies (cheer on Perfect, gasp on Miss), and particle sprites.
- **Whitebox (Phases 1–2):** Simple generated blocks in the type colors, plus a debug overlay (§12, Phase 1). Even in whitebox, each type has a distinct block pattern, roof shape and icon, shown with its text label, so the types can be told apart in grayscale (§10.4). Examples: Residential has stripes and a pitched roof; Commercial an awning band and a sign; Office a window grid and a stepped roof; Luxury a diamond pattern and a spire. All user-facing text comes from one strings file.

---

## 12. Implementation Phases

Each phase is specified and built separately. A phase is complete only when all of its acceptance criteria pass.

### Phase 1 — Deterministic Whitebox Core Loop

**Scope:**
- Set up the pnpm monorepo.
- Build `packages/sim`: LUT generation script and committed table, PRNG, crane, drop and landing, tiers, scoring, combo, sway shear model, lean, stabilizer, strikes, roof (automatic and early), Quick Play, input log, `replay`, `hashState`, and `tuning.ts`.
- Build `apps/web` with Vite + Phaser 4 only (no Vue): whitebox rendering, render interpolation, camera follow and culling, input handling, and visual-only Matter miss and collapse.
- **Debug overlay** (toggle with the `D` key): current tick, last offset (‰), last tier, sway target and current amplitude, lean, crane speed ‰, sensitivity ‰, stabilizer ‰, combo, fps.
- **Dev tuning panel** (development builds only): live-edit every `tuning.ts` value except the fixed engine constants (data-model §1.3 in `specs/001-whitebox-core-loop/data-model.md`) and restart the run, with export of the current values as JSON. Edits stay in memory and never change `tuning.ts`.
- **Dev type selector:** play any of the 4 tower types, or Quick Play.
- **Run export:** download the last run's `(config, inputLog, score, hash)` as JSON.

**Acceptance criteria:**

1. `packages/sim` has zero runtime dependencies, and a CI check confirms that none of the forbidden APIs (§5.1) appear in it.
2. After any sequence of steps, every value in `SimState` passes `Number.isSafeInteger`. This is verified by a fuzz test of 10,000 random input logs across all 4 types and Quick Play, which also confirms that no exceptions are thrown.
3. The `SIN_LUT` checksum test passes. The table has exactly 4096 entries, all within [−32767, 32767].
4. Tier boundary unit tests pass:
   - `|d|` = 0, 50 → Perfect
   - `|d|` = 51, 250 → Good
   - `|d|` = 251 → Miss
   - Each tested for both positive and negative `d`.
5. Cap unit tests pass:
   - Crane speed equals 2000‰ at floor ≥ 50 and never exceeds it.
   - Sensitivity equals 2000‰ at 20 or more Good landings.
   - Sway amplitude never exceeds 350 su.
   - The combo multiplier equals 3000‰ at 8 or more consecutive Perfects.
   - The stabilizer never goes below 500‰.
6. Rule unit tests pass:
   - A Perfect snaps the floor's rest position.
   - A Good keeps its offset.
   - Opposite Good offsets reduce |lean|.
   - The third strike triggers game over.
   - The early roof is unavailable below `minRoofFloors` and available at it.
   - An early-roof finish gets no completion bonus.
   - A target-height finish gets exactly +20% (truncated).
7. **Determinism:**
   - Replaying each golden fixture yields the committed score and hash in Node, and in Chromium, WebKit and Firefox (Playwright).
   - Replaying the same log 1,000 times in one process yields the same hash every time.
8. **Frame-rate independence:** A headless test drives the render loop at simulated 30, 60, 120 and 144 Hz with the same scripted input ticks. It produces identical input logs and identical final hashes.
9. **Input latency:** An accepted drop is applied on the first simulation tick after the input event, verified by a test with injected events.
10. **Performance diagnostics:** With the perf tools included (development builds, or an optimized build made with `VITE_PERF_TOOLS=1`), `?perf=luxury` plays a Luxury run with the auto-drop bot and shows a 60-second frame-time report (average fps, maximum frame time, frames over 33 ms). No device measurement is required to complete the phase (§10.2).
11. **Playability:** A full Residential run (30 floors plus roof), a game-over run, and a Quick Play run can each be played start to finish with mouse, touch and Spacebar. The miss slide-off and the game-over collapse both play.

### Phase 2 — Playtest and Tuning Gate

**Scope:**
- Add local playtest telemetry (dev builds only). For each run, record: tower type, floors reached, result, tier counts, strikes, duration, and the tuning version. Data can be exported as JSON.
- Add a 3-question post-session survey (1–5 scale): "fun", "felt fair", "right difficulty".
- Run playtests and iterate on `tuning.ts` values.

**Playtest protocol:**
- At least 5 testers, none of whom are the developer, with at least 2 who have never played a crane-stacking game.
- Each tester plays at least 15 minutes, covering Residential, Quick Play, and at least one attempt at each other type.
- Use the same tuning version for every tester within one round.

**Acceptance criteria (all measured on the final tuning version):**

1. ≥ 80% of testers complete a Residential tower at target height within their first 5 Residential attempts.
2. The median Perfect rate on Residential is between 25% and 55%.
3. Luxury: ≤ 30% of testers complete it on their first attempt, and ≥ 50% complete it within 15 attempts.
4. The median duration of a completed Residential run is between 60 and 150 seconds.
5. The median Quick Play score is between 150 and 600 (5–20× Residential perfect population), and the best Quick Play run of each tester lasts at least 2 minutes.
6. Mean survey scores are ≥ 4.0 for "fun" and ≥ 4.0 for "felt fair".
7. No Miss that matches a tester's report of an unfair strike can be reproduced with an offset ≤ 250 su, confirmed by replaying the exported run.
8. The final values are committed to `tuning.ts`, `TUNING_VERSION` is bumped, all golden fixtures are regenerated, and all Phase 1 criteria still pass.
9. **Gate:** If criteria 1–6 are not met after 3 tuning rounds, the sway formula (§4.3) and tier thresholds (§3.5) must be revisited before Phase 3 begins.

### Phase 3 — Vue Shell and State Bridge

**Scope:** Vue 3 + Pinia app shell; `GameCanvas.vue`; the event bus; HUD; title screen ("Tap to Start"); pause menu; settings (audio, Reduced Motion, Steady Tower); Quick Play flow with local best; the local save module with migration and corruption handling.

**Replacements:** the Phase 1 canvas HUD, the type selector and the dev-only plain-DOM tuning panel are replaced with Vue components (constitution Principle III). The tuning panel stays excluded from production builds.

**Acceptance criteria:**
- No Phaser object is reachable from any Pinia store (verified by a unit test that inspects the store state for non-plain values).
- The HUD reflects every simulation event within one rendered frame.
- Quick Play is fully playable from the title screen, and the local best persists across reloads.
- A corrupted save is recovered as specified in §8.6.

### Phase 4 — City Mode (MVP complete)

**Scope:** City grid view; tile inspector; build, rebuild and demolish flows; placement validation; adjacency bonus computation; grid expansion; city population display.

**Acceptance criteria:**
- Unit tests cover every placement rule, bonus rule and stacking example in §6, the bonus cap, the demolish-blocking rules, and the rebuild keep-best behavior (including game over during a rebuild).
- Grid expansion 5→7→9 preserves all tiles and coordinates.
- City state round-trips through save and load with identical `cityPopulation`.

### Phase 5 — Assets and Polish

**Scope:** 2.5D art replacing the whitebox; silhouettes and icons per type; citizen reactions; particles; parallax background; screen shake (disabled by Reduced Motion); full SFX set and BGM; UI transitions.

**Acceptance criteria:**
- The colorblind check passes: all 4 types can be identified in grayscale screenshots.
- Reduced Motion disables every effect listed in §10.4.
- The initial download is ≤ 5 MB compressed.
- The debug overlay (`D`) is disabled or hidden in public production builds before release. Run export may stay available.
- Before public release, the game is played through once on a real phone (any current mid-range iOS or Android device) with no noticeable stutter (§10.2).

### Phase 6 — Backend and Leaderboards (v1.1)

**Scope:** NestJS API; PostgreSQL schema (users, runs, city tiles, leaderboard views); guest and upgraded accounts; cloud save; run start and submit with server-side replay; plausibility flags; leaderboards; account deletion.

**Acceptance criteria:**
- The server replay matches every golden fixture.
- A tampered score, tampered log or wrong seed is rejected.
- Assisted and flagged runs never appear on leaderboards.
- Account deletion removes all user rows.

### Phase 7 — Mobile Native (v1.2)

**Scope:** Capacitor iOS and Android builds; haptics (light impact on Good, medium on Perfect, heavy on Miss and collapse; toggle in settings); Sign in with Apple; achievements (e.g. "8 Perfects in a row", "Complete a Luxury tower", "Fill a 9×9 city"); store listing assets.

**Acceptance criteria:**
- Native builds pass the App Store and Google Play review checklists.
- The native builds meet the §10.2 performance targets.
- Haptics respect the settings toggle.
