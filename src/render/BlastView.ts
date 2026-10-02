// Взрыв (план, 7.5.14): трёхслойная звезда, языки пламени ровно по клеткам креста из blastCells,
// обломки, комиксный дым, искры. Взрыв длится 400 мс, дым тает за 800 мс.

import Phaser from 'phaser';
import { ART } from '../art/manifest';
import { balance } from '../config/balance';
import { neighbor, type Grid } from '../core/grid';
import { CELL, cellX, cellY } from './coords';
import type { Juice } from './juice';
import type { WorldLayers } from './layers';

const A = balance.anim;
const PT = balance.particles;

export class BlastView {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: WorldLayers,
    private readonly juice: Juice,
    private readonly ts: number,
  ) {}

  /** Пламя рисуется по тем же клеткам, что и логика взрыва (2.3.9). */
  play(g: Grid, origin: number, rays: [number, number, number, number], reduced: boolean): void {
    const ox = cellX(g, origin);
    const oy = cellY(g, origin) - CELL * 0.1;
    const s = this.ts;

    // Звезда взрыва.
    const boom = this.scene.add.image(ox, oy, ART.boom).setScale(s * 0.3).setDepth(1e6);
    this.layers.fx.add(boom);
    this.scene.tweens.add({
      targets: boom,
      scale: s * 1.08,
      angle: reduced ? 0 : 18,
      duration: A.blastMs * 0.3,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: boom,
      alpha: 0,
      scale: s * 1.25,
      delay: A.blastMs * 0.45,
      duration: A.blastMs * 0.55,
      onComplete: () => boom.destroy(),
    });

    // Языки пламени по лучам.
    for (let d = 0; d < 4; d++) {
      let c = origin;
      for (let k = 1; k <= rays[d]; k++) {
        c = neighbor(g, c, d);
        const last = k === rays[d];
        const key = last ? ART.flameEnd : d % 2 === 0 ? ART.flameV : ART.flameH;
        const fx = cellX(g, c);
        const fy = cellY(g, c) - CELL * 0.05;
        const fl = this.scene.add.image(fx, fy, key).setScale(s * 0.2).setDepth(1e6 - 1);
        if (last) fl.setAngle([0, 270, 180, 90][d]);
        if (!last && (d === 0 || d === 1)) fl.setFlip(d === 1, d === 0);
        this.layers.fx.add(fl);
        const delay = (k - 1) * 40;
        this.scene.tweens.add({ targets: fl, scale: s, delay, duration: 90, ease: 'Back.easeOut' });
        this.scene.tweens.add({
          targets: fl,
          alpha: 0,
          scaleX: s * 0.7,
          scaleY: s * 0.7,
          delay: delay + A.blastMs * 0.55,
          duration: A.blastMs * 0.4,
          onComplete: () => fl.destroy(),
        });
        this.juice.sparksAt(fx, fy, 3);
      }
    }

    // Обломки породы, дым и искры. Бюджет: не больше 120 частиц на взрыв (13.6).
    const budget = PT.maxPerBlast;
    const debris = Math.min(PT.debrisPerBlast, budget);
    const sparks = Math.min(PT.sparksPerBlast, budget - debris);
    const smoke = Math.min(PT.smokePerBlast, budget - debris - sparks);
    this.juice.debrisAt(ox, oy, reduced ? Math.ceil(debris / 2) : debris);
    this.juice.sparksAt(ox, oy, sparks);
    this.scene.time.delayedCall(A.blastMs * 0.5, () => this.juice.smokeAt(ox, oy, smoke));
  }

  /** Крепкая порода треснула: трещины и осколки. */
  crack(g: Grid, cell: number): void {
    const x = cellX(g, cell);
    const y = cellY(g, cell) - CELL * 0.1;
    this.juice.debrisAt(x, y, 8);
    this.juice.smokeAt(x, y, 3);
  }
}
