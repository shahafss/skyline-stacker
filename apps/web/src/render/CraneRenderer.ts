import type Phaser from 'phaser';
import type { SimState, TowerType, GlobalTuning } from '@skyline/sim';
import { BLOCK_WIDTH, PHASE_FALLING, PHASE_SPAWN_DELAY, PHASE_SWINGING } from '@skyline/sim';
import { floorTextureKey, roofTextureKey } from './typeArt';
import { worldX } from './TowerRenderer';
import { PX_PER_SU, TYPE_COLORS } from './renderConfig';

const HOOK_LINE_LENGTH_PX = 300;

/**
 * Renders the crane hook line, trolley and the carried/falling block. Reads only sim state and
 * the loop's interpolated snapshot values; never writes them (Principle II).
 */
export class CraneRenderer {
  private readonly hookLine: Phaser.GameObjects.Rectangle;
  private readonly trolley: Phaser.GameObjects.Rectangle;
  private readonly block: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    private readonly type: TowerType,
    private readonly blockHeightPx: number,
    private readonly tuning: GlobalTuning,
  ) {
    const color = TYPE_COLORS[type];
    this.hookLine = scene.add.rectangle(0, 0, 4, HOOK_LINE_LENGTH_PX, 0xffffff, 0.6);
    this.hookLine.setDepth(5);
    this.trolley = scene.add.rectangle(0, 0, 40, 16, 0xffffff, 0.9);
    this.trolley.setDepth(5);
    this.block = scene.add.image(0, 0, floorTextureKey(type));
    this.block.setTint(color);
    this.block.setDisplaySize(BLOCK_WIDTH * PX_PER_SU, blockHeightPx);
    this.block.setDepth(6);
  }

  /**
   * `craneX`/`hookY` are the render-interpolated hook position (su and world px). `fallProgress`
   * is the render-interpolated ticks-since-release (float). `towerTopY` is the world-Y the block
   * lands at.
   */
  update(
    state: Readonly<SimState>,
    craneXSu: number,
    hookY: number,
    fallProgress: number,
    towerTopY: number,
  ): void {
    if (state.phase === PHASE_SPAWN_DELAY) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);

    const hookX = worldX(craneXSu);
    this.hookLine.x = hookX;
    this.hookLine.y = hookY - HOOK_LINE_LENGTH_PX / 2;
    this.trolley.x = hookX;
    this.trolley.y = hookY;

    this.block.setTexture(
      state.isRoof === 1 ? roofTextureKey(this.type) : floorTextureKey(this.type),
    );

    if (state.phase === PHASE_SWINGING) {
      this.block.setVisible(true);
      this.block.x = hookX;
      this.block.y = hookY + this.blockHeightPx / 2;
      this.block.angle = 0;
    } else if (state.phase === PHASE_FALLING) {
      const p = Math.min(1, fallProgress / this.tuning.DROP_FALL_TICKS);
      const eased = p * p;
      this.block.setVisible(true);
      this.block.x = worldX(state.releaseX);
      this.block.y = hookY + (towerTopY - hookY) * eased;
      this.block.angle = 0;
    } else {
      this.block.setVisible(false);
    }
  }

  private setVisible(visible: boolean): void {
    this.hookLine.setVisible(visible);
    this.trolley.setVisible(visible);
    if (!visible) {
      this.block.setVisible(false);
    }
  }
}
