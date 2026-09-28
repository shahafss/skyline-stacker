import Phaser from 'phaser';
import type { RunResult, SimConfig, SimEvent, TowerSim } from '@skyline/sim';
import { DEFAULT_TUNING, PHASE_FALLING, cloneTuning, createSim } from '@skyline/sim';
import { FixedStepLoop, type RenderSnapshot } from '../loop/FixedStepLoop';
import { InputController, createRoofButtonHitTest } from '../input/InputController';
import { TowerRenderer, floorCenterY, worldX } from '../render/TowerRenderer';
import { CraneRenderer } from '../render/CraneRenderer';
import { CameraRig, computeHookTargetY } from '../render/CameraRig';
import { MissFx } from '../fx/MissFx';
import { CollapseFx } from '../fx/CollapseFx';
import { Particles } from '../fx/Particles';
import { Hud } from '../hud/Hud';
import { setupVisibilityAutoPause } from '../lifecycle/visibility';
import { DebugOverlay, createDebugSnapshot, refreshDebugSnapshot } from '../dev/DebugOverlay';
import type { TuningPanel } from '../dev/TuningPanel';
import type { PerfCapture } from '../dev/PerfCapture';
import type { AutoBot } from '../dev/AutoBot';
import { buildDownload, triggerDownload } from '../export/runExport';

/** Floor count at which `?perf=luxury` begins its capture automatically (research R16). */
const PERF_AUTO_RUN_FLOOR_THRESHOLD = 50;

export interface GameSceneData {
  config?: SimConfig;
  /** Set by `BootScene` for `?perf=luxury`: turns the bot on and auto-starts the capture past
   * floor 50. Ignored unless perf tools are included in the build. */
  perfAutoRun?: boolean;
}

export function randomSeed(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] ?? 0;
}

/** True in dev, or in a production build made with `VITE_PERF_TOOLS=1` (contracts/controls.md). */
function perfToolsActive(): boolean {
  return import.meta.env.DEV || __PERF_TOOLS__;
}

function buildDefaultConfig(): SimConfig {
  return {
    type: 'residential',
    mode: 'city',
    seed: randomSeed(),
    assist: false,
    tuning: cloneTuning(DEFAULT_TUNING),
  };
}

/**
 * Wires the sim to the renderers, camera, fx, HUD and input, and drives the fixed-step render
 * loop from Phaser's `update(time, delta)`. `apps/web` reads sim state; it never writes it except
 * through `requestDrop()` / `requestRoof()` (Principle II).
 */
export class GameScene extends Phaser.Scene {
  private sim!: TowerSim;
  private runConfig!: SimConfig;
  private loop!: FixedStepLoop;
  private towerRenderer!: TowerRenderer;
  private craneRenderer!: CraneRenderer;
  private cameraRig!: CameraRig;
  private missFx!: MissFx;
  private collapseFx!: CollapseFx;
  private particles!: Particles;
  private hud!: Hud;
  private inputController!: InputController;
  private debugOverlay!: DebugOverlay;
  private readonly debugSnapshot = createDebugSnapshot();
  private tuningPanel: TuningPanel | null = null;
  private perfCapture: PerfCapture | null = null;
  private autoBot: AutoBot | null = null;
  // Guard the dynamic imports below (W1): several call sites can request the perf tools before
  // the first import resolves (e.g. `P`/`B` pressed twice, or `?perf=luxury` racing a keypress),
  // and without these flags each would start its own import and clobber the other's instance.
  private perfCaptureLoading = false;
  private autoBotLoading = false;
  private perfAutoRun = false;
  private perfAutoStarted = false;
  private removeVisibilityListener: (() => void) | null = null;

  constructor() {
    super({
      key: 'Game',
      physics: {
        matter: { gravity: { x: 0, y: 1 }, enableSleeping: false },
      },
    });
  }

  init(data: GameSceneData): void {
    this.runConfig = data.config ?? buildDefaultConfig();
    this.perfAutoRun = data.perfAutoRun === true && perfToolsActive();
    this.perfAutoStarted = false;
  }

  create(): void {
    this.sim = createSim(this.runConfig);

    const typeTuning = this.runConfig.tuning.types[this.runConfig.type];

    this.towerRenderer = new TowerRenderer(
      this,
      this.runConfig.type,
      typeTuning,
      this.scale.height,
      this.runConfig.tuning.global.VISUAL_TILT_MAX_DEG,
    );
    this.craneRenderer = new CraneRenderer(
      this,
      this.runConfig.type,
      this.towerRenderer.blockHeightPx,
      this.runConfig.tuning.global,
    );
    this.cameraRig = new CameraRig(this.cameras.main, this.scale.width, this.scale.height);
    this.cameraRig.snapTo(
      0,
      computeHookTargetY(
        0,
        this.towerRenderer.blockHeightPx,
        this.runConfig.tuning.global.CAMERA_HOOK_CLEARANCE,
      ),
    );

    this.missFx = new MissFx(this, this.runConfig.type, this.towerRenderer.blockHeightPx);
    this.collapseFx = new CollapseFx(this);
    this.particles = new Particles(this);
    this.hud = new Hud(this, this.runConfig, this.sim);
    this.hud.refresh(this.sim.getState());
    this.hud.updateRoofButtonVisibility();

    this.inputController = new InputController(this, this.sim);
    this.inputController.setRoofButtonHitTest(
      createRoofButtonHitTest(this, this.hud.getRoofButtonGameObject()),
    );

    this.debugOverlay = new DebugOverlay(this);

    this.input.on('pointerdown', this.maybeReturnToSelect);
    this.input.keyboard?.on('keydown-SPACE', this.maybeReturnToSelect);
    this.input.keyboard?.on('keydown-ESC', this.returnToSelect);
    this.input.keyboard?.on('keydown-D', this.toggleDebugOverlay);
    this.input.keyboard?.on('keydown-T', this.toggleTuningPanel);
    this.input.keyboard?.on('keydown-E', this.exportRun);
    this.input.keyboard?.on('keydown-P', this.togglePerfCapture);
    this.input.keyboard?.on('keydown-B', this.toggleAutoBot);

    if (import.meta.env.DEV || __PERF_TOOLS__) {
      if (this.perfAutoRun) {
        this.loadAutoBot((autoBot) => {
          autoBot.setEnabled(true);
        });
      }
    }

    this.loop = new FixedStepLoop({
      step: () => this.sim.step(),
      readSnapshot: (out) => {
        this.readSnapshot(out);
      },
      onEvents: (events) => {
        this.handleEvents(events as readonly SimEvent[]);
      },
    });

    this.removeVisibilityListener = setupVisibilityAutoPause(this.game, this.loop);

    if (import.meta.env.DEV) {
      window.__skyline = {
        getState: () => this.sim.getState(),
        getInputLog: () => this.sim.getInputLog(),
        getResult: () => this.sim.getResult(),
        isResultVisible: () => this.hud.isResultVisible(),
        isRoofButtonVisible: () => this.hud.isRoofButtonVisible(),
        getRoofButtonBounds: () => this.hud.getRoofButtonBounds(),
      };
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.removeVisibilityListener?.();
      this.input.keyboard?.off('keydown-D', this.toggleDebugOverlay);
      this.input.keyboard?.off('keydown-T', this.toggleTuningPanel);
      this.input.keyboard?.off('keydown-E', this.exportRun);
      this.input.keyboard?.off('keydown-P', this.togglePerfCapture);
      this.input.keyboard?.off('keydown-B', this.toggleAutoBot);
      this.tuningPanel?.destroy();
      this.tuningPanel = null;
      this.perfCapture?.destroy();
      this.perfCapture = null;
      this.autoBot = null;
    });
  }

  override update(_time: number, delta: number): void {
    this.loop.advance(delta);
    this.render();
    refreshDebugSnapshot(
      this.debugSnapshot,
      this.debugOverlay.visible,
      this.sim.getState(),
      this.game.loop.actualFps,
    );
    if (this.debugOverlay.visible) {
      this.debugOverlay.update(this.debugSnapshot, delta);
    }
    this.autoBot?.update();
    // Phaser 4.2.1 smooths `delta` over the last 10 frames, which under-reports the true worst
    // frame and can hide over-budget frames entirely (C2); `rawDelta` is the unsmoothed value.
    this.perfCapture?.update(this.game.loop.rawDelta);
    this.maybeStartPerfAutoRunCapture();
  }

  /** For `?perf=luxury` (research R16): starts the capture once the tower passes 50 floors. */
  private maybeStartPerfAutoRunCapture(): void {
    if (!(import.meta.env.DEV || __PERF_TOOLS__)) {
      return;
    }
    if (!this.perfAutoRun || this.perfAutoStarted) {
      return;
    }
    if (this.sim.getState().floors <= PERF_AUTO_RUN_FLOOR_THRESHOLD) {
      return;
    }
    this.perfAutoStarted = true;
    if (this.perfCapture) {
      this.perfCapture.start();
      return;
    }
    this.loadPerfCapture((perfCapture) => {
      perfCapture.start();
    });
  }

  private readSnapshot(out: RenderSnapshot): void {
    const state = this.sim.getState();
    out.craneX = state.craneX;
    out.swayS = state.swayS;
    out.fallTicks = state.phase === PHASE_FALLING ? state.tick - state.releaseTick : 0;
    out.cameraTargetY = computeHookTargetY(
      state.floors,
      this.towerRenderer.blockHeightPx,
      this.runConfig.tuning.global.CAMERA_HOOK_CLEARANCE,
    );
  }

  private render(): void {
    const state = this.sim.getState();
    const alpha = this.loop.alpha;
    const { prev, curr } = this.loop;

    const interpS = prev.swayS + (curr.swayS - prev.swayS) * alpha;
    const interpCraneX = prev.craneX + (curr.craneX - prev.craneX) * alpha;
    const interpCameraY = prev.cameraTargetY + (curr.cameraTargetY - prev.cameraTargetY) * alpha;
    const interpFallTicks = prev.fallTicks + (curr.fallTicks - prev.fallTicks) * alpha;

    this.cameraRig.update(state.craneCenterX, interpCameraY);
    const viewTop = this.cameraRig.viewTop;
    const viewBottom = this.cameraRig.viewBottom;
    this.towerRenderer.update(state, interpS, viewTop, viewBottom);

    const towerTopY = floorCenterY(state.floors + 1, this.towerRenderer.blockHeightPx);
    this.craneRenderer.update(state, interpCraneX, interpCameraY, interpFallTicks, towerTopY);

    this.missFx.update(
      viewTop,
      viewBottom,
      this.cameras.main.scrollX,
      this.cameras.main.scrollX + this.scale.width,
    );
  }

  private handleEvents(events: readonly SimEvent[]): void {
    if (events.length === 0) {
      return;
    }
    this.hud.updateRoofButtonVisibility();
    let refreshHud = false;
    for (const event of events) {
      switch (event.kind) {
        case 'land':
          refreshHud = true;
          this.handleLand(event);
          break;
        case 'miss':
          refreshHud = true;
          this.handleMiss(event);
          break;
        case 'comboChanged':
        case 'spawn':
        case 'roofAvailable':
        case 'roofPlaced':
          refreshHud = true;
          break;
        case 'finished':
          refreshHud = true;
          this.hud.showResult(event.result, event.score);
          break;
        case 'gameOver':
          refreshHud = true;
          this.handleGameOver(event.score);
          break;
        case 'release':
          break;
      }
    }
    if (refreshHud) {
      this.hud.refresh(this.sim.getState());
    }
  }

  private handleLand(event: Extract<SimEvent, { kind: 'land' }>): void {
    const state = this.sim.getState();
    const floorIndex = event.roof ? state.floors + 1 : state.floors;
    const restXAtFloor = event.roof
      ? (state.restX[state.floors] ?? 0) + event.offset
      : (state.restX[state.floors] ?? 0);
    const y = floorCenterY(floorIndex, this.towerRenderer.blockHeightPx);
    this.particles.landingDust(worldX(restXAtFloor), y);
    if (event.tier === 'perfect') {
      this.particles.perfectSpark(worldX(restXAtFloor), y);
    }
    if (event.roof) {
      this.towerRenderer.placeRoof(state.restX[state.floors] ?? 0, event.offset, state.floors);
    }
  }

  private handleMiss(event: Extract<SimEvent, { kind: 'miss' }>): void {
    const state = this.sim.getState();
    const y = floorCenterY(state.floors + 1, this.towerRenderer.blockHeightPx);
    this.missFx.spawn(state.releaseX, y, event.offset);
  }

  private handleGameOver(finalScore: number): void {
    this.hud.showResult('gameOver', finalScore);
    const state = this.sim.getState();
    const swayDirection = state.swayS >= 0 ? 1 : -1;
    this.collapseFx.collapse(this.towerRenderer.getVisibleImages(), swayDirection);
    const y = floorCenterY(state.floors, this.towerRenderer.blockHeightPx);
    this.particles.collapseDebris(worldX(state.lean), y);
  }

  private readonly maybeReturnToSelect = (): void => {
    const result: RunResult | null = this.sim.getResult();
    if (result === null) {
      return;
    }
    this.returnToSelect();
  };

  private readonly returnToSelect = (): void => {
    this.scene.start('Select');
  };

  private readonly toggleDebugOverlay = (): void => {
    this.debugOverlay.toggle();
  };

  /** Downloads the finished run as JSON (FR-041), active only after a result, every build. */
  private readonly exportRun = (): void => {
    const download = buildDownload(this.sim);
    if (download === null) {
      return;
    }
    triggerDownload(download);
    this.hud.showExportedNotice();
  };

  /** Dynamically imports the dev-only tuning panel on first use (FR-038), DEV builds only. */
  private readonly toggleTuningPanel = (): void => {
    if (!import.meta.env.DEV) {
      return;
    }
    if (this.tuningPanel) {
      this.tuningPanel.destroy();
      this.tuningPanel = null;
      return;
    }
    void import('../dev/TuningPanel').then(({ TuningPanel }) => {
      this.tuningPanel = new TuningPanel(this.runConfig, (config) => {
        this.tuningPanel?.destroy();
        this.tuningPanel = null;
        this.scene.restart({ config });
      });
    });
  };

  /**
   * Dynamically imports the dev-only perf capture on first use (research R16), included only in
   * DEV or `VITE_PERF_TOOLS=1` builds (contracts/controls.md `P`).
   */
  private readonly togglePerfCapture = (): void => {
    if (!(import.meta.env.DEV || __PERF_TOOLS__)) {
      return;
    }
    if (this.perfCapture) {
      this.perfCapture.toggle();
      return;
    }
    this.loadPerfCapture((perfCapture) => {
      perfCapture.toggle();
    });
  };

  /**
   * Dynamically imports the dev-only auto-drop bot on first use (T090), included only in DEV or
   * `VITE_PERF_TOOLS=1` builds (contracts/controls.md `B`).
   */
  private readonly toggleAutoBot = (): void => {
    if (!(import.meta.env.DEV || __PERF_TOOLS__)) {
      return;
    }
    if (this.autoBot) {
      this.autoBot.toggle();
      return;
    }
    this.loadAutoBot((autoBot) => {
      autoBot.toggle();
    });
  };

  /**
   * Loads `PerfCapture` on first use. The dev/`__PERF_TOOLS__` guard lives here, in the same
   * function as the `import()` call (matching `toggleTuningPanel`), so a plain production build
   * can dead-code-eliminate the whole `if` block, including the `import()`, and emit no chunk
   * (K1); a guard only in the callers doesn't stop this method's own `import()` from being
   * reachable. Also guards against the import being kicked off twice (W1) if `P` is pressed
   * again, or `?perf=luxury`'s auto-start fires, while an earlier import is still pending. Callers
   * that already hold `this.perfCapture` must check that themselves first.
   */
  private loadPerfCapture(onReady: (perfCapture: PerfCapture) => void): void {
    if (!(import.meta.env.DEV || __PERF_TOOLS__)) {
      return;
    }
    if (this.perfCaptureLoading) {
      return;
    }
    this.perfCaptureLoading = true;
    void import('../dev/PerfCapture').then(({ PerfCapture }) => {
      this.perfCaptureLoading = false;
      if (this.perfCapture) {
        return;
      }
      this.perfCapture = new PerfCapture(this);
      onReady(this.perfCapture);
    });
  }

  /**
   * Loads `AutoBot` on first use. The dev/`__PERF_TOOLS__` guard lives here, in the same function
   * as the `import()` call (matching `toggleTuningPanel`), so a plain production build can
   * dead-code-eliminate the whole `if` block, including the `import()`, and emit no chunk (K1); a
   * guard only in the callers doesn't stop this method's own `import()` from being reachable. Also
   * guards against the import being kicked off twice (W1) if `B` is pressed again, or
   * `?perf=luxury`'s auto-start fires, while an earlier import is still pending. Callers that
   * already hold `this.autoBot` must check that themselves first.
   */
  private loadAutoBot(onReady: (autoBot: AutoBot) => void): void {
    if (!(import.meta.env.DEV || __PERF_TOOLS__)) {
      return;
    }
    if (this.autoBotLoading) {
      return;
    }
    this.autoBotLoading = true;
    void import('../dev/AutoBot').then(({ AutoBot }) => {
      this.autoBotLoading = false;
      if (this.autoBot) {
        return;
      }
      this.autoBot = new AutoBot(this.sim);
      onReady(this.autoBot);
    });
  }
}
