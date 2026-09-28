---

description: "Task list for Phase 1 — Deterministic Whitebox Core Loop"
---

# Tasks: Phase 1 — Deterministic Whitebox Core Loop

**Input**: Design documents from `/specs/001-whitebox-core-loop/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Required. Constitution Principle IV requires tests written before or together with
every rule, and the spec's success criteria are tests. Within each phase, test tasks come first
and must fail before the implementation task is done.

**Ordering rule (user request)**:
1. The forbidden-API guards and CI are set up in the first tasks (Phase 1).
2. `packages/sim` is then built and **fully tested** (unit, fuzz, golden replay in Node, plus the
   cross-browser golden replay through the Phaser-free `packages/golden-harness`) in Phases 2–5.
3. **No `apps/web` / Phaser task may start before the Checkpoint "SIM COMPLETE" at the end of
   Phase 5.**

Because of this, the simulation and presentation work of User Stories 1–3 each have their own
phase.

**Revision 2026-09-27**: renumbered after the `/speckit-analyze` fixes (C2, C3, C4, U1, I1, A1,
I2, D1, P1). The old → new ID mapping is at the end of this file.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5 from [spec.md](./spec.md)
- Paths are relative to the repository root.

## Path Conventions

- Simulation: `packages/sim/src/`, tests in `packages/sim/tests/`
- Cross-browser golden harness (test-only): `packages/golden-harness/`
- Web: `apps/web/src/`, tests in `apps/web/tests/`
- Build/CI scripts: `scripts/`, with tests in `scripts/tests/`

---

## Phase 1: Setup — monorepo, forbidden-API guards, CI

**Purpose**: Workspace, strict tooling, and the determinism guards (Principle I) that must exist
before any sim code is written.

- [X] T001 Create the pnpm workspace root.
  - `package.json`: `"private": true`, `"type": "module"`, `"packageManager": "pnpm@12.6.0"`,
    `"engines": { "node": ">=22" }`.
  - Scripts: `typecheck`, `lint`, `format`, `format:check`, `test`, `check:sim-purity`,
    `gen:sin-lut`, `golden:regen`, `ci` (runs typecheck, lint, format:check, check:sim-purity and
    test in sequence).
  - `pnpm-workspace.yaml` with `packages/*` and `apps/*`.
  - `.gitignore` with node_modules, dist, coverage, playwright-report, test-results.
  - `.nvmrc` containing `22`.
- [X] T002 [P] Create `tsconfig.base.json`: `strict: true`, `noUncheckedIndexedAccess: true`,
  `noImplicitOverride: true`, `target: "ES2022"`, `module: "ESNext"`,
  `moduleResolution: "bundler"`, `verbatimModuleSyntax: true`, `isolatedModules: true`.
  Add root devDependency `typescript@~6.0.0`. Do not use TS 7 (research R1).
- [X] T003 [P] Add Prettier.
  - `.prettierrc`: `printWidth: 100`, `singleQuote: true`, `trailingComma: "all"`.
  - `.prettierignore` listing `packages/sim/src/sinLut.ts`, `pnpm-lock.yaml`, `coverage`, `dist`.
  - Root devDependency `prettier@^3.9`.
- [X] T004 Scaffold `packages/sim`.
  - `packages/sim/package.json`: name `@skyline/sim`, `"type": "module"`,
    `"exports": { ".": "./src/index.ts" }` (only `.`; internal modules are not importable),
    **no `dependencies` or `peerDependencies` field**.
  - Scripts: `test`, `test:fuzz` (`vitest run tests/fuzz`), `test:coverage`.
  - `packages/sim/tsconfig.json` extends `../../tsconfig.base.json`.
  - Placeholder `packages/sim/src/index.ts` (`export {};`).
- [X] T005 Add Vitest.
  - Root devDependencies `vitest@^5` and `@vitest/coverage-v8@^5`.
  - Root `vitest.config.ts` with `test.projects: ['packages/sim', 'scripts']`.
  - `packages/sim/vitest.config.ts` with the Node environment and coverage provider `v8`,
    `include: ['src/**']`, `exclude: ['src/sinLut.ts']`, `thresholds: { lines: 90 }`
    (Principle IV).
- [X] T006 Create `eslint.config.js` (flat config).
  - Root devDependencies `eslint@^10`, `typescript-eslint@^8.70`, `eslint-config-prettier`.
  - Apply `typescript-eslint` `strictTypeChecked` with `projectService: true`,
    `@typescript-eslint/no-explicit-any: "error"`, and `eslint-config-prettier` last.
  - Add a block scoped to `files: ['packages/sim/src/**/*.ts']` with exactly the research R4
    restrictions:
    - `no-restricted-properties` for `Math.` + `random`, `sin`, `cos`, `tan`, `atan2`, `pow`,
      `exp`, `log`, `sqrt`, `asin`, `acos`, `atan`, `cbrt`, `hypot`, `fround`, `log2`, `log10`,
      `log1p`, `expm1`, `sinh`, `cosh`, `tanh`.
    - `no-restricted-globals` for `Date`, `performance`, `setTimeout`, `setInterval`,
      `setImmediate`, `queueMicrotask`, `requestAnimationFrame`, `crypto`, `window`, `document`,
      `globalThis`, `process`.
    - `no-restricted-syntax` for `BinaryExpression[operator='**']`,
      `AssignmentExpression[operator='**=']`, `BinaryExpression[operator='/']`,
      `AssignmentExpression[operator='/=']`, and non-integer numeric literals
      (`Literal[raw=/[.eE]/]`).
    - `no-restricted-imports` with the pattern `['*', '!./*', '!../*']`, so only relative imports
      are allowed.
  - Add an override for `packages/sim/src/fixed.ts` that turns off only the `/` and `/=`
    selectors.
- [X] T007 Write `scripts/check-sim-purity.ts` (run with tsx; root devDependency `tsx@^4`).
  - Export `scanSource(text: string, fileName: string): Violation[]`, using plain regular
    expressions for every identifier and operator in T006. Strip comments first.
  - Export `checkSimPackageJson(json): Violation[]`. It fails on any `dependencies` or
    `peerDependencies`.
  - `main()` walks `packages/sim/src/**/*.ts`, prints `file:line: rule`, and exits with code 1 on
    any violation. `fixed.ts` may use `/` but nothing else.
- [X] T008 [P] Write `scripts/tests/check-sim-purity.test.ts` and `scripts/vitest.config.ts`.
  Assert `scanSource` flags each forbidden item, including one hidden behind an
  `// eslint-disable-next-line` comment. Assert it accepts `Math.imul`, `Math.trunc`, `Math.abs`,
  `Math.min`, `Math.max` and `Math.sign`. Assert `checkSimPackageJson` rejects
  `{ "dependencies": { "x": "1" } }`.
- [X] T009 [P] Write `scripts/tests/eslint-sim-rules.test.ts`. Use the ESLint Node API
  (`new ESLint()` + `lintText(code, { filePath: 'packages/sim/src/__probe__.ts' })`, with
  `projectService.allowDefaultProject` for the probe path if needed). Assert that each R4 rule
  reports on a probe snippet (`Math.random()`, `Date.now()`, `2 ** 3`, `a / b`, `0.5`,
  `import x from 'lodash'`). Assert that `a / b` is allowed with `filePath` `packages/sim/src/fixed.ts`.
- [X] T010 Create `.github/workflows/ci.yml`: on push and pull_request, on ubuntu-latest with Node
  22 and pnpm via corepack.
  - Job `checks` steps: `pnpm install --frozen-lockfile`, then `pnpm typecheck`, `pnpm lint`,
    `pnpm format:check`, `pnpm check:sim-purity`, `pnpm test`, and
    `pnpm --filter @skyline/sim test:coverage`.
  - Later tasks add steps or jobs to this file (T048, T056, T087, T092, T093).
- [X] T011 Run `pnpm install`, commit `pnpm-lock.yaml`, and confirm `pnpm ci` passes on the empty
  sim package. Also confirm that temporarily adding `Math.random()` to
  `packages/sim/src/index.ts` makes **both** `pnpm lint` and `pnpm check:sim-purity` fail
  (SC-001), then revert it.

**Checkpoint**: Guards and CI are live. Any forbidden API added to the sim from now on fails the
build.

---

## Phase 2: Foundational — simulation building blocks

**Purpose**: Types, fixed-point helpers, sine table, PRNG, tuning, config validation and hashing.
Every user story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T012 Define all types in `packages/sim/src/types.ts`, following
  [contracts/sim-api.md](./contracts/sim-api.md) and [data-model.md](./data-model.md) §2–§3.
  - Types: `TowerType`, `Mode`, `GlobalTuning` (22 fields of data-model §1.1), `TypeTuning`
    (8 fields of §1.2), `TuningValues`, `SimConfig`, `SimState`, `InputEvent`, `RunResultKind`,
    `RunResult`, and `SimEvent`. `SimEvent` includes the extensions `land.roof`,
    `finished.floors`, `gameOver.floors`, and the new `{ kind: 'roofPlaced'; tick: number }`.
  - `SimState` lists its fields in exactly the data-model §3 order, with a TSDoc unit on each
    field (su, ticks, ‰, uint32, or a code list).
  - Export the integer code constants: `PHASE_SPAWN_DELAY = 0`, `PHASE_SWINGING = 1`,
    `PHASE_FALLING = 2`, `PHASE_ENDED = 3`; `RESULT_NONE = 0`, `RESULT_COMPLETED = 1`,
    `RESULT_BUILT = 2`, `RESULT_GAME_OVER = 3`; `TIER_NONE = 0`, `TIER_PERFECT = 1`,
    `TIER_GOOD = 2`, `TIER_MISS = 3`; `INPUT_NONE = 0`, `INPUT_DROP = 1`, `INPUT_ROOF = 2`.
  - Type codes: residential 0, commercial 1, office 2, luxury 3. Mode codes: city 0, quick 1.
- [X] T013 [P] Write `packages/sim/tests/unit/fixed.test.ts`. Check `div(7, 2) = 3`,
  `div(-7, 2) = -3`, `div(7, -2) = -3`, `div(0, 5) = 0`, `U32 = 4294967296`,
  `toU32(-1) = 4294967295`.
- [X] T014 [P] Implement `packages/sim/src/fixed.ts`: `div(a, b) = Math.trunc(a / b)`,
  `U32 = 4294967296`, `toU32(v) = v >>> 0`, `abs`, `sign`, `min`, `max` (thin wrappers are
  allowed). This is the only sim file allowed to use `/` (research R3). Include TSDoc.
- [X] T015 [P] Write `scripts/gen-sin-lut.ts`. Compute `round(32767 × sin(2π k / 4096))` for
  k = 0..4095. Write `packages/sim/src/sinLut.ts` as `export const SIN_LUT: readonly number[]`
  (frozen) with a "GENERATED — do not edit" header, and `export const SIN_LUT_CHECKSUM` (FNV-1a
  32-bit over the entries, each written as a 16-bit little-endian two's complement value). Wire
  it to the root script `gen:sin-lut`, run it, and commit the output.
- [X] T016 [P] Write `packages/sim/tests/unit/sinLut.test.ts` (SC-003).
  - `SIN_LUT.length === 4096`.
  - Every entry is an integer in [−32767, 32767].
  - `SIN_LUT[0] = 0`, `[1024] = 32767`, `[2048] = 0`, `[3072] = −32767`.
  - The recomputed FNV-1a equals a checksum literal hard-coded in the test, **and** equals
    `SIN_LUT_CHECKSUM`.
- [X] T017 [P] Write `packages/sim/tests/unit/prng.test.ts`. Compare the sim's mulberry32
  (`advance`/`output`, uint32 output) with a reference mulberry32 written inline in the test, for
  seeds 0, 1 and 0xDEADBEEF over 1,000 draws. Assert the sequences for the same seed are
  identical and every output is in [0, 2^32).
- [X] T018 [P] Implement `packages/sim/src/prng.ts`: mulberry32 over uint32 using `Math.imul` and
  `>>> 0`. To avoid allocation, expose `advance(state): number` (the next state) and
  `output(state): number` (uint32). Include TSDoc.
- [X] T019 [P] Write `packages/sim/tests/unit/tuning.test.ts`.
  - Assert `DEFAULT_TUNING` equals a literal copy of the PRD §7.1 and §7.2 values:
    - Global: CRANE_AMPLITUDE 1100, DROP_FALL_TICKS 24, SPAWN_DELAY_TICKS 36, PERFECT_MAX 50,
      GOOD_MAX 250, LIVES 3, CRANE_SPEED_PER_FLOOR 20, CRANE_SPEED_CAP 2000,
      SENSITIVITY_STEP 50, SENSITIVITY_CAP 2000, BASE_SWAY_PER_FLOOR 3, LEAN_GAIN 600,
      SWAY_AMP_CAP 350, STABILIZER_STEP 800, STABILIZER_FLOOR 500, COMBO_STEP 250,
      COMBO_CAP 3000, COMPLETION_BONUS 200, BONUS_CAP 1000, ASSIST_SWAY 500,
      CAMERA_HOOK_CLEARANCE 5, VISUAL_TILT_MAX_DEG 6.
    - Per type (res/com/off/lux): targetFloors 30/40/50/60, minRoofFloors 15/20/25/30,
      cranePeriodTicks 144/144/120/132, swayPeriodTicks 180/120/180/156,
      swayMult 1000/1000/1200/2000, perfectPop 10/15/20/30, goodPop 5/7/10/15,
      blockVisualHeight 1000/1000/1400/1200.
  - Assert the fixed engine constants (data-model §1.3): `TICK_RATE = 60`, `BLOCK_WIDTH = 1000`,
    `MAX_TICKS_PER_FRAME = 5`, `SIN_LUT_SIZE = 4096`, `Q15_SCALE = 32768`,
    `SWAY_SMOOTHING_DIVISOR = 16`. None of them is a key of `TuningValues`.
  - Assert `DEFAULT_TUNING` is deeply frozen.
- [X] T020 Implement `packages/sim/src/tuning.ts`.
  - Export `TUNING_VERSION = "1.0.0"`, the deeply frozen `DEFAULT_TUNING` with the T019 values,
    and the fixed engine constants (data-model §1.3) `TICK_RATE`, `BLOCK_WIDTH`, `MAX_TICKS_PER_FRAME`,
    `SIN_LUT_SIZE`, `Q15_SCALE`, `SWAY_SMOOTHING_DIVISOR` (data-model §1.3).
  - TSDoc on each value with its unit. These are the only gameplay literals in the repository
    (Principle V). The sim formulas use `Q15_SCALE` and `SWAY_SMOOTHING_DIVISOR` instead of
    bare `32768` and `16`.
- [X] T021 [P] Implement `packages/sim/src/version.ts`: `export const SIM_VERSION = "0.1.0"`. Its
  TSDoc says to bump it whenever state fields, hash order or rules change.
- [X] T022 [P] Write `packages/sim/tests/unit/config.test.ts`.
  - `createSim`/`validateConfig` throws `SimConfigError` for:
    - A missing tuning field.
    - A non-integer value (`1.5`).
    - An unsafe integer.
    - Each bound in data-model §1.1–§1.2 exceeded by 1 on both sides, including
      "`PERFECT_MAX` 0 – `GOOD_MAX`", "`minRoofFloors` 1 – `targetFloors`", and
      "`STABILIZER_STEP` 0 – 1000".
    - A seed outside uint32.
    - `mode: 'quick'` with a type other than `'residential'`.
  - `isDefaultTuning(cloneTuning(DEFAULT_TUNING))` is true, and false after changing any single
    field (loop over all fields).
  - `cloneTuning` returns a deep, unfrozen copy.
- [X] T023 Implement `packages/sim/src/config.ts`.
  - `SimConfigError`, `validateConfig(config): void`, `isDefaultTuning(t)`, `cloneTuning(t)`.
  - Enforce the bounds table of data-model §1.1–§1.2 **verbatim**. Put it in a
    `TUNING_BOUNDS` constant next to `DEFAULT_TUNING` in `tuning.ts`, so all tuning numbers stay
    in one file.
  - Validate `seed` as an integer in [0, 4294967295] and `assist` as a boolean.
- [X] T024 [P] Write `packages/sim/tests/unit/hash.test.ts`.
  - FNV-1a of an empty stream = `0x811c9dc5`.
  - The 8-byte little-endian encoding (research R11) of `0`, `1`, `−1`, `2^32`, `−2^32 − 5` and
    `Number.MAX_SAFE_INTEGER` matches expected byte arrays.
  - `restX` is length-prefixed.
  - Changing any single state field changes the hash (iterate over all field names in hash
    order).
  - Hashing the same state twice gives the same uint32.
- [X] T025 Implement `packages/sim/src/hash.ts`.
  - `hashState(state)` over the fields in data-model "Hash order" (`typeCode` … `lastTier`,
    with `restX` as length then elements).
  - FNV-1a with `Math.imul(h ^ byte, 0x01000193) >>> 0`, and each number written as
    lo `v >>> 0` then hi `toU32(div(v − lo, U32))`, both little-endian.
  - Export `HASH_FIELD_ORDER` as a readonly tuple so tests and docs share one source.

**Checkpoint**: Foundations are ready and pass lint, purity and unit tests.

---

## Phase 3: User Story 1 — simulation of a complete Residential tower (P1) 🎯 MVP (sim half)

**Goal**: The sim runs the full PRD §3–§4 loop for a `city` Residential run: crane, drop,
landing tiers, scoring and combo, shear sway, lean, stabilizer, strikes, automatic roof, the
Completed result, and finality.

**Independent Test**: `pnpm --filter @skyline/sim test -- crane tiers sway landing caps sim-flow`
passes. A bot-driven 30-floor Residential run ends Completed with score = Σ pop +
`div(Σ pop × 200, 1000)`.

### Tests for User Story 1 (write first; they must fail)

- [X] T026 [P] [US1] Write the test-only snapshot helper `packages/sim/tests/helpers/snapshot.ts`
  (research R13, not part of the public API).
  - `snapshot(sim): SimSnapshot` deep-copies `getConfig()`, `getState()` (including a copy of
    `restX`) and `getInputLog()`.
  - `restore(snap): TowerSim` calls the internal `restoreSim(config, state, inputLog)` imported
    directly from `../../src/sim` (implemented in T037). It never imports from `index.ts`.
- [X] T027 [P] [US1] Write the test bot `packages/sim/tests/helpers/bot.ts`, using the T026
  snapshot helper.
  - `findDropTick(sim, want: 'perfect' | 'good' | 'miss', side?: -1 | 1): number | null`.
    It snapshots `sim` once. For each future swinging tick, it restores the snapshot, steps to
    the candidate tick, requests a drop, steps to the landing, and checks `lastTier` and the sign
    of `lastOffset`. It returns the first matching tick. Each candidate costs only the ticks up
    to its landing, with no replay from tick 0.
  - `playScript(config, script: Array<'P' | 'G' | 'M' | 'R'>): { log, sim }` (R = early roof
    before the drop) drives one live sim using `findDropTick`.
  - Include TSDoc.
- [X] T028 [P] [US1] Write `packages/sim/tests/unit/crane.test.ts`.
  - At spawn, `craneCenterX = restX[N]` (excluding sway), and `cranePhase` equals the next
    mulberry32 output.
  - `craneSpeed = min(2000, 1000 + 20 × N)`.
  - `craneIncrement = div(div(2^32, cranePeriodTicks) × craneSpeed, 1000)`.
  - Each swinging tick, `cranePhase = (cranePhase + craneIncrement) >>> 0` and
    `craneX = craneCenterX + div(CRANE_AMPLITUDE × SIN_LUT[cranePhase >>> 20], Q15_SCALE)`.
  - Formula-level cap: `craneSpeed` is 2000 for N = 50, 51 and 200.
- [X] T029 [P] [US1] Write `packages/sim/tests/unit/tiers.test.ts` (SC-004). Using
  `classifyOffset(d, tuning)` **and** an end-to-end sim check (bot T027), assert that
  d = 0, ±50 give Perfect; d = ±51, ±250 give Good; and d = ±251 gives Miss.
- [X] T030 [P] [US1] Write `packages/sim/tests/unit/sway.test.ts`.
  - Sway phase and S:
    - `swayPhase` stays 0 until floor 1 is placed, then advances by `div(2^32, swayPeriodTicks)`
      each tick with `>>> 0`.
    - `S = div(swayAmp × SIN_LUT[swayPhase >>> 20], Q15_SCALE)`.
    - `floorDisplayX(state, i) = restX[i] + div(S × i, N)`; the foundation never moves; the top
      floor moves by the full S.
  - Smoothing: `step = div(diff, SWAY_SMOOTHING_DIVISOR)`, and `step = sign(diff)` when that is
    0 and diff ≠ 0. Check diff = 1, 15, 16, −1, −17.
  - Target amplitude: recomputed only after a successful landing, following PRD §4.3, including
    the assist ×500‰ step and the 350 su cap.
  - Lean: `lean = div(Σ restX[1..N], N)`, signed.
  - While N = 0, sway and S are 0.
  - Formula-level caps: `sensitivity` = 2000 for `goodCount` ≥ 20; `recomputeSwayTarget` never
    returns more than 350.
- [X] T031 [P] [US1] Write `packages/sim/tests/unit/landing.test.ts`.
  - Perfect:
    - `restX[N+1] = restX[N]`, `combo += 1`, `comboMult = min(3000, 1000 + 250 × combo)`.
    - `pop = div(perfectPop × comboMult, 1000)`.
    - `stabilizer = max(500, div(stabilizer × 800, 1000))`.
  - Good: `restX[N+1] = restX[N] + d`, `combo = 0`, `pop = goodPop`, `stabilizer = 1000`,
    `goodCount += 1`.
  - Miss: no floor, `strikes += 1`, `combo = 0`, stabilizer unchanged, `emit miss`.
  - Formula-level caps: `comboMult` is 3000 for combo 8, 9 and 20; `stabilizer` never drops
    below 500.
- [X] T032 [P] [US1] Write `packages/sim/tests/unit/sim-flow.test.ts`, following the
  data-model §4 tick pipeline.
  - Start of run:
    - The first `step()` has tick 1 and emits `spawn`.
    - `requestDrop()` before the spawn returns false.
  - Drop, fall and spawn timing:
    - After an accepted `requestDrop()`, the logged tick = `getState().tick + 1` (SC-009,
      sim side).
    - `releaseX` equals the `craneX` of the previous tick.
    - The landing is evaluated at exactly `releaseTick + 24`.
    - The next spawn happens exactly 36 ticks after the landing tick.
    - `requestDrop()` returns false while falling, during the spawn delay, and while another
      input is pending.
  - Roof and result:
    - After 30 floors (Residential), the next spawn has `isRoof = true`.
    - A Perfect or Good roof ends with `result = 'completed'`, `finalScore = score +
      div(score × 200, 1000)`, `floors = 30`, and emits `finished`.
    - The roof adds no floor or population.
    - A roof Miss costs a strike, and the next spawn is again a roof.
  - Strikes: the 3rd Miss ends with `result = 'gameOver'`, `finalScore = score`, and emits
    `gameOver`.
  - **Finality (FR-045)**: after a result, 100 more `step()` calls return `[]`, `hashState` is
    unchanged, and `requestDrop()`/`requestRoof()` return false.
  - `getResult()` returns null before the end and `{ result, score, floors }` after.
  - `step()` returns the same array instance on every call.
  - **Snapshot helper fidelity**: `restore(snapshot(sim))` followed by the same inputs reaches
    the same final hash as the original sim.
- [X] T033 [P] [US1] Write `packages/sim/tests/unit/caps.test.ts`, the SC-005 roll-up.
  **End-to-end only**: each cap is checked by playing full runs through the public sim API with
  the bot, not by calling module functions.
  - Crane speed is 2000 at N ≥ 50.
  - Sensitivity is 2000 after ≥ 20 Goods.
  - Sway amplitude stays ≤ 350 su on a Luxury run with maximum lean.
  - comboMult is 3000 after ≥ 8 consecutive Perfects.
  - Stabilizer stays ≥ 500.

### Implementation for User Story 1

- [X] T034 [P] [US1] Implement `packages/sim/src/crane.ts`: `spawnCrane(state, tuning, typeTuning)`
  and `advanceCrane(state)`, using the T028 formulas. It reads numbers only from the passed
  tuning and the fixed engine constants (FR-049). TSDoc with units.
- [X] T035 [P] [US1] Implement `packages/sim/src/sway.ts`: `advanceSway(state)` (phase,
  smoothing with `SWAY_SMOOTHING_DIVISOR`, S with `Q15_SCALE`),
  `recomputeSwayTarget(state, tuning, typeTuning)` (PRD §4.3 in the exact written order of
  truncations), `updateLean(state)`, and the exported pure `floorDisplayX(state, i)`. TSDoc with
  units.
- [X] T036 [P] [US1] Implement `packages/sim/src/landing.ts`.
  - `classifyOffset(d, tuning): TIER_*`.
  - `evaluateLanding(state, tuning, typeTuning, events)`, handling Perfect, Good, Miss and roof
    landings as in data-model §4 "evaluate landing".
  - `endRun(state, result, tuning, events)`, which sets `result`, `finalScore`,
    `phase = ENDED`, and emits `finished`/`gameOver` with `floors`.
- [X] T037 [US1] Implement `packages/sim/src/sim.ts`, depending on T034–T036.
  - `createSim(config)`: call `validateConfig`, keep a private copy of the config (tuning via
    `cloneTuning`), and initialize every `SimState` field. Initial values: `phase = SPAWN_DELAY`,
    `phaseTimer = 0`, `restX = [0]`, `stabilizer = 1000`, `sensitivity = 1000`,
    `comboMult = 1000`, `rngState = seed`, `assist` = 0/1.
  - `step()`: the data-model §4 pipeline, in order, using one reused events array.
  - `requestDrop()` and `getState()` (live object), `getInputLog()`, `getResult()`,
    `getConfig()`.
  - The automatic roof rule: `isRoof = city && (N ≥ targetFloors || roofCommitted)`.
  - Internal `restoreSim(config, state, inputLog): TowerSim`, which builds a sim around copies
    of the given state and log. It is exported from `sim.ts` for the test helper only and
    **must not** be re-exported from `index.ts`.
- [X] T038 [US1] Export the public API from `packages/sim/src/index.ts`: types, code constants,
  `createSim`, `hashState`, `floorDisplayX`, tuning, fixed engine constants and version
  constants, `isDefaultTuning`, `cloneTuning`, `SimConfigError`. Do **not** export `restoreSim`.
  Run T026–T033 until they are green. Confirm `pnpm lint` and `pnpm check:sim-purity` pass.

**Checkpoint**: The sim plays a complete Residential tower headlessly with every US1 rule
verified.

---

## Phase 4: User Story 3 — simulation of every tower type, early roof, and Quick Play (P2) (sim half)

**Goal**: The per-type parameters, early roof (Built, with the `roofPlaced` event), and Quick
Play rules are in the sim.

**Independent Test**: `pnpm --filter @skyline/sim test -- roof quickplay types rules` passes.

### Tests for User Story 3 (write first; they must fail)

- [X] T039 [P] [US3] Write `packages/sim/tests/unit/roof.test.ts`.
  - `requestRoof()`:
    - Returns false below `minRoofFloors` (N = 14 Residential) and true at N = 15 while
      swinging (SC-006).
    - Returns false while falling, during spawn delay, when the block is already the roof, when
      an input is pending, and in `quick` mode.
  - When applied:
    - It is logged as `{ tick, type: 'roof' }`.
    - `step()` emits `{ kind: 'roofPlaced', tick }` on that same tick, exactly once per placement.
    - The block becomes the roof and **keeps swinging**; the `craneX` sequence is unchanged.
    - `canPlaceRoof(sim)` is false from that tick on.
  - Early roof landing:
    - Perfect/Good gives `result = 'built'` with `finalScore = score` (no bonus, SC-006).
    - A Miss respawns a roof (`roofCommitted`), and no second `roofPlaced` is emitted.
  - Events: `roofAvailable` is emitted on every non-roof spawn with N ≥ `minRoofFloors` in `city`
    mode. `canPlaceRoof(sim)` matches `requestRoof()` eligibility.
  - Once the automatic roof has spawned (N = target), `canPlaceRoof` is false and `roofPlaced` is
    never emitted.
- [X] T040 [P] [US3] Write `packages/sim/tests/unit/quickplay.test.ts`.
  - `quick` mode never spawns a roof and never emits `roofAvailable` or `roofPlaced`.
  - It ends only at 3 strikes with `result = 'gameOver'` and score = Σ pop.
  - A **300-floor** bot run (snapshot-based bot, T027) keeps `craneSpeed ≤ 2000` and
    `swayAmp ≤ 350`, and stays playable (the bot still finds Perfect ticks). The test must finish
    in under 30 s.
- [X] T041 [P] [US3] Write `packages/sim/tests/unit/types.test.ts`.
  - For each of the 4 types: crane and sway increments come from `cranePeriodTicks` /
    `swayPeriodTicks`, `swayMult` scales the target, `perfectPop`/`goodPop` are used, and
    `targetFloors` triggers the automatic roof (Commercial 40, Office 50, Luxury 60).
  - Early roof minimums are 20 / 25 / 30.
- [X] T042 [P] [US3] Write `packages/sim/tests/unit/rules.test.ts`, the SC-006 roll-up.
  **End-to-end only** (full runs through the public API with the bot). Check all seven rules:
  1. A Perfect snaps.
  2. A Good keeps its offset.
  3. A left Good followed by an equal right Good reduces |lean|.
  4. The 3rd strike gives game over.
  5. The early roof is unavailable at N = minRoofFloors − 1 and available at minRoofFloors.
  6. An early-roof finish has no bonus.
  7. A target-height finish gets exactly `div(sum × 200, 1000)`.

### Implementation for User Story 3

- [X] T043 [US3] Add `requestRoof()` to `packages/sim/src/sim.ts`, with eligibility
  `mode = city && phase = SWINGING && isRoof = 0 && floors ≥ minRoofFloors && pendingInput = 0
  && result = 0`.
  - Applying it in the step pipeline sets `isRoof = 1` and `roofCommitted = 1`, logs `roof`, and
    emits `{ kind: 'roofPlaced', tick }` (data-model §4).
  - Emit `roofAvailable` at spawn as in data-model §4.
  - Enforce the `quick` rules: no roof, residential tuning.
- [X] T044 [US3] Export `canPlaceRoof(sim)` (pure: it checks the same eligibility on
  `getState()` and `getConfig()`) from `packages/sim/src/sim.ts` via
  `packages/sim/src/index.ts`. Make T039–T042 green.

**Checkpoint**: All four types, the early roof and Quick Play are correct in the sim.

---

## Phase 5: User Story 2 — determinism: replay, fuzz, golden fixtures in Node and in 3 browsers (P1) (sim half)

**Goal**: `replay`, assist in the hash, run export and parse helpers, 10,000-run fuzz, committed
golden fixtures that replay in Node, and the Phaser-free cross-browser golden harness in CI. This
finishes the simulation.

**Independent Test**:
- `pnpm --filter @skyline/sim test` passes, including golden and fuzz.
- `pnpm --filter @skyline/sim test:coverage` reports lines ≥ 90%.
- `pnpm --filter @skyline/golden-harness test:e2e` passes in chromium, webkit and firefox.

### Tests for User Story 2 (write first; they must fail)

- [X] T045 [P] [US2] Write `packages/sim/tests/unit/replay.test.ts`.
  - For bot-played runs of every type and Quick Play, `replay(sim.getConfig(),
    sim.getInputLog())` equals the live final hash, result and events.
  - Replay stops when the result is set, or `DROP_FALL_TICKS + 1` ticks after the last input.
  - Replay throws `ReplayError` (with `.tick`) for:
    - A non-increasing log.
    - Two inputs on one tick.
    - A drop logged on a tick where it would be rejected.
    - A `roof` logged in `quick` mode.
  - Replaying one log 1,000 times in one process gives one hash (SC-007, Node).
- [X] T046 [P] [US2] Write `packages/sim/tests/unit/assist.test.ts` (FR-047, FR-048).
  - `state.assist` is 1 when `config.assist` is true.
  - The same seed and log with the opposite `assist` value gives a different hash (check 50
    random logs).
  - With assist, `swayTarget` equals `div(targetWithoutAssist × 500, 1000)` before the cap.
- [X] T047 [P] [US2] Write `packages/sim/tests/unit/export.test.ts`.
  - `createRunExport(sim)` returns every field of
    [contracts/run-export.schema.json](./contracts/run-export.schema.json):
    - `format: "skyline-stacker/run"`, `exportVersion: 1`, `simVersion`, `tuningVersion`.
    - `tuningOverridden = !isDefaultTuning(config.tuning)`.
    - The full `config` including the complete `tuning`, `inputLog`, `result`, and `hash`.
  - It throws if the run has no result.
  - `parseRunExport(JSON.parse(JSON.stringify(x)))` round-trips.
  - `parseRunExport` rejects: a missing field, an extra field, `mode: 'quick'` with type
    `'office'`, a non-integer tuning value, and a hash outside uint32.
  - An export with overridden tuning replays to its recorded hash using its own tuning
    (FR-050).
- [X] T048 [P] [US2] Write the shared fuzz harness `packages/sim/tests/fuzz/harness.ts` and five
  files `packages/sim/tests/fuzz/fuzz-1.test.ts` … `fuzz-5.test.ts` (2,000 runs each, seed ranges
  disjoint) (SC-002, research R15).
  - Type and mode are chosen round-robin over the 4 types and Quick Play.
  - A test-side mulberry32 picks random gaps of 0–200 ticks between `requestDrop`/`requestRoof`
    calls (20% roof).
  - Each run stops at a result or at 6,000 ticks.
  - After **every** step: every scalar field and every `restX[i]` passes
    `Number.isSafeInteger`, and no exception has been thrown.
  - On failure, print the run's seed and log.
  - Add a CI step `pnpm gen:sin-lut && git diff --exit-code packages/sim/src/sinLut.ts` to
    `.github/workflows/ci.yml`.

### Implementation for User Story 2

- [X] T049 [US2] Implement `packages/sim/src/replay.ts`: `ReplayError` (with `tick`) and
  `replay(config, log)`, following [contracts/sim-api.md](./contracts/sim-api.md). It returns
  `{ state, hash, events (copied), result }`. Export both from `packages/sim/src/index.ts`.
- [X] T050 [US2] Implement `packages/sim/src/export.ts`, pure with no I/O (data-model §8).
  - Export the `RunExport` type, `createRunExport(sim): RunExport`, and
    `parseRunExport(value: unknown): RunExport`. Validation is hand-written against the schema,
    with no new dependency (Principle VIII).
  - Export them from `packages/sim/src/index.ts`.
  - Add these three items, marked `[ext]`, to
    `specs/001-whitebox-core-loop/contracts/sim-api.md`.
- [X] T051 [US2] Write `scripts/gen-golden.ts`, the fixture generator (research R13).
  - Use the bot from `packages/sim/tests/helpers/bot.ts` with `DEFAULT_TUNING` only.
  - Write four fixtures to `packages/sim/tests/golden/fixtures/`:
    - `completed-residential.json`: 30 floors plus roof. Script includes ≥ 8 consecutive
      Perfects, ≥ 3 Goods on both sides, and 1 Miss.
    - `early-roof-commercial.json`: 20 floors, then Place Roof, then a roof Miss, then a roof
      Good. Result `built`.
    - `game-over-luxury.json`: ≥ 10 floors, then 3 Misses. Result `gameOver`.
    - `quick-play.json`: Quick Play to ≥ 25 floors, then 3 Misses. Also played with
      `assist: true`.
  - Use fixed seeds and `createRunExport` for the file format.
  - Wire it to the root script `golden:regen`, run it, and commit the fixtures.
- [X] T052 [US2] Write `packages/sim/tests/golden/golden.test.ts` (SC-007, Node). For every
  fixture:
  - It passes `parseRunExport`, `tuningOverridden === false`,
    `tuningVersion === TUNING_VERSION`, and `config.tuning` deep-equals `DEFAULT_TUNING`.
  - Replay gives the recorded `result.score`, `result.result`, `result.floors` and `hash`.
  - The fixtures include at least one each of completed, built and gameOver.
  - Replaying `completed-residential` 1,000 times gives one hash.

### Cross-browser golden harness (Vite-only, no Phaser)

- [X] T053 [US2] Scaffold the test-only workspace package `packages/golden-harness` (research
  R14; plan Complexity Tracking).
  - `packages/golden-harness/package.json`: name `@skyline/golden-harness`, `"private": true`,
    `"type": "module"`; dependency `@skyline/sim: "workspace:*"`; devDependencies `vite@^8`,
    `@playwright/test@^1.63`. **No Phaser.** Scripts: `dev` (`vite --port 5174`), `test:e2e`
    (`playwright test`).
  - `packages/golden-harness/tsconfig.json` extends the base config.
  - `packages/golden-harness/vite.config.ts` with `server.fs.allow` including the repo root, so
    the page can read the fixtures.
  - `packages/golden-harness/index.html` and `packages/golden-harness/src/main.ts`:
    - Import `{ parseRunExport, replay }` from `@skyline/sim`, and load the fixtures with
      `import.meta.glob('../../sim/tests/golden/fixtures/*.json', { eager: true })`.
    - Replay each fixture and set `window.__goldenResults = [{ name, score, result, floors,
      hash, expected: { score, result, floors, hash } }]`.
  - It is never deployed and has no build step in CI.
- [X] T054 [US2] Create `packages/golden-harness/playwright.config.ts` and
  `packages/golden-harness/tests/golden.spec.ts`.
  - `webServer`: `pnpm dev`, port 5174.
  - Projects chromium, webkit and firefox.
  - The spec opens `/`, waits for `window.__goldenResults`, and asserts every fixture's score,
    result, floors and hash equal the committed values (SC-007, browsers).
- [X] T055 [US2] Add a job `golden-browsers` to `.github/workflows/ci.yml`, right after the golden
  Node tests (`needs: checks`). It runs
  `pnpm exec playwright install --with-deps chromium webkit firefox` then
  `pnpm --filter @skyline/golden-harness test:e2e`. From this task on, every change to
  `packages/sim` must pass it before merge (constitution quality gate).
- [X] T056 [US2] Run `pnpm --filter @skyline/sim test:coverage`. Add unit tests in
  `packages/sim/tests/unit/` for any `packages/sim/src` lines left uncovered until lines ≥ 90%.
  Confirm TSDoc with units on every export in `packages/sim/src/` (Principle IX).

**Checkpoint — SIM COMPLETE (gate)**:
- `pnpm ci` is green.
- All sim unit, fuzz (10,000) and golden Node tests pass, and coverage is ≥ 90%.
- The golden replay passes in chromium, webkit and firefox in CI.
- Lint and purity pass.

**Only now may `apps/web` / Phaser work start.**

---

## Phase 6: User Story 1 — playable Residential tower in the browser (P1) 🎯 MVP (presentation half)

**Goal**: A player can play a full Residential tower with mouse, touch or Space in a whitebox
Phaser 4 build. It has render interpolation, camera follow and culling, a canvas HUD, visual-only
Matter.js miss and collapse, particles, and auto-pause. All user-facing text comes from one
strings file.

**Independent Test**: `pnpm dev` starts a Residential run. A tester plays 30 floors plus the roof
and sees Completed with the correct score. `pnpm --filter @skyline/web test` passes, and the
Playwright playability smoke test passes in chromium.

### Setup for the web app

- [X] T057 [US1] Scaffold `apps/web`.
  - `apps/web/package.json`: name `@skyline/web`; dependencies `phaser@~4.2.1` and
    `@skyline/sim: "workspace:*"`; devDependencies `vite@^8`, `@playwright/test@^1.63`.
  - Scripts: `dev`, `build`, `preview`, `test`, `test:e2e`.
  - Also create `apps/web/tsconfig.json` and `apps/web/vitest.config.ts` (Node environment).
  - `apps/web/vite.config.ts`: single input `index.html`; define `__PERF_TOOLS__` from
    `process.env.VITE_PERF_TOOLS`.
  - `apps/web/index.html`: a full-viewport container with a dark background.
  - Add `apps/web` to the root `vitest.config.ts` projects.
- [X] T058 [P] [US1] Create `apps/web/src/render/typeArt.ts` (constitution Principle VII: types
  are never told apart by color alone; FR-028).
  - `generateTypeArt(scene)` builds, with `Graphics.generateTexture`, a distinct whitebox
    **floor pattern**, **roof top shape** and **icon** per type:
    - Residential: horizontal balcony stripes; pitched (triangle) roof; house icon.
    - Commercial: a striped awning band at the base of each floor; flat roof with a sign board;
      awning icon.
    - Office: a grid of window squares; flat stepped roof; grid icon.
    - Luxury: a diamond (diagonal lattice) pattern; spire roof; crown/spire icon.
  - Texture keys: `floor-<type>`, `roof-<type>`, `icon-<type>`. The patterns are drawn in
    white/gray so each type's tint (from `renderConfig.ts`) still applies.
  - Each floor pattern and roof shape must be identifiable in grayscale.
- [X] T059 [P] [US1] Create `apps/web/src/strings.ts` (constitution Principle VII: externalized UI
  strings).
  - Export one frozen English table `STRINGS` holding **every** user-facing text in `apps/web`:
    - Tower type names; "Quick Play".
    - HUD labels: score, lives, combo, floors, "ASSIST".
    - Result banners "COMPLETED", "BUILT", "GAME OVER"; "Press Space or tap to play again".
    - Selector title and hints; "Assist: ON" / "Assist: OFF".
    - "Place Roof"; "Run exported".
    - Debug overlay field labels.
  - Small formatting helpers, for example `formatCombo(multPermille)` → "×1.75" and
    `formatFloors(n, target)` → "12 / 40".
  - Components import from here. They must not contain literal user-facing strings.
  - **Exempt** (plan.md, interpretations): text in the dev-only tools (tuning panel T084, perf
    report T090), which are excluded from production builds and replaced in Phase 3.
- [X] T060 [US1] Create `apps/web/src/main.ts`, depending on T058.
  - Phaser game config: `type: Phaser.AUTO` (WebGL with Canvas fallback), 720×1280,
    `scale.mode: FIT`, `autoCenter: CENTER_BOTH`.
  - Matter physics configured but enabled only in GameScene, with gravity y = 1.
  - Scenes `[BootScene, GameScene]`.
  - `apps/web/src/scenes/BootScene.ts` generates the particle textures `dust`, `spark` and
    `debris` with `Graphics.generateTexture`, calls `generateTypeArt(scene)` (T058), then starts
    GameScene.

### Tests for User Story 1 (write first; they must fail)

- [X] T061 [P] [US1] Write `apps/web/tests/unit/FixedStepLoop.test.ts`.
  - At 60 Hz deltas, one step per frame.
  - A 100 ms delta runs exactly `MAX_TICKS_PER_FRAME` (5) steps and discards the rest.
  - `alpha = accumulator / TICK_MS` is in [0, 1).
  - Before each step, `prev` receives the `curr` values (crane X, S, fall ticks, camera target).
  - `pause()` stops steps, and `resume()` resets the accumulator (FR-035).
  - It performs no allocations per `advance()`: check with a spy that the snapshot objects
    keep their identity.
- [X] T062 [P] [US1] Write `apps/web/tests/unit/InputController.test.ts` against the Phaser-free
  `InputCore`.
  - A pointer down gives `requestDrop()`.
  - A Space keydown with `repeat: false` gives `requestDrop()`; `repeat: true` is ignored.
  - **SC-009**: an event injected between steps is applied on `tick + 1` (use a real
    `createSim`).
  - A rejected request is not buffered: an input during the fall followed by a later step does
    not drop.

### Implementation for User Story 1

- [X] T063 [P] [US1] Implement `apps/web/src/loop/FixedStepLoop.ts` (no Phaser imports; research
  R8).
  - `advance(elapsedMs): number` (steps run), `alpha`, `pause()`, `resume()`.
  - Preallocated `prev`/`curr` `RenderSnapshot` objects.
  - An epsilon of `1e-6` on the `TICK_MS` comparison.
  - It calls a `stepSim()` callback and forwards events to `onEvents(events)` without copying.
  - TSDoc on the loop with units (ms, ticks), as Principle IX requires.
- [X] T064 [P] [US1] Implement `apps/web/src/input/InputController.ts`.
  - The Phaser-free `InputCore` class (drop and roof requests, repeat filter).
  - A thin Phaser adapter that binds scene `pointerdown` and `keydown-SPACE` (reading
    `event.repeat`).
  - Leave a hook `isOverRoofButton(pointer)` returning false; it is used in US3.
- [X] T065 [P] [US1] Create `apps/web/src/render/renderConfig.ts` with styling values only
  (Principle V exemption):
  - `PX_PER_SU = 0.2` (a 1000 su block is 200 px, so ±1600 su fits the 720 px width).
  - `BASE_BLOCK_HEIGHT_PX = 90`.
  - Type colors: residential `0x3b82f6` blue, commercial `0xef4444` red, office `0x22c55e`
    green, luxury `0xeab308` yellow.
  - Camera smoothing factors, HUD panel color `0x111827` (alpha 0.85) and HUD text `#ffffff`.
  - Type **names** are not here; they come from `strings.ts`.
- [X] T066 [US1] Implement `apps/web/src/render/TowerRenderer.ts`.
  - The foundation, plus a `FloorPool` of images sized `ceil(viewportHeight / minBlockPx) + 4`,
    using the run type's `floor-<type>` texture (T058) tinted with its color.
  - Each frame, assign images only to floors inside the camera view (culling, FR-031).
  - Position each floor at `floorDisplayX` using interpolated S
    (`prevS + (currS − prevS) × alpha`).
  - Block height = `BASE_BLOCK_HEIGHT_PX × blockVisualHeight / 1000`.
  - Visual tilt `atan(localShearPx / blockHeightPx)`, clamped to `VISUAL_TILT_MAX_DEG` from the
    run's tuning.
  - A landed roof uses `roof-<type>`.
  - Zero allocations per frame.
- [X] T067 [US1] Implement `apps/web/src/render/CraneRenderer.ts`.
  - The hook line and trolley at the interpolated crane X.
  - The attached block while swinging, drawn with `roof-<type>` when `state.isRoof = 1`.
  - While falling, the block at the frozen `releaseX`, with quadratic ease-in:
    `y = hookY + (towerTopY − hookY) × p²`, where
    `p = min(1, (tick − releaseTick + alpha) / DROP_FALL_TICKS)` (FR-030).
  - Hidden during the spawn delay.
- [X] T068 [US1] Implement `apps/web/src/render/CameraRig.ts`.
  - Vertical target keeps the hook `CAMERA_HOOK_CLEARANCE` block heights above the top floor.
  - Smooth pan after each landing.
  - Horizontal follow of `craneCenterX` with smoothing.
  - Interpolation with alpha, and no allocation.
- [X] T069 [P] [US1] Implement `apps/web/src/fx/MissFx.ts`. On a `miss` event, create a Matter
  rectangle body at the landing position with sideways velocity `sign(offset)` away from the
  tower and a small angular velocity. Remove it when it leaves the viewport. Its output is never
  read by the sim (Principle II).
- [X] T070 [P] [US1] Implement `apps/web/src/fx/CollapseFx.ts`. On `gameOver`, convert every
  **visible** floor image into a Matter body at its displayed position and tilt, with horizontal
  velocity from the sign of the current sway direction. Culled floors are not converted.
- [X] T071 [P] [US1] Implement `apps/web/src/fx/Particles.ts`: Phaser particle emitters,
  preallocated, for landing dust (`land`), Perfect sparks (`land` with tier `perfect`) and
  collapse debris (`gameOver`) (FR-033).
- [X] T072 [P] [US1] Implement `apps/web/src/hud/Hud.ts`, drawn on the canvas with a fixed camera
  (FR-034). **All text comes from `STRINGS` (T059).**
  - Contents on a dark backing panel for AA contrast:
    - Score.
    - Lives as "● ● ○" plus the number.
    - The combo multiplier via `formatCombo`.
    - Floors / target via `formatFloors`; Quick Play shows floors only.
    - The type **name and `icon-<type>`**, and an "ASSIST" badge.
  - Update text objects only on relevant events (no per-frame string building).
  - A result banner (COMPLETED / BUILT / GAME OVER) plus the final score and the play-again hint.
- [X] T073 [P] [US1] Implement `apps/web/src/lifecycle/visibility.ts`. Listen to
  `document.visibilitychange` and Phaser `game.events` `hidden`/`visible`. On hidden call
  `loop.pause()`; on visible call `loop.resume()`, which resets the accumulator (FR-035).
- [X] T074 [US1] Implement `apps/web/src/scenes/GameScene.ts`.
  - Accept a `SimConfig` scene init param. The default is `city` / `residential` /
    `assist: false` / `DEFAULT_TUNING` clone, with the seed from
    `crypto.getRandomValues(new Uint32Array(1))[0]` (outside the sim).
  - Create the sim, the FixedStepLoop, the renderers, the CameraRig, fx, Hud, InputController
    and visibility.
  - Call `loop.advance(delta)` in `update(time, delta)`, then render with `loop.alpha`.
  - Route events to Hud, fx and particles.
  - After a result, Space or pointer restarts with a new seed.
  - In dev builds only, expose `window.__skyline = { getState, getInputLog, getResult }` for
    Playwright.
- [X] T075 [US1] Create `apps/web/playwright.config.ts`:
  - `webServer`: `pnpm dev --port 5173`.
  - Projects chromium, webkit and firefox.
  - `testDir: tests/e2e`.

  Then write `apps/web/tests/e2e/playability.spec.ts`:
  - Start a run.
  - Press Space, click the canvas, and tap with `hasTouch` in a mobile-emulation context.
  - Assert via `window.__skyline` that each input produced a `drop` log entry on the tick after
    it.
  - Play with repeated drops until a result appears, and assert the HUD banner is visible.

**Checkpoint**: The MVP is playable. User Story 1 is fully functional in the browser.

---

## Phase 7: User Story 3 — type selector, Place Roof button, and Quick Play in the browser (P2) (presentation half)

**Goal**: Pick any type or Quick Play with Steady Tower on or off, and use the Place Roof button
without it also counting as a drop. The button hides as soon as the roof is placed.

**Independent Test**:
- Keys `1`–`5` start each mode.
- Place Roof appears at `minRoofFloors`, creates only a `roof` log entry, and disappears on
  `roofPlaced`.
- Quick Play shows no roof button.

### Tests for User Story 3 (write first; they must fail)

- [X] T076 [P] [US3] Extend `apps/web/tests/unit/InputController.test.ts`. A pointer down whose
  hit list contains the Place Roof button calls `requestRoof()` only and never `requestDrop()`,
  whichever of the two guards fires first (FR-051, research R9).
- [X] T077 [P] [US3] Write `apps/web/tests/e2e/place-roof.spec.ts`.
  - Start a Commercial run and use `window.__skyline` plus Space to reach 20 floors.
  - Click the Place Roof button.
  - Assert:
    - The log gained exactly one `{ type: 'roof' }` entry and no `drop` entry for that press.
    - The block is still swinging.
    - The button is hidden within one tick of the press (after `roofPlaced`).
  - Assert Quick Play never shows the button.

### Implementation for User Story 3

- [X] T078 [US3] Implement `apps/web/src/scenes/SelectScene.ts`, following
  [contracts/controls.md](./contracts/controls.md). **All text comes from `STRINGS` (T059).**
  - Five entries: Residential, Commercial, Office, Luxury, Quick Play. Each shows the type name,
    the type's `icon-<type>` and a color swatch.
  - Keys:
    - `1`–`4` start `city` runs, and `5`/`Q` starts Quick Play.
    - `↑`/`↓` move a visible focus ring, and `Enter` starts the focused entry.
    - `A` toggles the Assist ON/OFF text.
  - Pointer click works too.
  - Start GameScene with the matching `SimConfig`: type residential for Quick Play, `assist`,
    and a `cloneTuning(DEFAULT_TUNING)`.
  - Register it as the first scene after Boot in `apps/web/src/main.ts`.
  - When a run ends, return to it with `Esc` or after the result banner.
- [X] T079 [US3] Add the Place Roof button to `apps/web/src/hud/Hud.ts`. Its label comes from
  `STRINGS` (T059).
  - It is an interactive canvas button.
  - Visibility:
    - Show it on `roofAvailable` when `canPlaceRoof(sim)` is true.
    - Hide it on **`roofPlaced`**, on `release`, and on `finished`/`gameOver`.
    - Also re-check `canPlaceRoof` on `spawn` and `land`.
  - On `pointerdown` it calls `requestRoof()` then `event.stopPropagation()`.
  - Implement `isOverRoofButton(pointer)` in `apps/web/src/input/InputController.ts` using the
    pointer's hit list (the second guard).
- [X] T080 [US3] Update `apps/web/src/hud/Hud.ts` and `apps/web/src/render/TowerRenderer.ts` to
  use each type's `blockVisualHeight`, color, `floor-<type>`/`roof-<type>` textures and icon.
  Hide floors/target and the roof button in Quick Play. Show the ASSIST badge when
  `config.assist`.

**Checkpoint**: All four types and Quick Play are playable, and the early roof works with the
pointer.

---

## Phase 8: User Story 2 — frame-rate independence through the real loop (P1) (presentation half)

**Goal**: Prove SC-008 through the real render loop. SC-007 in browsers is already covered by the
golden harness (Phase 5).

**Independent Test**: `pnpm --filter @skyline/web test -- loop-framerate` passes.

- [X] T081 [US2] Write `apps/web/tests/unit/loop-framerate.test.ts` (SC-008).
  - For 30, 60, 120 and 144 Hz, drive `FixedStepLoop` plus a real sim with deltas of
    `1000 / hz` ms for a scripted run.
  - Scripted inputs are injected between frames when `sim.getState().tick === T − 1` for a fixed
    list of target ticks.
  - Assert that all four input logs are identical and all four final hashes are identical.

**Checkpoint**: Determinism is proven in Node, in three browser engines, and across frame rates.

---

## Phase 9: User Story 4 — inspect and tune the simulation (P2)

**Goal**: The debug overlay (`D`) and the dev-only in-memory tuning panel (`T`).

**Independent Test**:
- In `pnpm dev`, `D` toggles live values.
- `T` edits `SWAY_AMP_CAP`, and **Apply & restart** changes behavior and shows OVERRIDDEN.
- `git status` shows `packages/sim/src/tuning.ts` unchanged.
- The production bundle has no tuning panel.

### Tests for User Story 4 (write first; they must fail)

- [X] T082 [P] [US4] Write `apps/web/tests/unit/tuningPanelModel.test.ts` against a Phaser-free
  and DOM-free model in `apps/web/src/dev/tuningPanelModel.ts`.
  - It lists every `GlobalTuning` and `TypeTuning` field (22 + 4 × 8), and **excludes** all the
    fixed engine constants (data-model §1.3) (FR-038).
  - Text input is parsed as an integer. Non-integers are rejected with a message.
  - `apply()` runs `validateConfig` and surfaces `SimConfigError` messages.
  - `isOverridden` equals `!isDefaultTuning`.
  - `reset()` restores `cloneTuning(DEFAULT_TUNING)`.
  - `exportJson()` returns the complete tuning plus `TUNING_VERSION`.
  - The model never imports Node `fs` or makes network calls.

### Implementation for User Story 4

- [X] T083 [P] [US4] Implement `apps/web/src/dev/DebugOverlay.ts`, toggled with `D` (FR-037).
  **Labels come from `STRINGS` (T059).**
  - Shows the current tick, last offset ‰ (`lastOffset`), last tier, sway target and current
    amplitude, lean, crane speed ‰, sensitivity ‰, stabilizer ‰, combo, and fps from
    `game.loop.actualFps`.
  - **One reused text object per field**, created once. Each field keeps its last value and calls
    `setText` only when that value changes, at most 10 times per second (Principle VI).
  - Present in every Phase 1 build (accepted; PRD Phase 5 requires hiding it before public
    release).
- [X] T084 [US4] Implement `apps/web/src/dev/tuningPanelModel.ts` and
  `apps/web/src/dev/TuningPanel.ts`, the minimal plain-DOM dev tool allowed before Phase 3
  (constitution Principle III v1.2.0).
  - `TuningPanel.ts` is a plain DOM form with `id="skyline-tuning-panel"` and the marker
    `data-dev-tool="tuning-panel"`.
  - One labeled integer input per field, grouped Global / per type, with keyboard focus order.
  - Buttons: **Apply & restart** (restarts GameScene with the edited tuning, in memory only),
    **Reset to defaults**, and **Export JSON** (download as `tuning-<TUNING_VERSION>.json`).
  - An "OVERRIDDEN" label whenever the values differ from the defaults.
  - Its text may be written inline: dev-only tool text is exempt from `strings.ts` (plan.md,
    interpretations).
  - Load it only via `if (import.meta.env.DEV) { const m = await import('./dev/TuningPanel'); … }`
    from `apps/web/src/scenes/GameScene.ts` on key `T`.
- [X] T085 [US4] Write `scripts/check-prod-bundle.ts` and the root script `check:prod-bundle`.
  - After `pnpm --filter @skyline/web build`, fail if any file in `apps/web/dist/` contains
    `skyline-tuning-panel` or `tuning-panel`.
  - Add `pnpm --filter @skyline/web build && pnpm check:prod-bundle` to
    `.github/workflows/ci.yml` (FR-038).

**Checkpoint**: Developers can inspect and tune runs. Overrides stay in memory and never ship.

---

## Phase 10: User Story 5 — export a run for replay (P3)

**Goal**: Download the finished run as JSON with the full tuning and `tuningOverridden`, and
replay it from the command line.

**Independent Test**:
- After a run, press `E` to download `run-<type>-<seed>.json`.
- `pnpm --filter @skyline/sim replay <file>` prints a matching score, result and hash.
- An overridden run shows `tuningOverridden: true` and still replays.

### Tests for User Story 5 (write first; they must fail)

- [X] T086 [P] [US5] Write `apps/web/tests/unit/runExport.test.ts`.
  - `buildDownload(sim)` returns filename `run-<type>-<seed>.json` and JSON text equal to
    `createRunExport(sim)`, with `tuningOverridden` true for a sim created with modified tuning.
  - It is unavailable (returns null) before a result.
- [X] T087 [P] [US5] Write `scripts/tests/replay-run.test.ts`. Run `scripts/replay-run.ts` on
  each golden fixture and on a generated overridden-tuning export. Assert the output contains
  `MATCH` and exit code 0. A tampered hash gives `MISMATCH` and exit code 1.

### Implementation for User Story 5

- [X] T088 [US5] Implement `apps/web/src/export/runExport.ts`.
  - `buildDownload(sim)` uses `createRunExport`, and `triggerDownload({ filename, text })` uses a
    `Blob` and a temporary `<a download>`. There is no network call (Principle VII).
  - Bind key `E` in `apps/web/src/scenes/GameScene.ts`, active only after a result, in every
    build.
  - Show the "Run exported" text **from `STRINGS` (T059)** in the HUD banner.
- [X] T089 [US5] Implement `scripts/replay-run.ts`.
  - Read a JSON path, call `parseRunExport`, then `replay` using **the export's own tuning**
    (FR-050).
  - Print the result, score, floors, hash, tuningVersion, tuningOverridden, and `MATCH` or
    `MISMATCH`. Exit with code 1 on mismatch.
  - Add the script `"replay": "tsx ../../scripts/replay-run.ts"` to
    `packages/sim/package.json`. The script lives outside `src`, so the sim stays free of I/O.

**Checkpoint**: Every run can be exported and replayed exactly.

---

## Phase 11: Polish & cross-cutting concerns

**Purpose**: Performance tooling and measurement (SC-010), size budget, final validation
(SC-011) including the grayscale check, and documentation.

- [X] T090 [P] Implement `apps/web/src/dev/PerfCapture.ts` and `apps/web/src/dev/AutoBot.ts`.
  Include them only when `import.meta.env.DEV || __PERF_TOOLS__`.
  - `P` records 60 s of frame times into a preallocated `Float64Array(60 * 150)` and reports the
    average fps, the maximum frame ms, and the count of frames over 33 ms in an overlay. The
    report text may be written inline (dev-only tool text is exempt from `strings.ts`).
  - `B` toggles a bot that calls `requestDrop()` when the predicted landing offset is at most
    `PERFECT_MAX` from the run's tuning. It reads `craneX` and `swayS` from state and never
    writes state.
  - The URL parameter `?perf=luxury` starts a Luxury run with the bot on and begins the capture
    automatically once the tower passes 50 floors, showing the report on screen. This is for
    the touch-only iPhone 11. Ignore the parameter when the perf tools are not included
    ([contracts/controls.md](./contracts/controls.md)).
  - Add a CI step that runs `VITE_PERF_TOOLS=1 pnpm --filter @skyline/web build` to prove the
    flag builds.
- [X] T091 [P] Write `scripts/check-bundle-size.ts` and the root script `check:bundle-size`.
  - Sum the gzip-compressed size of every file in `apps/web/dist/` using Node `zlib`.
  - Print it, and fail above 5 MB (5,242,880 bytes) (Principle VI).
  - Add it to `.github/workflows/ci.yml` after the build.
- [X] T092 [P] Audit `apps/web/src/render/`, `apps/web/src/loop/`, `apps/web/src/hud/`,
  `apps/web/src/fx/` and `apps/web/src/dev/DebugOverlay.ts` for per-frame allocations: no object
  or array literals, closures, or string concatenation inside `update`/render paths. Also grep
  `apps/web/src/` (excluding `strings.ts` and the exempt dev-only tools `dev/TuningPanel.ts`,
  `dev/tuningPanelModel.ts`, `dev/PerfCapture.ts` and `dev/AutoBot.ts`) for user-facing
  string literals, and move any found into `strings.ts`. Record the findings in
  `specs/001-whitebox-core-loop/validation.md`.
- [ ] T093 Run the full [quickstart.md](./quickstart.md) validation map and record each SC-001 …
  SC-011 result in `specs/001-whitebox-core-loop/validation.md`. Include:
  - The manual playability checks with mouse, touch and Space (SC-011).
  - The Place Roof check (the button hides right after the press).
  - The export/replay and tuning-override checks.
  - **The grayscale check** (constitution Principle VII, quickstart step 7): screenshots of the
    selector and of a tower of each type with its roof, viewed in grayscale. All four types must
    be told apart by pattern, roof shape, icon and name alone. Save the screenshots next to
    `validation.md`.
- [ ] T094 Measure performance per [quickstart.md](./quickstart.md#performance-check-sc-010)
  using an optimized `VITE_PERF_TOOLS=1` build and `?perf=luxury`. Record device, OS and browser
  version, throttle setting and numbers in `specs/001-whitebox-core-loop/validation.md`
  (SC-010).
  - iPhone 11 in Safari: a 60-floor Luxury run averages ≥ 58 fps with no frame above 33 ms over
    60 s.
  - Desktop Chrome with DevTools CPU throttling at 4× (stand-in for a mid-range Android phone):
    the same targets.
  - Optional, only if a 120 Hz display is available: ≥ 110 fps average with 60 ticks per second.
    Otherwise record "not run; covered by SC-008".
  - If it fails, profile and fix in the render modules before closing the phase.
- [X] T095 [P] Update `README.md` with setup, scripts, and a link to
  [quickstart.md](./quickstart.md). **Keep** the Sync Impact Report comment in
  `.specify/memory/constitution.md`; it is the required change record.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T011 closes it (guards proven).
- **Foundational (Phase 2)**: depends on Phase 1. It blocks every story.
- **US1 sim (Phase 3)**: depends on Phase 2.
- **US3 sim (Phase 4)**: depends on Phase 3 (it extends `sim.ts`).
- **US2 sim + golden harness (Phase 5)**: depends on Phases 3–4 (the bot, all rules). It ends at
  the **SIM COMPLETE gate**, which includes the 3-browser golden replay.
- **US1 web (Phase 6)**: depends on the gate. This is the first Phaser work.
- **US3 web (Phase 7)**: depends on Phase 6.
- **US2 web (Phase 8)**: depends on Phase 6 (FixedStepLoop). It can run in parallel with Phase 7.
- **US4 (Phase 9)**: depends on Phase 6. It can run in parallel with Phases 7–8.
- **US5 (Phase 10)**: T089 (CLI) depends only on Phase 5. T088 depends on Phase 6.
- **Polish (Phase 11)**: depends on all story phases.

### User Story Dependencies

```text
Setup → Foundational → US1-sim → US3-sim → US2-sim (+ golden-harness) ══ SIM COMPLETE ══►
    US1-web ──► US3-web
       ├──────► US2-web
       ├──────► US4
       └──────► US5 ──► Polish
```

### Within each phase

- Test tasks come first and must fail, then the implementation tasks make them pass.
- `types.ts` → `fixed`/`prng`/`sinLut`/`tuning` → `config`/`hash` → `crane`/`sway`/`landing` →
  `sim` → `replay`/`export` → golden fixtures → golden harness.
- The test helpers (T026 snapshot, T027 bot) are written before `sim.ts` and compile against the
  planned `restoreSim` signature. They go green together with T037.
- Every task ends with `pnpm lint && pnpm check:sim-purity` still green.

### Parallel Opportunities

- Phase 1: T002, T003 in parallel; T008, T009 in parallel after T006 and T007.
- Phase 2: T013/T014, T015/T016, T017/T018, T019, T021, T022 and T024 are in separate files and
  can run in parallel. T020 → T023 → T025 run in sequence.
- Phase 3: all tests T026–T033 in parallel; then T034, T035 and T036 in parallel; then T037 →
  T038.
- Phase 4: T039–T042 in parallel.
- Phase 5: T045–T048 in parallel. T053 → T054 → T055 run in sequence after T052.
- Phase 6: T058 and T059 in parallel with T061 and T062 (T060 follows T058); then T063–T065 and T069–T073 in
  parallel.
- After Phase 6: Phases 7, 8 and 9 in parallel.

---

## Parallel Example: User Story 1 (sim half)

```bash
# Tests and test helpers first, all in parallel:
Task: "Write snapshot helper in packages/sim/tests/helpers/snapshot.ts"
Task: "Write bot helper in packages/sim/tests/helpers/bot.ts"
Task: "Write crane tests in packages/sim/tests/unit/crane.test.ts"
Task: "Write tier boundary tests in packages/sim/tests/unit/tiers.test.ts"
Task: "Write sway tests in packages/sim/tests/unit/sway.test.ts"
Task: "Write landing tests in packages/sim/tests/unit/landing.test.ts"
Task: "Write tick pipeline tests in packages/sim/tests/unit/sim-flow.test.ts"
Task: "Write end-to-end cap roll-up in packages/sim/tests/unit/caps.test.ts"

# Then the three rule modules in parallel:
Task: "Implement packages/sim/src/crane.ts"
Task: "Implement packages/sim/src/sway.ts"
Task: "Implement packages/sim/src/landing.ts"
```

## Parallel Example: User Story 1 (web half)

```bash
Task: "Create apps/web/src/strings.ts"
Task: "Create apps/web/src/render/typeArt.ts"
Task: "Implement apps/web/src/loop/FixedStepLoop.ts"
Task: "Implement apps/web/src/input/InputController.ts"
Task: "Implement apps/web/src/fx/MissFx.ts"
Task: "Implement apps/web/src/hud/Hud.ts"
```

---

## Implementation Strategy

### Simulation first (required order)

1. Phase 1: workspace, **forbidden-API guards (ESLint + purity script) and CI**.
2. Phase 2: sim foundations.
3. Phases 3–5: every sim rule, replay, fuzz and golden (Node), plus the Phaser-free golden harness
   in chromium, webkit and firefox.
4. **Stop at SIM COMPLETE and validate**: `pnpm ci` and the `golden-browsers` job are green, and
   coverage is ≥ 90%.

### MVP (User Story 1)

5. Phase 6: a playable Residential tower in the browser. **Stop and validate** by playing a full
   tower with mouse, touch and Space.

### Incremental delivery

6. Then, in order:
   - Phase 7: all types, Place Roof, Quick Play.
   - Phase 8: frame-rate independence.
   - Phase 9: dev tools.
   - Phase 10: export and replay CLI.
   - Phase 11: performance on devices, size budget, grayscale check, final validation.
7. Phase 1 (of the PRD) is complete only when all 11 success criteria are recorded as passing in
   `validation.md`.

---

## Notes

- [P] tasks touch different files and have no unfinished dependencies.
- Gameplay numbers appear only in `packages/sim/src/tuning.ts` (Principle V). Web styling values
  live in `renderConfig.ts`, and user-facing text lives in `strings.ts`.
- Any change to `DEFAULT_TUNING` bumps `TUNING_VERSION` and runs `pnpm golden:regen` in the same
  commit.
- Any change to state fields or hash order bumps `SIM_VERSION` and regenerates the fixtures.
- Commit after each task or logical group, and stop at any checkpoint to validate.

### Task ID mapping (revision 2026-09-27)

| Old | New | Old | New | Old | New |
| --- | --- | --- | --- | --- | --- |
| T001–T025 | unchanged | T044–T047 | T045–T048 | T063–T065 | T069–T071 |
| — | T026 (new: snapshot helper) | T048 | T049 | T066 | T072 |
| T026 | T027 | T049 | T050 | T067 | T073 |
| T027–T031 | T028–T032 | T050 | T051 | T068 | T074 |
| T032 | T033 | T051 | T052 | T069 | T075 |
| T033–T035 | T034–T036 | — | T053–T055 (new: golden harness, spec, CI job) | T070–T071 | T076–T077 |
| T036 | T037 | T052 | T056 | T072–T074 | T078–T080 |
| T037 | T038 | T053 | T057 | T075 | T081 |
| T038–T041 | T039–T042 | T054 (main.ts) | T060 | T076–T077 | removed (moved to T053–T055) |
| T042–T043 | T043–T044 | — | T058 (new: typeArt.ts), T059 (new: strings.ts) | T078–T081 | T082–T085 |
| | | T055–T062 | T061–T068 | T082–T091 | T086–T095 |

---

## Phase 12: Convergence

**Purpose**: Remediation found by `/speckit-converge` after auditing the implemented code against
spec.md, plan.md, the existing tasks, and the constitution. This phase does not re-list Phase
7–11 work (T076–T095), which is already tracked.

- [X] T096 Remove the dead `blockHeightPx` private field in `apps/web/src/scenes/GameScene.ts`
  (declared at line 52, reassigned at line 72 from a duplicated `90` px magic number) — it is
  never read; every real call site already uses `this.towerRenderer.blockHeightPx`, which is
  correctly sourced from `renderConfig.BASE_BLOCK_HEIGHT_PX` and the run's
  `blockVisualHeight` tuning. Delete the field and its assignment per plan.md's `apps/web`
  render config decision (renderConfig.ts as the single source of styling constants)
  (contradicts).

---

## Phase 13: Convergence

**Purpose**: Remediation found by a second `/speckit-converge` pass, run after Phases 6–8
(T057–T081) were implemented. This phase does not re-list T096 above, which remains outstanding
from the prior pass.

- [X] T097 Document the `Esc` key in
  [contracts/controls.md](./contracts/controls.md)'s "Gameplay input" table: pressing `Esc` in
  `GameScene` returns to the run selector at any time (`apps/web/src/scenes/GameScene.ts`,
  `keydown-ESC` → `returnToSelect()`), implemented per T078 ("return to it with Esc or after the
  result banner"), but the committed control contract has no row for it. Add a row documenting
  this control so the contract matches the implemented behavior (partial).

---

## Phase 14: Convergence

**Purpose**: Remediation found by a third `/speckit-converge` pass, run after Phases 9–10
(T082–T089) were implemented. This phase does not re-list the still-open T090–T097.

- [X] T098 Strengthen the overridden-tuning case in `scripts/tests/replay-run.test.ts` so it
  proves the export's own tuning is used: assert the output contains `tuningOverridden: true`,
  override a value that always changes the hash (for example the type's `cranePeriodTicks` or
  `swayMult`) instead of only `LIVES`, and assert that `replay` with `DEFAULT_TUNING` gives a
  different hash for that export. Also remove the `mkdtempSync` temp directory in an `afterAll`
  per FR-050, US5/AC1 (partial)
- [X] T099 Fix the run-as-main guard in `scripts/replay-run.ts`: it compares `import.meta.url` to
  `` `file://${process.argv[1]}` ``, which fails for paths with spaces, other percent-encoded
  characters, or symlinks, so the CLI then prints nothing and exits 0. Compare
  `fileURLToPath(import.meta.url)` with `realpathSync(process.argv[1])` instead, and add a test
  that runs the script through a path that needs encoding, per T089 (partial)
- [X] T100 Stop allocating a new `DebugSnapshot` object every frame: `GameScene.update` calls
  `readDebugSnapshot(...)`, which returns a fresh object literal each frame even while the overlay
  is hidden. Fill a preallocated snapshot in place, and skip the read while the overlay is hidden,
  per plan: "No per-frame allocations in the render loop" (Principle VI) (contradicts)
- [X] T101 Add a case to `scripts/tests/replay-run.test.ts` where an export's `tuningVersion`
  differs from the current `TUNING_VERSION`, and assert that it still replays with `MATCH` and
  exit code 0, per FR-050 (partial)
- [X] T102 Show the debug overlay's last tier as a name (none / Perfect / Good / Miss) from
  `STRINGS` in `apps/web/src/dev/DebugOverlay.ts`, not the raw `TIER_*` integer code, per FR-037
  (partial)
- [X] T103 Make `scripts/replay-run.ts` report a missing, unreadable or malformed file (and a
  `ReplayError`) as a one-line error with exit code 1 instead of an uncaught stack trace. Resolve a
  relative path against the directory the user ran the command from (`INIT_CWD` when run through
  `pnpm --filter`, which runs in `packages/sim`), per T089 and quickstart step 5 (partial)
