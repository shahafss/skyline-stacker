import Phaser from 'phaser';
import type { SimConfig } from '@skyline/sim';
import { DEFAULT_TUNING, cloneTuning } from '@skyline/sim';
import { generateTypeArt } from '../render/typeArt';
import { randomSeed, type GameSceneData } from './GameScene';

/** Particle texture keys generated once at boot. */
export const PARTICLE_TEXTURE_DUST = 'dust';
export const PARTICLE_TEXTURE_SPARK = 'spark';
export const PARTICLE_TEXTURE_DEBRIS = 'debris';

/** Generates every whitebox texture (particles and per-type art), then starts `SelectScene`,
 * unless `?perf=luxury` (research R16) starts a scripted Luxury run with the bot straight away. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.generateParticleTextures();
    generateTypeArt(this);

    if (this.startPerfAutoRun()) {
      return;
    }
    this.scene.start('Select');
  }

  /**
   * `?perf=luxury` (contracts/controls.md): starts a Luxury run with the bot on, for touch-only
   * devices with no keys for `4` / `B` / `P`. Ignored (no-op, returns `false`) when perf tools
   * are not included in the build.
   */
  private startPerfAutoRun(): boolean {
    if (!(import.meta.env.DEV || __PERF_TOOLS__)) {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('perf') !== 'luxury') {
      return false;
    }
    const config: SimConfig = {
      type: 'luxury',
      mode: 'city',
      seed: randomSeed(),
      assist: false,
      tuning: cloneTuning(DEFAULT_TUNING),
    };
    this.scene.start('Game', { config, perfAutoRun: true } satisfies GameSceneData);
    return true;
  }

  private generateParticleTextures(): void {
    const dust = this.make.graphics({}, false);
    dust.fillStyle(0xcccccc, 1);
    dust.fillCircle(4, 4, 4);
    dust.generateTexture(PARTICLE_TEXTURE_DUST, 8, 8);
    dust.destroy();

    const spark = this.make.graphics({}, false);
    spark.fillStyle(0xffffff, 1);
    spark.fillCircle(3, 3, 3);
    spark.generateTexture(PARTICLE_TEXTURE_SPARK, 6, 6);
    spark.destroy();

    const debris = this.make.graphics({}, false);
    debris.fillStyle(0x999999, 1);
    debris.fillRect(0, 0, 6, 6);
    debris.generateTexture(PARTICLE_TEXTURE_DEBRIS, 6, 6);
    debris.destroy();
  }
}
