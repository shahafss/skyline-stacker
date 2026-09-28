import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { SelectScene } from './scenes/SelectScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 1280,
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    matter: {
      gravity: { x: 0, y: 1 },
      enableSleeping: false,
    },
  },
  scene: [BootScene, SelectScene, GameScene],
};

new Phaser.Game(config);
