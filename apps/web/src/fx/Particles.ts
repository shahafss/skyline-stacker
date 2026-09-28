import type Phaser from 'phaser';
import {
  PARTICLE_TEXTURE_DEBRIS,
  PARTICLE_TEXTURE_DUST,
  PARTICLE_TEXTURE_SPARK,
} from '../scenes/BootScene';

/**
 * Preallocated particle emitters (FR-033): dust on every landing, sparks on a Perfect landing,
 * and debris on collapse. Triggering a burst reuses the emitter; nothing is created per frame.
 */
export class Particles {
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly spark: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly debris: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.dust = scene.add.particles(0, 0, PARTICLE_TEXTURE_DUST, {
      emitting: false,
      lifespan: 350,
      speed: { min: 20, max: 70 },
      angle: { min: 200, max: 340 },
      scale: { start: 1, end: 0 },
      quantity: 8,
    });
    this.dust.setDepth(10);

    this.spark = scene.add.particles(0, 0, PARTICLE_TEXTURE_SPARK, {
      emitting: false,
      lifespan: 500,
      speed: { min: 60, max: 160 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      quantity: 16,
    });
    this.spark.setDepth(11);

    this.debris = scene.add.particles(0, 0, PARTICLE_TEXTURE_DEBRIS, {
      emitting: false,
      lifespan: 1200,
      speed: { min: 40, max: 220 },
      angle: { min: 180, max: 360 },
      gravityY: 400,
      scale: { start: 1, end: 0.6 },
      quantity: 40,
    });
    this.debris.setDepth(12);
  }

  landingDust(x: number, y: number): void {
    this.dust.explode(8, x, y);
  }

  perfectSpark(x: number, y: number): void {
    this.spark.explode(16, x, y);
  }

  collapseDebris(x: number, y: number): void {
    this.debris.explode(40, x, y);
  }
}
