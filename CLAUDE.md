# Skyline Stacker

pnpm workspace built with GitHub Spec Kit. The constitution (`.specify/memory/constitution.md`) governs all work; the current feature is in `.specify/feature.json`.

## Layout

- `packages/sim` — deterministic simulation (pure; no rendering, DOM, or wall-clock access)
- `apps/web` — Phaser web app (presentation and input)
- `scripts/` — repo checks (e.g. sim purity)
- `specs/<feature>/` — Spec Kit artifacts

## Verification command

```bash
pnpm run ci
```

Runs typecheck, lint, format check, sim-purity check, and tests. A task is not done until this passes. Use `pnpm format` to fix formatting failures.

## Rules to watch closely

- Determinism (Principle I): all game rules live in `packages/sim`; state is safe integers only, divisions truncated, fixed 60 Hz ticks, zero runtime dependencies.
- Sim/UI separation (Principles II–III): sim code must not import from `apps/web`; dev-only tools must stay out of production builds.
- Test-first core logic (Principle IV).
- Tuning (Principle V): defaults live in `packages/sim/src/tuning.ts`; sim code reads gameplay numbers only from the tuning object in its config.
