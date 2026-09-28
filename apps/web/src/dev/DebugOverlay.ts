import type Phaser from 'phaser';
import type { SimState } from '@skyline/sim';
import { STRINGS } from '../strings';

const PANEL_MARGIN = 12;
const PANEL_WIDTH = 220;
const ROW_HEIGHT = 20;
const ROW_PAD = 8;
/** Refreshes at most 10 times per second (Principle VI): dev overlay text is never rebuilt per frame. */
const UPDATE_INTERVAL_MS = 100;

interface DebugFieldDef {
  readonly key: keyof DebugSnapshot;
  readonly label: string;
}

const FIELDS: readonly DebugFieldDef[] = [
  { key: 'tick', label: STRINGS.debug.tick },
  { key: 'lastOffset', label: STRINGS.debug.lastOffset },
  { key: 'lastTier', label: STRINGS.debug.lastTier },
  { key: 'swayTarget', label: STRINGS.debug.swayTarget },
  { key: 'swayAmp', label: STRINGS.debug.swayAmp },
  { key: 'lean', label: STRINGS.debug.lean },
  { key: 'craneSpeed', label: STRINGS.debug.craneSpeed },
  { key: 'sensitivity', label: STRINGS.debug.sensitivity },
  { key: 'stabilizer', label: STRINGS.debug.stabilizer },
  { key: 'combo', label: STRINGS.debug.combo },
  { key: 'fps', label: STRINGS.debug.fps },
];

/** The raw values `DebugOverlay` displays (FR-037), read once per frame from live state. */
export interface DebugSnapshot {
  tick: number;
  lastOffset: number;
  lastTier: number;
  swayTarget: number;
  swayAmp: number;
  lean: number;
  craneSpeed: number;
  sensitivity: number;
  stabilizer: number;
  combo: number;
  fps: number;
}

/** Builds a `DebugSnapshot` from live sim state and the scene's measured frame rate. */
export function readDebugSnapshot(state: Readonly<SimState>, actualFps: number): DebugSnapshot {
  return {
    tick: state.tick,
    lastOffset: state.lastOffset,
    lastTier: state.lastTier,
    swayTarget: state.swayTarget,
    swayAmp: state.swayAmp,
    lean: state.lean,
    craneSpeed: state.craneSpeed,
    sensitivity: state.sensitivity,
    stabilizer: state.stabilizer,
    combo: state.comboMult,
    fps: Math.round(actualFps),
  };
}

/**
 * The `D`-toggled debug overlay (FR-037), present in every Phase 1 build. One text object per
 * field is created once; `update` calls `setText` only for a field whose value changed, and does
 * so at most 10 times per second (Principle VI).
 */
export class DebugOverlay {
  private isVisible = false;
  private msSinceUpdate = UPDATE_INTERVAL_MS;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly texts = new Map<keyof DebugSnapshot, Phaser.GameObjects.Text>();
  private readonly lastValues = new Map<keyof DebugSnapshot, number>();

  constructor(scene: Phaser.Scene) {
    const x = scene.scale.width - PANEL_WIDTH - PANEL_MARGIN;
    const y = PANEL_MARGIN;
    const height = FIELDS.length * ROW_HEIGHT + ROW_PAD * 2;

    this.panel = scene.add.rectangle(x, y, PANEL_WIDTH, height, 0x111827, 0.85);
    this.panel.setOrigin(0, 0);
    this.panel.setScrollFactor(0);
    this.panel.setDepth(300);
    this.panel.setVisible(false);

    const textStyle = { color: '#ffffff', fontSize: '13px', fontFamily: 'monospace' };
    FIELDS.forEach((field, i) => {
      const text = scene.add.text(x + ROW_PAD, y + ROW_PAD + i * ROW_HEIGHT, '', textStyle);
      text.setScrollFactor(0);
      text.setDepth(301);
      text.setVisible(false);
      this.texts.set(field.key, text);
    });
  }

  /** True while the overlay is shown. */
  get visible(): boolean {
    return this.isVisible;
  }

  /** Toggles the overlay on/off (bound to key `D`). */
  toggle(): void {
    this.isVisible = !this.isVisible;
    this.panel.setVisible(this.isVisible);
    for (const text of this.texts.values()) {
      text.setVisible(this.isVisible);
    }
    if (this.isVisible) {
      this.lastValues.clear();
      this.msSinceUpdate = UPDATE_INTERVAL_MS;
    }
  }

  /** Refreshes changed fields, throttled to `UPDATE_INTERVAL_MS`. No-op while hidden. */
  update(snapshot: Readonly<DebugSnapshot>, deltaMs: number): void {
    if (!this.isVisible) {
      return;
    }
    this.msSinceUpdate += deltaMs;
    if (this.msSinceUpdate < UPDATE_INTERVAL_MS) {
      return;
    }
    this.msSinceUpdate = 0;
    for (const field of FIELDS) {
      const value = snapshot[field.key];
      if (this.lastValues.get(field.key) === value) {
        continue;
      }
      this.lastValues.set(field.key, value);
      this.texts.get(field.key)?.setText(`${field.label}: ${String(value)}`);
    }
  }
}
