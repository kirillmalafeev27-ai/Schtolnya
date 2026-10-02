// Вид шахты: фон, запечённый пол, блоки, подъёмник, логово, крепь с фонарями, предметы, шашка с фитилём.
// Только читает состояние и реагирует на события.

import Phaser from 'phaser';
import { ART, BEDROCK_VARIANTS, BLOCK_H, CRACKED_VARIANTS, DEBRIS_VARIANTS, HARD_VARIANTS, POCKET_VARIANTS, ROCK_VARIANTS, VEIN_VARIANTS } from '../art/manifest';
import { bakeFloor } from '../art/floorBake';
import { balance } from '../config/balance';
import { hex, palette as P } from '../config/palette';
import { Cell, cx, cy, dirTo, type Grid } from '../core/grid';
import type { GameState, Item } from '../core/state';
import { baseY, CELL, cellX, cellY, footY } from './coords';
import { buildDecor, type Decor } from './decor';
import type { WorldLayers } from './layers';

export class WorldView {
  readonly decor: Decor;
  private readonly blocks = new Map<number, Phaser.GameObjects.Image>();
  private readonly items = new Map<number, Phaser.GameObjects.Container>();
  private floorImage!: Phaser.GameObjects.Image;
  private floorKey = '';
  readonly lanternSprites: { img: Phaser.GameObjects.Image; x: number; y: number; phase: number }[] = [];
  private lairs: Phaser.GameObjects.Image[] = [];
  private mushrooms: Phaser.GameObjects.Image[] = [];
  private fuseGfx: Phaser.GameObjects.Graphics;
  private fuseStick: Phaser.GameObjects.Image | null = null;
  private fuseSpark: Phaser.GameObjects.Image | null = null;
  private fusePath: { x: number; y: number }[] = [];
  private fuseLen = 0;
  liftImage!: Phaser.GameObjects.Image;
  liftFront!: Phaser.GameObjects.Image;
  daylight!: Phaser.GameObjects.Image;
  private readonly texScale: number;
  private pocketTimers = new Map<number, number>();
  private pocketSparks = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: WorldLayers,
    private state: GameState,
    texCellPx: number,
    private readonly uid: string,
  ) {
    this.texScale = CELL / texCellPx;
    this.decor = buildDecor(state.grid, state.seed, { lift: state.lift, lairs: state.lairs });
    this.fuseGfx = scene.add.graphics();
    this.build(texCellPx);
  }

  private get g(): Grid {
    return this.state.grid;
  }

  private img(x: number, y: number, key: string, layer: Phaser.GameObjects.Layer): Phaser.GameObjects.Image {
    const im = this.scene.add.image(x, y, key).setScale(this.texScale);
    layer.add(im);
    return im;
  }

  private build(texCellPx: number): void {
    const g = this.g;
    const L = this.layers;

    // 0: фон за стенами — темнота с дальними балками и друзами.
    const pad = 6 * CELL;
    const bg = this.scene.add
      .tileSprite(-pad, -pad, g.w * CELL + pad * 2, g.h * CELL + pad * 2, ART.backdrop)
      .setOrigin(0, 0)
      .setTileScale(this.texScale);
    L.bg.add(bg);

    // 1: запечённый пол.
    this.floorKey = `${ART.floorBaked}-${this.uid}`;
    const canvas = bakeFloor(this.scene.textures, g, this.decor, texCellPx, this.state.seed);
    if (this.scene.textures.exists(this.floorKey)) this.scene.textures.remove(this.floorKey);
    this.scene.textures.addCanvas(this.floorKey, canvas);
    this.floorImage = this.scene.add.image(0, 0, this.floorKey).setOrigin(0, 0).setScale(this.texScale);
    L.floor.add(this.floorImage);

    // 3: блоки.
    for (let i = 0; i < g.cells.length; i++) this.placeBlock(i);

    // Подъёмник: клеть в верхней стене, свет дня из ствола.
    const lx = cellX(g, this.state.lift);
    const ly = baseY(g, this.state.lift);
    this.daylight = this.img(lx, ly + CELL * 0.35, ART.daylight, L.floor).setOrigin(0.5, 1).setAlpha(0.9);
    this.daylight.setBlendMode(Phaser.BlendModes.ADD);
    this.liftImage = this.img(lx, ly + CELL * 0.08, ART.lift, L.obj).setOrigin(0.5, 1);
    this.liftImage.setDepth(ly - CELL * 0.5);
    this.liftFront = this.img(lx, ly + CELL * 0.08, ART.liftFront, L.obj).setOrigin(0.5, 1);
    this.liftFront.setDepth(ly + CELL * 0.2);

    // Логово кобольда: гнездо и светящиеся грибы.
    for (const lair of this.state.lairs) {
      const nest = this.img(cellX(g, lair), footY(g, lair) + CELL * 0.1, ART.lair, L.floor).setOrigin(0.5, 0.7);
      this.lairs.push(nest);
      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2 + (lair % 7);
        const mx = cellX(g, lair) + Math.cos(ang) * CELL * 0.36;
        const my = cellY(g, lair) + Math.sin(ang) * CELL * 0.22 + CELL * 0.12;
        const m = this.img(mx, my, ART.mushroom(k % 3), L.obj).setOrigin(0.5, 1);
        m.setDepth(my);
        this.mushrooms.push(m);
      }
    }

    // Крепь и фонари.
    for (const p of this.decor.posts) {
      const { x, y, depth } = this.postPos(p.cell, p.side);
      const post = this.img(x, y, ART.timberPost, L.obj).setOrigin(0.5, 1);
      post.setDepth(depth);
    }
    for (const l of this.decor.lanterns) {
      const { x, y, depth } = this.postPos(l.cell, l.side);
      const lan = this.img(x, y - CELL * 0.95, ART.lantern, L.obj).setOrigin(0.5, 0.1);
      lan.setDepth(depth + 1);
      this.lanternSprites.push({ img: lan, x, y: y - CELL * 0.72, phase: l.phase });
    }

    // Предметы на полу.
    for (const it of this.state.items) this.addItem(it, false);
    L.obj.add(this.fuseGfx);
  }

  /** Где стоит стойка крепи: у северной стены — на её лицевой грани, у боковой — у края клетки. */
  private postPos(cell: number, side: 'n' | 'w' | 'e'): { x: number; y: number; depth: number } {
    const g = this.g;
    const x0 = cellX(g, cell);
    const top = cy(g, cell) * CELL;
    if (side === 'n') return { x: x0 + CELL * 0.28, y: top + CELL * 0.16, depth: top + CELL * 0.16 };
    const dx = side === 'w' ? -0.4 : 0.4;
    return { x: x0 + dx * CELL, y: top + CELL * 0.62, depth: top + CELL * 0.62 };
  }

  private blockKey(i: number): string | null {
    const g = this.g;
    const v = this.decor.variants[i];
    switch (g.cells[i]) {
      case Cell.BEDROCK: {
        // Изредка голубая друза: два последних варианта.
        const crystal = v % 9 === 0;
        return ART.bedrock(crystal ? BEDROCK_VARIANTS - 1 - (v % 2) : v % (BEDROCK_VARIANTS - 2));
      }
      case Cell.ROCK:
        return g.cracked[i] ? ART.rockCracked(v % CRACKED_VARIANTS) : ART.rock(v % ROCK_VARIANTS);
      case Cell.HARD:
        return ART.hard(v % HARD_VARIANTS);
      case Cell.VEIN:
        return ART.vein(v % VEIN_VARIANTS);
      case Cell.POCKET:
        return ART.pocket(v % POCKET_VARIANTS);
      default:
        return null;
    }
  }

  private placeBlock(i: number): void {
    const key = this.blockKey(i);
    const old = this.blocks.get(i);
    if (!key) {
      old?.destroy();
      this.blocks.delete(i);
      return;
    }
    const g = this.g;
    if (old) {
      old.setTexture(key);
      return;
    }
    const x = cellX(g, i);
    const y = baseY(g, i);
    const im = this.img(x, y, key, this.layers.obj).setOrigin(0.5, 1);
    im.setDepth(y);
    void BLOCK_H;
    this.blocks.set(i, im);
    if (g.cells[i] === Cell.POCKET) this.pocketTimers.set(i, 1 + (this.decor.variants[i] % 30) / 10);
  }

  blockAt(i: number): Phaser.GameObjects.Image | undefined {
    return this.blocks.get(i);
  }

  setState(s: GameState): void {
    this.state = s;
  }

  /** Клетка изменилась после взрыва. */
  refreshCell(i: number): void {
    this.placeBlock(i);
    const spark = this.pocketSparks.get(i);
    if (spark && this.g.cells[i] !== Cell.POCKET) {
      spark.destroy();
      this.pocketSparks.delete(i);
      this.pocketTimers.delete(i);
    }
  }

  /** Копоть и обломки на месте взрыва — поверх пола (7.5.1). */
  addScorch(i: number): void {
    const g = this.g;
    const x = cellX(g, i);
    const y = cellY(g, i) + CELL * 0.08;
    const sc = this.img(x, y, ART.scorch, this.layers.floor).setAlpha(0.85);
    sc.setRotation((this.decor.variants[i] / 251) * Math.PI);
    const n = 4 + (this.decor.variants[i] % 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + this.decor.variants[i];
      const r = CELL * (0.18 + ((k * 37) % 10) / 40);
      this.img(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, ART.rubble((i + k) % DEBRIS_VARIANTS), this.layers.floor).setRotation(a);
    }
  }

  // ───────────── предметы ─────────────

  addItem(it: Item, popIn: boolean): Phaser.GameObjects.Container {
    const g = this.g;
    const x = cellX(g, it.cell);
    const y = footY(g, it.cell) - CELL * 0.04;
    const key = it.kind === 'stick' ? ART.stickItem : it.kind === 'vein' ? ART.nuggetBig : ART.nuggetSmall;
    const shadow = this.scene.add.image(0, 0, ART.shadow).setScale(this.texScale * 0.55, this.texScale * 0.5);
    const sprite = this.scene.add.image(0, 0, key).setOrigin(0.5, 0.85).setScale(this.texScale);
    if (it.kind === 'stick') sprite.setRotation(-0.5);
    const c = this.scene.add.container(x, y, [shadow, sprite]);
    c.setDepth(y);
    c.setData('sprite', sprite);
    this.layers.obj.add(c);
    this.items.set(it.id, c);
    if (popIn) {
      sprite.y = -CELL * 0.6;
      this.scene.tweens.add({ targets: sprite, y: 0, duration: 380, ease: 'Bounce.easeOut' });
    }
    return c;
  }

  removeItem(id: number): Phaser.GameObjects.Container | undefined {
    const c = this.items.get(id);
    this.items.delete(id);
    return c;
  }

  // ───────────── шашка и фитиль ─────────────

  /** Шашка торчит из грани породы, фитиль свисает и петляет по полу соседней клетки (7.5.11). */
  showFuse(rock: number, stand: number): void {
    this.clearFuse();
    const g = this.g;
    const d = dirTo(g, rock, stand);
    const rx = cellX(g, rock);
    const ry = cellY(g, rock);
    const dx = [0, -1, 0, 1][d];
    const dy = [-1, 0, 1, 0][d];
    // Точка на грани породы, обращённой к месту закладки.
    const fx = rx + dx * CELL * 0.42;
    const fy = ry + dy * CELL * 0.36 + (dy < 0 ? -CELL * 0.1 : 0);
    const stick = this.img(fx, fy, ART.dynPlanted, this.layers.obj).setOrigin(0.5, 0.75);
    stick.setRotation(dx * 0.5 + (dy > 0 ? 0 : dy < 0 ? Math.PI : 0) * 0);
    stick.setDepth(baseY(g, rock) + (dy > 0 ? 2 : -2));
    this.fuseStick = stick;
    // Петля фитиля по полу клетки, где стоял герой.
    const sx = cellX(g, stand);
    const sy = footY(g, stand);
    const pts: { x: number; y: number }[] = [];
    const steps = 22;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const bx = fx + (sx - fx) * t;
      const by = fy + (sy - fy) * t;
      const wob = Math.sin(t * Math.PI * 2.4) * CELL * 0.12 * (1 - t * 0.4);
      pts.push({ x: bx + (dy !== 0 ? wob : 0), y: by + (dx !== 0 ? wob : 0) + CELL * 0.04 });
    }
    this.fusePath = pts;
    this.fuseLen = 0;
    for (let k = 1; k < pts.length; k++) this.fuseLen += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    this.fuseGfx.setDepth(footY(g, stand) - CELL * 0.3);
    this.fuseSpark = this.img(pts[pts.length - 1].x, pts[pts.length - 1].y, ART.fuseSpark, this.layers.fx);
    this.fuseSpark.setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Перерисовать фитиль: оставшаяся длина показывает оставшееся время. Возвращает позицию искры. */
  drawFuse(frac: number, time: number): { x: number; y: number } | null {
    const pts = this.fusePath;
    const gfx = this.fuseGfx;
    gfx.clear();
    if (!pts.length || !this.fuseSpark) return null;
    // frac: 1 — фитиль целый, 0 — догорел до шашки. Искра бежит от конца к шашке.
    const lit = this.fuseLen * Math.max(0, Math.min(1, frac));
    let acc = 0;
    let sparkPt = pts[0];
    const unburned: { x: number; y: number }[] = [pts[0]];
    const burned: { x: number; y: number }[] = [];
    for (let k = 1; k < pts.length; k++) {
      const seg = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
      if (acc + seg <= lit) {
        unburned.push(pts[k]);
      } else if (acc < lit) {
        const t = (lit - acc) / seg;
        sparkPt = { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t };
        unburned.push(sparkPt);
        burned.push(sparkPt, pts[k]);
      } else {
        burned.push(pts[k]);
      }
      acc += seg;
    }
    if (lit >= this.fuseLen) sparkPt = pts[pts.length - 1];
    const w = CELL * 0.045;
    const line = (list: { x: number; y: number }[], width: number, color: number, alpha = 1) => {
      if (list.length < 2) return;
      gfx.lineStyle(width, color, alpha);
      gfx.beginPath();
      gfx.moveTo(list[0].x, list[0].y);
      for (let k = 1; k < list.length; k++) gfx.lineTo(list[k].x, list[k].y);
      gfx.strokePath();
    };
    line(burned, w * 1.6, hex(P.ink), 0.55);
    line(burned, w * 0.7, hex(P.scorch), 0.9);
    line(unburned, w * 2.2, hex(P.ink));
    line(unburned, w * 1.1, hex(P.timber.light));
    const flick = 0.85 + Math.sin(time * 0.06) * 0.15 + Math.random() * 0.15;
    this.fuseSpark.setPosition(sparkPt.x, sparkPt.y).setScale(this.texScale * flick).setRotation(time * 0.02);
    return sparkPt;
  }

  clearFuse(): void {
    this.fuseGfx.clear();
    this.fuseStick?.destroy();
    this.fuseSpark?.destroy();
    this.fuseStick = null;
    this.fuseSpark = null;
    this.fusePath = [];
  }

  // ───────────── жизнь в кадре ─────────────

  update(time: number, delta: number, reduced: boolean): void {
    // Фонари чуть покачиваются.
    for (const l of this.lanternSprites) {
      l.img.setRotation(reduced ? 0 : Math.sin(time / 900 + l.phase) * Phaser.Math.DegToRad(balance.light.lanterns.swingDeg));
    }
    // Предметы на полу слегка покачиваются.
    for (const c of this.items.values()) {
      const sp = c.getData('sprite') as Phaser.GameObjects.Image;
      if (!reduced) sp.setScale(this.texScale * (1 + Math.sin(time / 380 + c.x) * 0.03), this.texScale);
    }
    // Карман: раз в 3–5 с в трещине вспыхивает золотая искра (7.5.6).
    for (const [cell, t] of this.pocketTimers) {
      let left = t - delta / 1000;
      if (left <= 0) {
        left = 3 + ((this.decor.variants[cell] + time) % 20) / 10;
        this.flashPocket(cell);
      }
      this.pocketTimers.set(cell, left);
    }
    // Грибы у логова медленно пульсируют.
    for (let k = 0; k < this.mushrooms.length; k++) {
      const m = this.mushrooms[k];
      if (!reduced) m.setScale(this.texScale * (1 + Math.sin(time / 640 + k) * 0.05));
    }
  }

  private flashPocket(cell: number): void {
    const g = this.g;
    let sp = this.pocketSparks.get(cell);
    if (!sp) {
      sp = this.img(cellX(g, cell) + CELL * 0.08, cellY(g, cell) - CELL * 0.12, ART.pocketSpark, this.layers.fx);
      sp.setBlendMode(Phaser.BlendModes.ADD);
      this.pocketSparks.set(cell, sp);
    }
    sp.setAlpha(1).setScale(0);
    this.scene.tweens.add({
      targets: sp,
      scale: { from: 0, to: this.texScale },
      angle: { from: 0, to: 90 },
      alpha: { from: 1, to: 0 },
      duration: 520,
      ease: 'Sine.easeOut',
    });
  }

  lairPositions(): { x: number; y: number }[] {
    return this.state.lairs.map((l) => ({ x: cellX(this.g, l), y: cellY(this.g, l) }));
  }

  get cellTexScale(): number {
    return this.texScale;
  }

  destroy(): void {
    if (this.scene.textures.exists(this.floorKey)) this.scene.textures.remove(this.floorKey);
  }
}

/** Позиция клетки в мире: x, y центра. */
export function cellCenter(g: Grid, i: number): { x: number; y: number } {
  return { x: (cx(g, i) + 0.5) * CELL, y: (cy(g, i) + 0.5) * CELL };
}
