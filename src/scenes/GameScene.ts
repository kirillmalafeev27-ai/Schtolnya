// Сцена мира. Читает состояние раунда и реагирует на события; умеет режим заставки для меню.

import Phaser from 'phaser';
import type { RoundController } from '../app/RoundController';
import { ART } from '../art/manifest';
import { balance } from '../config/balance';
import type { HintLevel } from '../config/levels';
import { hex, palette as P } from '../config/palette';
import type { GameEvent } from '../core/events';
import { Cell, cx, cy, manhattan, type Grid } from '../core/grid';
import { koboldPathDistance } from '../core/kobold';
import type { GameState } from '../core/state';
import type { SfxKey } from '../i18n/sfx.de';
import { BlastView } from '../render/BlastView';
import { CELL, cellX, cellY, footY } from '../render/coords';
import { HeroView } from '../render/HeroView';
import { hintFlags, HintsView, type HintsInfo } from '../render/HintsView';
import { Juice, type SfxStyleName } from '../render/juice';
import { KoboldView } from '../render/KoboldView';
import { createLayers, worldLayersOf, type WorldLayers } from '../render/layers';
import { WorldView } from '../render/WorldView';

const A = balance.anim;
const CAM = balance.camera;

export interface SceneOptions {
  reduced: boolean;
  hints: HintLevel;
  words: Record<SfxKey, string>;
  latinWords: boolean;
  texCellPx: number;
  /** Сообщения для DOM-плашек над миром. */
  onPlate: (kind: 'noShelter' | 'pathClosed' | 'veinFirst', cell: number, visible: boolean) => void;
  /** Подобранный предмет долетел до мира-края — пусть DOM подхватит. */
  onPickupFly?: (kind: 'stick' | 'vein' | 'nugget', screen: { x: number; y: number }) => void;
  /** Звуки и прочие отклики на события (аудио подключается снаружи). */
  onEvent?: (e: GameEvent, s: GameState, scene: GameScene) => void;
}

interface RoundViews {
  ctrl: RoundController;
  layers: WorldLayers;
  world: WorldView;
  hero: HeroView;
  kobolds: KoboldView[];
  hints: HintsView;
  blast: BlastView;
  juice: Juice;
  shownItems: Set<number>;
  zzz: Phaser.GameObjects.Image[];
}

export class GameScene extends Phaser.Scene {
  private views: RoundViews | null = null;
  private opts!: SceneOptions;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private running = false;
  private attract = false;
  private uid = 0;
  private hintsInfo: HintsInfo = { noShelter: false, noShelterCell: -1 };
  private shakeAmp = 0;
  private shakeUntil = 0;
  private shakeDur = 1;
  private baseScroll = { x: 0, y: 0 };
  private baseZoom = 1;
  private follow = false;
  private lastTrapp = 0;
  private knisterShown = false;
  private frozen = false;
  /** Готовность сцены: create() отработал. */
  ready = false;
  onReady: (() => void) | null = null;

  constructor() {
    super('Game');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(P.caveDeep);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ui');
    this.scale.on('resize', () => this.fit());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.ready = true;
    this.onReady?.();
  }

  get state(): GameState | null {
    return this.views?.ctrl.state ?? null;
  }

  get juice(): Juice | null {
    return this.views?.juice ?? null;
  }

  // ───────────── жизненный цикл раунда ─────────────

  startRound(ctrl: RoundController, opts: SceneOptions, attract = false): void {
    this.clearRound();
    this.opts = opts;
    this.attract = attract;
    this.uid++;
    const layers = createLayers(this);
    const s = ctrl.state;
    const ts = CELL / opts.texCellPx;
    const world = new WorldView(this, layers, s, opts.texCellPx, `r${this.uid}`);
    const hero = new HeroView(this, layers, s.grid, s.start, ts);
    if (attract) hero.setVisible(false);
    const kobolds = s.kobolds.map((k) => new KoboldView(this, layers, s.grid, k.cell, ts));
    const hints = new HintsView(this, layers, ts);
    hints.flags = hintFlags(s.params.hints, opts.hints);
    const juice = new Juice(this, layers, ts, this.cameras.main, [this.cameras.main, this.uiCam]);
    juice.reduced = opts.reduced;
    juice.sfxLatin = opts.latinWords;
    const blast = new BlastView(this, layers, juice, ts);
    this.views = { ctrl, layers, world, hero, kobolds, hints, blast, juice, shownItems: new Set(s.items.map((i) => i.id)), zzz: [] };
    // Камеры: основная видит слои 0–4 (к ним применяется свет), вторая — только слой 5.
    this.cameras.main.ignore(layers.ui);
    this.uiCam.ignore(worldLayersOf(layers));
    hero.syncBelt(s.hero.sticks, s.hero.hasVein);
    // Пузыри сна над спящими кобольдами.
    for (const k of kobolds) {
      const z = this.add.image(k.x + CELL * 0.3, k.y - CELL * 0.85, ART.zzz).setScale(ts).setAlpha(0.9);
      layers.ui.add(z);
      this.views.zzz.push(z);
    }
    ctrl.subscribe((events, state) => this.onEvents(ctrl, events, state));
    this.knisterShown = false;
    this.fit();
    this.refreshHints();
  }

  clearRound(): void {
    if (!this.views) return;
    const v = this.views;
    v.world.destroy();
    for (const l of Object.values(v.layers)) l.destroy(true);
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.views = null;
    this.running = false;
    this.tweens.timeScale = 1;
  }

  /** Логика идёт только во время игры: не в интро, не на паузе, не после конца. */
  setRunning(on: boolean): void {
    this.running = on;
  }

  setReduced(reduced: boolean): void {
    if (this.opts) this.opts.reduced = reduced;
    if (this.views) this.views.juice.reduced = reduced;
  }

  setHintLevel(h: HintLevel): void {
    if (!this.views || !this.opts) return;
    this.opts.hints = h;
    this.views.hints.flags = hintFlags(this.views.ctrl.state.params.hints, h);
    this.refreshHints();
  }

  // ───────────── камера ─────────────

  /** Зал вписывается в панель целиком; если клетка меньше 36 CSS px — камера следует за героем (11.1.4). */
  fit(): void {
    const v = this.views;
    if (!v) return;
    const g = v.ctrl.state.grid;
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setSize(W, H);
    this.uiCam.setSize(W, H);
    const pad = balance.art;
    const left = -pad.viewPadSide * CELL;
    const right = g.w * CELL + pad.viewPadSide * CELL;
    const top = -pad.viewPadTop * CELL;
    const bottom = g.h * CELL + pad.viewPadBottom * CELL;
    const rw = right - left;
    const rh = bottom - top;
    const dpr = W / Math.max(1, this.game.canvas.clientWidth || W);
    let zoom = Math.min(W / rw, H / rh);
    const minZoom = (balance.art.minCellCssPx * dpr) / CELL;
    this.follow = zoom < minZoom;
    if (this.follow) zoom = minZoom;
    this.baseZoom = zoom;
    for (const cam of [this.cameras.main, this.uiCam]) cam.setZoom(zoom);
    if (!this.follow) {
      const cxw = (left + right) / 2;
      const cyw = (top + bottom) / 2;
      this.baseScroll.x = cxw - W / 2;
      this.baseScroll.y = cyw - H / 2;
    } else {
      this.updateFollow(true);
    }
    this.applyScroll(0, 0);
  }

  private updateFollow(snap: boolean): void {
    const v = this.views;
    if (!v || !this.follow) return;
    const g = v.ctrl.state.grid;
    const W = this.scale.width;
    const H = this.scale.height;
    const z = this.baseZoom;
    const viewW = W / z;
    const viewH = H / z;
    let tx = v.hero.x - viewW / 2;
    let ty = v.hero.y - CELL * 0.5 - viewH / 2;
    const pad = balance.art;
    const minX = -pad.viewPadSide * CELL;
    const maxX = g.w * CELL + pad.viewPadSide * CELL - viewW;
    const minY = -pad.viewPadTop * CELL;
    const maxY = g.h * CELL + pad.viewPadBottom * CELL - viewH;
    tx = maxX < minX ? (minX + maxX) / 2 : Phaser.Math.Clamp(tx, minX, maxX);
    ty = maxY < minY ? (minY + maxY) / 2 : Phaser.Math.Clamp(ty, minY, maxY);
    // Phaser держит scroll в «незумированных» координатах вокруг центра камеры.
    const sx = tx + viewW / 2 - W / 2;
    const sy = ty + viewH / 2 - H / 2;
    if (snap) {
      this.baseScroll.x = sx;
      this.baseScroll.y = sy;
    } else {
      this.baseScroll.x += (sx - this.baseScroll.x) * 0.12;
      this.baseScroll.y += (sy - this.baseScroll.y) * 0.12;
    }
  }

  private applyScroll(dx: number, dy: number): void {
    for (const cam of [this.cameras.main, this.uiCam]) cam.setScroll(this.baseScroll.x + dx, this.baseScroll.y + dy);
  }

  /** Тряска одинаково сдвигает обе камеры, чтобы подсказки не разъезжались с миром. */
  shake(px: number, ms = CAM.shakeMs): void {
    if (!this.views || this.views.juice.reduced) return;
    this.shakeAmp = Math.max(this.shakeAmp * this.shakeLeft(), px);
    this.shakeDur = ms;
    this.shakeUntil = this.time.now + ms;
  }

  private shakeLeft(): number {
    return Math.max(0, (this.shakeUntil - this.time.now) / this.shakeDur);
  }

  /** Мировая точка → CSS-пиксели внутри панели мира. */
  worldToCss(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    const W = this.scale.width;
    const dpr = W / Math.max(1, this.game.canvas.clientWidth || W);
    const sx = (x - cam.worldView.x) * cam.zoom;
    const sy = (y - cam.worldView.y) * cam.zoom;
    return { x: sx / dpr, y: sy / dpr };
  }

  cellToCss(cell: number): { x: number; y: number } {
    const g = this.views?.ctrl.state.grid;
    if (!g) return { x: 0, y: 0 };
    return this.worldToCss(cellX(g, cell), cellY(g, cell));
  }

  /** CSS-размер клетки. */
  cellCssSize(): number {
    const W = this.scale.width;
    const dpr = W / Math.max(1, this.game.canvas.clientWidth || W);
    return (CELL * this.cameras.main.zoom) / dpr;
  }

  // ───────────── ввод ─────────────

  private onPointer(p: Phaser.Input.Pointer): void {
    const v = this.views;
    if (!v || this.attract || !this.running) return;
    const s = v.ctrl.state;
    if (s.status !== 'playing' || s.paused) return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const cell = this.pickCell(s.grid, wp.x, wp.y);
    if (cell < 0) return;
    // Тап по герою — «стоять» (с запасом по высоте фигуры).
    const hx = v.hero.x;
    const hy = v.hero.y;
    if (Math.abs(wp.x - hx) < CELL * 0.36 && wp.y < hy + CELL * 0.1 && wp.y > hy - CELL * 1.0) {
      v.ctrl.setIntent('stay');
      return;
    }
    v.ctrl.tap(cell);
  }

  /** Клетка под точкой с учётом выступа блоков вверх на 0.25 клетки. */
  pickCell(g: Grid, x: number, y: number): number {
    const gx = Math.floor(x / CELL);
    if (gx < 0 || gx >= g.w) return -1;
    const gy = Math.floor(y / CELL);
    const gy2 = Math.floor((y + balance.art.blockRise * CELL) / CELL);
    if (gy2 !== gy && gy2 >= 0 && gy2 < g.h) {
      const i2 = gy2 * g.w + gx;
      if (g.cells[i2] !== Cell.FLOOR) return i2;
    }
    if (gy < 0 || gy >= g.h) return gy === -1 && gy2 === 0 ? gx : -1;
    return gy * g.w + gx;
  }

  // ───────────── события правил ─────────────

  private say(key: SfxKey, x: number, y: number, style: SfxStyleName, important = false, hold?: number): void {
    const v = this.views;
    if (!v) return;
    v.juice.word(this.opts.words[key], x, y, style, { important, hold });
  }

  private onEvents(ctrl: RoundController, events: GameEvent[], s: GameState): void {
    const v = this.views;
    if (!v || v.ctrl !== ctrl) return;
    const g = s.grid;
    const reduced = v.juice.reduced;
    let refresh = false;
    for (const e of events) {
      this.opts.onEvent?.(e, s, this);
      switch (e.type) {
        case 'STEP': {
          const fromX = v.hero.x;
          const fromY = v.hero.y;
          v.hero.step(e.to, e.shelter, reduced);
          v.juice.stepDust(fromX, fromY);
          refresh = true;
          break;
        }
        case 'PLANTED': {
          v.hero.plant(cellX(g, e.cell), reduced);
          v.world.showFuse(e.cell, e.stand);
          v.juice.sparksAt(cellX(g, e.stand), footY(g, e.stand) - CELL * 0.3, 10);
          this.say('zisch', cellX(g, e.cell), cellY(g, e.cell), 'danger', true);
          this.knisterShown = false;
          refresh = true;
          break;
        }
        case 'FUSE_COUNTDOWN': {
          const key = e.n === 3 ? 'drei' : e.n === 2 ? 'zwei' : 'eins';
          this.say(key, cellX(g, e.cell), cellY(g, e.cell) + CELL * 0.1, 'count', true, 760);
          break;
        }
        case 'BLAST': {
          v.world.clearFuse();
          v.blast.play(g, e.origin, e.rays, reduced);
          this.shake(CAM.shakeBlastPx);
          v.juice.flash(A.whiteFlashMs);
          v.juice.hitStop(A.hitStopMs);
          this.say('kawumm', cellX(g, e.origin), cellY(g, e.origin) - CELL * 0.2, 'boom', true);
          refresh = true;
          break;
        }
        case 'ROCK_DESTROYED':
          v.world.refreshCell(e.cell);
          v.world.addScorch(e.cell);
          break;
        case 'ROCK_CRACKED':
          v.world.refreshCell(e.cell);
          v.blast.crack(g, e.cell);
          this.shake(CAM.shakeCrackPx);
          this.say('knacks', cellX(g, e.cell) + CELL * 0.5, cellY(g, e.cell), 'plain');
          break;
        case 'VEIN_OPENED':
          this.say('funkel', cellX(g, e.cell), cellY(g, e.cell) - CELL * 0.3, 'gold', true);
          v.juice.zoomPunch(CAM.veinZoom, CAM.veinZoomMs);
          v.juice.sparksAt(cellX(g, e.cell), cellY(g, e.cell), 24);
          break;
        case 'POCKET_OPENED':
          v.juice.sparksAt(cellX(g, e.cell), cellY(g, e.cell), 12);
          break;
        case 'PICKUP': {
          const c = v.world.removeItem(e.itemId);
          v.shownItems.delete(e.itemId);
          if (c) this.flyPickup(c, e.kind);
          if (e.kind === 'stick') this.say('schnapp', cellX(g, e.cell), cellY(g, e.cell), 'plain');
          else this.say('kling', cellX(g, e.cell), cellY(g, e.cell), 'gold', e.kind === 'vein');
          break;
        }
        case 'KOBOLD_WAKE': {
          const k = s.kobolds[e.id];
          v.kobolds[e.id].setMode(k.mode, k.anger, reduced);
          v.zzz[e.id]?.setVisible(false);
          const kv = v.kobolds[e.id];
          this.say('ha', kv.x, kv.y - CELL * 0.4, 'kobold', true);
          this.time.delayedCall(520, () => this.say('grrr', kv.x, kv.y - CELL * 0.4, 'kobold'));
          this.shake(CAM.shakeWakePx);
          refresh = true;
          break;
        }
        case 'KOBOLD_CROUCH':
          v.kobolds[e.id].crouch(reduced);
          break;
        case 'KOBOLD_STEP': {
          v.kobolds[e.id].step(e.to, reduced);
          const k = s.kobolds[e.id];
          const d = koboldPathDistance(s, k);
          if (d <= A.alarmCells && this.time.now - this.lastTrapp > A.trappIntervalMs) {
            this.lastTrapp = this.time.now;
            this.say('trapp', cellX(g, e.to), cellY(g, e.to), 'kobold');
          }
          refresh = true;
          break;
        }
        case 'KOBOLD_STUNNED': {
          const k = s.kobolds[e.id];
          v.kobolds[e.id].setMode(k.mode, k.anger, reduced);
          v.zzz[e.id]?.setVisible(false);
          this.say('aua', cellX(g, e.cell), cellY(g, e.cell) - CELL * 0.3, 'kobold', true);
          refresh = true;
          break;
        }
        case 'KOBOLD_RECOVERED': {
          const k = s.kobolds[e.id];
          v.kobolds[e.id].setMode(k.mode, k.anger, reduced);
          this.say('grrr2', v.kobolds[e.id].x, v.kobolds[e.id].y - CELL * 0.4, 'kobold', true);
          refresh = true;
          break;
        }
        case 'KOBOLD_ANGER': {
          const k = s.kobolds[e.id];
          v.kobolds[e.id].setMode(k.mode, k.anger, reduced);
          break;
        }
        case 'CAUGHT': {
          v.hero.setMood('caught', reduced);
          v.kobolds[e.id].grab(reduced);
          this.shake(CAM.shakeCaughtPx);
          this.say('habDich', cellX(g, e.cell), cellY(g, e.cell) - CELL * 0.3, 'kobold', true, 1400);
          refresh = true;
          break;
        }
        case 'HERO_BLASTED':
          v.hero.setMood('blasted', reduced);
          this.time.delayedCall(420, () => this.say('autsch', v.hero.x, v.hero.y - CELL * 0.6, 'danger', true, 1400));
          refresh = true;
          break;
        case 'ESCAPED': {
          v.hero.setMood('victory', reduced);
          this.say(e.close ? 'knapp' : 'geschafft', cellX(g, s.lift), cellY(g, s.lift) + CELL * 0.4, 'win', true, 1600);
          v.juice.flash(A.whiteFlashMs, 0.6);
          this.rideLiftUp();
          refresh = true;
          break;
        }
        case 'DENIED':
          this.onDenied(e.reason, e.cell, s);
          break;
        case 'NO_SHELTER':
          break;
        case 'INTENT':
        case 'READY':
        case 'ACTION_SPENT':
          refresh = true;
          break;
        default:
          break;
      }
    }
    // Новые предметы (самородки после взрыва) выпрыгивают на пол.
    for (const it of s.items) {
      if (!v.shownItems.has(it.id)) {
        v.shownItems.add(it.id);
        v.world.addItem(it, true);
      }
    }
    v.world.setState(s);
    v.hero.syncBelt(s.hero.sticks, s.hero.hasVein);
    if (refresh) this.refreshHints();
  }

  private onDenied(reason: string, cell: number, s: GameState): void {
    const v = this.views!;
    const g = s.grid;
    const reduced = v.juice.reduced;
    switch (reason) {
      case 'bedrock': {
        // Скала покачивается, звучит «KLOPF» (2.2.9).
        const b = v.world.blockAt(cell);
        if (b && !reduced) this.tweens.add({ targets: b, angle: { from: -4, to: 4 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => b.setAngle(0) });
        this.say('klopf', cellX(g, cell), cellY(g, cell), 'plain');
        break;
      }
      case 'noSticks':
        v.hero.shrug(reduced);
        this.say('leer', v.hero.x, v.hero.y - CELL * 0.4, 'danger');
        break;
      case 'fuseBusy':
        v.hero.shrug(reduced);
        this.say('warte', v.hero.x, v.hero.y - CELL * 0.4, 'danger');
        break;
      case 'noPath':
        this.opts.onPlate('pathClosed', cell, true);
        break;
      case 'liftLocked': {
        const lift = v.world.liftImage;
        if (!reduced) this.tweens.add({ targets: lift, y: { from: lift.y, to: lift.y - CELL * 0.08 }, duration: 70, yoyo: true, repeat: 1 });
        this.opts.onPlate('veinFirst', s.lift, true);
        break;
      }
    }
  }

  /** Подобранный предмет подлетает: шашка встаёт на пояс, самородок летит в мешочек (9.2). */
  private flyPickup(c: Phaser.GameObjects.Container, kind: 'stick' | 'vein' | 'nugget'): void {
    const v = this.views!;
    const target = kind === 'stick' ? v.hero.beltWorld() : v.hero.pouchWorld();
    this.tweens.add({
      targets: c,
      x: target.x,
      y: target.y,
      scale: 0.5,
      duration: A.pickupFlyMs * 0.6,
      ease: 'Back.easeIn',
      onComplete: () => {
        if (this.opts.onPickupFly) this.opts.onPickupFly(kind, this.worldToCss(target.x, target.y));
        c.destroy();
      },
    });
  }

  private rideLiftUp(): void {
    const v = this.views!;
    const dur = Math.min(A.finalAnimMaxMs, 1400);
    v.hero.rideUp(CELL * 2.2, dur);
    if (!v.juice.reduced) {
      this.tweens.add({ targets: [v.world.liftImage, v.world.liftFront], y: `-=${CELL * 2.2}`, duration: dur, ease: 'Quad.easeIn' });
    }
  }

  refreshHints(): void {
    const v = this.views;
    if (!v) return;
    const s = v.ctrl.state;
    const info = v.hints.refresh(s);
    if (info.noShelter !== this.hintsInfo.noShelter || info.noShelterCell !== this.hintsInfo.noShelterCell) {
      this.opts.onPlate('noShelter', info.noShelterCell, info.noShelter);
    }
    this.hintsInfo = info;
    // Настроение героя: готовность и тревога (кобольд ближе 3 клеток).
    if (s.status === 'playing') {
      const near = s.kobolds.some((k) => k.mode === 'awake' && koboldPathDistance(s, k) <= A.alarmCells);
      const mood = s.hero.ready ? 'ready' : near ? 'alarm' : 'idle';
      v.hero.setMood(mood, v.juice.reduced);
    }
  }

  // ───────────── кадр ─────────────

  override update(time: number, delta: number): void {
    const v = this.views;
    if (!v) return;
    const s = v.ctrl.state;
    const dt = Math.min(delta / 1000, balance.time.maxFrameDtS);
    if (this.running && !this.attract && s.status === 'playing' && !s.paused) v.ctrl.tick(dt);

    // Хит-стоп: замирает только картинка мира.
    const stop = v.juice.hitStopped;
    if (stop !== this.frozen) {
      this.frozen = stop;
      v.juice.freezeWorld(stop);
    }
    const reduced = v.juice.reduced;
    const st = v.ctrl.state;
    if (!stop) {
      v.world.update(time, delta, reduced);
      v.hero.update();
      for (const kv of v.kobolds) kv.update(time, reduced);
      v.hints.update(delta, reduced);
    }
    // Фитиль: искра бежит, оставшаяся длина — оставшееся время.
    if (st.fuse) {
      const frac = st.fuse.remaining / st.fuse.total;
      v.world.drawFuse(frac, time);
      v.hints.setFuse(frac);
      if (!this.knisterShown && st.fuse.total - st.fuse.remaining > 0.9) {
        this.knisterShown = true;
        this.say('knister', cellX(st.grid, st.fuse.cell), cellY(st.grid, st.fuse.cell) + CELL * 0.2, 'plain');
      }
    }
    // Пузыри сна.
    v.zzz.forEach((z, k) => {
      if (!z.visible) return;
      if (!reduced) z.setY(v.kobolds[k].y - CELL * 0.85 + Math.sin(time / 500 + k) * CELL * 0.05);
    });
    // Камера: следование и тряска.
    if (this.follow) this.updateFollow(false);
    let dx = 0;
    let dy = 0;
    const left = this.shakeLeft();
    if (left > 0) {
      const amp = this.shakeAmp * left;
      dx = (Math.random() * 2 - 1) * amp;
      dy = (Math.random() * 2 - 1) * amp;
    }
    this.applyScroll(dx, dy);
  }

  /** Отладка: сетка и путь кобольда. */
  debugDraw(on: boolean): void {
    const v = this.views;
    if (!v) return;
    const key = '__debug';
    const old = this.children.getByName(key);
    old?.destroy();
    if (!on) return;
    const s = v.ctrl.state;
    const g = s.grid;
    const gfx = this.add.graphics().setName(key);
    v.layers.ui.add(gfx);
    gfx.lineStyle(2, hex(P.good), 0.5);
    for (let x = 0; x <= g.w; x++) gfx.lineBetween(x * CELL, 0, x * CELL, g.h * CELL);
    for (let y = 0; y <= g.h; y++) gfx.lineBetween(0, y * CELL, g.w * CELL, y * CELL);
    void cx;
    void cy;
    void manhattan;
  }
}
