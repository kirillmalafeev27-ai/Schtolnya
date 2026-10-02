// Кобольд (план, 7.5.13): приземистый горный дух. Глаза рисуются в слое 5 — видны в самом тёмном углу.

import Phaser from 'phaser';
import { ART } from '../art/manifest';
import { balance } from '../config/balance';
import { hex, palette as P } from '../config/palette';
import type { Grid } from '../core/grid';
import type { KoboldMode } from '../core/state';
import { CELL, cellX, footY } from './coords';
import type { WorldLayers } from './layers';

const A = balance.anim;

export class KoboldView {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly footL: Phaser.GameObjects.Image;
  private readonly footR: Phaser.GameObjects.Image;
  private readonly candle: Phaser.GameObjects.Image;
  private readonly sleeper: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  readonly eyes: Phaser.GameObjects.Image;
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private readonly steam: Phaser.GameObjects.Image[] = [];
  private mode: KoboldMode = 'sleep';
  private anger = 0;
  private facing: -1 | 1 = -1;
  private waddle = 0;
  private crouchTween: Phaser.Tweens.Tween | null = null;
  private eyeFlash = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    layers: WorldLayers,
    private readonly g: Grid,
    cell: number,
    private readonly ts: number,
  ) {
    const s = ts;
    const part = (key: string, x: number, y: number, ox = 0.5, oy = 0.5) =>
      scene.add.image(x, y, key).setScale(s).setOrigin(ox, oy);
    this.footL = part(ART.koboldFoot, -CELL * 0.14, -CELL * 0.04);
    this.footR = part(ART.koboldFoot, CELL * 0.14, -CELL * 0.04);
    this.torso = part(ART.koboldBody, 0, -CELL * 0.05, 0.5, 1);
    this.head = part(ART.koboldHead, -CELL * 0.04, -CELL * 0.5, 0.5, 0.85);
    this.candle = part(ART.koboldCandle, CELL * 0.06, -CELL * 0.98, 0.5, 1);
    this.body = scene.add.container(0, 0, [this.footL, this.footR, this.torso, this.head, this.candle]);
    this.sleeper = part(ART.koboldSleep, 0, -CELL * 0.02, 0.5, 1);
    this.root = scene.add.container(cellX(g, cell), footY(g, cell), [this.body, this.sleeper]);
    layers.obj.add(this.root);
    this.shadow = scene.add.image(this.root.x, this.root.y, ART.shadow).setScale(s * 1.0, s * 0.85);
    layers.shadow.add(this.shadow);
    this.eyes = scene.add.image(0, 0, ART.koboldEyes).setScale(s);
    layers.ui.add(this.eyes);
    for (let k = 0; k < 3; k++) {
      const st = scene.add.image(0, 0, ART.stunStar).setScale(s).setVisible(false);
      layers.fx.add(st);
      this.stars.push(st);
    }
    for (let k = 0; k < 2; k++) {
      const st = scene.add.image(0, 0, ART.steam).setScale(s).setVisible(false).setAlpha(0.7);
      layers.fx.add(st);
      this.steam.push(st);
    }
    this.setMode('sleep', 0, true);
    this.sync();
  }

  get x(): number {
    return this.root.x;
  }

  get y(): number {
    return this.root.y;
  }

  /** Где голова — сюда ставится мишень, слова-звуки и звёздочки. */
  headWorld(): { x: number; y: number } {
    return { x: this.root.x, y: this.root.y - CELL * 0.86 };
  }

  private sync(): void {
    this.root.setDepth(this.root.y);
    this.shadow.setPosition(this.root.x, this.root.y + CELL * 0.01);
    const sleeping = this.mode === 'sleep';
    const hx = this.root.x + this.facing * CELL * 0.1;
    const hy = this.root.y + this.body.y - CELL * 0.6 * this.body.scaleY;
    this.eyes.setPosition(hx, hy);
    this.eyes.setVisible(!sleeping);
  }

  setMode(mode: KoboldMode, anger: number, reduced: boolean): void {
    const prev = this.mode;
    this.mode = mode;
    this.anger = anger;
    const sleeping = mode === 'sleep';
    this.body.setVisible(!sleeping);
    this.sleeper.setVisible(sleeping);
    this.head.setTexture(
      mode === 'stunned' ? ART.koboldHeadSooty : anger > 0 ? ART.koboldHeadAngry : ART.koboldHead,
    );
    // Злее после оглушения — краснеет (7.5.13).
    const angry = anger > 0 && mode !== 'stunned';
    for (const p of [this.torso, this.head]) {
      if (angry) p.setTint(hex(P.dynamite.light)).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (mode === 'stunned') p.setTint(hex(P.blast.smoke)).setTintMode(Phaser.TintModes.MULTIPLY);
      else p.clearTint();
    }
    this.candle.setVisible(mode !== 'stunned');
    for (const st of this.stars) st.setVisible(mode === 'stunned');
    for (const st of this.steam) st.setVisible(angry && !reduced);
    if (mode === 'stunned') {
      this.body.setAngle(0);
      if (!reduced)
        this.scene.tweens.add({
          targets: this.body,
          scaleY: { from: 1, to: 0.82 },
          duration: 160,
          ease: 'Back.easeOut',
        });
      else this.body.scaleY = 0.82;
    } else if (prev === 'stunned') {
      this.body.scaleY = 1;
    }
    if (prev === 'sleep' && mode === 'awake') this.wakeUp(reduced);
    this.sync();
  }

  private wakeUp(reduced: boolean): void {
    // «HÄ?!»: вскакивает, трёт глаза, глаза вспыхивают.
    this.eyeFlash = 1;
    if (reduced) return;
    this.body.y = CELL * 0.1;
    this.scene.tweens.add({ targets: this.body, y: 0, duration: 260, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: this.head,
      angle: { from: -12, to: 12 },
      duration: 90,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.head.setAngle(0),
    });
  }

  /** Приседает за 150 мс до шага — видимый сигнал для приманки (2.4.4). */
  crouch(reduced: boolean): void {
    this.crouchTween?.stop();
    if (reduced) {
      this.body.scaleY = 0.86;
      return;
    }
    this.crouchTween = this.scene.tweens.add({
      targets: this.body,
      scaleY: 0.78,
      scaleX: this.facing * 1.14,
      duration: A.koboldCrouchMs,
      ease: 'Quad.easeOut',
    });
  }

  step(to: number, reduced: boolean): void {
    const tx = cellX(this.g, to);
    const ty = footY(this.g, to);
    if (tx !== this.root.x) this.facing = tx < this.root.x ? -1 : 1;
    this.crouchTween?.stop();
    this.body.scaleX = this.facing;
    this.body.scaleY = 1;
    this.scene.tweens.add({
      targets: this.root,
      x: tx,
      y: ty,
      duration: A.stepMs * 1.2,
      ease: 'Quad.easeOut',
      onUpdate: () => this.sync(),
      onComplete: () => this.sync(),
    });
    if (!reduced) {
      this.scene.tweens.add({
        targets: this.body,
        y: { from: 0, to: -CELL * 0.1 },
        duration: A.stepMs * 0.6,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
      this.scene.tweens.add({
        targets: this.body,
        scaleY: { from: 1.12, to: 1 },
        duration: A.stepMs * 1.4,
        ease: 'Back.easeOut',
      });
    }
  }

  /** Поймал героя — «HAB DICH!»: тянется вверх. */
  grab(reduced: boolean): void {
    if (reduced) return;
    this.scene.tweens.add({
      targets: this.body,
      scaleY: 1.15,
      angle: this.facing * -8,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  update(time: number, reduced: boolean): void {
    // Переваливается при ходьбе, во сне дышит.
    if (this.mode === 'awake' && !reduced) {
      this.waddle += 0.09;
      this.body.setAngle(Math.sin(this.waddle) * 4);
    }
    if (this.mode === 'sleep' && !reduced)
      this.sleeper.setScale(
        this.ts * (1 + Math.sin(time / 700) * 0.03),
        this.ts * (1 - Math.sin(time / 700) * 0.04),
      );
    // Звёздочки вокруг головы оглушённого.
    if (this.mode === 'stunned') {
      const h = this.headWorld();
      this.stars.forEach((st, k) => {
        const a = time / 260 + (k / 3) * Math.PI * 2;
        st.setPosition(h.x + Math.cos(a) * CELL * 0.3, h.y + CELL * 0.18 + Math.sin(a) * CELL * 0.1);
        st.setDepth(this.root.y + (Math.sin(a) > 0 ? 1 : -1));
        st.setAngle(time / 4);
      });
    }
    // Пар из ушей у злого.
    if (this.anger > 0 && this.mode === 'awake' && !reduced) {
      const h = this.headWorld();
      this.steam.forEach((st, k) => {
        const t = (((time / 900 + k * 0.5) % 1) + 1) % 1;
        st.setPosition(h.x + (k ? 1 : -1) * CELL * (0.36 + t * 0.2), h.y + CELL * 0.26 - t * CELL * 0.4);
        st.setAlpha(0.7 * (1 - t)).setScale(this.ts * (0.6 + t));
      });
    }
    // Глаза вспыхивают при пробуждении.
    if (this.eyeFlash > 0) {
      this.eyeFlash = Math.max(0, this.eyeFlash - 0.03);
      this.eyes.setScale(this.ts * (1 + this.eyeFlash * 0.9));
    }
    this.sync();
  }

  destroy(): void {
    this.root.destroy();
    this.shadow.destroy();
    this.eyes.destroy();
    for (const s of [...this.stars, ...this.steam]) s.destroy();
  }
}
