# Skyline Stacker

A 2.5D crane tower-stacking web game with a city-building meta-game, built as a pnpm workspace
with [GitHub Spec Kit](https://github.com/github/spec-kit).

- `docs/PRD.md` is the source of truth for features, numbers, and phases.
- `.specify/memory/constitution.md` defines the non-negotiable engineering principles (determinism,
  sim/UI separation, test-first core logic, single source of tuning, performance budgets,
  accessibility, phased delivery, code standards) that every spec, plan, and task must follow.
- `.specify/feature.json` points at the current feature's Spec Kit artifacts under `specs/`.

## Layout

- `packages/sim` — deterministic simulation (pure TypeScript, zero runtime dependencies; no
  rendering, DOM, or wall-clock access)
- `apps/web` — Phaser web app (presentation and input)
- `scripts/` — repo-wide checks and tools (sim purity, production bundle, bundle size, golden
  fixture generation, run replay)
- `specs/<feature>/` — Spec Kit artifacts (spec, plan, tasks, contracts, quickstart, validation)
  for each feature

## Setup

Requires Node ≥ 22 and pnpm (the pinned version is set via `packageManager`; run `corepack
enable` once to get it automatically).

```bash
pnpm install
```

## Common scripts

Run these from the repository root.

| Command                  | What it does                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run ci`            | Full verification: typecheck, lint, format check, sim-purity check, and tests. A change is not done until this passes.                                                                      |
| `pnpm typecheck`         | TypeScript project-wide type check.                                                                                                                                                         |
| `pnpm lint`              | ESLint over the whole repo.                                                                                                                                                                 |
| `pnpm format`            | Formats the repo with Prettier (fixes `format:check` failures).                                                                                                                             |
| `pnpm format:check`      | Prettier check only, no writes.                                                                                                                                                             |
| `pnpm test`              | Runs the Vitest suites.                                                                                                                                                                     |
| `pnpm check:sim-purity`  | Enforces `packages/sim`'s determinism rules (Principle I): forbidden APIs, non-integer literals, zero runtime dependencies.                                                                 |
| `pnpm check:prod-bundle` | Fails if a production `apps/web` build contains dev-only tuning-panel markers.                                                                                                              |
| `pnpm check:bundle-size` | Sums the gzip size of `apps/web/dist` and fails above the 5 MB budget (Principle VI). Run it against a **plain** production build, before any `VITE_PERF_TOOLS=1` build overwrites `dist/`. |
| `pnpm gen:sin-lut`       | Regenerates the committed `SIN_LUT` trig table used by `packages/sim`.                                                                                                                      |
| `pnpm golden:regen`      | Regenerates the golden replay fixtures (after a tuning change; bump `TUNING_VERSION` first).                                                                                                |

Package-scoped scripts (run with `pnpm --filter <package> <script>`, or `cd` into the package):

| Package        | Script          | What it does                                                                           |
| -------------- | --------------- | -------------------------------------------------------------------------------------- |
| `@skyline/web` | `dev`           | Starts the Vite dev server.                                                            |
| `@skyline/web` | `build`         | Production build to `apps/web/dist`.                                                   |
| `@skyline/web` | `preview`       | Serves the production build locally.                                                   |
| `@skyline/web` | `test:e2e`      | Playwright end-to-end tests.                                                           |
| `@skyline/sim` | `test:coverage` | Vitest with the ≥90% coverage threshold (Principle IV).                                |
| `@skyline/sim` | `test:fuzz`     | The integer-safety fuzz test across all tower types and Quick Play.                    |
| `@skyline/sim` | `replay`        | Replays an exported run JSON (`scripts/replay-run.ts`) and reports `MATCH`/`MISMATCH`. |

## Developer tools (in-game)

Phase 1 ships a few dev-only, keyboard-driven tools alongside the game canvas; see
[`specs/001-whitebox-core-loop/contracts/controls.md`](specs/001-whitebox-core-loop/contracts/controls.md)
for the full control reference, including the debug overlay (`D`), run export (`E`), the tuning
panel (`T`, development builds only), and the perf-capture tooling (`P` / `B` /
`?perf=luxury`, development or `VITE_PERF_TOOLS=1` builds).

## Validating a feature

Each feature under `specs/<feature>/` carries its own `quickstart.md` validation map (manual
playability, export/replay, tuning overrides, the grayscale accessibility check, and performance
measurement against the Principle VI budgets). Results are recorded in that feature's
`validation.md`. For the current feature, see
[`specs/001-whitebox-core-loop/quickstart.md`](specs/001-whitebox-core-loop/quickstart.md).
