# Quickstart & Validation: Phase 1 — Deterministic Whitebox Core Loop

How to run the Phase 1 build and prove each success criterion. Interfaces are in
[contracts/](./contracts/) and state details in [data-model.md](./data-model.md).

## Prerequisites

- Node.js 22 LTS and pnpm 12 (`corepack enable` picks up the pinned version).
- Playwright browsers: `pnpm exec playwright install --with-deps chromium webkit firefox`.
- For SC-010: a Pixel 6a–class Android phone with Chrome and USB debugging, and a 120 Hz display.

## Setup and run

```bash
pnpm install
```

```bash
pnpm dev
```

This opens the Vite dev server for `apps/web`. Press `1` to start a Residential run and `Space` to
drop. `D` toggles the debug overlay, and `T` opens the tuning panel (dev only).

```bash
pnpm build && pnpm --filter @skyline/web preview
```

The production build must not contain the tuning panel. Check that `T` does nothing in preview.

## Validation map

| Criterion | Command / procedure | Expected outcome |
| --- | --- | --- |
| SC-001 isolation + forbidden APIs | `pnpm lint` and `pnpm check:sim-purity` | Both pass. Adding `Math.random()` to any file in `packages/sim/src` makes **both** fail |
| SC-002 fuzz | `pnpm --filter @skyline/sim test:fuzz` | 10,000 runs, 0 exceptions, all values safe integers |
| SC-003 sine table | `pnpm --filter @skyline/sim test -- sinLut` and `pnpm gen:sin-lut && git diff --exit-code` | 4096 entries in range, checksum matches, regenerated file identical |
| SC-004 tiers | `pnpm --filter @skyline/sim test -- tiers` | ±0, ±50 Perfect; ±51, ±250 Good; ±251 Miss |
| SC-005 caps | `pnpm --filter @skyline/sim test -- caps` | All five caps hold |
| SC-006 rules | `pnpm --filter @skyline/sim test -- rules` | All seven rules pass |
| SC-007 determinism (Node) | `pnpm --filter @skyline/sim test -- golden` | Every fixture matches its score and hash; 1,000 replays give one hash |
| SC-007 determinism (browsers) | `pnpm --filter @skyline/web test:e2e -- golden` | Same results in chromium, webkit and firefox projects |
| SC-008 frame-rate independence | `pnpm --filter @skyline/web test -- loop` | 30/60/120/144 Hz give identical logs and hashes |
| SC-009 input latency | `pnpm --filter @skyline/web test -- input` | Injected drop applied on tick + 1 |
| Coverage (Principle IV) | `pnpm --filter @skyline/sim test:coverage` | Lines ≥ 90% |
| All CI gates | `pnpm ci` | typecheck, lint, format check, purity, unit/fuzz/golden, coverage |

## Manual playability check (SC-011)

Run `pnpm dev`, then:

1. **Residential completed run**: press `1`, play to 30 floors and land the roof, using the mouse
   for some drops, `Space` for others, and touch (a phone on the LAN via `pnpm dev --host`).
   - Expect result **Completed**.
   - Expect score = floor population + 20%, truncated.
2. **Game over run**: start any type and miss three times.
   - Expect each miss to slide off the tower.
   - Expect the third miss to collapse the visible tower and show **Game Over**.
3. **Quick Play run**: press `5` and play until three strikes.
   - Expect no roof and no Place Roof button.
4. **Place Roof**: in a Commercial run, reach 20 floors and press Place Roof with the pointer.
   - Expect only one `roof` entry in the exported log for that press, and no drop.
   - Expect the block to become the roof and keep swinging.
5. **Export and replay**: after a run, press `E` and run
   `pnpm --filter @skyline/sim replay <file>`.
   - Expect the printed score, result and hash to match the file.
6. **Tuning override**: open the tuning panel with `T`, change `SWAY_AMP_CAP`, press
   **Apply & restart**, finish the run and export it.
   - Expect `tuningOverridden: true` and the edited value in `config.tuning`.
   - Expect the replay to still match.
   - Expect `git status` to show `tuning.ts` unchanged.

## Performance check (SC-010)

1. Make a production build with the perf tools switched on, and serve it on the LAN:
   `VITE_PERF_TOOLS=1 pnpm build && pnpm --filter @skyline/web preview --host`. This keeps the
   optimized bundle but includes the bot and perf capture. The tuning panel stays excluded.
2. On the Pixel 6a–class phone, open the game and press `4` (Luxury). Press `B` for the auto-drop
   bot, then press `P` for a 60-second capture once the tower passes 50 floors.
3. **Pass**: average ≥ 58 fps and no frame above 33 ms. Repeat on the 120 Hz display. **Pass**:
   average ≥ 110 fps, with the debug overlay still showing 60 ticks per second.
4. Record the results (device, browser version, numbers) in the phase completion notes.

## Regenerating golden fixtures

Only when `TUNING_VERSION` changes (Principle V):

```bash
pnpm golden:regen
```

Commit the regenerated fixtures in the same change as the tuning bump.
