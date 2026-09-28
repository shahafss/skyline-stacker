# Validation — 001-whitebox-core-loop

This file records the Phase 11 polish/validation results (SC-010, SC-011). Each task appends its
own section; sections are added in task order and are never retroactively rewritten by a later
task, only appended to.

## Audit (T092)

**Scope**: `apps/web/src/render/`, `apps/web/src/loop/`, `apps/web/src/hud/`, `apps/web/src/fx/`,
and `apps/web/src/dev/DebugOverlay.ts` for per-frame allocations (object/array literals, closures,
or string concatenation inside `update`/render paths); plus a repo-wide grep of `apps/web/src/`
(excluding `strings.ts` and the exempt dev-only tools `dev/TuningPanel.ts`,
`dev/tuningPanelModel.ts`, `dev/PerfCapture.ts` and `dev/AutoBot.ts`) for user-facing string
literals that should live in `strings.ts`.

### Per-frame allocation audit

Files read in full: `render/TowerRenderer.ts`, `render/CraneRenderer.ts`, `render/CameraRig.ts`,
`render/renderConfig.ts`, `render/typeArt.ts`, `loop/FixedStepLoop.ts`, `hud/Hud.ts`,
`fx/MissFx.ts`, `fx/Particles.ts`, `fx/CollapseFx.ts`, `dev/DebugOverlay.ts`, and the call sites in
`scenes/GameScene.ts` that drive their `update`/render methods each frame.

**Finding (fixed)**: `CameraRig.getViewBounds()` returned a fresh `{ top, bottom }` object literal
on every call, and `GameScene.render()` (driven every frame from `update()`) called it once per
frame, then passed the fields on to `TowerRenderer.update`/`MissFx.update`. That is a per-frame
object allocation in the render path, violating this audit's own rule, the plan's "no per-frame
allocations in the render loop", and constitution Principle VI. It was missed in the first pass of
this audit, which listed `CameraRig.update`/`apply` as allocation-free but never checked
`getViewBounds` and stated (incorrectly) that `GameScene.render()` "allocates nothing".

**Fix applied**: `CameraRig.getViewBounds()` was replaced with two number-returning accessors,
`get viewTop()` and `get viewBottom()` (`apps/web/src/render/CameraRig.ts`), so reading the bounds
allocates nothing. `GameScene.render()` (`apps/web/src/scenes/GameScene.ts`) was updated to read
`this.cameraRig.viewTop` / `this.cameraRig.viewBottom` into local `const`s once per frame and pass
those numbers to `TowerRenderer.update` and `MissFx.update`, instead of destructuring a returned
object. No other caller or test referenced `getViewBounds`.

Findings otherwise: **no per-frame allocations**. Specifically:

- `FixedStepLoop.advance`/`stepOnce`/`copyCurrToPrev` mutate the preallocated `prev`/`curr`
  `RenderSnapshot` objects field-by-field; no object, array, or closure is created per call.
- `TowerRenderer.update` reuses a pooled `Phaser.GameObjects.Image[]` (`this.pool`), writing
  `x`/`y`/`angle`/`setVisible` on existing images. `getVisibleImages()` does allocate (via
  `Array.prototype.filter`), but it is called only once, from `GameScene.handleGameOver`, on the
  game-over event, not from any per-frame path.
- `CraneRenderer.update` and `CameraRig.update`/`apply` only assign to existing Phaser objects'
  properties; no literals or closures are created. (`CameraRig.viewTop`/`viewBottom`, after the fix
  above, are plain number getters — also allocation-free.)
- `MissFx.update` iterates `this.bodies` backwards and calls `splice`/`destroy` in place; no new
  array is created. `MissFx.spawn` and `Particles.*` / `CollapseFx.collapse` allocate (a Matter
  body, `explode()`), but each is triggered once per game event (a landing, a miss, game over),
  never from a per-frame loop.
- `DebugOverlay.update` is throttled to at most 10 calls/second (`UPDATE_INTERVAL_MS`), reads from
  the caller's preallocated `DebugSnapshot` (`GameScene.debugSnapshot`, filled in place by
  `fillDebugSnapshot`), and only calls `setText` on already-created `Phaser.GameObjects.Text`
  instances for fields whose value changed. The `` `${field.label}: ...` `` template literal runs
  at most once per changed field per throttle tick (≤ 10 Hz), not per frame.
- `GameScene.render()` (called once per frame from `update`) destructures `{ prev, curr }` from
  `this.loop` (a reference read, not a copy), reads the two `CameraRig` number getters, and
  computes plain numbers; after the fix above it allocates nothing.
- `Hud.refresh`/`showResult`/`updateRoofButtonVisibility` are only called from
  `GameScene.handleEvents`, itself only invoked when a tick produced at least one sim event — not
  on every rendered frame — so their `setText` template-literal calls are not a per-frame cost.
- `Hud.getRoofButtonBounds()` returns a fresh bounds object, but it is called only from the
  DEV-only `window.__skyline` test hook (`GameScene`'s `if (import.meta.env.DEV)` block), never
  from any per-frame `update`/`render` path.

One fix was needed and applied in this category (`CameraRig`/`GameScene.render` above).

### User-facing string literal audit

Grepped every `.ts` file under `apps/web/src/` except `strings.ts` and the exempt dev-only files
(`dev/TuningPanel.ts`, `dev/tuningPanelModel.ts`, `dev/PerfCapture.ts`, `dev/AutoBot.ts`) for
quoted or template-literal text that reads as player-facing copy.

Findings: **no stray user-facing string literals**. Everything that matched the grep was one of:

- Phaser scene keys / texture keys / event-kind discriminants (`'Boot'`, `'Select'`, `'Game'`,
  `'dust'`, `'spark'`, `'debris'`, `'land'`, `'miss'`, `'finished'`, etc.) — identifiers, not
  displayed text.
- Key names compared in input handlers (`'q'`, `'Q'`, `'ArrowUp'`, `'Enter'`, …).
- CSS/style values (`'monospace'`, hex colors) and DOM API calls (`document.createElement('a')`).
- TSDoc comments (backtick-quoted code references), which are not rendered to players.
- `apps/web/src/dev/perfCaptureModel.ts`'s `formatPerfReport` (`'Perf capture complete'`, …): this
  is the pure-model half of the dev-only perf capture tool. T090 explicitly allows the perf
  report's text to be written inline ("dev-only tool text is exempt from `strings.ts`"), and the
  function's own doc comment already states the exemption. Left as-is; not a violation of this
  audit's scope, which lists `PerfCapture.ts`/`AutoBot.ts` as the exempt surface these model files
  implement.

All actual player-facing copy already lives in `apps/web/src/strings.ts` and is consumed via
`STRINGS`/`formatCombo`/`formatFloors` by `Hud.ts`, `DebugOverlay.ts`, `SelectScene.ts`, and
`GameScene.ts`.

No fixes were needed in this category.

### Conclusion

The audited modules comply with Principle VI (no per-frame allocation) and Principle VII
(externalized UI strings) after fixing the `CameraRig.getViewBounds()` per-frame allocation found
above. Source changes made as part of T092: `apps/web/src/render/CameraRig.ts` and
`apps/web/src/scenes/GameScene.ts`.

## Quickstart validation (T093)

**Date**: 2026-09-28. **Desktop**: macOS, dev server (`pnpm --filter @skyline/web dev`), Playwright
1.63.0 Chromium at a 540×960 portrait viewport for the scripted checks. Automated rows were run
from the quickstart validation map.

### Automated criteria

| Criterion | Command | Result |
| --- | --- | --- |
| SC-001 isolation + forbidden APIs | `pnpm lint`, `pnpm check:sim-purity` | Pass |
| SC-002 fuzz | `pnpm --filter @skyline/sim test:fuzz` | Pass (5 tests, 10,000 runs) |
| SC-003 sine table | sim tests + `pnpm gen:sin-lut && git diff --exit-code` | Pass; regenerated table identical |
| SC-004 tiers, SC-005 caps, SC-006 rules | `pnpm --filter @skyline/sim test` | Pass (188 tests) |
| SC-007 determinism (Node) | `pnpm --filter @skyline/sim test` (golden) | Pass |
| SC-007 determinism (browsers) | `pnpm --filter @skyline/golden-harness test:e2e` | Pass in chromium, webkit, firefox |
| SC-008 frame-rate independence | `pnpm --filter @skyline/web test` | Pass (61 tests) |
| SC-009 input latency | `pnpm --filter @skyline/web test` | Pass |
| Coverage (Principle IV) | `pnpm --filter @skyline/sim test:coverage` | Pass: lines 99.26% (≥ 90%) |
| SC-010 performance | see T094 | Recorded under T094 |

Note: the quickstart's name filters (`-- sinLut`, `-- tiers`, …) do not narrow the run; each
command runs the whole package suite, which passes.

### Manual playability (SC-011)

| Check | How | Result |
| --- | --- | --- |
| Mouse and `Space` drops | Manual, by the developer, desktop dev build | Pass |
| Place Roof (pointer) | Manual, by the developer: Residential, button appeared at 15 floors, pressed it, the block became the roof, landed, run ended | Pass (result Built) |
| Completed run, all four types | Scripted: dev auto-bot (`B`) on Residential, Commercial, Office, Luxury | Pass: all **Completed** at 30 / 40 / 50 / 60 floors, 0 strikes |
| Completion bonus +20% (truncated) | HUD score before the roof vs final score | Pass: 828 → 993, 1692 → 2030, 2860 → 3432, 5188 → 6225 |
| Touch on a phone | iPhone 11, Safari | Not yet recorded |
| Game-over run, Quick Play run | Not run by hand; rules and results are covered by SC-006 and the golden fixtures (a game-over fixture exists) | Not run manually |

### Export and replay

- Residential run exported with `E`: file `run-residential-<seed>.json`, the HUD shows
  "Run exported". `pnpm --filter @skyline/sim replay <file>` printed `completed`, score 993,
  30 floors, `tuningOverridden: false`, **MATCH**.

### Tuning override

- Tuning panel (`T`): `SWAY_AMP_CAP` 350 → 200. The panel showed OVERRIDDEN. **Apply & restart**,
  auto-played to Completed, exported.
- The export has `tuningOverridden: true` and `config.tuning.global.SWAY_AMP_CAP` = 200. Replay
  printed **MATCH**. `git diff packages/sim/src/tuning.ts` is empty.

### Grayscale check (Principle VII)

Screenshots in [screenshots/](./screenshots/): `selector-*`, `tower-<type>-*`, each in color and
grayscale (`filter: grayscale(1)` on the canvas).

- **Selector**: each entry has a distinct pattern sample (horizontal siding, dark band with
  checkered strip, window grid, crosshatch), a distinct icon (house, dome, grid, crown) and its
  name. **Pass.**
- **Towers with roofs**: distinct roof shapes (gable, flat cap with box, stepped, spire) plus the
  type icon and name in the HUD. **Pass.**
- Note: at the result screen the camera keeps the hook in frame, so only the top floor or two and
  the roof are visible. For Office only the roof is in view; its window-grid pattern is shown in
  the selector.

## Performance (T094, SC-010)

**Build**: optimized production build with perf tools (`VITE_PERF_TOOLS=1 pnpm --filter
@skyline/web build`), served with `pnpm --filter @skyline/web preview --host`. URL
`?perf=luxury`: Luxury run, auto-drop bot, 60-second capture starting once the tower passes 50
floors. Target: average ≥ 58 fps, no frame above 33 ms.

### iPhone 11, iOS 26.6.1 (23G83), 2026-09-28

Phone on charger, Low Power Mode off, same Wi-Fi as the desktop.

| Run | Browser | Frames | Avg fps | Max frame | Frames > 33 ms | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Chrome for iOS (WebKit) | 3592 | 59.9 | 100.0 ms | 2 | Fail (two one-off stalls) |
| 2 | Chrome for iOS (WebKit) | 3598 | 60.0 | 22.0 ms | 0 | Pass |
| 3 | **Safari** | 3598 | 60.0 | 20.0 ms | 0 | **Pass** |

The required Safari run passes. Run 1's two stalls did not recur in either later run, so they are
treated as a one-off device hiccup (the phone was at 16% battery and charging), not a render-code
issue.

### 120 Hz display

Not run; no 120 Hz display available. Covered by SC-008.
