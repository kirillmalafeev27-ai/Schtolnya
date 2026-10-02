// Источники живого света (план, 8.2) и настроение раунда (8.4). Запасной путь без фильтра (8.5).

import Phaser from 'phaser';
import { putCanvas } from '../art/ArtFactory';
import { ART } from '../art/manifest';
import { balance } from '../config/balance';
import { palette as P, rgb01 } from '../config/palette';
import { Cell } from '../core/grid';
import type { GameState } from '../core/state';
import { koboldPathDistance } from '../core/kobold';
import { ComicLight, type LightSource } from '../shared/ComicLightFilter';
import { CELL, cellX, cellY } from './coords';
import type { HeroView } from './HeroView';
import type { KoboldView } from './KoboldView';
import type { WorldLayers } from './layers';
import type { WorldView } from './WorldView';

const L = balance.light;
const PRI = { blast: 100, spark: 90, hero: 80, eyes: 70, day: 60, lantern: 50, vein: 30, mushroom: 20 };

function noise(t: number, seed: number): number {
  return (
    Math.sin(t * 1.7 + seed) * 0.5 +
    Math.sin(t * 3.1 + seed * 2.3) * 0.3 +
    Math.sin(t * 7.3 + seed * 0.7) * 0.2
  );
}

interface Flash {
  x: number;
  y: number;
  born: number;
}

export interface LightFrame {
  state: GameState;
  hero: HeroView;
  kobolds: KoboldView[];
  world: WorldView;
  spark: { x: number; y: number } | null;
}

export class LightRig {
  filter: ComicLight | null;
  private readonly maskKey: string;
  private maskCanvas: HTMLCanvasElement;
  private flashes: Flash[] = [];
  private wokeAt = -1e9;
  private dimUntil = 0;
  private cold = 0;
  private readonly glows: Phaser.GameObjects.Image[] = [];
  private vignetteImg: Phaser.GameObjects.Image | null = null;
  reduced = false;
  /** Сколько источников света в последнем кадре (отладочная панель). */
  lastCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: WorldLayers,
    state: GameState,
    useFilter: boolean,
    uid: string,
    private readonly dpr: number,
  ) {
    this.maskKey = `light-mask-${uid}`;
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = state.grid.w;
    this.maskCanvas.height = state.grid.h;
    this.drawMask(state);
    putCanvas(scene.textures, this.maskKey, this.maskCanvas);
    scene.textures.get(this.maskKey).setFilter(Phaser.Textures.FilterMode.NEAREST);

    if (useFilter) {
      const amb = rgb01(P.ambient);
      const len = Math.hypot(amb[0], amb[1], amb[2]) || 1;
      const k = L.ambientStrength / len;
      this.filter = new ComicLight(scene.cameras.main, {
        ambient: [amb[0] * k, amb[1] * k, amb[2] * k],
        steps: L.steps,
        thresholds: L.thresholds,
        band: L.band,
        floorMin: L.floorMinLight,
        dotSpacing: L.dotSpacingCssPx * dpr,
        tintStrength: 0.82,
      });
      this.filter.maskTexture = scene.textures.get(this.maskKey);
      const flipParam = new URLSearchParams(location.search).get('maskflip');
      if (flipParam !== null) this.filter.maskFlip = flipParam === '1';
      this.filter.maskGrid = {
        w: state.grid.w,
        h: state.grid.h,
        cell: CELL,
        offsetY: balance.art.blockRise * CELL,
      };
      scene.cameras.main.filters.internal.add(this.filter);
    } else {
      this.filter = null;
      this.buildFallback();
    }
  }

  /** Запасной путь (8.5): края затемняет текстура виньетки, свечения — аддитивными спрайтами. */
  private buildFallback(): void {
    for (let i = 0; i < 12; i++) {
      const g = this.scene.add
        .image(0, 0, ART.glowSoft)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false);
      this.layers.fx.add(g);
      this.glows.push(g);
    }
    this.vignetteImg = this.scene.add.image(0, 0, ART.vignette).setOrigin(0.5, 0.5).setAlpha(0.85);
    this.layers.fx.add(this.vignetteImg);
  }

  /** Снять световой фильтр посреди раунда (автоснижение качества, 13.6.4). */
  disableFilter(): void {
    if (!this.filter) return;
    this.scene.cameras.main.filters.internal.remove(this.filter);
    this.filter = null;
    this.buildFallback();
  }

  private drawMask(s: GameState): void {
    const ctx = this.maskCanvas.getContext('2d')!;
    const g = s.grid;
    const img = ctx.createImageData(g.w, g.h);
    for (let i = 0; i < g.cells.length; i++) {
      const walk = g.cells[i] === Cell.FLOOR || g.cells[i] === Cell.LIFT ? 255 : 0;
      img.data[i * 4] = walk;
      img.data[i * 4 + 1] = walk;
      img.data[i * 4 + 2] = walk;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  /** После взрыва маска проходов обновляется (8.3). */
  refreshMask(s: GameState): void {
    this.drawMask(s);
    const tex = this.scene.textures.get(this.maskKey);
    (tex.source[0] as unknown as { update(): void }).update();
  }

  onBlast(x: number, y: number): void {
    this.flashes.push({ x, y, born: this.scene.time.now });
    this.dimUntil = this.scene.time.now + balance.anim.dustDimMs + L.blastFlash.fadeMs;
  }

  onKoboldWake(): void {
    this.wokeAt = this.scene.time.now;
  }

  update(f: LightFrame): void {
    const now = this.scene.time.now;
    const t = now / 1000;
    const s = f.state;
    const g = s.grid;
    const lights: LightSource[] = [];
    const awake = s.kobolds.some((k) => k.mode !== 'sleep');
    this.cold += ((awake ? 1 : 0) - this.cold) * 0.05;

    // Фонари на крепи: мерцание по шуму, лёгкое покачивание; на пробуждении кобольда — мигают.
    const since = now - this.wokeAt;
    const blink =
      since >= 0 && since < balance.anim.lanternBlinkMs * 2
        ? Math.floor(since / (balance.anim.lanternBlinkMs / 2)) % 2 === 0
          ? 0.05
          : 1
        : 1;
    const lan = rgb01(P.lantern);
    const coldCol = rgb01(P.ambient);
    const c = L.awakeCooling * this.cold;
    const lanCol: [number, number, number] = [
      lan[0] * (1 - c) + coldCol[0] * c,
      lan[1] * (1 - c) + coldCol[1] * c,
      lan[2] * (1 - c) + coldCol[2] * c * 3,
    ];
    f.world.lanternSprites.forEach((l, i) => {
      const flick = this.reduced ? 1 : 1 - L.lanterns.flicker * (0.5 + 0.5 * noise(t, l.phase + i));
      const sway = this.reduced ? 0 : Math.sin(now / 900 + l.phase) * CELL * 0.04;
      lights.push({
        x: l.x + sway,
        y: l.y,
        radius: L.lanterns.radius * CELL,
        color: lanCol,
        intensity: L.lanterns.intensity * flick * blink,
        priority: PRI.lantern - Math.hypot(l.x - f.hero.x, l.y - f.hero.y) / 1e4,
      });
    });

    // Налобный фонарь героя: центр смещён по направлению взгляда.
    const lamp = f.hero.lampWorld();
    lights.push({
      x: lamp.x,
      y: lamp.y + CELL * 0.35,
      radius: L.heroLamp.radius * CELL,
      color: rgb01(P.hero.lamp),
      intensity: L.heroLamp.intensity,
      priority: PRI.hero,
    });

    // Свет из ствола над подъёмником — самое тёплое и яркое место.
    lights.push({
      x: cellX(g, s.lift),
      y: cellY(g, s.lift) + CELL * 0.6,
      radius: L.daylight.radius * CELL,
      color: rgb01(P.daylight),
      intensity: L.daylight.intensity,
      priority: PRI.day,
    });

    // Искра фитиля — сильное мерцание.
    if (f.spark) {
      const fl = this.reduced ? 1 : 1 + (Math.random() - 0.5) * L.fuseSpark.flicker * 2;
      lights.push({
        x: f.spark.x,
        y: f.spark.y,
        radius: L.fuseSpark.radius * CELL,
        color: rgb01(P.fuseSpark),
        intensity: L.fuseSpark.intensity * fl,
        priority: PRI.spark,
      });
    }

    // Вспышки взрывов гаснут за 400 мс.
    this.flashes = this.flashes.filter((fl) => now - fl.born < L.blastFlash.fadeMs);
    for (const fl of this.flashes) {
      const k = 1 - (now - fl.born) / L.blastFlash.fadeMs;
      lights.push({
        x: fl.x,
        y: fl.y,
        radius: L.blastFlash.radius * CELL,
        color: rgb01(P.blast.inner),
        intensity: L.blastFlash.intensity * k,
        priority: PRI.blast,
      });
    }

    // Жила светится (пульс 2 с) — и пока в стене, и когда самородок лежит на полу.
    const veinCell = g.cells[s.vein] === Cell.VEIN ? s.vein : s.items.find((it) => it.kind === 'vein')?.cell;
    if (veinCell !== undefined) {
      const pulse = this.reduced ? 1 : 0.75 + 0.25 * Math.sin((t * Math.PI * 2) / L.vein.periodS);
      lights.push({
        x: cellX(g, veinCell),
        y: cellY(g, veinCell),
        radius: L.vein.radius * CELL,
        color: rgb01(P.gold.light),
        intensity: L.vein.intensity * pulse,
        priority: PRI.vein,
      });
    }

    // Грибы у логова — медленный пульс 4 с.
    for (const lair of s.lairs) {
      const pulse = this.reduced ? 1 : 0.7 + 0.3 * Math.sin((t * Math.PI * 2) / L.mushrooms.periodS + lair);
      lights.push({
        x: cellX(g, lair),
        y: cellY(g, lair) + CELL * 0.1,
        radius: L.mushrooms.radius * CELL,
        color: rgb01(P.mushroom),
        intensity: L.mushrooms.intensity * pulse,
        priority: PRI.mushroom,
      });
    }

    // Глаза кобольда — движутся с ним; во сне закрыты.
    s.kobolds.forEach((k, i) => {
      if (k.mode === 'sleep') return;
      const kv = f.kobolds[i];
      if (!kv) return;
      lights.push({
        x: kv.eyes.x,
        y: kv.eyes.y + CELL * 0.2,
        radius: L.koboldEyes.radius * CELL,
        color: rgb01(P.kobold.eyes),
        intensity: L.koboldEyes.intensity,
        priority: PRI.eyes,
      });
    });

    // Сразу после взрыва свет на секунду приглушён пылью.
    if (now < this.dimUntil) {
      const left = (this.dimUntil - now) / (balance.anim.dustDimMs + L.blastFlash.fadeMs);
      const k = 1 - (1 - L.dustDim) * Math.min(1, left * 1.5);
      for (const l of lights) if (l.priority !== PRI.blast) l.intensity *= k;
    }

    // Кобольд ближе 3 клеток — виньетка краснеет и пульсирует в такт сердцебиению.
    const near =
      s.status === 'playing' &&
      s.kobolds.some((k) => k.mode === 'awake' && koboldPathDistance(s, k) <= balance.anim.alarmCells);
    const bad = rgb01(P.bad);
    let vig = 0;
    if (near) {
      if (this.reduced) vig = 0.35;
      else {
        const beat = (t * balance.anim.vignettePulseHz) % 1;
        const pulse =
          Math.max(0, Math.sin(beat * Math.PI * 2)) ** 3 +
          0.6 * Math.max(0, Math.sin((beat - 0.18) * Math.PI * 2)) ** 3;
        vig = 0.22 + 0.26 * pulse;
      }
    }

    this.lastCount = Math.min(lights.length, L.maxLights);
    if (this.filter) {
      this.filter.lights = lights;
      this.filter.vignette = [bad[0] * 0.55, bad[1] * 0.08, bad[2] * 0.1, vig];
    } else {
      this.updateFallback(lights, vig);
    }
  }

  private updateFallback(lights: LightSource[], vig: number): void {
    const list = lights
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.glows.length);
    this.glows.forEach((g, i) => {
      const l = list[i];
      if (!l) {
        g.setVisible(false);
        return;
      }
      const col = Phaser.Display.Color.GetColor(l.color[0] * 255, l.color[1] * 255, l.color[2] * 255);
      g.setVisible(true)
        .setPosition(l.x, l.y)
        .setTint(col)
        .setAlpha(Math.min(1, l.intensity * 0.35))
        .setDisplaySize(l.radius * 1.6, l.radius * 1.6);
    });
    const cam = this.scene.cameras.main;
    if (this.vignetteImg) {
      const v = cam.worldView;
      this.vignetteImg
        .setPosition(v.centerX, v.centerY)
        .setDisplaySize(v.width * 1.05, v.height * 1.05)
        .setDepth(1e9);
      this.vignetteImg.setTint(vig > 0 ? Phaser.Display.Color.GetColor(140, 20, 30) : 0xffffff);
    }
  }

  destroy(): void {
    if (this.filter) this.scene.cameras.main.filters.internal.remove(this.filter);
    if (this.scene.textures.exists(this.maskKey)) this.scene.textures.remove(this.maskKey);
    for (const g of this.glows) g.destroy();
    this.vignetteImg?.destroy();
    void this.dpr;
  }
}
