// Звук раунда (план, 9.2 и 10): события правил → пресеты, шипение фитиля и тиканье,
// храп и шаги кобольда по расстоянию, эмбиент штольни.

import type { RoundController } from '../app/RoundController';
import { balance } from '../config/balance';
import type { GameEvent } from '../core/events';
import { koboldPathDistance } from '../core/kobold';
import type { GameState } from '../core/state';
import { cellX } from '../render/coords';
import { Mixer } from '../shared/audio/mixer';
import * as S from './presets';

const AU = balance.audio;
const rr = (a: number, b: number) => a + Math.random() * (b - a);

/** То, что звуку нужно знать о сцене: где на экране источник. */
export interface PanSource {
  panOf(worldX: number): number;
}

export class MineAudio {
  readonly mixer: Mixer;
  private ctrl: RoundController | null = null;
  private scene: PanSource | null = null;
  private drone: S.Loop | null = null;
  private hiss: S.Hiss | null = null;
  private timer = 0;
  private lastTick = -1;
  private nextDrip = 0;
  private nextCreak = 0;
  private nextSnore = 0;
  private nextCrackle = 0;
  private stepVariant = 0;
  private roundStartPending = false;

  constructor() {
    this.mixer = new Mixer({
      duckLevel: AU.duckLevel,
      duckMs: AU.duckAfterBlastMs,
      pitchJitter: AU.pitchJitter,
    });
    this.mixer.onUnlock = () => {
      this.startAmbient();
      if (this.roundStartPending) this.roundStart();
    };
  }

  /** Первый жест игрока: запустить AudioContext (10.7). */
  unlock(): void {
    this.mixer.unlock();
  }

  setVolumes(sfx: number, ambient: number, on: boolean): void {
    this.mixer.setVolumes({ sfx, ambient, on });
    if (on) this.startAmbient();
  }

  setPaused(on: boolean): void {
    if (on) this.stopHiss();
    this.mixer.setPaused(on);
  }

  /** Новый раунд: колокол и скрип каната. */
  attach(ctrl: RoundController, scene: PanSource): void {
    this.ctrl = ctrl;
    this.scene = scene;
    this.stopHiss();
    this.lastTick = -1;
    if (!this.timer) this.timer = window.setInterval(() => this.poll(), 50);
    if (this.mixer.ready) this.roundStart();
    else this.roundStartPending = true;
  }

  detach(): void {
    this.ctrl = null;
    this.stopHiss();
  }

  private roundStart(): void {
    this.roundStartPending = false;
    const s = this.ctrl?.state;
    const pan = s ? this.pan(cellX(s.grid, s.lift)) : 0;
    S.liftBell(this.mixer, { pan, vol: 0.9 });
    S.cage(this.mixer, { pan, vol: 0.7 }, 0.9);
  }

  /** Подсчёт очков в итогах: «дзынь» с растущей высотой. */
  tally(step: number): void {
    S.kling(this.mixer, { vol: 0.8 }, step * 2);
  }

  private pan(worldX: number): number {
    return this.scene ? this.scene.panOf(worldX) * 0.8 : 0;
  }

  private panCell(s: GameState, cell: number): number {
    return this.pan(cellX(s.grid, cell));
  }

  onEvent(e: GameEvent, s: GameState): void {
    const m = this.mixer;
    if (!m.ready) return;
    switch (e.type) {
      case 'ANSWERED':
        if (e.correct) S.click(m);
        else S.softBonk(m);
        break;
      case 'STEP':
        S.step(m, { pan: this.panCell(s, e.to), vol: 0.9 }, this.stepVariant++ % 3);
        break;
      case 'PLANTED':
        S.plant(m, { pan: this.panCell(s, e.cell) });
        this.stopHiss();
        this.hiss = S.fuseHiss(m, { pan: this.panCell(s, e.cell) });
        this.lastTick = -1;
        break;
      case 'BLAST': {
        this.stopHiss();
        const pan = this.panCell(s, e.origin);
        m.duck();
        S.blast(m, { pan });
        window.setTimeout(() => S.rumble(m, { pan: -pan * 0.5, vol: 0.8 }), rr(600, 1100));
        break;
      }
      case 'ROCK_CRACKED':
        S.crack(m, { pan: this.panCell(s, e.cell) });
        break;
      case 'VEIN_OPENED':
        S.vein(m, { pan: this.panCell(s, e.cell) });
        break;
      case 'POCKET_OPENED':
        S.glitter(m, { pan: this.panCell(s, e.cell), vol: 0.8 });
        break;
      case 'PICKUP':
        if (e.kind === 'stick') S.schnapp(m, { pan: this.panCell(s, e.cell) });
        else S.kling(m, { pan: this.panCell(s, e.cell) }, e.kind === 'vein' ? 5 : 0);
        break;
      case 'KOBOLD_WAKE':
        S.growl(m, { pan: this.panCell(s, s.kobolds[e.id].cell) }, false);
        break;
      case 'KOBOLD_STEP': {
        const k = s.kobolds[e.id];
        const d = Math.min(koboldPathDistance(s, k), AU.koboldHearCells);
        // Главный звуковой сигнал: чем ближе, тем громче (10.3).
        const near = 1 - d / AU.koboldHearCells;
        S.koboldStep(m, { pan: this.panCell(s, e.to), vol: 0.12 + Math.pow(near, 1.4) * 0.95 });
        break;
      }
      case 'KOBOLD_STUNNED':
        S.bonk(m, { pan: this.panCell(s, e.cell) });
        break;
      case 'KOBOLD_RECOVERED':
        S.growl(m, { pan: this.panCell(s, s.kobolds[e.id].cell), vol: 1.15 }, true);
        break;
      case 'CAUGHT':
        S.caught(m, { pan: this.panCell(s, e.cell) });
        break;
      case 'ESCAPED': {
        const pan = this.panCell(s, s.lift);
        S.liftBell(m, { pan });
        S.cage(m, { pan, vol: 0.9 }, 1.3);
        break;
      }
      case 'DENIED':
        if (e.reason === 'liftLocked') S.bellDull(m, { pan: this.panCell(s, s.lift) });
        else if (e.reason === 'bedrock') S.knock(m, { pan: this.panCell(s, e.cell) }, 2);
        else if (e.reason === 'noPath') S.knock(m, { pan: this.panCell(s, e.cell), vol: 0.6 }, 1);
        else S.knock(m, { pan: this.panCell(s, s.hero.cell), vol: 0.8 }, 1);
        break;
      default:
        break;
    }
  }

  // ───────────── петли и расписание ─────────────

  private startAmbient(): void {
    if (this.drone || !this.mixer.ready) return;
    this.drone = S.drone(this.mixer);
    const now = this.mixer.now;
    this.nextDrip = now + rr(AU.dripMinS, AU.dripMaxS);
    this.nextCreak = now + rr(AU.creakMinS, AU.creakMaxS);
    if (!this.timer) this.timer = window.setInterval(() => this.poll(), 50);
  }

  private stopHiss(): void {
    this.hiss?.stop();
    this.hiss = null;
  }

  private poll(): void {
    const m = this.mixer;
    if (!m.ready) return;
    const now = m.now;
    if (!this.drone) this.startAmbient();
    if (now >= this.nextDrip) {
      S.drip(m, { pan: rr(-0.9, 0.9), vol: rr(0.6, 1) });
      this.nextDrip = now + rr(AU.dripMinS, AU.dripMaxS);
    }
    if (now >= this.nextCreak) {
      S.creak(m, { pan: rr(-0.8, 0.8), vol: rr(0.6, 1) });
      this.nextCreak = now + rr(AU.creakMinS, AU.creakMaxS);
    }
    const s = this.ctrl?.state;
    if (!s || s.status !== 'playing' || s.paused) {
      this.stopHiss();
      return;
    }
    // Фитиль: шипение растёт к концу, треск искр, тиканье последних 3 с.
    if (s.fuse) {
      if (!this.hiss) this.hiss = S.fuseHiss(m, { pan: this.panCell(s, s.fuse.cell) });
      const frac = s.fuse.remaining / s.fuse.total;
      this.hiss?.set(frac);
      if (now >= this.nextCrackle) {
        this.hiss?.crackle();
        this.nextCrackle = now + rr(0.05, 0.22);
      }
      if (s.fuse.remaining <= 3) {
        const half = Math.ceil(s.fuse.remaining / 0.5);
        if (half !== this.lastTick) {
          this.lastTick = half;
          S.tick(m, { pan: this.panCell(s, s.fuse.cell) }, half % 2 === 0);
        }
      }
    } else if (this.hiss) this.stopHiss();
    // Храп спящих кобольдов — тихо, с панорамой по x (9.2).
    if (now >= this.nextSnore) {
      this.nextSnore = now + rr(2.6, 3.6);
      for (const k of s.kobolds) {
        if (k.mode !== 'sleep') continue;
        const d = Math.min(koboldPathDistance(s, k), AU.koboldHearCells * 1.5);
        S.snore(m, { pan: this.panCell(s, k.cell), vol: 0.35 + (1 - d / (AU.koboldHearCells * 1.5)) * 0.45 });
      }
    }
  }

  destroy(): void {
    clearInterval(this.timer);
    this.timer = 0;
    this.stopHiss();
    this.drone?.stop();
    this.drone = null;
    this.mixer.destroy();
  }
}
