import type Phaser from 'phaser';
import type { RunResultKind, SimConfig, SimState } from '@skyline/sim';
import { iconTextureKey } from '../render/typeArt';
import { HUD_PANEL_ALPHA, HUD_PANEL_COLOR, HUD_TEXT_COLOR } from '../render/renderConfig';
import { formatCombo, formatFloors, STRINGS } from '../strings';

const PANEL_WIDTH = 260;
const PANEL_HEIGHT = 190;
const PANEL_MARGIN = 12;

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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: SimConfig,
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
  }

  /** True once the end-of-run banner is showing (used by the Playwright dev hook). */
  isResultVisible(): boolean {
    return this.resultBanner.visible;
  }

  hideResult(): void {
    this.resultBanner.setVisible(false);
    this.resultScoreText.setVisible(false);
    this.playAgainText.setVisible(false);
  }

  private iconType(): SimConfig['type'] {
    return this.config.type;
  }

  private layoutResultTexts(): void {
    const cx = this.scene.scale.width / 2;
    const cy = this.scene.scale.height / 2;
    this.resultBanner.setPosition(cx, cy - 40);
    this.resultScoreText.setPosition(cx, cy + 20);
    this.playAgainText.setPosition(cx, cy + 60);
  }
}
