# Specification Quality Checklist: Phase 1 — Deterministic Whitebox Core Loop

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-26
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- **Deliberate exception to "no implementation details"**: the user asked for PRD §3, §4, §5 and
  §7 to be treated as authoritative requirements. So the spec keeps the algorithms the PRD makes
  normative for determinism: the mulberry32 PRNG, the Q15 4096-entry sine table, the FNV-1a state
  hash, integer-only state, and the 60 Hz tick. It also names the browser engines (Chromium,
  WebKit, Firefox) and the measurement devices (iPhone 11, desktop Chrome at 4× CPU throttling),
  because they are the measurement targets of PRD §12. No frameworks, libraries, or code structure are named (Phaser, Matter.js, Vitest and
  Playwright are left to the plan).
- **Audience**: the spec is written for the product owner and designer. Gameplay terms (su, ‰,
  tick) are defined in the PRD glossary (§2).
- **Clarifications**: none were needed. Gaps were filled with documented assumptions (roof landing
  effects, sway at N = 0, Phase 1 in-canvas HUD, auto-pause only, deferred rotate overlay, dev
  tuning overrides per constitution Principle V).
- Validation passed on the first iteration.
- 2026-09-26 update: added FR-044–FR-048 (explicit run result; assist flag in config, exports,
  replay and state hash), with matching acceptance scenarios and entities. Re-validated: all items
  still pass.
- 2026-09-26 update 2: aligned with constitution v1.1.0 Principle V (FR-038, FR-039, FR-041,
  FR-043, new FR-049/FR-050, entities, assumptions); added FR-051 (Place Roof press is not a
  drop); mode name `city` used throughout; header cleaned up. Re-validated: all items pass.
- 2026-09-27 update 3 (after constitution v1.2.0 and two /speckit-analyze runs):
  - SC-010 now uses an iPhone 11 (Safari) and desktop Chrome at 4× CPU throttling, with the
    120 Hz check optional. The reference-devices assumption was updated to match.
  - FR-038 and User Story 4 refer to "the fixed engine constants (data-model §1.3)".
  - FR-027 and the Simulation Event entity include `roofPlaced`.
  - FR-028 requires a distinct pattern, roof shape and icon per type; User Story 3 scenario 6
    adds the grayscale check.
  - User Story 5 was reworded: exports are not promoted to golden fixtures.
  - Status set to "Ready for implementation" once /speckit-analyze reported no critical issues.
  - Re-validated: all items pass.
