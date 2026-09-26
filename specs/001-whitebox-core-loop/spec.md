# Feature Specification: Phase 1 — Deterministic Whitebox Core Loop

**Feature Branch**: `001-whitebox-core-loop` (no git repository yet; directory name only)

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Phase 1 of Skyline Stacker: the deterministic whitebox core loop, as
defined in docs/PRD.md. Scope is strictly PRD §12 "Phase 1", using the rules in §3 (core gameplay),
§4 (sway model), §5 (determinism), and §7 (tuning parameters). Treat those sections as the
authoritative requirements, including every number in the tuning tables. Include: the complete
stacking loop for all 4 tower types and Quick Play; the deterministic simulation; whitebox
rendering with render interpolation, camera follow, and visual-only miss and collapse effects;
developer tools (debug overlay, tuning panel, tower-type selector, run export). Explicitly out of
scope: Vue, Pinia, the city grid, save files, final art, audio, backend, and mobile builds. The
success criteria are the 11 Phase 1 acceptance criteria in PRD §12."

**Authoritative sources**: `docs/PRD.md` §3, §4, §5, §7 and §12 (Phase 1). Every formula and
number in those sections is part of this spec by reference. Where this spec restates a rule, the
PRD wins on any mismatch, and the mismatch must be raised (constitution, Governance rule 2).

## User Scenarios & Testing *(mandatory)*

Actors:
- **Player**: plays runs in the browser with mouse, touch, or Spacebar.
- **Developer/Designer**: inspects the simulation, tunes values, and exports runs for replay.
- **Verifier**: an automated check or reviewer that replays runs and confirms determinism.

### User Story 1 - Play a complete Residential tower (Priority: P1)

A player opens the game, and a block swings on a crane above the foundation. They release blocks
one at a time to stack a Residential tower. Each landing is graded Perfect, Good, or Miss, and
score, combo, strikes, and floor count update. The tower sways more as it grows and as it leans.
After floor 30 the next block is a roof. When the roof lands, the tower is Completed and gets the
+20% completion bonus.

**Why this priority**: This is the core loop of the game. Nothing else in the product matters
unless it is playable and correct.

**Independent Test**: Start a Residential run, play to 30 floors plus the roof using each input
method, and confirm the final score equals the sum of floor population plus 20%, truncated.

**Acceptance Scenarios**:

1. **Given** a block is swinging, **When** the player taps, clicks, or presses Spacebar, **Then**
   the release is applied on the next simulation tick. The block falls straight down for 24 ticks
   and lands with no horizontal drift.
2. **Given** a landing offset |d| ≤ 50 su, **When** it lands, **Then** it is Perfect. The new
   floor snaps to the previous floor's rest position, combo increases by 1, the stabilizer is
   applied, and population = trunc(perfectPop × comboMult‰ / 1000).
3. **Given** 51 ≤ |d| ≤ 250, **When** it lands, **Then** it is Good. The floor keeps its offset,
   combo and stabilizer reset, goodPop is added, and the Good count increases by 1.
4. **Given** |d| > 250, **When** it lands, **Then** it is a Miss. No floor is added, strikes
   increase by 1, combo resets, and the block visibly slides off the tower.
5. **Given** N = 30 on Residential, **When** the next block spawns, **Then** it is the roof. A
   Perfect or Good roof landing finishes the run as Completed with +20% bonus (truncated). A Miss
   costs a strike and a new roof spawns.
6. **Given** a third Miss, **When** it lands, **Then** the run ends in game over and the visible
   tower collapses.
7. **Given** a block is falling, a spawn delay is running, or the game is paused, **When** the
   player presses a drop input, **Then** the input is discarded (not buffered). Held-key
   auto-repeat is ignored.

---

### User Story 2 - Deterministic replay and verification (Priority: P1)

A verifier takes a finished run's configuration, seed, and input log and replays it from tick 0 in
a server-like environment and in each supported browser engine. Every replay produces the same
final score and the same state hash. This is what later makes server-validated leaderboards
possible.

**Why this priority**: Determinism is a non-negotiable project principle. If it slips now,
everything built later on replays and validation breaks.

**Independent Test**: Replay each committed golden fixture in the server-like runtime and in three
browser engines, and compare the score and hash with the committed values.

**Acceptance Scenarios**:

1. **Given** a golden fixture (config, seed, input log, expected score, expected hash), **When** it
   is replayed in any supported environment, **Then** score and hash match exactly.
2. **Given** the same input log, **When** it is replayed 1,000 times in one process, **Then** all
   1,000 hashes are identical.
3. **Given** the same scripted input ticks, **When** the game loop runs at simulated 30, 60, 120,
   and 144 Hz display rates, **Then** the recorded input logs and final hashes are identical.
4. **Given** any sequence of steps and inputs, **When** state is inspected, **Then** every value is
   a safe integer and no error has been thrown.

---

### User Story 3 - Play every tower type, early roof, and Quick Play (Priority: P2)

A player or developer picks any of the four tower types (Residential, Commercial, Office, Luxury)
or Quick Play from a developer selector. Each type uses its own parameters (target floors, crane
and sway periods, sway multiplier, population, block visual height, color). In tower modes, once
the floor count reaches the type's early-roof minimum, a **Place Roof** control appears. Using it
turns the swinging block into the roof, and a successful landing finishes the tower as Built with
no bonus. Quick Play is endless on Residential parameters, with no roof, and ends only at 3
strikes.

**Why this priority**: Required for full Phase 1 coverage and for the Phase 2 playtests, but
builds on Story 1.

**Independent Test**: Select each type in turn and play or replay a run. Check early-roof
availability at and below the minimum, and confirm Quick Play has no roof and ends at 3 strikes.

**Acceptance Scenarios**:

1. **Given** N < minRoofFloors[type], **Then** Place Roof is unavailable. **Given**
   N ≥ minRoofFloors[type] with a block swinging (and the block is not already the roof),
   **Then** Place Roof is available.
2. **Given** an early roof lands Perfect or Good, **Then** the run ends as Built and the score is
   the floor population sum with no completion bonus.
3. **Given** Quick Play, **Then** no roof ever spawns, Place Roof is never offered, and the run
   ends only at 3 strikes with score = sum of floor population.
4. **Given** very long Quick Play runs, **Then** crane speed never exceeds 2000‰, sway amplitude
   never exceeds 350 su, and play stays possible indefinitely.

---

### User Story 4 - Inspect and tune the simulation (Priority: P2)

A developer presses `D` to toggle a debug overlay showing current tick, last offset (‰), last
tier, sway target and current amplitude, lean, crane speed ‰, sensitivity ‰, stabilizer ‰, combo,
and fps. In development builds, a tuning panel lets them edit every tuning value, restart the run
with the new values, and export the current values as JSON.

**Why this priority**: Phase 2 tuning depends on these tools, but the game is playable without
them.

**Independent Test**: In a development build, toggle the overlay and check that each value changes
as expected during play. Edit a tuning value, restart, observe the changed behavior, and export
the values.

**Acceptance Scenarios**:

1. **Given** a run in progress, **When** `D` is pressed, **Then** the overlay toggles and all listed
   values update live.
2. **Given** a development build, **When** a tuning value is edited and the run restarted, **Then**
   the new run uses the edited value, and the run is marked as using overridden tuning.
3. **Given** a production build, **Then** the tuning panel is not available.

---

### User Story 5 - Export a run for replay (Priority: P3)

After a run, the developer downloads a JSON file with the run's config, seed, input log, final
score, and state hash, so the run can be replayed, investigated, or promoted to a golden fixture.

**Why this priority**: Supports debugging and fixture creation, and Phase 2 criterion 7 (replaying
disputed misses).

**Independent Test**: Export a run, replay the file, and confirm the score and hash match.

**Acceptance Scenarios**:

1. **Given** a finished run, **When** the developer exports it, **Then** a JSON file is saved, and
   replaying it gives the recorded score and hash.

---

### Edge Cases

- **First block (N = 0)**: the landing target is the foundation (rest 0). Sway is zero until the
  first floor is placed. The sway phase starts at 0 at that moment.
- **Exact tier boundaries**: |d| = 50 is Perfect, 51 and 250 are Good, 251 is a Miss, for both
  positive and negative d.
- **Opposite offsets**: a left Good followed by an equal right Good moves lean back toward 0.
- **Caps reached**: crane speed at floor ≥ 50, sensitivity at ≥ 20 Good landings, combo at ≥ 8
  consecutive Perfects, stabilizer floor at 500‰, sway amplitude at 350 su. Values hold at the cap
  and never exceed it.
- **Miss on the roof**: costs a strike and spawns a new roof. A third strike on the roof is game over.
- **Early roof and automatic roof**: once the automatic roof has spawned, Place Roof is not offered.
- **Place Roof while not swinging** (falling or spawn delay): rejected and not logged.
- **Input on the same tick as another input**: at most one drop is applied per swinging block;
  extra inputs are discarded.
- **Tab hidden or app backgrounded**: the simulation pauses. No ticks advance while paused, and
  paused time never appears in the tick count.
- **Slow device / long frame**: at most 5 ticks run per rendered frame. Extra time is discarded, so
  the game slows down rather than skipping ahead.
- **Floors below the viewport**: not drawn, but still fully present in simulation state and in the
  collapse (only visible floors take part in the collapse effect).
- **Very tall towers (Luxury 60 floors, long Quick Play)**: frame rate and correctness hold.

## Requirements *(mandatory)*

### Functional Requirements

**Run flow and input (PRD §3.1–3.2)**

- **FR-001**: The system MUST run the run flow of PRD §3.1: spawn → swing → release → fixed-length
  fall → landing evaluation → spawn delay (36 ticks) → next spawn, until completion, early finish,
  or game over.
- **FR-002**: The system MUST accept drop input from pointer down on the game area (mouse or touch)
  and from Spacebar. Key auto-repeat MUST be ignored.
- **FR-003**: A drop MUST be accepted only while a block is attached and swinging. Inputs at any
  other time MUST be discarded, not buffered.
- **FR-004**: An accepted drop or roof request MUST be applied on the next simulation tick and
  recorded in the input log with that tick number.

**Crane, drop, landing (PRD §3.3–3.4)**

- **FR-005**: At each spawn, the crane center MUST be set to the top floor's rest position (without
  sway) and stay fixed until the next spawn. The crane start phase MUST come from the seeded
  random generator.
- **FR-006**: Crane position, phase advance, and crane speed (+20‰ per floor, capped at 2000‰) MUST
  follow the PRD §3.3 formulas exactly, using the per-type crane period.
- **FR-007**: On release, the block's horizontal position MUST freeze. The block MUST fall straight
  down for exactly 24 ticks. The landing offset MUST be measured against the top floor's current
  swaying position at the landing tick (PRD §3.4).

**Tiers, scoring, strikes (PRD §3.5–3.7)**

- **FR-008**: Landings MUST be graded by PRD §3.5: Perfect (|d| ≤ 50), Good (51–250), Miss (> 250),
  with the stated effects on rest position, combo, stabilizer, Good count, and strikes.
- **FR-009**: Combo, combo multiplier (+250‰ per step, capped at 3000‰), Perfect/Good floor
  population, and the completion bonus (+200‰, truncated) MUST follow PRD §3.6. The roof MUST add
  no floor population.
- **FR-010**: The player MUST have 3 lives. The third Miss MUST end the run in game over.

**Roof and modes (PRD §3.8–3.9)**

- **FR-011**: In tower modes, when N reaches targetFloors[type], the next spawned block MUST be the
  roof.
- **FR-012**: In tower modes, when N ≥ minRoofFloors[type] and a non-roof block is swinging, the
  player MUST be able to turn it into the roof (Place Roof). This MUST be logged as a `roof` input.
- **FR-013**: The roof MUST land under normal tier rules. Perfect or Good finishes the run
  (Completed at target height with bonus, otherwise Built without bonus). A Miss costs a strike and
  spawns a new roof.
- **FR-014**: Quick Play MUST use Residential parameters with no target, no roof, and no bonus. It
  MUST end only at 3 strikes.

**Sway model (PRD §4)**

- **FR-015**: Tower sway MUST be the horizontal-shear model of PRD §4.1. The foundation never
  moves, the top floor moves by the full sway, and floor i is displaced by trunc(S × i / N).
- **FR-016**: Lean MUST be the truncated signed average of floor rest positions (PRD §4.2).
- **FR-017**: The sway amplitude target MUST be recomputed after every successful landing, using
  the PRD §4.3 formula: base sway per floor, lean gain, sensitivity (+50‰ per Good, capped at
  2000‰), per-type sway multiplier, stabilizer (×800‰ per Perfect, floor 500‰, reset on Good,
  unchanged on Miss), assist multiplier (500‰ when Steady Tower is on), and a 350 su cap.
- **FR-018**: The current amplitude MUST move toward the target each tick using the PRD §4.3
  smoothing rule (1/16 of the difference, at least 1 su when not equal).
- **FR-019**: Sway MUST NOT cause collapse by itself. The only loss condition is 3 strikes.

**Determinism (PRD §5)**

- **FR-020**: All game rules MUST live in a standalone simulation component with no third-party
  runtime dependencies. It MUST run unchanged in browsers and in a server-side runtime.
- **FR-021**: Every simulation state value MUST be a safe integer. Every division MUST be
  truncated.
- **FR-022**: The simulation MUST advance in fixed ticks at 60 per second. It MUST NOT read the
  clock, use platform randomness, use platform trigonometry or power/root/log functions, or use
  timers. An automated check MUST fail the build if any of these appear in the simulation
  component.
- **FR-023**: Sine values MUST come from a committed, precomputed 4096-entry Q15 table (values in
  [−32767, 32767]), generated once by a script and verified by a committed checksum.
- **FR-024**: Randomness MUST come only from a seeded mulberry32 generator with a uint32 seed. It
  MUST be used only for the crane start phase at each spawn. Phase 1 generates the seed at run
  start on the client.
- **FR-025**: Each run MUST record an ordered input log of `{ tick, type: 'drop' | 'roof' }`.
- **FR-026**: Replaying (config, seed, input log) from tick 0 MUST reproduce the identical final
  state. A state hash (32-bit FNV-1a over all state fields in a fixed, documented order) MUST be
  available for any state.
- **FR-027**: The simulation MUST expose the event stream of PRD §8.3 (spawn, release, land, miss,
  comboChanged, roofAvailable, finished, gameOver) so presentation can react without changing
  state.

**Rendering and presentation (PRD §3.10, §4.1, §5.6, §7.3, §11)**

- **FR-028**: The game MUST render whitebox visuals: colored rectangles in each type's color with
  the per-type block visual height, the foundation, the crane and hook, and a text label for the
  current tower type (so types are not told apart by color alone).
- **FR-029**: Rendering MUST run at the display refresh rate with a fixed-step accumulator capped
  at 5 ticks per frame, discarding excess time. Crane position, sway, falling block, and camera
  MUST be interpolated between the previous and current tick. Interpolated values MUST never feed
  back into the simulation.
- **FR-030**: The falling block MUST be drawn with a quadratic ease-in between hook and tower top.
  Floors MAY be drawn with a visual tilt proportional to local shear, capped at 6°. Tilt MUST NOT
  affect gameplay.
- **FR-031**: The camera MUST keep the hook 5 block heights above the top floor, pan smoothly after
  each landing, and follow the crane center horizontally with smoothing. Floors below the viewport
  MUST NOT be drawn, but MUST remain in simulation state.
- **FR-032**: On a Miss, the block MUST visibly slide and tumble off the tower, away from it, and
  be removed once off-screen. On game over, every visible floor MUST fall in a collapse that
  starts from its displayed position, tilt, and sway direction. These effects MUST be visual only.
- **FR-033**: Landing dust, Perfect sparks, and collapse debris SHOULD be shown as simple
  whitebox particles.
- **FR-034**: The HUD MUST show score, strikes remaining, combo multiplier, floors / target, and
  the Place Roof control when available.
- **FR-035**: The simulation MUST auto-pause when the page is hidden or the app is backgrounded,
  and resume when it becomes visible again.
- **FR-036**: The game MUST use a portrait 720×1280 logical resolution, scaled to fit and
  letterboxed on desktop.

**Developer tools (PRD §12 Phase 1)**

- **FR-037**: The `D` key MUST toggle a debug overlay showing: current tick, last offset (‰), last
  tier, sway target and current amplitude, lean, crane speed ‰, sensitivity ‰, stabilizer ‰,
  combo, and fps.
- **FR-038**: Development builds MUST provide a tuning panel that edits every tuning value,
  restarts the run with the edited values, and exports the current values as JSON. Production
  builds MUST NOT include it.
- **FR-039**: A run played with edited tuning values MUST be marked as such (for example, a tuning
  version that does not match the committed one). It MUST NOT be usable as a golden fixture.
- **FR-040**: A developer selector MUST let the player start a run of any of the 4 tower types or
  Quick Play, with Steady Tower on or off.
- **FR-041**: After a run, the developer MUST be able to download the run as JSON containing
  config (type, mode, seed, assist), input log, final score, state hash, and tuning version.

**Tuning (PRD §7)**

- **FR-042**: Every gameplay value in PRD §7.1 and §7.2 MUST be defined in one tuning source,
  together with a tuning version string, using exactly the PRD values. No gameplay number may be
  hard-coded anywhere else.
- **FR-043**: Changing any committed tuning value MUST bump the tuning version and regenerate all
  golden fixtures.

### Key Entities *(include if feature involves data)*

- **Run Config**: tower type (residential, commercial, office, luxury), mode (city/tower or
  quick), seed (uint32), assist flag (Steady Tower).
- **Simulation State**: integer-only snapshot. Includes tick, run phase (swinging, falling, spawn
  delay, finished, game over), floor rest positions, floor count N, crane center, crane phase and
  increment, released block position, sway phase and increment, current and target sway
  amplitude, lean, combo, Good count, stabilizer, strikes, score, roof flags, PRNG state, pending
  input.
- **Input Event**: `{ tick, type: 'drop' | 'roof' }`, the tick on which it was applied.
- **Input Log**: ordered list of input events for one run.
- **Simulation Event**: presentation notification (spawn, release, land, miss, comboChanged,
  roofAvailable, finished, gameOver) with its data.
- **Tuning Set**: all global and per-type gameplay values plus a tuning version string.
- **Golden Fixture**: committed (config, input log) with expected score and hash. At least one
  each for Completed, Early-roof, and Game-over runs.
- **Run Export**: JSON file with config, input log, score, hash, and tuning version.
- **Sine Table**: 4096 Q15 integer entries with a committed checksum.

## Success Criteria *(mandatory)*

### Measurable Outcomes

These carry over the 11 Phase 1 acceptance criteria of PRD §12. Phase 1 is complete only when
all of them pass.

- **SC-001 (Isolation and forbidden APIs)**: The simulation component has zero third-party runtime
  dependencies. An automated check confirms that none of the forbidden APIs of PRD §5.1 appear in
  it, and fails the build if one is introduced.
- **SC-002 (Integer safety fuzz)**: 10,000 random input logs across all 4 tower types and Quick
  Play run without any exception. After every step, every state value is a safe integer.
- **SC-003 (Sine table)**: The sine table has exactly 4096 entries, all within [−32767, 32767],
  and matches the committed checksum.
- **SC-004 (Tier boundaries)**: |d| = 0 and 50 give Perfect; 51 and 250 give Good; 251 gives Miss;
  each is verified for both positive and negative d.
- **SC-005 (Caps)**: Crane speed equals 2000‰ at floor ≥ 50 and never exceeds it. Sensitivity
  equals 2000‰ at ≥ 20 Good landings. Sway amplitude never exceeds 350 su. The combo multiplier
  equals 3000‰ at ≥ 8 consecutive Perfects. The stabilizer never goes below 500‰.
- **SC-006 (Rules)**: A Perfect snaps the floor's rest position. A Good keeps its offset. Opposite
  Good offsets reduce |lean|. The third strike triggers game over. The early roof is unavailable
  below minRoofFloors and available at it. An early-roof finish gets no completion bonus. A
  target-height finish gets exactly +20% (truncated).
- **SC-007 (Determinism)**: Every golden fixture (at least 3: Completed, Early-roof, Game-over)
  replays to its committed score and hash in the server-side runtime and in the Chromium, WebKit,
  and Firefox browser engines. Replaying one log 1,000 times in one process gives the same hash
  every time.
- **SC-008 (Frame-rate independence)**: Driving the game loop at simulated 30, 60, 120, and
  144 Hz with the same scripted input ticks produces identical input logs and identical final
  hashes.
- **SC-009 (Input latency)**: An accepted drop is applied on the first simulation tick after the
  input event, verified with injected events.
- **SC-010 (Performance)**: On the reference mid-range Android phone (Pixel 6a class), a 60-floor
  Luxury run averages ≥ 58 fps with no frame above 33 ms over a 60-second capture. On a 120 Hz
  display, the render rate averages ≥ 110 fps while the simulation stays at 60 ticks per second.
- **SC-011 (Playability)**: A full Residential run (30 floors plus roof), a game-over run, and a
  Quick Play run can each be played start to finish with mouse, touch, and Spacebar. The miss
  slide-off and game-over collapse both play visibly.

## Assumptions

- **Scope boundary**: Only PRD §12 Phase 1 is in scope. Out of scope: Vue/Pinia app shell, title
  screen, pause menu and settings screen, city grid and tile rules (§6), save files (§8.6), final
  2.5D art and citizen reactions, audio, reduced-motion effects (there are no cosmetic motion
  effects to disable yet), backend and accounts, native mobile builds, and playtest telemetry
  (Phase 2).
- **"City" mode in Phase 1**: "Tower mode" means a single tower of a chosen type with target
  height and roof, as in City mode but with no grid. A game over simply ends the run; there is no
  tile to lose.
- **HUD**: Phase 1 draws a minimal HUD (FR-034) on the game canvas itself, since Vue arrives in
  Phase 3. It will be replaced by the DOM HUD in Phase 3.
- **Pause**: Phase 1 only has auto-pause on page hide or backgrounding (FR-035). A manual pause
  menu arrives in Phase 3.
- **Steady Tower**: supported by the simulation (it is part of the §4.3 formula) and toggled from
  the developer selector. The player-facing setting arrives in Phase 3.
- **Seed**: generated on the client at run start from any available randomness source. That source
  is outside the simulation, so it does not affect determinism.
- **Roof landing effects**: a roof landing grades a tier but adds no floor, population, or sway
  recompute. It ends the run on Perfect or Good.
- **Sway before the first floor**: amplitude and displacement are 0 while N = 0.
- **Rotate-device overlay** (PRD §10.3) is deferred to Phase 3. Phase 1 renders portrait and
  letterboxes in any orientation.
- **Reference devices**: the team has access to a Pixel 6a–class Android phone and a 120 Hz
  display to measure SC-010.
- **Tuning overrides**: follow the constitution's reading of the dev tuning panel (Principle V):
  overridden runs are marked and never become golden fixtures or saved towers.
- **Dependencies**: the constitution (v1.0.0) applies in full. In particular, the sim may not use
  third-party runtime packages, and later-phase technology may not be scaffolded early.
