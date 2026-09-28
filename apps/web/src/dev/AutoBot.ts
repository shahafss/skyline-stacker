import type { TowerSim } from '@skyline/sim';
import { PHASE_SWINGING } from '@skyline/sim';
import { shouldDropNow } from './autoBotModel';

/**
 * Dev-only auto-drop bot (T090), used for perf runs. Included only via dynamic `import()`
 * guarded by `import.meta.env.DEV || __PERF_TOOLS__` (contracts/controls.md `B`). Reads
 * `craneX`, `swayPhase`, `swayAmp`, `swayTarget`, `swayIncrement` and `restX` from sim state, plus
 * `DROP_FALL_TICKS`/`PERFECT_MAX` from the run's tuning, and never writes state directly, only
 * through `requestDrop()` (Principle II).
 */
export class AutoBot {
  private enabled = false;

  constructor(private readonly sim: TowerSim) {}

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Toggles the bot on/off (bound to key `B`). */
  toggle(): void {
    this.enabled = !this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Called every frame from `GameScene.update`; no-op while disabled or not swinging. */
  update(): void {
    if (!this.enabled) {
      return;
    }
    const state = this.sim.getState();
    if (state.phase !== PHASE_SWINGING) {
      return;
    }
    const { global } = this.sim.getConfig().tuning;
    const restX = state.restX[state.floors] ?? 0;
    if (
      shouldDropNow(
        state.craneX,
        restX,
        state.swayPhase,
        state.swayAmp,
        state.swayTarget,
        state.swayIncrement,
        global.DROP_FALL_TICKS,
        global.PERFECT_MAX,
      )
    ) {
      this.sim.requestDrop();
    }
  }
}
