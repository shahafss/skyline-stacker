import Phaser from 'phaser';
import { generateTypeArt } from '../render/typeArt';

/** Particle texture keys generated once at boot. */
export const PARTICLE_TEXTURE_DUST = 'dust';
export const PARTICLE_TEXTURE_SPARK = 'spark';
export const PARTICLE_TEXTURE_DEBRIS = 'debris';

/** Generates every whitebox texture (particles and per-type art), then starts `SelectScene`. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.generateParticleTextures();
    generateTypeArt(this);
    this.scene.start('Select');
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
