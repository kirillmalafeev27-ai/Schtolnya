// Герой: сборка из частей-контейнеров (план, 7.5.12). Анимации на твинах, ничего не блокируют.

import Phaser from 'phaser';
import { ART } from '../art/manifest';
import { balance } from '../config/balance';
import { hex, palette as P } from '../config/palette';
import type { Grid } from '../core/grid';
import { CELL, cellX, footY } from './coords';
import type { WorldLayers } from './layers';

const A = balance.anim;
const MAX_BELT = 6;

export type HeroMood = 'idle' | 'ready' | 'alarm' | 'blasted' | 'caught' | 'victory';

export class HeroView {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly torso: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly legL: Phaser.GameObjects.Image;
  private readonly legR: Phaser.GameObjects.Image;
  private readonly armL: Phaser.GameObjects.Image;
  private readonly armR: Phaser.GameObjects.Image;
  private readonly scarf: Phaser.GameObjects.Image;
  private readonly pouch: Phaser.GameObjects.Image;
  private readonly belt: Phaser.GameObjects.Image[] = [];
  private readonly beltMore: Phaser.GameObjects.Text;
  private readonly shadow: Phaser.GameObjects.Image;
  private facing: -1 | 1 = 1;
  private mood: HeroMood = 'idle';
  private moveTween: Phaser.Tweens.Tween | null = null;
  private moodTween: Phaser.Tweens.Tween | null = null;
  private running = false;
  private hasGold = false;
  /** Смещение «на плечах» при поимке и подъёме клети. */
  lift = 0;

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
    this.legL = part(ART.heroLeg, -CELL * 0.08, -CELL * 0.27, 0.5, 0);
    this.legR = part(ART.heroLeg, CELL * 0.08, -CELL * 0.27, 0.5, 0);
    this.torso = part(ART.heroBody, 0, -CELL * 0.24, 0.5, 1);
    this.armL = part(ART.heroArm, -CELL * 0.27, -CELL * 0.66, 0.5, 0.1);
    this.armR = part(ART.heroArm, CELL * 0.27, -CELL * 0.66, 0.5, 0.1);
    this.scarf = part(ART.heroScarf, -CELL * 0.06, -CELL * 0.74, 0.85, 0.3);
    this.pouch = part(ART.heroPouch, CELL * 0.18, -CELL * 0.36);
    for (let k = 0; k < MAX_BELT; k++) {
      const st = part(ART.heroBeltStick, -CELL * 0.2 + k * CELL * 0.055, -CELL * 0.36, 0.5, 0.5);
      st.setRotation(-0.1 + (k % 2) * 0.12);
      this.belt.push(st);
    }
    this.beltMore = scene.add
      .text(-CELL * 0.26, -CELL * 0.3, '', {
        fontFamily: 'Rubik',
        fontStyle: '900',
        fontSize: `${Math.round(CELL * 0.16)}px`,
        color: P.panel,
        stroke: P.ink,
        strokeThickness: CELL * 0.05,
      })
      .setOrigin(1, 0.5);
    this.head = part(ART.heroHead, CELL * 0.02, -CELL * 0.78, 0.5, 0.9);
    this.body = scene.add.container(0, 0, [
      this.legL,
      this.legR,
      this.armL,
      this.torso,
      ...this.belt,
      this.pouch,
      this.beltMore,
      this.scarf,
      this.head,
      this.armR,
    ]);
    this.root = scene.add.container(cellX(g, cell), footY(g, cell), [this.body]);
    layers.obj.add(this.root);
    this.shadow = scene.add.image(this.root.x, this.root.y, ART.shadow).setScale(s * 0.8, s * 0.75);
    layers.shadow.add(this.shadow);
    this.syncDepth();
  }

  get x(): number {
    return this.root.x;
  }

  get y(): number {
    return this.root.y;
  }

  /** Направление взгляда: -1 влево, 1 вправо (по последнему горизонтальному шагу). */
  get face(): -1 | 1 {
    return this.facing;
  }

  setFacing(f: -1 | 1): void {
    this.facing = f;
    this.body.scaleX = f;
  }

  private syncDepth(): void {
    this.root.setDepth(this.root.y);
    this.shadow.setPosition(this.root.x, this.root.y + CELL * 0.01);
  }

  /** Шаг — прыжок с приплющиванием при приземлении, 180 мс (7.5.12). */
  step(to: number, shelter: boolean, reduced: boolean): void {
    const tx = cellX(this.g, to);
    const ty = footY(this.g, to);
    if (tx !== this.root.x) this.setFacing(tx < this.root.x ? -1 : 1);
    this.moveTween?.stop();
    this.running = shelter;
    const dur = A.stepMs;
    this.moveTween = this.scene.tweens.add({
      targets: this.root,
      x: tx,
      y: ty,
      duration: dur,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.syncDepth(),
      onComplete: () => this.syncDepth(),
    });
    if (reduced) return;
    // Прыжок корпусом и приплющивание.
    this.scene.tweens.add({
      targets: this.body,
      y: { from: 0, to: -CELL * 0.14 },
      duration: dur * 0.5,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: this.body,
      scaleY: { from: 1, to: 0.86 },
      scaleX: { from: this.facing, to: this.facing * 1.12 },
      delay: dur * 0.85,
      duration: 60,
      yoyo: true,
    });
    // Ноги перебирают.
    this.scene.tweens.add({ targets: this.legL, angle: { from: -24, to: 18 }, duration: dur, yoyo: false });
    this.scene.tweens.add({ targets: this.legR, angle: { from: 22, to: -16 }, duration: dur, yoyo: false });
    this.scene.tweens.add({ targets: [this.legL, this.legR], angle: 0, delay: dur, duration: 80 });
    // Бег в укрытие — наклон вперёд, шарф развевается.
    this.body.rotation = shelter ? 0.16 * this.facing : 0;
    this.scene.tweens.add({
      targets: this.scarf,
      angle: { from: -40, to: 0 },
      duration: dur * 1.6,
      ease: 'Sine.easeOut',
    });
  }

  /** Закладка — присел, вставил шашку, чиркнул спичкой, 250 мс. */
  plant(rockX: number, reduced: boolean): void {
    if (rockX !== this.root.x) this.setFacing(rockX < this.root.x ? -1 : 1);
    if (reduced) return;
    this.scene.tweens.add({
      targets: this.body,
      scaleY: { from: 1, to: 0.78 },
      duration: A.plantMs * 0.4,
      yoyo: true,
      hold: A.plantMs * 0.2,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: this.armR,
      angle: { from: 0, to: -80 },
      duration: A.plantMs * 0.5,
      yoyo: true,
    });
    this.scene.tweens.add({
      targets: this.armL,
      angle: { from: 0, to: 50 },
      delay: A.plantMs * 0.5,
      duration: 90,
      yoyo: true,
    });
  }

  /** Отказ: покачивается. */
  shrug(reduced: boolean): void {
    if (reduced) return;
    this.scene.tweens.add({
      targets: this.body,
      angle: { from: -8, to: 8 },
      duration: 70,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.body.setAngle(0),
    });
  }

  setMood(mood: HeroMood, reduced: boolean): void {
    if (this.mood === mood) return;
    this.mood = mood;
    this.moodTween?.stop();
    this.moodTween = null;
    this.body.setAngle(0);
    this.head.setAngle(0);
    switch (mood) {
      case 'ready':
        this.head.setTexture(ART.heroHeadHappy);
        if (!reduced)
          this.moodTween = this.scene.tweens.add({
            targets: this.body,
            y: { from: 0, to: -CELL * 0.05 },
            duration: 170,
            yoyo: true,
            repeat: -1,
            repeatDelay: 140,
          });
        break;
      case 'alarm':
        this.head.setTexture(ART.heroHeadWorried);
        if (!reduced)
          this.moodTween = this.scene.tweens.add({
            targets: this.head,
            angle: { from: -6, to: 6 },
            duration: 420,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        break;
      case 'blasted':
        this.head.setTexture(ART.heroHeadSooty);
        this.torso.setTint(hex(P.scorch)).setTintMode(Phaser.TintModes.MULTIPLY);
        this.body.y = 0;
        if (!reduced)
          this.scene.tweens.add({
            targets: this.body,
            angle: { from: -10, to: 10 },
            duration: 90,
            yoyo: true,
            repeat: 3,
          });
        break;
      case 'caught':
        this.head.setTexture(ART.heroHeadWorried);
        if (!reduced) {
          this.scene.tweens.add({ targets: this.body, y: -CELL * 0.35, duration: 220, ease: 'Back.easeOut' });
          this.moodTween = this.scene.tweens.add({
            targets: [this.legL, this.legR],
            angle: { from: -25, to: 25 },
            duration: 110,
            yoyo: true,
            repeat: -1,
          });
        }
        break;
      case 'victory':
        this.head.setTexture(ART.heroHeadHappy);
        if (!reduced)
          this.moodTween = this.scene.tweens.add({
            targets: this.armR,
            angle: { from: -150, to: -110 },
            duration: 160,
            yoyo: true,
            repeat: -1,
          });
        else this.armR.setAngle(-130);
        break;
      default:
        this.head.setTexture(ART.heroHead);
        this.body.y = 0;
    }
  }

  getMood(): HeroMood {
    return this.mood;
  }

  /** Шашки на поясе (видно до 6, дальше «+N») и мешочек для самородка. */
  syncBelt(sticks: number, hasVein: boolean): void {
    for (let k = 0; k < MAX_BELT; k++) this.belt[k].setVisible(k < sticks);
    this.beltMore.setText(sticks > MAX_BELT ? `+${sticks - MAX_BELT}` : '');
    if (hasVein !== this.hasGold) {
      this.hasGold = hasVein;
      this.pouch.setTexture(hasVein ? ART.heroPouchGold : ART.heroPouch);
      this.scene.tweens.add({
        targets: this.pouch,
        scale: { from: this.ts * 1.6, to: this.ts },
        duration: 300,
        ease: 'Back.easeOut',
      });
    }
  }

  /** Где на экране мира висит пояс — сюда прилетают подобранные шашки. */
  beltWorld(): { x: number; y: number } {
    return { x: this.root.x, y: this.root.y - CELL * 0.36 };
  }

  pouchWorld(): { x: number; y: number } {
    return { x: this.root.x + CELL * 0.18 * this.facing, y: this.root.y - CELL * 0.36 };
  }

  /** Налобный фонарь: центр света смещён по направлению взгляда (8.2). */
  lampWorld(): { x: number; y: number } {
    return {
      x: this.root.x + this.facing * CELL * balance.light.heroLamp.offset,
      y: this.root.y - CELL * 0.55,
    };
  }

  update(): void {
    if (!this.running) this.body.rotation *= 0.85;
    this.syncDepth();
  }

  setVisible(v: boolean): void {
    this.root.setVisible(v);
    this.shadow.setVisible(v);
  }

  /** Подъём вместе с клетью при победе. */
  rideUp(dy: number, duration: number): void {
    this.scene.tweens.add({
      targets: [this.root, this.shadow],
      y: `-=${dy}`,
      alpha: 0,
      duration,
      ease: 'Quad.easeIn',
    });
  }

  destroy(): void {
    this.root.destroy();
    this.shadow.destroy();
  }
}
