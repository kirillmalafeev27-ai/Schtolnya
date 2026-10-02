// Слои мира (план, 7.6). К слоям 0–4 применяется световой фильтр; слой 5 рисует вторая камера без фильтра.

import Phaser from 'phaser';

export interface WorldLayers {
  /** 0: фон за стенами. */
  bg: Phaser.GameObjects.Layer;
  /** 1: пол, рельсы, копоть и обломки после взрывов. */
  floor: Phaser.GameObjects.Layer;
  /** 2: контактные тени. */
  shadow: Phaser.GameObjects.Layer;
  /** 3: объекты с сортировкой по y основания. */
  obj: Phaser.GameObjects.Layer;
  /** 4: атмосфера: пыль, дым, искры, обломки. */
  fx: Phaser.GameObjects.Layer;
  /** 5: то, что читается поверх света. */
  ui: Phaser.GameObjects.Layer;
}

export function createLayers(scene: Phaser.Scene): WorldLayers {
  const make = (depth: number) => scene.add.layer().setDepth(depth);
  return {
    bg: make(0),
    floor: make(1),
    shadow: make(2),
    obj: make(3),
    fx: make(4),
    ui: make(5),
  };
}

export function worldLayersOf(l: WorldLayers): Phaser.GameObjects.Layer[] {
  return [l.bg, l.floor, l.shadow, l.obj, l.fx];
}
