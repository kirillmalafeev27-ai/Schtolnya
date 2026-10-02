import Phaser from 'phaser';

/** Генерация процедурного арта под экраном загрузки (план, 7.3.6). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Game');
  }
}
