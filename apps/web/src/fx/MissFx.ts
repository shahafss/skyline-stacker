import type Phaser from 'phaser';
import type { TowerType } from '@skyline/sim';
import { BLOCK_WIDTH } from '@skyline/sim';
import { floorTextureKey } from '../render/typeArt';
import { worldX } from '../render/TowerRenderer';
import { PX_PER_SU, TYPE_COLORS } from '../render/renderConfig';

type MatterImage = Phaser.Physics.Matter.Image;

/**
 * On a Miss, slides the block off visually with a Matter body (Principle II: never read back by
 * the sim). Bodies are removed once they leave the camera view.
 */
export class MissFx {
  private readonly bodies: MatterImage[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly type: TowerType,
    private readonly blockHeightPx: number,
  ) {}

  /** Spawns a sliding block at the frozen release X, one block above the current top floor. */
  spawn(releaseXSu: number, landingWorldY: number, offset: number): void {
    const widthPx = BLOCK_WIDTH * PX_PER_SU;
    const x = worldX(releaseXSu);
    const body = this.scene.matter.add.image(x, landingWorldY, floorTextureKey(this.type));
    body.setTint(TYPE_COLORS[this.type]);
    body.setDisplaySize(widthPx, this.blockHeightPx);
    body.setRectangle(widthPx, this.blockHeightPx);
    body.setFriction(0.05, 0.01);
    body.setBounce(0.2);
    const direction = offset >= 0 ? 1 : -1;
    body.setVelocity(direction * 6, -3);
    body.setAngularVelocity(direction * 0.06);
    this.bodies.push(body);
  }

  /** Destroys any body that has fallen or slid outside the given world bounds. */
  update(worldTop: number, worldBottom: number, worldLeft: number, worldRight: number): void {
    for (let i = this.bodies.length - 1; i >= 0; i -= 1) {
      const body = this.bodies[i];
      if (!body) continue;
      if (
        body.y > worldBottom + 400 ||
        body.y < worldTop - 400 ||
        body.x < worldLeft - 400 ||
        body.x > worldRight + 400
      ) {
        body.destroy();
        this.bodies.splice(i, 1);
      }
    }
  }
}
