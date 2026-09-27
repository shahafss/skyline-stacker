import type Phaser from 'phaser';

/**
 * On game over, converts every currently visible floor image into a falling Matter body
 * (Principle II: its output is never read back by the sim). Culled (invisible) floors are left
 * alone, since they were never rendered.
 */
export class CollapseFx {
  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * `swayDirection` is the sign of the tower's sway at the moment of collapse (+1 or -1), used so
   * every block falls the same way the tower was already leaning.
   */
  collapse(images: readonly Phaser.GameObjects.Image[], swayDirection: number): void {
    for (const img of images) {
      const width = img.displayWidth;
      const height = img.displayHeight;
      const body = this.scene.matter.add.image(img.x, img.y, img.texture.key);
      body.setTint(img.tintTopLeft);
      body.setDisplaySize(width, height);
      body.setRectangle(width, height);
      body.setAngle(img.angle);
      body.setFriction(0.05, 0.01);
      body.setBounce(0.15);
      const jitter = (Math.random() - 0.5) * 2;
      body.setVelocity(swayDirection * (3 + Math.random() * 2), -1 + jitter);
      body.setAngularVelocity(swayDirection * 0.04 * (0.5 + Math.random()));
      img.setVisible(false);
    }
  }
}
