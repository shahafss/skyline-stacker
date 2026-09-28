# Contract: Phase 1 controls and developer tools (`apps/web`)

This covers the player-facing and developer-facing controls of the Phase 1 whitebox build.
There is no Vue and no DOM UI except the dev-only tuning panel.

## Gameplay input (FR-002–FR-004, FR-051)

| Input | Effect | Rules |
| --- | --- | --- |
| Pointer down on the game canvas (mouse or touch) | `requestDrop()` | Ignored if it lands on the Place Roof button (two guards, research R9) |
| `Space` keydown | `requestDrop()` | `event.repeat === true` is ignored |
| Pointer down on **Place Roof** | `requestRoof()` only | Never also a drop. Shown only while `canPlaceRoof(sim)` |
| `Esc` keydown | Return to the run selector | Works at any time during a run, not only after it ends (unlike pointer/`Space`, which only return once the run has a result) |
| Page hidden / app backgrounded | Pause (no ticks) | On return, the accumulator is reset so time is not fast-forwarded (FR-035) |

A request that the sim rejects (not swinging, input pending, run ended) is dropped silently; it is
never buffered.

## Run selector (FR-040)

Shown at start and after each run ends. Keyboard-navigable (Principle VII) and pointer-clickable.

| Key | Action |
| --- | --- |
| `1` `2` `3` `4` | Start `city` run: Residential, Commercial, Office, Luxury |
| `5` / `Q` | Start Quick Play |
| `↑` `↓` + `Enter` | Move focus and start the focused entry (visible focus ring) |
| `A` | Toggle Steady Tower (assist) for the next run; state shown as text ("Assist: ON") |

Each entry shows the type's **name as text**, its **icon** (`icon-<type>`), a sample of its
**block pattern** (`floor-<type>`), and its color swatch, so types are never told apart by color
alone and stay distinguishable in grayscale. All text comes from `strings.ts`.

## HUD (FR-034), drawn on the canvas

Score · Strikes remaining (as "Lives: ● ● ○" plus the number) · Combo multiplier (for example
"×1.75") · Floors / target ("12 / 40"; Quick Play shows only floors) · type name with its icon ·
"ASSIST" badge when on · Place Roof button when available (hidden again on `roofPlaced`). The
tower's blocks use the type's pattern and its roof uses the type's roof shape. HUD text comes
from `strings.ts` and sits on a dark backing panel, so light text meets WCAG AA contrast.

## Developer tools

| Key | Tool | Builds |
| --- | --- | --- |
| `D` | Debug overlay (FR-037): tick, last offset ‰, last tier, sway target / current amplitude, lean, crane speed ‰, sensitivity ‰, stabilizer ‰, combo, fps | All Phase 1 builds |
| `E` | Download the last finished run as `run-<type>-<seed>.json` ([schema](./run-export.schema.json)) (FR-041) | All Phase 1 builds |
| `T` | Tuning panel (FR-038): plain DOM form of every `TuningValues` field; **Apply & restart**, **Reset to defaults**, **Export JSON**. Edits stay in memory only; the panel shows "OVERRIDDEN" whenever the values differ from the defaults | **Development only** (dynamic import behind `import.meta.env.DEV`) |
| `P` | 60-second perf capture: average fps, max frame ms, frames over 33 ms (research R16) | Development, or a production build made with `VITE_PERF_TOOLS=1` |
| `B` | Toggle the auto-drop bot, used for perf runs | Development, or a production build made with `VITE_PERF_TOOLS=1` |

**URL parameter `?perf=luxury`** (same builds as `P` / `B`): starts a Luxury run with the bot on
and begins the 60-second capture automatically once the tower passes 50 floors. The report is
shown on screen. This exists for touch-only devices such as the iPhone 11, which have no keys for
`4` / `B` / `P`. In builds without the perf tools, the parameter is ignored.

Exports are saved by the browser's download mechanism. Nothing is transmitted (Principle VII).
