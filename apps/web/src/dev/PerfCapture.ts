import type Phaser from 'phaser';
import {
  computePerfReport,
  createCaptureBuffer,
  formatPerfReport,
  isCaptureComplete,
  recordFrame,
} from './perfCaptureModel';

const PANEL_MARGIN = 12;
const PANEL_WIDTH = 240;
const PANEL_HEIGHT = 140;

/**
 * Dev-only perf capture (T090, research R16). Included only via dynamic `import()` guarded by
 * `import.meta.env.DEV || __PERF_TOOLS__` (contracts/controls.md `P`). Records 60 seconds of
 * frame times into a preallocated buffer (Principle VI) and shows the report on screen. Its
 * overlay text is inline and exempt from `strings.ts` (plan.md interpretations).
 */
export class PerfCapture {
  private readonly buffer = createCaptureBuffer();
  private count = 0;
  private elapsedMs = 0;
  private capturing = false;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const x = PANEL_MARGIN;
    const y = scene.scale.height - PANEL_HEIGHT - PANEL_MARGIN;

    this.panel = scene.add.rectangle(x, y, PANEL_WIDTH, PANEL_HEIGHT, 0x111827, 0.85);
    this.panel.setOrigin(0, 0);
    this.panel.setScrollFactor(0);
    this.panel.setDepth(300);
    this.panel.setVisible(false);

    this.text = scene.add.text(x + 8, y + 8, '', {
      color: '#ffffff',
      fontSize: '13px',
      fontFamily: 'monospace',
    });
    this.text.setScrollFactor(0);
    this.text.setDepth(301);
    this.text.setVisible(false);
  }

  get isCapturing(): boolean {
    return this.capturing;
  }

  /** Toggles the capture on/off (bound to key `P`). Stopping early shows no report. */
  toggle(): void {
    if (this.capturing) {
      this.cancel();
    } else {
      this.start();
    }
  }

  /** Starts (or restarts) a fresh 60-second capture. Idempotent while already capturing. */
  start(): void {
    if (this.capturing) {
      return;
    }
    this.count = 0;
    this.elapsedMs = 0;
    this.capturing = true;
    this.panel.setVisible(true);
    this.text.setVisible(true);
    this.text.setText('Perf capture running...');
  }

  private cancel(): void {
    this.capturing = false;
    this.panel.setVisible(false);
    this.text.setVisible(false);
  }

  private finish(): void {
    this.capturing = false;
    const report = computePerfReport(this.buffer, this.count);
    this.text.setText(formatPerfReport(report));
  }

  /** Called every frame from `GameScene.update`; no-op while not capturing. */
  update(deltaMs: number): void {
    if (!this.capturing) {
      return;
    }
    this.count = recordFrame(this.buffer, this.count, deltaMs);
    this.elapsedMs += deltaMs;
    if (isCaptureComplete(this.elapsedMs, this.count, this.buffer.length)) {
      this.finish();
    }
  }

  destroy(): void {
    this.panel.destroy();
    this.text.destroy();
  }
}
