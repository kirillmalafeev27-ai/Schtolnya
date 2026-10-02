import Phaser from 'phaser';

/** Сцена мира. Умеет режим заставки для меню. */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0f1626);
  }
}
