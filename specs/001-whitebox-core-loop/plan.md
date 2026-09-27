# Implementation Plan: Phase 1 — Deterministic Whitebox Core Loop

**Branch**: `001-whitebox-core-loop` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-whitebox-core-loop/spec.md`

## Summary

Build the playable, deterministic stacking loop for all four tower types and Quick Play as a
whitebox web game. The work has two parts:

- `packages/sim`: an integer-only, zero-dependency TypeScript simulation. It implements PRD §3–§5
  with a fixed 60 Hz tick, a committed Q15 sine table, mulberry32, a tick-based input log,
  `replay` and an FNV-1a state hash. It receives its complete tuning values through `SimConfig`.
- `apps/web`: a Vite + Phaser 4 renderer that only reads sim state. It covers interpolation,
  camera and culling, visual-only Matter.js miss and collapse effects, a canvas HUD, and the
  developer tools.

Correctness is proven by Vitest unit, fuzz and golden tests, and by Playwright replays in
Chromium, WebKit and Firefox.

## Technical Context

**Language/Version**: TypeScript 6.0.x, `strict` (pinned below 6.1 for typescript-eslint; research R1), Node.js 22 LTS

**Primary Dependencies**: Phaser 4.2.x (only runtime dependency, `apps/web`; includes Matter.js). `packages/sim` has none. Dev: Vite 8, Vitest 5 + coverage-v8, Playwright 1.63, ESLint 10 + typescript-eslint 8.70, Prettier 3.9, tsx 4

**Storage**: None. There are no save files in Phase 1. Run exports are downloaded JSON files, and golden fixtures are committed JSON.

**Testing**: Vitest (unit, rules, caps, tiers, fuzz, golden, loop, input) in Node; Playwright (golden replay and playability smoke tests) in chromium, webkit and firefox

**Target Platform**: Browsers (last 2 versions of Chrome, Edge and Firefox; Safari / iOS Safari 16+). The sim also runs in Node 22.

**Project Type**: pnpm workspaces monorepo: a pure library (`packages/sim`) and a browser game app (`apps/web`)

**Performance Goals**:
- 60 fps sustained (≥ 58 average, no frame above 33 ms) on an iPhone 11 in Safari and on
  desktop Chrome with 4× CPU throttling (the stand-in for a mid-range Android phone).
- Render at display rate with the sim fixed at 60 ticks per second. The 120 Hz hardware check
  (≥ 110 fps) is optional, when a 120 Hz display is available; SC-008 covers frame-rate
  independence automatically.
- At most 5 ticks per frame.

**Constraints**:
- Integer-only sim state and no forbidden APIs in the sim (Principle I).
- No per-frame allocations in the render loop.
- Initial download ≤ 5 MB compressed.
- No Vue, Pinia, NestJS or Capacitor.
- No analytics or network calls.

**Scale/Scope**:
- 4 tower types plus Quick Play; towers up to 60 floors; Quick Play unbounded.
- About 10 sim modules and about 15 web modules.
- 4 golden fixtures and 10,000 fuzz runs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.2.0. **Result: PASS** (initial and post-design, re-checked after the v1.2.0
amendment on 2026-09-27). The notes below record interpretations and resolved items.

| Principle | Status | How this plan complies |
| --- | --- | --- |
| I. Deterministic Simulation | ✅ | All rules are in `packages/sim` with zero runtime deps. Integers only, and division only via `div()` (R3). 60 Hz tick with inputs logged by tick (R6). Committed LUT with checksum and regeneration check (R5); mulberry32. ESLint rules **and** an independent `check-sim-purity` script (R4). Cross-engine golden replay (R14) |
| II. Sim authoritative | ✅ | Sway is the shear model; no rigid bodies for the standing tower. Phaser only reads state; `FixedStepLoop` interpolates into render-only snapshots (R8). Matter.js only for miss and collapse bodies, never read back. Culling is render-only |
| III. UI / engine separation | ✅ | Pre-Phase-3 rule (v1.2.0): player-facing UI (HUD, selector, Place Roof) is drawn in the canvas; the dev-only tuning panel is minimal plain DOM, excluded from production builds (checked in CI) and replaced with Vue in Phase 3. No event bus or Pinia yet |
| IV. Test-first | ✅ | Unit tests for every rule, cap and tier boundary; ≥ 90% line coverage gate; 4 golden fixtures (3 required) in Node and 3 browsers, with the browser replay in CI from the sim phases onward via `packages/golden-harness`; 10k fuzz (R15). **Cross-browser golden gate**: it applies from T055 onward, the first point where fixtures (T051) and the browser job (T055) both exist; before that there is nothing to replay |
| V. Single source of tuning | ✅ | `DEFAULT_TUNING` + `TUNING_VERSION` in `tuning.ts`; `SimConfig.tuning` is required and complete (R10). The panel is in-memory and dev-only. Exports carry full tuning plus `tuningOverridden`. Fixtures must deep-equal the defaults (R13). Colors are styling in `renderConfig.ts` |
| VI. Performance | ✅ | Pooled images; reused event array (R12); preallocated snapshots and perf buffer; accumulator capped at 5 ticks; debug overlay reuses text objects. Measured on the v1.2.0 devices: iPhone 11 (Safari) and desktop Chrome at 4× CPU throttling; 120 Hz check only if a display is available; SC-008 covers frame-rate independence. The real Android check is a Phase 5 item (R16) |
| VII. Accessibility | ✅ | Each type has a distinct whitebox pattern, roof top shape, icon and text label (not color alone), confirmed by a grayscale check. All user-facing text comes from `strings.ts`, including the debug overlay. **Exempt**: text in the dev-only tools (tuning panel, perf report), because they are excluded from production builds and replaced in Phase 3. Selector is keyboard-navigable with a visible focus ring. HUD text on a dark backing (AA). No analytics; exports are local downloads. Reduced Motion has nothing to disable yet (no cosmetic motion in Phase 1) |
| VIII. Phased delivery | ✅ | Only Phase 1 scope; no `apps/api`, Vue or Capacitor. The only runtime dependency is Phaser (PRD §8.1). Dev tool deps are justified below |
| IX. Code standards | ✅ | Strict TS, ESLint + Prettier in CI, pnpm workspaces. `packages/golden-harness` is **not** a constitution exception: Principle IX names the required packages but does not forbid test-only ones. TSDoc with units on every sim export and on `FixedStepLoop`. Tweens and generated textures only; no Spine |

**Dependency justification (Principle VIII)**: `phaser` is the renderer named in PRD §8.1.
`vite`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `eslint`, `typescript-eslint`,
`eslint-config-prettier`, `prettier` and `typescript` are the tools the constitution and PRD name.
`tsx` runs the TypeScript scripts (`gen-sin-lut`, `gen-golden`, `check-sim-purity`) without a
build step; the alternative, compiling scripts with `tsc` first, adds a build stage. No other
packages are added.

**Items raised under Governance rule 2 (all resolved 2026-09-27):**

1. **PRD §8.3 API extensions**: `SimConfig.tuning`, `RunResult` / `getResult()`,
   `land.roof`, `finished` / `gameOver.floors`, `SIM_VERSION`, `DEFAULT_TUNING`,
   `isDefaultTuning`, `SimConfigError` / `ReplayError`, and the reused `step()` array.
   **Resolved**: PRD §8.3 was updated to match [contracts/sim-api.md](./contracts/sim-api.md).
2. **FR-038 "every tuning value"**: **Resolved**. The fixed engine constants (data-model §1.3)
   cannot be edited. The spec (FR-038, User Story 4) and the PRD's Phase 1 scope now say "every
   tuning value except the fixed engine constants (data-model §1.3)".
3. **Dev tools in non-dev builds**: **Accepted for Phase 1**. The debug overlay and run export
   are in every Phase 1 build, and only the tuning panel is dev-only. PRD §12 Phase 5 now
   requires the debug overlay to be disabled or hidden in public production builds before
   release. Run export may stay.
4. **Reference devices vs. constitution Principle VI**: no Android phone is available. SC-010
   uses an iPhone 11 (Safari) and desktop Chrome at 4× CPU throttling, and the 120 Hz check is
   optional. **Resolved** by constitution v1.2.0, which adopts these devices and requires a real
   Android check before public release (PRD §12 Phase 5).

**Interpretations recorded 2026-09-27 (not exceptions):**

- **Dev-only tool text**: text in the dev-only tools (the tuning panel and the perf report) is
  exempt from `strings.ts`. These tools are excluded from production builds and replaced in
  Phase 3, so their text is never player-facing. The debug overlay is in every Phase 1 build, so
  it keeps using `STRINGS`.
- **Cross-browser golden gate timing**: the quality gate "cross-browser golden replays MUST pass
  before any change to `packages/sim` is merged" applies from **T055** onward. Before T051 there
  are no fixtures to replay, and T055 is the CI job that runs them.
- **`packages/golden-harness`**: not a constitution exception (see Structure Decision).

## Project Structure

### Documentation (this feature)

```text
specs/001-whitebox-core-loop/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R16
├── data-model.md        # Phase 1: tuning, config, state, tick pipeline, exports
├── quickstart.md        # Phase 1: run and validation guide
├── contracts/
│   ├── sim-api.md               # @skyline/sim public API (PRD §8.3 + extensions)
│   ├── run-export.schema.json   # Run export / golden fixture JSON Schema
│   └── controls.md              # Input, selector, HUD and dev tool contract
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
package.json                 # workspace root: scripts (dev, build, lint, format, typecheck,
                             #   test, check:sim-purity, gen:sin-lut, golden:regen, ci)
pnpm-workspace.yaml          # packages/*, apps/*
tsconfig.base.json           # strict settings shared by all packages
eslint.config.js             # flat config; sim-scoped restriction block (R4)
.prettierrc
.github/workflows/ci.yml     # install → typecheck → lint → format:check → check:sim-purity →
                             #   gen:sin-lut + git diff → test (coverage) → playwright (3 browsers)

scripts/
├── gen-sin-lut.ts           # writes packages/sim/src/sinLut.ts (R5)
├── gen-golden.ts            # bot-driven fixture generator (R13)
└── check-sim-purity.ts      # regex scan + zero-dependency check (R4)

packages/sim/                # @skyline/sim — zero runtime dependencies
├── package.json             # no "dependencies"; exports ./src/index.ts (ESM)
├── src/
│   ├── index.ts             # public API (contracts/sim-api.md)
│   ├── types.ts             # TowerType, Mode, SimConfig, SimState, SimEvent, RunResult
│   ├── tuning.ts            # DEFAULT_TUNING, TUNING_VERSION, fixed engine constants
│   ├── config.ts            # validateConfig, isDefaultTuning, cloneTuning, SimConfigError
│   ├── version.ts           # SIM_VERSION
│   ├── fixed.ts             # div(), uint32 helpers — the only file allowed to use "/"
│   ├── sinLut.ts            # GENERATED 4096-entry Q15 table + checksum
│   ├── prng.ts              # mulberry32
│   ├── crane.ts             # spawn, speed, increment, crane offset
│   ├── sway.ts              # phase, smoothing, S, target amplitude, lean, floorDisplayX
│   ├── landing.ts           # tier classification, scoring, combo, stabilizer, roof, result
│   ├── sim.ts               # createSim: state init, tick pipeline (data-model §4)
│   ├── replay.ts            # replay(), ReplayError
│   ├── export.ts            # RunExport type, createRunExport, parseRunExport (pure, no I/O)
│   └── hash.ts              # hashState (R11)
└── tests/
    ├── helpers/
    │   ├── snapshot.ts      # test-only snapshot/restore (uses internal restoreSim; not public)
    │   └── bot.ts           # scripted tier bot used by tests and gen-golden
    ├── unit/                # sinLut, prng, fixed, tiers, caps, rules, crane, sway, landing,
    │                        #   roof, result, config, hash, latency, finality, assist, export
    ├── fuzz/                # fuzz-1..5.test.ts (2,000 runs each, R15)
    └── golden/
        ├── golden.test.ts   # score + hash + default-tuning assertions; 1,000× replay
        └── fixtures/        # completed-residential, early-roof-commercial,
                             #   game-over-luxury, quick-play (.json)

packages/golden-harness/     # @skyline/golden-harness — private, test-only, Vite + Playwright,
│                            #   no Phaser (R14). Replays the golden fixtures in 3 browsers.
├── package.json             # deps: @skyline/sim (workspace); devDeps: vite, @playwright/test
├── index.html + src/main.ts # replays every fixture, sets window.__goldenResults
├── vite.config.ts
├── playwright.config.ts     # webServer = vite on port 5174; chromium, webkit, firefox
└── tests/golden.spec.ts     # SC-007 in browsers

apps/web/                    # @skyline/web — Vite + Phaser 4 only
├── package.json             # dependencies: phaser, @skyline/sim (workspace)
├── index.html
├── vite.config.ts           # single input (index.html)
├── playwright.config.ts     # webServer = vite dev; projects chromium, webkit, firefox
├── src/
│   ├── main.ts              # Phaser game config (WebGL, Canvas fallback, 720×1280, FIT)
│   ├── strings.ts           # every user-facing text (Principle VII: externalized strings)
│   ├── scenes/
│   │   ├── BootScene.ts     # generate whitebox textures (particles; calls typeArt)
│   │   ├── SelectScene.ts   # run selector (contracts/controls.md)
│   │   └── GameScene.ts     # wires sim, loop, renderers, input, HUD, fx, dev tools
│   ├── loop/FixedStepLoop.ts        # accumulator + interpolation snapshot (R8), Phaser-free
│   ├── input/InputController.ts     # pointer + Space, repeat filter, roof guard (R9)
│   ├── render/
│   │   ├── renderConfig.ts  # px per su, base block px, type colors, smoothing (styling)
│   │   ├── typeArt.ts       # per-type whitebox pattern, roof top shape and icon textures
│   │   ├── TowerRenderer.ts # FloorPool, culling, tilt
│   │   ├── CraneRenderer.ts # hook, swinging and falling block (quadratic ease-in)
│   │   └── CameraRig.ts     # hook clearance, vertical pan, horizontal follow
│   ├── fx/
│   │   ├── MissFx.ts        # Matter slide-off body
│   │   ├── CollapseFx.ts    # Matter bodies for visible floors
│   │   └── Particles.ts     # dust, sparks, debris
│   ├── hud/Hud.ts           # canvas HUD + Place Roof button
│   ├── lifecycle/visibility.ts      # auto-pause, accumulator reset
│   ├── export/runExport.ts  # build RunExport (tuningOverridden) + download
│   └── dev/
│       ├── DebugOverlay.ts
│       ├── TuningPanel.ts   # DOM, dynamic import, DEV only
│       ├── PerfCapture.ts   # DEV or VITE_PERF_TOOLS
│       └── AutoBot.ts       # DEV or VITE_PERF_TOOLS
└── tests/
    ├── unit/                # FixedStepLoop, loop-framerate (SC-008), InputController (SC-009,
    │                        #   FR-051), runExport, tuningPanelModel
    └── e2e/                 # playability.spec.ts (Space, pointer, touch), place-roof.spec.ts
```

**Structure Decision**: This is the PRD §8.2 pnpm workspaces layout, limited to Phase 1:
`packages/sim`, `apps/web` and `scripts/`, plus the test-only `packages/golden-harness`.
`apps/api` is not created (Principle VIII).

- All game rules are in `packages/sim`. `apps/web` imports only its public API.
- Phaser-free web modules (`FixedStepLoop`, `InputController` logic, `runExport`) are split out so
  the headless tests for SC-008 and SC-009 can run in Node.
- The cross-browser golden replay lives in its own Vite-only package, so it runs in CI during the
  sim phases, before any Phaser code exists (constitution quality gate on cross-browser replays).
  A harness page inside `apps/web` would need `apps/web` and Phaser before the SIM COMPLETE gate,
  and Vitest browser mode would add a second browser-test setup next to Playwright.
  `packages/golden-harness` is test-only and never shipped. It is **not** a constitution
  exception, because Principle IX names the required packages but does not forbid test-only ones.

## Complexity Tracking

No constitution violations or exceptions. Nothing to justify.
