import type Phaser from 'phaser';
import type { SimState, TowerType, TypeTuning } from '@skyline/sim';
import { BLOCK_WIDTH } from '@skyline/sim';
import { floorTextureKey, roofTextureKey } from './typeArt';
import { BASE_BLOCK_HEIGHT_PX, PX_PER_SU, TYPE_COLORS } from './renderConfig';

/** World-space center Y (px) of floor `i` (1-based; the foundation is `i = 0`). */
export function floorCenterY(i: number, blockHeightPx: number): number {
  return -(i - 0.5) * blockHeightPx;
}

/** World-space X (px) of a `su` coordinate. */
export function worldX(su: number): number {
  return su * PX_PER_SU;
}

/**
 * Renders the foundation and a pooled, culled set of floor images (FR-031), plus the landed roof.
 * Reads only sim state and the loop's interpolated sway; never writes it (Principle II).
 */
export class TowerRenderer {
  readonly blockHeightPx: number;
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private readonly foundation: Phaser.GameObjects.Image;
  private readonly roofImage: Phaser.GameObjects.Image;
  private roofPlacedAtSu: number | null = null;
  private roofPlacedAtFloor = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly type: TowerType,
    typeTuning: TypeTuning,
    viewportHeightPx: number,
    private readonly visualTiltMaxDeg: number,
  ) {
    this.blockHeightPx = (BASE_BLOCK_HEIGHT_PX * typeTuning.blockVisualHeight) / 1000;
    const color = TYPE_COLORS[type];
    const widthPx = BLOCK_WIDTH * PX_PER_SU;

    this.foundation = scene.add.image(0, this.blockHeightPx / 2, floorTextureKey(type));
    this.foundation.setTint(color);
    this.foundation.setDisplaySize(widthPx * 4, this.blockHeightPx);
    this.foundation.setDepth(0);

    const poolSize = Math.ceil(viewportHeightPx / this.blockHeightPx) + 4;
    for (let i = 0; i < poolSize; i += 1) {
      const img = scene.add.image(0, 0, floorTextureKey(type));
      img.setTint(color);
      img.setDisplaySize(widthPx, this.blockHeightPx);
      img.setVisible(false);
      img.setDepth(1);
      this.pool.push(img);
    }

    this.roofImage = scene.add.image(0, 0, roofTextureKey(type));
    this.roofImage.setTint(color);
    this.roofImage.setDisplaySize(widthPx, this.blockHeightPx);
    this.roofImage.setVisible(false);
    this.roofImage.setDepth(2);
  }

  /** Records where a landed roof (Completed/Built) sits, so it renders from then on. */
  placeRoof(finalRestX: number, offset: number, floorIndex: number): void {
    this.roofPlacedAtSu = finalRestX + offset;
    this.roofPlacedAtFloor = floorIndex + 1;
  }

  /**
   * Redraws the visible floors for the current frame. `interpolatedS` is the render-interpolated
   * top-floor shear displacement (su, float). `cameraTop`/`cameraBottom` are world-Y px bounds of
   * the current camera view, for culling.
   */
  update(
    state: Readonly<SimState>,
    interpolatedS: number,
    cameraTop: number,
    cameraBottom: number,
  ): void {
    const n = state.floors;
    let poolIndex = 0;
    for (let i = 1; i <= n && poolIndex < this.pool.length; i += 1) {
      const centerY = floorCenterY(i, this.blockHeightPx);
      if (centerY + this.blockHeightPx < cameraTop || centerY - this.blockHeightPx > cameraBottom) {
        continue;
      }
      const restXi = state.restX[i] ?? 0;
      const restXPrev = state.restX[i - 1] ?? 0;
      const displaySu = restXi + (interpolatedS * i) / n;
      const prevDisplaySu = restXPrev + (interpolatedS * (i - 1)) / n;
      const img = this.pool[poolIndex];
      poolIndex += 1;
      if (!img) {
        continue;
      }
      img.setVisible(true);
      img.x = worldX(displaySu);
      img.y = centerY;
      const localShearPx = worldX(displaySu - prevDisplaySu);
      img.angle = this.clampTiltDeg(localShearPx);
    }
    for (; poolIndex < this.pool.length; poolIndex += 1) {
      const img = this.pool[poolIndex];
      img?.setVisible(false);
    }

    if (this.roofPlacedAtSu !== null) {
      this.roofImage.setVisible(true);
      this.roofImage.x = worldX(this.roofPlacedAtSu);
      this.roofImage.y = floorCenterY(this.roofPlacedAtFloor, this.blockHeightPx);
    }
  }

  /** Pooled floor images currently visible (in view), for the collapse effect (T070). */
  getVisibleImages(): Phaser.GameObjects.Image[] {
    return this.pool.filter((img) => img.visible);
  }

  /** Texture key used for visible floors, for the collapse effect. */
  getFloorTextureKey(): string {
    return floorTextureKey(this.type);
  }

  private clampTiltDeg(localShearPx: number): number {
    const deg = (Math.atan(localShearPx / this.blockHeightPx) * 180) / Math.PI;
    if (deg > this.visualTiltMaxDeg) {
      return this.visualTiltMaxDeg;
    }
    if (deg < -this.visualTiltMaxDeg) {
      return -this.visualTiltMaxDeg;
    }
    return deg;
  }
}
