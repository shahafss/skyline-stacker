# Research: Phase 1 — Deterministic Whitebox Core Loop

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-26

Each entry records a decision, why it was chosen, and what else was considered. Versions were
checked against the npm registry on 2026-09-26.

---

## R1. Toolchain versions

**Decision**:

| Tool | Version | Where |
| --- | --- | --- |
| Node.js | 22 LTS | CI and local |
| pnpm | 12.x, pinned via `packageManager` in the root `package.json` | workspace |
| TypeScript | **6.0.x** (not 7.x) | all packages |
| Phaser | 4.2.x | `apps/web` (only runtime dependency in the repo) |
| Vite | 8.x | `apps/web` |
| Vitest + `@vitest/coverage-v8` | 5.x | all packages |
| `@playwright/test` | 1.63.x | `apps/web` e2e |
| ESLint + `typescript-eslint` | 10.x + 8.70.x | root flat config |
| Prettier (+ `eslint-config-prettier`) | 3.9.x | root |
| tsx | 4.x | `scripts/` |

**Rationale**: TypeScript 7 is the latest, but `typescript-eslint` 8.70 declares support for
TypeScript `>=4.8.4 <6.1.0`. Principle IX requires ESLint in CI, and the forbidden-API rule
(Principle I) depends on it, so TypeScript is pinned to 6.0.x until typescript-eslint supports 7.
Vitest 5 supports Vite 8.

**Alternatives considered**: TypeScript 7 with ESLint running on a separate TS 6 install (two
compilers, confusing); Biome instead of ESLint + Prettier (the constitution names ESLint and
Prettier).

---

## R2. Phaser 4 and Matter.js

**Decision**: Use Phaser 4.2.x. Enable its bundled Matter.js physics in the game scene only for
the miss slide-off and the game-over collapse. Particles use Phaser's particle emitters, not
Matter. Whitebox blocks are pooled `Image` objects that use a generated 1×1 white texture, tinted
and scaled per type.

**Rationale**: The published `phaser@4.2.1` package contains `src/physics/matter-js/` (92 files)
and `types/matter.d.ts`, so Matter.js comes with Phaser and adds no separate dependency. Tinted
images of one texture batch into very few WebGL draw calls, which helps the 60 fps budget
(Principle VI). A pool avoids creating objects every frame.

**Alternatives considered**: Standalone `matter-js` (an extra dependency for no benefit); Phaser
`Graphics` redrawn each frame (allocates and re-tessellates every frame); Arcade physics for
effects (cannot tumble or rotate blocks convincingly).

---

## R3. Fixed-point arithmetic and division in `packages/sim`

**Decision**: All sim arithmetic uses integers. Division is only allowed through one helper,
`div(a, b)` = `Math.trunc(a / b)`, in `packages/sim/src/fixed.ts`. ESLint forbids the `/` and `/=`
operators everywhere else in `packages/sim/src`. uint32 wrapping uses `>>> 0`. Multiplication of
two uint32 values in the PRNG uses `Math.imul`. The constant 2^32 is written as the literal
`4294967296` (the `**` operator is forbidden).

**Rationale**: "Every division is truncated" is hard to check by reading code but easy to check
with a lint rule if division is centralised. Checked worst cases stay well below 2^53:
- Crane: `CRANE_AMPLITUDE × 32767` ≈ 3.6 × 10^7.
- Increment: `trunc(2^32 / period) × CRANE_SPEED_CAP` ≈ 8.6 × 10^12 in the worst case (period 1).
- Lean term: `|lean| × LEAN_GAIN × sens` stays below 10^12 for 10^5 floors of maximum drift.
- Tuning validation (R10) bounds every input so these limits hold even for panel overrides.

**Alternatives considered**: A custom ESLint rule that checks every `/` is wrapped in
`Math.trunc` (more code to maintain); BigInt (slow, and not needed within these ranges).

---

## R4. Enforcing the forbidden APIs

**Decision**: Two independent guards, as Principle I requires.

1. **ESLint**, scoped to `packages/sim/src/**`:
   - `no-restricted-properties`: `Math.random`, `sin`, `cos`, `tan`, `atan2`, `pow`, `exp`, `log`,
     `sqrt`, plus `asin`, `acos`, `atan`, `cbrt`, `hypot`, `fround`, `log2`, `log10`, `log1p`,
     `expm1`, `sinh`, `cosh`, `tanh`.
   - `no-restricted-globals`: `Date`, `performance`, `setTimeout`, `setInterval`,
     `setImmediate`, `queueMicrotask`, `requestAnimationFrame`, `crypto`, `window`, `document`,
     `globalThis`, `process`.
   - `no-restricted-syntax`: the `**` and `**=` operators; the `/` and `/=` operators (except in
     `fixed.ts`, R3); non-integer numeric literals (for example `0.5`).
   - `no-restricted-imports`: any import that is not relative, to keep zero runtime dependencies.
2. **CI check** `scripts/check-sim-purity.ts` (run with tsx). It scans `packages/sim/src` with
   plain regular expressions (not ESLint), so disabling a lint rule inline cannot bypass it. It
   also fails if `packages/sim/package.json` has any `dependencies` or `peerDependencies`.

**Rationale**: SC-001 needs a build failure when a forbidden API appears. The grep check catches
`eslint-disable` comments.

**Alternatives considered**: A custom ESLint plugin (more code than config); TypeScript `lib`
tricks to remove `Math.sin` from types (`Math` is a single lib declaration and cannot be partly
removed).

---

## R5. Sine table generation

**Decision**: `scripts/gen-sin-lut.ts` (tsx) computes `round(32767 × sin(2πk/4096))` for
k = 0..4095 using `Math.sin`. This is allowed because it runs at build time, outside
`packages/sim`. It writes `packages/sim/src/sinLut.ts` as a frozen `Int16Array`-compatible number
array with a header comment, plus the FNV-1a 32-bit checksum as an exported constant. A unit test
recomputes FNV-1a over the committed table and compares it with a checksum hard-coded in the test.
A CI step reruns the generator and fails if `git diff` shows a change.

**Rationale**: The runtime never computes sine (PRD §5.2). The CI regeneration check proves the
committed file matches the script.

**Alternatives considered**: Generating the table at startup (breaks the rule); a quarter-wave
table with symmetry (smaller but adds branching logic, and a 4096-entry table is only about 20 KB
of source).

---

## R6. Tick pipeline and step semantics

**Decision**: A single `step()` performs one tick in this fixed order (full detail in
[data-model.md](./data-model.md#tick-pipeline)):

1. If a result is already set, return an empty event list and change nothing (FR-045).
2. `tick += 1`.
3. Apply the pending input (`drop` or `roof`) and append `{ tick, type }` to the input log.
4. Advance tower sway (phase, amplitude smoothing, displacement S) when N ≥ 1.
5. Run the phase machine: spawn when the spawn delay ends, advance the crane while swinging,
   evaluate the landing when `tick === landingTick`.

`createSim` starts in the spawn-delay phase with 0 ticks remaining, so the first block spawns on
tick 1 and emits `spawn`. A drop requested before then is rejected. A drop applied on tick t
freezes `releaseX` at the crane position of tick t−1 (the last position shown to the player) and
sets `landingTick = t + DROP_FALL_TICKS`.

**Rationale**: A fixed, documented order is what makes the sim deterministic and the hash
meaningful. Applying input first means an input made between frames takes effect on the very next
tick (SC-009).

**Alternatives considered**: Spawning the first block in `createSim` (the spawn event would have
no `step()` to return it); applying input after moving the crane (the block would release one tick
later than shown on screen).

---

## R7. Roof state machine and run result

**Decision**:
- A spawned block is the roof when `mode = city` and (`N ≥ targetFloors` or `roofCommitted = 1`).
- `requestRoof()` succeeds only when `mode = city`, the phase is swinging, the block is not already
  the roof, `N ≥ minRoofFloors`, and no input is pending. Applying it sets `isRoof = 1` and
  `roofCommitted = 1`, so a roof that misses respawns as a roof.
- A roof that lands Perfect or Good sets the result: **Completed** if `N ≥ targetFloors` (with
  bonus), otherwise **Built** (no bonus). It adds no floor and no population, and does not change
  sway.
- The third strike sets **Game Over**. Quick Play can only end this way.
- The result (`result`, `finalScore`, `floors`) is part of the hashed state (FR-044–FR-046).

**Rationale**: This follows PRD §3.8 and the spec's assumptions. Keeping the result in state means
a replay alone is enough for later City mode integration and server validation.

---

## R8. Render loop, interpolation, and frame-rate independence

**Decision**: `apps/web/src/loop/FixedStepLoop.ts` is a plain TypeScript class with no Phaser
imports. It takes elapsed milliseconds from the caller. It adds them to an accumulator, runs at
most `MAX_TICKS_PER_FRAME` sim steps while `accumulator ≥ TICK_MS − 1e-6`, discards leftover
time beyond the cap, and returns `alpha = accumulator / TICK_MS`. Before each step it copies the
values that need interpolation (crane X, sway S, fall progress, camera target) from current to
previous in a preallocated snapshot. The Phaser scene calls it from `update(time, delta)`.

The SC-008 test drives the same class in Node with synthetic frame deltas of 1000/30, 1000/60,
1000/120 and 1000/144 ms. It injects scripted inputs "between frames when `sim.tick === T − 1`",
and asserts identical input logs and hashes.

**Rationale**: Keeping the loop free of Phaser makes it testable headless. The epsilon absorbs
floating-point error from `1000/60` (render-side floats are allowed). Inputs are recorded by tick,
so frame timing cannot change the outcome.

**Alternatives considered**: Integer microsecond accumulators (not needed, because the recorded
log is tick-based); Phaser's built-in fixed step (it is tied to the physics plugin and harder to
test on its own).

---

## R9. Input handling and the Place Roof press (FR-051)

**Decision**: `InputController` listens to Phaser's scene-level `pointerdown` and to the Space
key. Space is read from the raw `keydown` event, and events with `event.repeat === true` are
ignored. The Place Roof button is an interactive game object. Its own `pointerdown` handler calls
`sim.requestRoof()` and then `event.stopPropagation()`, and the scene-level handler also skips any
pointer whose hit list (`currentlyOver`) contains the button. The two guards are independent, so
the press can never also become a drop. Inputs call `requestDrop()` / `requestRoof()` as soon as
the event arrives, and the sim applies them on the next step.

**Rationale**: The PRD HUD places the button over the game area. Two guards cost almost nothing
and are covered by an e2e test.

---

## R10. Tuning through config (Principle V, v1.1.0)

**Decision**:
- `tuning.ts` exports `TUNING_VERSION`, `DEFAULT_TUNING: Readonly<TuningValues>`, and the
  fixed engine constants (data-model §1.3).
- `SimConfig.tuning: TuningValues` is required. `createSim` validates it: every value must be a
  safe integer within documented bounds, periods ≥ 1, `PERFECT_MAX ≤ GOOD_MAX`,
  `minRoofFloors ≤ targetFloors`. Invalid config throws `SimConfigError`.
- `isDefaultTuning(t)` deep-compares a tuning object with `DEFAULT_TUNING`. The web layer uses it
  to set `tuningOverridden` on exports.
- The dev tuning panel edits a copy in memory and restarts the run with it. It never writes files.
  It is loaded with a dynamic `import()` behind `import.meta.env.DEV`, so production builds do not
  include it.
- **The fixed engine constants (data-model §1.3) are not editable in the panel.** The 60 Hz tick
  is required by Principle I. `BLOCK_WIDTH = 1000` is what makes |d| equal to ‰ (PRD §3.4).
  `MAX_TICKS_PER_FRAME` is a render-loop limit that cannot change results. `SIN_LUT_SIZE`,
  `Q15_SCALE` and `SWAY_SMOOTHING_DIVISOR` are part of the PRD formulas themselves.

**Rationale**: This implements Principle V exactly. Validation keeps panel experiments within
integer-safe ranges (R3).

**Resolved (2026-09-27)**: FR-038 now says the panel edits every tuning value except the fixed
engine constants (data-model §1.3).

**Alternatives considered**: Passing only overrides as a diff (Principle V requires the complete
values in exports; a complete object in config is simpler).

---

## R11. State hash encoding

**Decision**: FNV-1a 32-bit (offset basis `0x811c9dc5`, prime `0x01000193`, multiplication via
`Math.imul`) over a byte stream. Each state number is written as 8 bytes little-endian: low
32 bits `v >>> 0`, then high 32 bits `div(v − lo, 4294967296) >>> 0`. This is exact for all safe
integers, including negative ones. Arrays are written as their length and then their elements.
Field order is fixed in [data-model.md](./data-model.md#hash-order). Tuning values are not
hashed; they are part of the config, which the export records in full.

**Rationale**: This is the PRD §5.5 algorithm, with an unambiguous encoding for negative and
large values.

---

## R12. Events without per-tick allocation

**Decision**: `step()` returns a `readonly SimEvent[]` that is **reused**: it is cleared at the
start of every step and valid only until the next call. Event objects are allocated only when an
event happens, which is rare. `replay()` copies events into its own array. `getState()` returns the
live read-only state object, not a copy; callers must copy what they need.

**Rationale**: Principle VI forbids allocation in the render loop, and `step()` runs up to 5 times
per frame. The PRD signature (`step(): SimEvent[]`) is kept; only the lifetime is documented.

---

## R13. Golden fixtures and how they are made

**Decision**:
- A fixture is a run export file (same schema, [contracts/run-export.schema.json](./contracts/run-export.schema.json))
  with `tuningOverridden: false` and `tuningVersion === TUNING_VERSION`.
- There are 4 fixtures in `packages/sim/tests/golden/fixtures/`: `completed-residential`,
  `early-roof-commercial`, `game-over-luxury` (the 3 required) and `quick-play` (extra coverage).
- `scripts/gen-golden.ts` creates them with a deterministic bot. For each block, the bot tries
  candidate drop ticks by replaying the log prefix plus the candidate, and picks the first
  candidate that gives the tier its script asks for (for example "Perfect ×8, Good, Miss…").
- `pnpm golden:regen` must be run in the same change as any `TUNING_VERSION` bump. The golden
  test also asserts that each fixture's tuning deep-equals `DEFAULT_TUNING`.

- The bot searches candidate drop ticks from a **test-only snapshot** of the sim
  (`packages/sim/tests/helpers/snapshot.ts`), restoring it for each candidate. The snapshot uses
  an internal `restoreSim(config, state, inputLog)` exported from `sim.ts` but **not** from
  `index.ts`, so it is not part of the public API.

**Rationale**: Scripted tiers make the fixtures cover combos, Goods, Misses and both roof kinds
on purpose. Replaying the whole log for every candidate would cost about 10⁹ steps for a
300-floor run; restoring a snapshot makes each candidate cost only the ticks up to its landing.

---

## R14. Cross-browser replay (Playwright)

**Decision**: A separate, private, test-only workspace package `packages/golden-harness`
(Vite + Playwright, **no Phaser**). Its page imports `@skyline/sim` and the fixtures
(`import.meta.glob`), replays each fixture, and exposes the results on `window.__goldenResults`.
Playwright's `webServer` starts its Vite dev server, and three projects (chromium, webkit,
firefox) compare the results with the committed score and hash. It is built in Phase 5, right
after the Node golden test, and runs in CI from then on. `apps/web` has its own Playwright config
for the playability smoke tests. The harness is never deployed.

**Rationale**: This tests the real ESM sim module in each engine. Keeping it out of `apps/web`
lets the constitution's cross-browser gate apply to every `packages/sim` change during the sim
phases, before any Phaser work begins.

**Alternatives considered**: Vitest browser mode with the Playwright provider (the user chose
Playwright tests; one e2e runner is simpler).

---

## R15. Fuzz test budget (SC-002)

**Decision**: 10,000 runs split over 5 test files (2,000 each, run in parallel by Vitest). Each
run uses:
- a type/mode chosen round-robin over the 4 types and Quick Play;
- a seed and input gaps from a test-side mulberry32 generator (reproducible, with the failing seed
  printed on failure);
- a cap of 6,000 ticks.

After every step, all scalar fields and every `restX` entry are checked with
`Number.isSafeInteger`.

**Rationale**: The cap bounds total work to 60 million steps or less, which runs in tens of
seconds. Random gaps cover drops, roof requests during every phase, and runs that finish.

---

## R16. Performance measurement (SC-010)

**Decision**: The debug overlay shows fps. A **perf capture** (key `P`), included in dev builds and in
production builds made with `VITE_PERF_TOOLS=1` so measurements use the optimized bundle, records frame
times for 60 seconds into a preallocated `Float64Array` and reports the average fps, the maximum
frame time, and the number of frames over 33 ms. The manual protocol in
[quickstart.md](./quickstart.md#performance-check-sc-010) runs a scripted 60-floor Luxury run
(auto-drop bot, same build flag), started with the URL parameter `?perf=luxury` so it works on a
touch-only phone. The measurement targets are an iPhone 11 in Safari and desktop Chrome with 4×
CPU throttling as a stand-in for a mid-range Android phone. A 120 Hz check is optional.

**Rationale**: SC-010 needs repeatable measurements on the available devices; the scripted bot
and URL start make runs identical on each. CPU throttling approximates a slower CPU but not a
mobile GPU, so a real Android check is still required before public release (PRD §12 Phase 5).

**Size budget**: Phaser 4 minified and gzipped is expected to be well under 1 MB, far inside the
5 MB MVP budget. The build reports compressed size.
