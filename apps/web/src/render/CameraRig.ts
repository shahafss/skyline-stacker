import type Phaser from 'phaser';
import { worldX } from './TowerRenderer';
import { CAMERA_HORIZONTAL_SMOOTHING, CAMERA_VERTICAL_SMOOTHING } from './renderConfig';

/**
 * The world-Y (px) the camera keeps the crane hook at: `hookClearance` block heights above the
 * top floor (PRD §3.10).
 */
export function computeHookTargetY(
  floors: number,
  blockHeightPx: number,
  hookClearance: number,
): number {
  const topOfTowerY = -floors * blockHeightPx;
  return topOfTowerY - hookClearance * blockHeightPx;
}

/**
 * Smoothly pans and follows the tower: vertically toward the hook-clearance target, horizontally
 * toward the crane center. The targets are already tick-interpolated by the caller; this class
 * only applies frame-to-frame easing, so the pan reads as smooth camera motion (FR-029).
 */
export class CameraRig {
  private currentXSu = 0;
  private currentYPx = 0;

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly viewportWidthPx: number,
    private readonly viewportHeightPx: number,
  ) {}

  /** Immediately places the camera at the given target, with no easing (used on run start). */
  snapTo(targetXSu: number, targetYPx: number): void {
    this.currentXSu = targetXSu;
    this.currentYPx = targetYPx;
    this.apply();
  }

  /** Eases the camera toward the given target for this frame. */
  update(targetXSu: number, targetYPx: number): void {
    this.currentXSu += (targetXSu - this.currentXSu) * CAMERA_HORIZONTAL_SMOOTHING;
    this.currentYPx += (targetYPx - this.currentYPx) * CAMERA_VERTICAL_SMOOTHING;
    this.apply();
  }

  /** The current world-Y top bound of the viewport, for renderer culling. */
  get viewTop(): number {
    return this.camera.scrollY;
  }

  /** The current world-Y bottom bound of the viewport, for renderer culling. */
  get viewBottom(): number {
    return this.camera.scrollY + this.viewportHeightPx;
  }

  private apply(): void {
    this.camera.scrollX = worldX(this.currentXSu) - this.viewportWidthPx / 2;
    this.camera.scrollY = this.currentYPx - this.viewportHeightPx / 2;
  }
}
