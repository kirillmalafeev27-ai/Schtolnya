// Сочность (план, раздел 9): тряска, вспышки, хит-стоп, слова-звуки, частицы.
// Ничто здесь не блокирует ввод и не задерживает логику.

import Phaser from 'phaser';
import { putCanvas } from '../art/ArtFactory';
import { ART, SMOKE_VARIANTS } from '../art/manifest';
import { balance } from '../config/balance';
import { palette as P } from '../config/palette';
import type { WorldLayers } from './layers';
import { CELL } from './coords';

const A = balance.anim;
const PT = balance.particles;

export interface SfxWordStyle {
  fill: string;
  outer: string;
  size: number;
}

export const SFX_STYLES = {
  boom: { fill: P.blast.inner, outer: P.dynamite.base, size: 0.62 },
  danger: { fill: P.panel, outer: P.dynamite.base, size: 0.44 },
  gold: { fill: P.gold.light, outer: P.gold.shadow, size: 0.44 },
  kobold: { fill: P.kobold.skinLight, outer: P.kobold.skinShadow, size: 0.44 },
  plain: { fill: P.panel, outer: P.bedrock.shadow, size: 0.36 },
  count: { fill: P.panel, outer: P.dynamite.base, size: 0.56 },
  win: { fill: P.caption, outer: P.gold.shadow, size: 0.62 },
} as const satisfies Record<string, SfxWordStyle>;

export type SfxStyleName = keyof typeof SFX_STYLES;

/** Растеризует слово-звук в текстуру (кэш) — Bangers, тушь, внешняя цветная обводка, наклон (7.4 sfxWord). */
export function sfxWordTexture(
  scene: Phaser.Scene,
  text: string,
  style: SfxStyleName,
  latin: boolean,
): string {
  const key = `sfx:${style}:${text}`;
  if (scene.textures.exists(key)) return key;
  const st = SFX_STYLES[style];
  const size = Math.round(CELL * st.size);
  const font = `${size}px ${latin ? 'Bangers' : '"Rubik"'}`;
  const weight = latin ? '' : '900 ';
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = weight + font;
  const tw = measure.measureText(text).width;
  const pad = size * 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(tw + pad * 2);
  canvas.height = Math.ceil(size * 1.5 + pad);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.transform(1, 0, -0.12, 1, 0, 0);
  ctx.font = weight + font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // Внешняя цветная обводка, затем тушь, затем заливка.
  ctx.strokeStyle = st.outer;
  ctx.lineWidth = size * 0.42;
  ctx.strokeText(text, size * 0.05, size * 0.08);
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = size * 0.2;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = st.fill;
  ctx.fillText(text, 0, 0);
  // Блик сверху.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-canvas.width, -canvas.height / 2, canvas.width * 2, canvas.height * 0.28);
  putCanvas(scene.textures, key, canvas);
  return key;
}

interface WordItem {
  img: Phaser.GameObjects.Image;
  born: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlap(a: Box, b: Box): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

export class Juice {
  private words: WordItem[] = [];
  private flashTimes: number[] = [];
  private hitStopUntil = 0;
  reduced = false;
  sfxLatin = true;
  /** Рамки героя и кобольдов: слова-звуки их не закрывают (9.1.4). */
  avoid: () => Box[] = () => [];
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly debris: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: WorldLayers,
    private readonly ts: number,
    _mainCam: Phaser.Cameras.Scene2D.Camera,
    private readonly cams: Phaser.Cameras.Scene2D.Camera[],
  ) {
    const s = ts;
    this.sparks = scene.add.particles(0, 0, ART.spark, {
      emitting: false,
      lifespan: { min: 260, max: 620 },
      speed: { min: CELL * 1.5, max: CELL * 5.5 },
      scale: { start: s * 1.2, end: 0 },
      gravityY: CELL * 5,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.dust = scene.add.particles(0, 0, ART.dust, {
      emitting: false,
      lifespan: { min: 300, max: 600 },
      speed: { min: CELL * 0.25, max: CELL * 0.8 },
      angle: { min: 190, max: 350 },
      scale: { start: s * 0.9, end: s * 1.6 },
      alpha: { start: 0.55, end: 0 },
      gravityY: -CELL * 0.4,
    });
    for (let k = 0; k < 2; k++) {
      this.debris.push(
        scene.add.particles(0, 0, ART.debris(k * 3), {
          emitting: false,
          lifespan: { min: 380, max: 760 },
          speed: { min: CELL * 1.6, max: CELL * 4.2 },
          angle: { min: 200, max: 340 },
          rotate: { min: -540, max: 540 },
          scale: { min: s * 0.7, max: s * 1.25 },
          gravityY: CELL * 9,
          alpha: { start: 1, end: 0.6 },
        }),
      );
    }
    for (let k = 0; k < SMOKE_VARIANTS; k++) {
      this.smoke.push(
        scene.add.particles(0, 0, ART.smoke(k), {
          emitting: false,
          lifespan: A.smokeMs,
          speed: { min: CELL * 0.2, max: CELL * 0.75 },
          scale: { start: s * 0.6, end: s * 1.45 },
          alpha: { start: 0.6, end: 0 },
          rotate: { min: -30, max: 30 },
          gravityY: -CELL * 0.6,
        }),
      );
    }
    layers.fx.add([...this.smoke, ...this.debris, this.dust, this.sparks]);
  }

  get hitStopped(): boolean {
    return this.scene.time.now < this.hitStopUntil;
  }

  /** Хит-стоп замораживает только картинку мира (9.1.2). */
  hitStop(ms: number): void {
    if (this.reduced) return;
    this.hitStopUntil = this.scene.time.now + Math.min(ms, A.hitStopMs);
  }

  shake(px: number, ms = balance.camera.shakeMs): void {
    if (this.reduced || px <= 0) return;
    for (const cam of this.cams) {
      const intensity = (px * cam.zoom) / Math.max(1, cam.width);
      cam.shake(ms, new Phaser.Math.Vector2(intensity, (px * cam.zoom) / Math.max(1, cam.height)), true);
    }
  }

  /** Вспышка не дольше `ms` и не чаще 3 раз в секунду (9.1.5). */
  flash(ms = A.whiteFlashMs, alpha = 0.9): void {
    if (this.reduced) return;
    const now = this.scene.time.now;
    this.flashTimes = this.flashTimes.filter((t) => now - t < 1000);
    if (this.flashTimes.length >= A.maxFlashesPerSecond) return;
    this.flashTimes.push(now);
    // Вспышка на последней камере (слой 5), чтобы накрыть весь мир поверх света.
    const cam = this.cams[this.cams.length - 1];
    cam.flash(Math.min(ms, A.whiteFlashMs), 255, 255, 255, true);
    void alpha;
  }

  zoomPunch(z: number, ms: number): void {
    if (this.reduced) return;
    for (const cam of this.cams) {
      const base = cam.zoom;
      this.scene.tweens.add({
        targets: cam,
        zoom: base * z,
        duration: ms / 2,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => cam.setZoom(base),
      });
    }
  }

  /**
   * Слово-звук над событием со смещением вверх; одновременно не больше трёх (9.1.4).
   * Возвращает изображение (или null, если места нет и слово неважное).
   */
  word(
    text: string,
    x: number,
    y: number,
    style: SfxStyleName,
    opts: { important?: boolean; hold?: number; below?: boolean } = {},
  ): Phaser.GameObjects.Image | null {
    const now = this.scene.time.now;
    this.words = this.words.filter((w) => w.img.active);
    if (this.words.length >= A.maxSfxWords) {
      if (!opts.important) return null;
      const oldest = this.words.shift();
      oldest?.img.destroy();
    }
    const key = sfxWordTexture(this.scene, text, style, this.sfxLatin);
    const src = this.scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
    const ww = src.width * this.ts * 0.8;
    const wh = src.height * this.ts * 0.6;
    // Кандидаты: над событием, выше, сбоку, ниже. Берём первое место без перекрытий.
    const below = [
      { x, y: y + CELL * 0.55 },
      { x, y: y + CELL * 1.1 },
    ];
    const cands = [
      ...(opts.below ? below : []),
      { x, y: y - CELL * 0.85 },
      { x, y: y - CELL * 1.4 },
      { x: x + CELL * 1.05, y: y - CELL * 0.55 },
      { x: x - CELL * 1.05, y: y - CELL * 0.55 },
      { x, y: y + CELL * 0.6 },
      { x, y: y - CELL * 1.95 },
    ];
    const blockers = [
      ...this.avoid(),
      ...this.words
        .filter((w2) => w2.img.active)
        .map((w2) => ({ x: w2.img.x - ww / 2, y: w2.img.y - wh / 2, w: ww, h: wh })),
    ];
    let best = cands[0];
    let bestOv = Infinity;
    for (const c of cands) {
      const box = { x: c.x - ww / 2, y: c.y - wh / 2, w: ww, h: wh };
      let ov = 0;
      for (const b of blockers) ov += overlap(box, b);
      if (ov < bestOv - 1) {
        bestOv = ov;
        best = c;
      }
      if (ov === 0) break;
    }
    const img = this.scene.add.image(best.x, best.y, key).setScale(this.ts).setDepth(10);
    img.setAngle(-6 + Math.random() * 12);
    this.layers.ui.add(img);
    const item = { img, born: now };
    this.words.push(item);
    const hold = opts.hold ?? A.sfxWordMs;
    if (this.reduced) {
      this.scene.time.delayedCall(hold, () => img.destroy());
      return img;
    }
    img.setScale(0);
    this.scene.tweens.add({ targets: img, scale: this.ts, duration: 160, ease: 'Back.easeOut' });
    // Уход без полупрозрачности: тушь и заливка поверх ступенчатого света не должны «просвечивать».
    this.scene.tweens.add({
      targets: img,
      y: img.y - CELL * 0.22,
      delay: 160,
      duration: hold - 160,
      ease: 'Sine.easeOut',
    });
    this.scene.tweens.add({
      targets: img,
      scale: 0,
      angle: img.angle + (Math.random() < 0.5 ? -14 : 14),
      delay: hold,
      duration: 150,
      ease: 'Back.easeIn',
      onComplete: () => img.destroy(),
    });
    return img;
  }

  /** Пыль из-под сапог. */
  stepDust(x: number, y: number): void {
    if (this.reduced) return;
    this.dust.explode(PT.stepDust, x, y);
  }

  sparksAt(x: number, y: number, n: number): void {
    this.sparks.explode(this.reduced ? Math.ceil(n / 3) : n, x, y);
  }

  debrisAt(x: number, y: number, n: number): void {
    const half = Math.ceil(n / 2);
    this.debris[0].explode(half, x, y);
    this.debris[1].explode(n - half, x, y);
  }

  smokeAt(x: number, y: number, n: number): void {
    for (let k = 0; k < n; k++) {
      const e = this.smoke[k % this.smoke.length];
      e.explode(1, x + (Math.random() - 0.5) * CELL * 0.6, y + (Math.random() - 0.5) * CELL * 0.4);
    }
  }

  /** Количество живых частиц (для бюджета 13.6). */
  liveParticles(): number {
    let n = this.sparks.getAliveParticleCount() + this.dust.getAliveParticleCount();
    for (const e of [...this.debris, ...this.smoke]) n += e.getAliveParticleCount();
    return n;
  }

  /** Заморозить и разморозить картинку мира. */
  freezeWorld(frozen: boolean): void {
    this.scene.tweens.timeScale = frozen ? 0 : 1;
    for (const e of [this.sparks, this.dust, ...this.debris, ...this.smoke]) e.timeScale = frozen ? 0 : 1;
  }
}
