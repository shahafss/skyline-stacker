import type Phaser from 'phaser';
import type { RunResultKind, SimConfig, SimState, TowerSim } from '@skyline/sim';
import { canPlaceRoof } from '@skyline/sim';
import { iconTextureKey } from '../render/typeArt';
import { HUD_PANEL_ALPHA, HUD_PANEL_COLOR, HUD_TEXT_COLOR } from '../render/renderConfig';
import { formatCombo, formatFloors, STRINGS } from '../strings';

const PANEL_WIDTH = 260;
const PANEL_HEIGHT = 190;
const PANEL_MARGIN = 12;
const ROOF_BUTTON_WIDTH = 220;
const ROOF_BUTTON_HEIGHT = 60;
const ROOF_BUTTON_COLOR = 0x2563eb;
const ROOF_BUTTON_ALPHA = 0.9;

function livesText(strikes: number, lives: number): string {
  const remaining = Math.max(0, lives - strikes);
  const used = Math.max(0, lives - remaining);
  return `${'●'.repeat(remaining)}${'○'.repeat(used)} ${String(remaining)}/${String(lives)}`;
}

/**
 * The canvas HUD (FR-034): score, lives, combo, floors, type + icon, ASSIST badge, and the result
 * banner. Drawn with a fixed camera (`setScrollFactor(0)`) so it never pans with the tower. All
 * text comes from `STRINGS`. Text objects are updated only when the caller calls `refresh`, not
 * every frame.
 */
export class Hud {
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly livesLabel: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly floorsText: Phaser.GameObjects.Text;
  private readonly typeText: Phaser.GameObjects.Text;
  private readonly typeIcon: Phaser.GameObjects.Image;
  private readonly assistBadge: Phaser.GameObjects.Text;

  private readonly resultBanner: Phaser.GameObjects.Text;
  private readonly resultScoreText: Phaser.GameObjects.Text;
  private readonly playAgainText: Phaser.GameObjects.Text;
  private readonly exportedText: Phaser.GameObjects.Text;

  private readonly roofButtonBg: Phaser.GameObjects.Rectangle;
  private readonly roofButtonText: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: SimConfig,
    private readonly sim: TowerSim,
  ) {
    const x = PANEL_MARGIN;
    const y = PANEL_MARGIN;

    this.panel = scene.add.rectangle(
      x,
      y,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      HUD_PANEL_COLOR,
      HUD_PANEL_ALPHA,
    );
    this.panel.setOrigin(0, 0);
    this.panel.setScrollFactor(0);
    this.panel.setDepth(100);

    const textStyle = { color: HUD_TEXT_COLOR, fontSize: '20px', fontFamily: 'monospace' };
    const pad = 12;
    this.scoreText = scene.add.text(x + pad, y + pad, '', textStyle);
    this.livesLabel = scene.add.text(x + pad, y + pad + 28, '', textStyle);
    this.comboText = scene.add.text(x + pad, y + pad + 56, '', textStyle);
    this.floorsText = scene.add.text(x + pad, y + pad + 84, '', textStyle);
    this.typeText = scene.add.text(x + pad + 36, y + pad + 112, '', textStyle);
    this.assistBadge = scene.add.text(x + pad, y + pad + 140, '', {
      ...textStyle,
      color: '#facc15',
    });

    this.typeIcon = scene.add.image(x + pad + 12, y + pad + 122, iconTextureKey(this.iconType()));
    this.typeIcon.setDisplaySize(28, 28);
    this.typeIcon.setScrollFactor(0);
    this.typeIcon.setDepth(101);

    for (const t of [
      this.scoreText,
      this.livesLabel,
      this.comboText,
      this.floorsText,
      this.typeText,
      this.assistBadge,
    ]) {
      t.setScrollFactor(0);
      t.setDepth(101);
    }

    this.typeText.setText(
      this.config.mode === 'quick' ? STRINGS.quickPlay : STRINGS.typeNames[this.config.type],
    );
    this.assistBadge.setText(this.config.assist ? STRINGS.hud.assist : '');

    this.resultBanner = scene.add.text(0, 0, '', {
      color: HUD_TEXT_COLOR,
      fontSize: '48px',
      fontFamily: 'monospace',
    });
    this.resultBanner.setScrollFactor(0);
    this.resultBanner.setDepth(200);
    this.resultBanner.setOrigin(0.5, 0.5);
    this.resultBanner.setVisible(false);

    this.resultScoreText = scene.add.text(0, 0, '', {
      color: HUD_TEXT_COLOR,
      fontSize: '28px',
      fontFamily: 'monospace',
    });
    this.resultScoreText.setScrollFactor(0);
    this.resultScoreText.setDepth(200);
    this.resultScoreText.setOrigin(0.5, 0.5);
    this.resultScoreText.setVisible(false);

    this.playAgainText = scene.add.text(0, 0, STRINGS.result.playAgain, {
      color: HUD_TEXT_COLOR,
      fontSize: '18px',
      fontFamily: 'monospace',
    });
    this.playAgainText.setScrollFactor(0);
    this.playAgainText.setDepth(200);
    this.playAgainText.setOrigin(0.5, 0.5);
    this.playAgainText.setVisible(false);

    this.exportedText = scene.add.text(0, 0, STRINGS.runExported, {
      color: HUD_TEXT_COLOR,
      fontSize: '16px',
      fontFamily: 'monospace',
    });
    this.exportedText.setScrollFactor(0);
    this.exportedText.setDepth(200);
    this.exportedText.setOrigin(0.5, 0.5);
    this.exportedText.setVisible(false);

    const roofX = this.scene.scale.width / 2;
    const roofY = this.scene.scale.height - 100;
    this.roofButtonBg = scene.add.rectangle(
      roofX,
      roofY,
      ROOF_BUTTON_WIDTH,
      ROOF_BUTTON_HEIGHT,
      ROOF_BUTTON_COLOR,
      ROOF_BUTTON_ALPHA,
    );
    this.roofButtonBg.setScrollFactor(0);
    this.roofButtonBg.setDepth(150);
    this.roofButtonBg.setVisible(false);
    this.roofButtonBg.setInteractive({ useHandCursor: true });
    this.roofButtonBg.on('pointerdown', this.handleRoofButtonDown);

    this.roofButtonText = scene.add.text(roofX, roofY, STRINGS.hud.placeRoof, {
      color: HUD_TEXT_COLOR,
      fontSize: '22px',
      fontFamily: 'monospace',
    });
    this.roofButtonText.setOrigin(0.5, 0.5);
    this.roofButtonText.setScrollFactor(0);
    this.roofButtonText.setDepth(151);
    this.roofButtonText.setVisible(false);

    this.layoutResultTexts();
    this.refresh(null);
  }

  /** Updates every HUD field from live state. Call on relevant events, not every frame. */
  refresh(state: Readonly<SimState> | null): void {
    const lives = this.config.tuning.global.LIVES;
    const strikes = state?.strikes ?? 0;
    const score = state?.score ?? 0;
    const combo = state?.comboMult ?? 1000;
    const floors = state?.floors ?? 0;

    this.scoreText.setText(`${STRINGS.hud.score}: ${String(score)}`);
    this.livesLabel.setText(`${STRINGS.hud.lives}: ${livesText(strikes, lives)}`);
    this.comboText.setText(`${STRINGS.hud.combo}: ${formatCombo(combo)}`);

    if (this.config.mode === 'quick') {
      this.floorsText.setText(`${STRINGS.hud.floors}: ${formatFloors(floors)}`);
    } else {
      const target = this.config.tuning.types[this.config.type].targetFloors;
      this.floorsText.setText(`${STRINGS.hud.floors}: ${formatFloors(floors, target)}`);
    }
  }

  /** Shows the end-of-run banner with the final score. */
  showResult(result: RunResultKind, finalScore: number): void {
    const label =
      result === 'completed'
        ? STRINGS.result.completed
        : result === 'built'
          ? STRINGS.result.built
          : STRINGS.result.gameOver;
    this.resultBanner.setText(label);
    this.resultScoreText.setText(`${STRINGS.hud.score}: ${String(finalScore)}`);
    this.resultBanner.setVisible(true);
    this.resultScoreText.setVisible(true);
    this.playAgainText.setVisible(true);
    this.exportedText.setVisible(false);
  }

  /** True once the end-of-run banner is showing (used by the Playwright dev hook). */
  isResultVisible(): boolean {
    return this.resultBanner.visible;
  }

  hideResult(): void {
    this.resultBanner.setVisible(false);
    this.resultScoreText.setVisible(false);
    this.playAgainText.setVisible(false);
    this.exportedText.setVisible(false);
  }

  /** Shows the "Run exported" notice in the HUD banner after a successful export (FR-041). */
  showExportedNotice(): void {
    this.exportedText.setVisible(true);
  }

  /**
   * Re-checks `canPlaceRoof(sim)` and shows/hides the Place Roof button accordingly (T079). Safe
   * to call after any event: eligibility (mode, phase, floors, `roofCommitted`, result) already
   * covers every show/hide rule in contracts/controls.md.
   */
  updateRoofButtonVisibility(): void {
    const visible = canPlaceRoof(this.sim);
    this.roofButtonBg.setVisible(visible);
    this.roofButtonText.setVisible(visible);
  }

  /** True while the Place Roof button is shown (used by the Playwright dev hook). */
  isRoofButtonVisible(): boolean {
    return this.roofButtonBg.visible;
  }

  /** The interactive object InputController's hit-list guard checks against (research R9). */
  getRoofButtonGameObject(): Phaser.GameObjects.GameObject {
    return this.roofButtonBg;
  }

  /** Screen-space bounds of the button while visible, for the Playwright dev hook; else `null`. */
  getRoofButtonBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this.roofButtonBg.visible) {
      return null;
    }
    const bounds = this.roofButtonBg.getBounds();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }

  private readonly handleRoofButtonDown = (
    _pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event: { stopPropagation: () => void },
  ): void => {
    this.sim.requestRoof();
    event.stopPropagation();
  };

  private iconType(): SimConfig['type'] {
    return this.config.type;
  }

  private layoutResultTexts(): void {
    const cx = this.scene.scale.width / 2;
    const cy = this.scene.scale.height / 2;
    this.resultBanner.setPosition(cx, cy - 40);
    this.resultScoreText.setPosition(cx, cy + 20);
    this.playAgainText.setPosition(cx, cy + 60);
    this.exportedText.setPosition(cx, cy + 90);
  }
}
