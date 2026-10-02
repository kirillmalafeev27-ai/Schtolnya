// Подсказки (план, 2.8 и 7.5.15) в слое 5 — читаются поверх любого света.

import Phaser from 'phaser';
import { ART } from '../art/manifest';
import type { HintLevel } from '../config/levels';
import { blastCross } from '../core/blast';
import { Cell, manhattan, neighbor } from '../core/grid';
import { burningCross, heroPassable, heroRoute, shelterMarks, standCellFor } from '../core/intent';
import { koboldPreview } from '../core/kobold';
import type { GameState } from '../core/state';
import { CELL, cellX, cellY, footY } from './coords';
import type { WorldLayers } from './layers';

export interface HintFlags {
  preview: boolean;
  shelters: boolean;
  paws: boolean;
  target: boolean;
}

/** Какие подсказки включены на уровне (4.4) с учётом настроек игрока. */
export function hintFlags(level: HintLevel, user: HintLevel): HintFlags {
  const rank: Record<HintLevel, number> = { all: 0, noShelter: 1, burningOnly: 2 };
  const eff = rank[level] >= rank[user] ? level : user;
  return {
    preview: eff !== 'burningOnly',
    shelters: eff === 'all',
    paws: eff !== 'burningOnly',
    target: eff !== 'burningOnly',
  };
}

class Pool {
  private items: Phaser.GameObjects.Image[] = [];
  private used = 0;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly ts: number,
  ) {}
  begin(): void {
    this.used = 0;
  }
  take(key: string, x: number, y: number): Phaser.GameObjects.Image {
    let im = this.items[this.used];
    if (!im) {
      im = this.scene.add.image(x, y, key);
      this.layer.add(im);
      this.items.push(im);
    }
    this.used++;
    return im.setTexture(key).setPosition(x, y).setVisible(true).setAlpha(1).setScale(this.ts).setAngle(0).setOrigin(0.5, 0.5).setDepth(0);
  }
  end(): void {
    for (let k = this.used; k < this.items.length; k++) this.items[k].setVisible(false);
  }
  get active(): Phaser.GameObjects.Image[] {
    return this.items.slice(0, this.used);
  }
}

export interface HintsInfo {
  /** Нет укрытия ближе трёх шагов — показать красную плашку. */
  noShelter: boolean;
  /** Клетка, у которой показывать плашку. */
  noShelterCell: number;
}

export class HintsView {
  private readonly tape: Pool;
  private readonly marks: Pool;
  private readonly route: Pool;
  private readonly paws: Pool;
  private readonly targets: Pool;
  private ghost: Phaser.GameObjects.Image;
  private pulse = 0;
  private burning = false;
  private fuseFrac = 1;
  flags: HintFlags = { preview: true, shelters: true, paws: true, target: true };

  constructor(
    scene: Phaser.Scene,
    layers: WorldLayers,
    private readonly ts: number,
  ) {
    this.tape = new Pool(scene, layers.ui, ts);
    this.route = new Pool(scene, layers.ui, ts);
    this.marks = new Pool(scene, layers.ui, ts);
    this.paws = new Pool(scene, layers.ui, ts);
    this.targets = new Pool(scene, layers.ui, ts);
    this.ghost = scene.add.image(0, 0, ART.ghost).setScale(ts).setOrigin(0.5, 0.92).setVisible(false);
    layers.ui.add(this.ghost);
  }

  /** Перестроить подсказки по состоянию. Вызывается после каждого события. */
  refresh(s: GameState): HintsInfo {
    const g = s.grid;
    const h = s.hero;
    const f = this.flags;
    const info: HintsInfo = { noShelter: false, noShelterCell: -1 };
    this.tape.begin();
    this.marks.begin();
    this.route.begin();
    this.paws.begin();
    this.targets.begin();
    this.ghost.setVisible(false);
    if (s.status !== 'playing') {
      for (const p of [this.tape, this.marks, this.route, this.paws, this.targets]) p.end();
      return info;
    }

    // Крест: горящей шашки — всегда; будущий — при намерении «заложить», если уровень разрешает (2.8.1).
    let crossOrigin = -1;
    this.burning = !!s.fuse;
    if (s.fuse) crossOrigin = s.fuse.cell;
    else if (f.preview && h.intent.kind === 'plant' && h.sticks > 0) crossOrigin = h.intent.target;
    let crossSet: Set<number> | null = null;
    if (crossOrigin >= 0) {
      const cross = blastCross(g, crossOrigin, s.params.blastRange);
      crossSet = new Set(cross.cells);
      for (let d = 0; d < 4; d++) {
        let c = crossOrigin;
        for (let k = 1; k <= cross.rays[d]; k++) {
          c = neighbor(g, c, d);
          const key = d % 2 === 0 ? ART.tapeV : ART.tapeH;
          this.tape.take(key, cellX(g, c), cellY(g, c));
        }
      }
      const center = this.tape.take(ART.tapeCenter, cellX(g, crossOrigin), cellY(g, crossOrigin) - CELL * 0.12);
      center.setData('center', true);
      // Клетка, которая разрушится: трещина; у крепкой породы — «×2».
      this.marks.take(ART.crackMark, cellX(g, crossOrigin), cellY(g, crossOrigin) - CELL * 0.12);
      if (g.cells[crossOrigin] === Cell.HARD) this.marks.take(ART.x2, cellX(g, crossOrigin) + CELL * 0.24, cellY(g, crossOrigin) - CELL * 0.4);

      // Укрытия и призрак героя — только для будущей закладки.
      if (!s.fuse && h.intent.kind === 'plant') {
        const adjacent = manhattan(g, h.cell, h.intent.target) === 1;
        const stand = adjacent ? h.cell : standCellFor(s, h.intent.target);
        if (stand !== null && stand >= 0) {
          if (!adjacent) {
            this.ghost.setVisible(true).setPosition(cellX(g, stand), footY(g, stand));
            this.ghost.setFlipX(cellX(g, crossOrigin) < cellX(g, stand));
          }
          const sm = shelterMarks(g, stand, crossSet, heroPassable(s));
          if (f.shelters) {
            for (const c of sm.one) this.marks.take(ART.bootWhite, cellX(g, c), cellY(g, c) + CELL * 0.1).setData('boot', true);
            for (const c of sm.two) this.marks.take(ART.bootOrange, cellX(g, c), cellY(g, c) + CELL * 0.1).setData('boot', true);
          }
          if (!sm.one.length && !sm.two.length) {
            info.noShelter = true;
            info.noShelterCell = stand;
          }
        }
      }
    }

    // Маршрут героя; отрезки по горящему кресту — красные (2.2.8).
    const route = h.intent.kind === 'stay' ? [] : heroRoute(s);
    if (route && route.length) {
      const burningSet = burningCross(s);
      let prevX = cellX(g, h.cell);
      let prevY = cellY(g, h.cell) + CELL * 0.18;
      for (const c of route) {
        const x = cellX(g, c);
        const y = cellY(g, c) + CELL * 0.18;
        const red = !!burningSet && (burningSet.has(c) || burningSet.has(h.cell));
        for (let k = 1; k <= 2; k++) {
          const t = k / 3;
          this.route.take(red ? ART.routeDotRed : ART.routeDot, prevX + (x - prevX) * t, prevY + (y - prevY) * t).setAlpha(0.9);
        }
        prevX = x;
        prevY = y;
      }
    }

    // Следующие 3 шага кобольда — бледные отпечатки лап (2.8.5); мишень — если он на горящем кресте (2.8.4).
    const burningSet = burningCross(s);
    for (const k of s.kobolds) {
      if (f.paws && k.mode === 'awake') {
        const steps = koboldPreview(s, k, 3);
        steps.forEach((c, i) => {
          const p = this.paws.take(ART.paw, cellX(g, c) + (i % 2 ? 8 : -8), cellY(g, c) + CELL * 0.12);
          p.setAlpha(0.75 - i * 0.18);
          p.setData('paw', i);
        });
      }
      if (f.target && burningSet && burningSet.has(k.cell)) {
        const t = this.targets.take(ART.target, cellX(g, k.cell), cellY(g, k.cell) - CELL * 0.62);
        t.setData('target', true);
      }
    }

    for (const p of [this.tape, this.marks, this.route, this.paws, this.targets]) p.end();
    return info;
  }

  setFuse(frac: number): void {
    this.fuseFrac = frac;
  }

  /** Пульсация: крест пульсирует всё чаще к концу фитиля (2.8.3). */
  update(dtMs: number, reduced: boolean): void {
    const freq = this.burning ? 1.2 + (1 - this.fuseFrac) * 5 : 0.8;
    this.pulse += (dtMs / 1000) * freq * Math.PI * 2;
    const a = reduced ? 0.85 : 0.72 + Math.sin(this.pulse) * 0.2;
    for (const im of this.tape.active) im.setAlpha(this.burning ? a : 0.62);
    for (const im of this.targets.active) {
      im.setAngle(this.pulse * 12);
      if (!reduced) im.setScale(this.ts * (1 + Math.sin(this.pulse * 1.5) * 0.08));
    }
    if (!reduced) {
      for (const im of this.marks.active) if (im.getData('boot')) im.setScale(this.ts * (1 + Math.sin(this.pulse * 0.7) * 0.05));
    }
    if (this.ghost.visible) this.ghost.setAlpha(0.5 + Math.sin(this.pulse * 0.8) * 0.12);
  }
}
