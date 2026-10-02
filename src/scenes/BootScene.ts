// Генерация процедурного арта под экраном загрузки (план, 7.3.6).

import Phaser from 'phaser';
import { ArtFactory, type GenReport, type Recipe } from '../art/ArtFactory';

export interface BootConfig {
  cellPx: number;
  recipes: Record<string, Recipe>;
  onProgress: (done: number, total: number) => void;
  onDone: (report: GenReport) => void;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const cfg = this.registry.get('bootConfig') as BootConfig;
    const factory = new ArtFactory(this.textures, cfg.cellPx, cfg.recipes);
    factory
      .generateAll(cfg.onProgress)
      .then((report) => {
        this.registry.set('artFactory', factory);
        this.scene.start('Game');
        cfg.onDone(report);
      })
      .catch((e: unknown) => {
        console.error('BootScene: генерация арта упала', e);
      });
  }
}
