// Приложение «Шахта»: страница-комикс, игра Phaser, панель вопроса, экраны и поток раундов.

import Phaser from 'phaser';
import type { GenReport, Recipe } from '../art/ArtFactory';
import { placeholderRecipes } from '../art/recipes/placeholder';
import { balance } from '../config/balance';
import { getLevel, levels } from '../config/levels';
import { DIRS, Cell, cx, cy, idx, inBounds } from '../core/grid';
import type { GameEvent } from '../core/events';
import { generateLevel } from '../core/levelGen';
import type { GameState } from '../core/state';
import { ru } from '../i18n/ru';
import { sfxDe, sfxRu } from '../i18n/sfx.de';
import { BootScene, type BootConfig } from '../scenes/BootScene';
import { GameScene } from '../scenes/GameScene';
import { applyPageLayout, computePageLayout, type PageLayout } from '../shared/layout';
import { PaceTracker } from '../shared/pace';
import { QuestionPanel } from '../shared/QuestionPanel';
import type { QuestionProvider } from '../shared/questions/types';
import { GearWidget } from '../ui/GearWidget';
import { iconBoot, iconDynamite, iconPalm, iconPause, iconReady, iconShield, iconWait } from '../ui/icons';
import { WorldPlates } from '../ui/plates';
import { PauseScreen } from '../ui/screens/PauseScreen';
import { ResultsScreen } from '../ui/screens/ResultsScreen';
import { applyTheme } from '../ui/theme';
import { RoundController } from './RoundController';
import { defaultStorage, GameStore, type KeyValueStorage } from './storage';

export interface FinishInfo {
  level: number;
  won: boolean;
  score: number;
  stars: 0 | 1 | 2 | 3;
  cause?: 'kobold' | 'blast';
}

export interface MineOptions {
  questions: QuestionProvider;
  storage?: KeyValueStorage;
  level?: number;
  onFinish?: (r: FinishInfo) => void;
  /** Рецепты арта (по умолчанию — полный процедурный комикс). */
  recipes?: Record<string, Recipe>;
}

export class MineApp {
  readonly root: HTMLElement;
  private readonly worldPanel: HTMLElement;
  private readonly quizPanel: HTMLElement;
  private readonly canvasHost: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly screens: HTMLElement;
  private readonly store: GameStore;
  private readonly pace: PaceTracker;
  private readonly panel: QuestionPanel;
  private readonly gear: GearWidget;
  private readonly plates: WorldPlates;
  private readonly pauseBtn: HTMLButtonElement;
  private game: Phaser.Game | null = null;
  private scene: GameScene | null = null;
  private ctrl: RoundController | null = null;
  private layout: PageLayout | null = null;
  private ro: ResizeObserver | null = null;
  private pauseScreen: PauseScreen | null = null;
  private results: ResultsScreen | null = null;
  private levelId = 1;
  private texCellPx: number = balance.art.cellPx;
  private dpr = 1;
  private destroyed = false;
  private roundOverTimer = 0;
  private unsub: (() => void) | null = null;
  private artReport: GenReport | null = null;
  reducedMotion = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: MineOptions,
  ) {
    this.store = new GameStore(options.storage ?? defaultStorage());
    this.pace = new PaceTracker(this.store.paceStorage(), balance.pace);
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.reducedMotion = this.store.settings.reducedMotion ?? prefersReduced;

    this.root = document.createElement('div');
    this.root.className = 'mine';
    this.root.classList.toggle('mine--reduced', this.reducedMotion);
    applyTheme(this.root);
    this.root.innerHTML = `
      <div class="mine__page">
        <section class="mine__panel mine__world" aria-label="${ru.title}">
          <div class="mine__canvas-host"></div>
          <div class="mine__world-overlay"></div>
        </section>
        <section class="mine__panel mine__quiz"></section>
      </div>
      <div class="mine__screens"></div>`;
    container.appendChild(this.root);
    this.worldPanel = this.root.querySelector('.mine__world')!;
    this.quizPanel = this.root.querySelector('.mine__quiz')!;
    this.canvasHost = this.root.querySelector('.mine__canvas-host')!;
    this.overlay = this.root.querySelector('.mine__world-overlay')!;
    this.screens = this.root.querySelector('.mine__screens')!;

    this.panel = new QuestionPanel(
      this.quizPanel,
      options.questions,
      {
        wrongFeedbackMs: balance.rules.wrongFeedbackMs,
        answerFlashMs: balance.anim.answerFlashMs,
        flipMs: balance.anim.questionFlipMs,
        doubleTapGuardMs: balance.time.doubleTapGuardMs,
        fontMaxPx: balance.questions.fontMaxPx,
        fontMinPx: balance.questions.fontMinPx,
      },
      { groupLabel: ru.quizLabel, optionLabel: ru.optionLabel, readyHint: ru.readyHint, hoppla: sfxDe.hoppla },
    );
    this.panel.onAnswer = (r) => {
      const ctrl = this.ctrl;
      if (!ctrl) return false;
      return ctrl.answer(r.correct, r.timeMs);
    };
    this.panel.setHeader(iconWait, ru.answer.intro);

    this.gear = new GearWidget(this.worldPanel, {
      onHome: () => this.ctrl?.setIntent('home'),
      onStay: () => this.ctrl?.setIntent('stay'),
    });
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.type = 'button';
    this.pauseBtn.className = 'round-btn mine__pause';
    this.pauseBtn.setAttribute('aria-label', ru.gear.pause);
    this.pauseBtn.innerHTML = iconPause;
    this.pauseBtn.addEventListener('click', () => this.togglePause());
    this.worldPanel.appendChild(this.pauseBtn);

    this.plates = new WorldPlates(this.overlay, (cell) => {
      const p = this.scene?.cellToCss(cell) ?? { x: 0, y: 0 };
      return { ...p, cell: this.scene?.cellCssSize() ?? 40 };
    });

    window.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    this.relayout();
    this.ro = new ResizeObserver(() => this.relayout());
    this.ro.observe(container);
    this.ro.observe(this.canvasHost);
  }

  // ───────────── запуск ─────────────

  async boot(): Promise<void> {
    // Шрифты нужны до генерации арта: иначе текст на канве нарисуется запасным шрифтом (7.3.5).
    try {
      await Promise.all([
        document.fonts.load('900 48px Rubik'),
        document.fonts.load('700 24px Rubik'),
        document.fonts.load('48px Bangers'),
      ]);
    } catch {
      // без шрифтов играем с запасными
    }
    if (this.destroyed) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, balance.art.maxDpr);
    const quality = this.store.settings.quality;
    this.texCellPx = quality === 'low' ? balance.art.cellPxLow : balance.art.cellPx;
    const recipes = this.options.recipes ?? placeholderRecipes;
    await new Promise<void>((resolve) => {
      const bootConfig: BootConfig = {
        cellPx: this.texCellPx,
        recipes,
        onProgress: () => undefined,
        onDone: (report) => {
          this.artReport = report;
          resolve();
        },
      };
      const { w, h } = this.canvasSize();
      this.game = new Phaser.Game({
        type: Phaser.WEBGL,
        parent: this.canvasHost,
        backgroundColor: '#0f1626',
        antialias: true,
        scale: { mode: Phaser.Scale.NONE, width: w, height: h, zoom: 1 / this.dpr },
        render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
        audio: { noAudio: true },
        input: { keyboard: false },
        banner: false,
        callbacks: {
          preBoot: (game) => game.registry.set('bootConfig', bootConfig),
        },
        scene: [BootScene, GameScene],
      });
    });
    if (this.destroyed || !this.game) return;
    this.scene = this.game.scene.getScene('Game') as GameScene;
    await new Promise<void>((resolve) => {
      if (this.scene!.ready) resolve();
      else this.scene!.onReady = () => resolve();
    });
    this.relayout();
    void this.panel.start();
    this.startLevel(this.options.level ?? 1);
  }

  /** Текущий раунд (для отладки и сквозных тестов). */
  get round(): RoundController | null {
    return this.ctrl;
  }

  get gameScene(): GameScene | null {
    return this.scene;
  }

  get worldElement(): HTMLElement {
    return this.worldPanel;
  }

  get genReport(): GenReport | null {
    return this.artReport;
  }

  private canvasSize(): { w: number; h: number } {
    const r = this.canvasHost.getBoundingClientRect();
    return { w: Math.max(2, Math.round(r.width * this.dpr)), h: Math.max(2, Math.round(r.height * this.dpr)) };
  }

  private relayout(): void {
    const r = this.container.getBoundingClientRect();
    const layout = computePageLayout(r.width, r.height, balance.layout);
    const changed = !this.layout || layout.landscape !== this.layout.landscape;
    this.layout = layout;
    applyPageLayout(this.root, layout);
    this.panel?.setLandscape(layout.landscape);
    if (this.game) {
      const { w, h } = this.canvasSize();
      if (w !== this.game.scale.width || h !== this.game.scale.height) {
        this.game.scale.resize(w, h);
        const c = this.game.canvas;
        c.style.width = `${w / this.dpr}px`;
        c.style.height = `${h / this.dpr}px`;
        this.game.scale.refresh();
      }
      this.scene?.fit();
    }
    void changed;
  }

  // ───────────── раунд ─────────────

  startLevel(id: number, seed = Math.floor(Math.random() * 1e9)): void {
    if (!this.scene) return;
    this.levelId = id;
    this.results?.destroy();
    this.results = null;
    this.pauseScreen?.destroy();
    this.pauseScreen = null;
    this.plates.hideAll();
    clearTimeout(this.roundOverTimer);
    this.unsub?.();
    const def = getLevel(id);
    const landscape = this.layout?.landscape ?? false;
    const gen = generateLevel(def, landscape, seed);
    for (const w of gen.warnings) console.warn(w);
    // Темп фиксируется на старте раунда и внутри раунда не меняется (3.4).
    const ctrl = new RoundController(def, gen, this.pace.snapshot());
    this.ctrl = ctrl;
    const words = this.store.settings.sfxLang === 'ru' ? sfxRu : sfxDe;
    this.scene.startRound(ctrl, {
      reduced: this.reducedMotion,
      hints: this.store.settings.hints,
      words,
      latinWords: this.store.settings.sfxLang !== 'ru',
      texCellPx: this.texCellPx,
      onPlate: (kind, cell, visible) => this.plates.show(kind, cell, visible),
      onPickupFly: (kind, from) => this.flyToGear(kind, from),
    });
    this.unsub = ctrl.subscribe((events, state) => this.onRoundEvents(events, state));
    this.syncUi(ctrl.state);
    this.panel.setMode('active');
    this.scene.setRunning(true);
  }

  private onRoundEvents(events: GameEvent[], s: GameState): void {
    for (const e of events) {
      if (e.type === 'ANSWERED') this.pace.record(e.timeMs, e.correct, !e.fuseBurning);
      if (e.type === 'CAUGHT' || e.type === 'HERO_BLASTED' || e.type === 'ESCAPED') this.onRoundOver(s);
      if (e.type === 'PAUSED') this.panel.setPaused(true);
      if (e.type === 'RESUMED') this.panel.setPaused(false);
    }
    this.syncUi(s);
  }

  private syncUi(s: GameState): void {
    const ctrl = this.ctrl;
    if (!ctrl) return;
    this.gear.update(s.hero.sticks, s.hero.hasVein, s.loot, s.hero.intent.kind === 'stay');
    if (s.status !== 'playing') {
      this.panel.setMode('over');
      this.panel.setHeader(iconWait, ru.answer.over);
      return;
    }
    switch (ctrl.answerKind()) {
      case 'ready':
        this.panel.setMode('ready');
        this.panel.setHeader(iconReady, ru.answer.ready, 'ready');
        break;
      case 'plant':
        this.panel.setMode('active');
        this.panel.setHeader(iconDynamite, ru.answer.plant);
        break;
      case 'shelter':
        this.panel.setMode('active');
        this.panel.setHeader(iconShield, ru.answer.shelter);
        break;
      case 'stay':
        this.panel.setMode('active');
        this.panel.setHeader(iconPalm, ru.answer.stay);
        break;
      default:
        this.panel.setMode('active');
        this.panel.setHeader(iconBoot, ru.answer.step);
    }
  }

  private onRoundOver(s: GameState): void {
    const ctrl = this.ctrl;
    if (!ctrl) return;
    this.plates.hideAll();
    const won = s.status === 'won';
    const record = this.store.recordResult(this.levelId, s.stars, s.finalScore);
    this.options.onFinish?.({
      level: this.levelId,
      won,
      score: s.finalScore,
      stars: s.stars,
      cause: s.cause ?? undefined,
    });
    // Снимок кадра для первой панели итогов — чуть позже, чтобы попала поза героя.
    const delay = Math.min(balance.anim.finalAnimMaxMs, won ? 900 : 650);
    this.roundOverTimer = window.setTimeout(() => {
      this.takeSnapshot((img) => this.showResults(s, record, img));
    }, delay);
  }

  private takeSnapshot(cb: (img: HTMLImageElement | null) => void): void {
    const r = this.game?.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined;
    if (!r || typeof r.snapshot !== 'function') {
      cb(null);
      return;
    }
    let done = false;
    const t = window.setTimeout(() => {
      if (!done) cb(null);
      done = true;
    }, 600);
    r.snapshot((img) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      cb(img instanceof HTMLImageElement ? img : null);
    });
  }

  private showResults(s: GameState, record: boolean, snapshot: HTMLImageElement | null): void {
    if (this.destroyed) return;
    this.results?.destroy();
    const won = s.status === 'won';
    this.results = new ResultsScreen(
      this.screens,
      {
        level: this.levelId,
        won,
        cause: s.cause,
        vein: s.hero.hasVein,
        nuggets: s.hero.nuggets,
        sticks: s.hero.sticks,
        score: s.finalScore,
        stars: s.stars,
        blasts: s.stats.blasts,
        stuns: s.stats.stuns,
        correct: s.stats.correct,
        wrong: s.stats.wrong,
        answerTimesMs: s.stats.answerTimesMs,
        best: this.store.progress.best[this.levelId] ?? s.finalScore,
        record,
        hasNext: this.levelId < levels[levels.length - 1].id,
        snapshot,
      },
      {
        onRetry: () => this.startLevel(this.levelId),
        onNext: () => this.startLevel(Math.min(this.levelId + 1, levels[levels.length - 1].id)),
        onMenu: () => this.startLevel(this.levelId),
      },
    );
  }

  /** Подобранный предмет летит по дуге в плашку снаряжения (11.3). */
  private flyToGear(kind: 'stick' | 'vein' | 'nugget', from: { x: number; y: number }): void {
    const to = this.gear.slotCenter(kind, this.worldPanel);
    const el = document.createElement('div');
    el.className = `fly fly--${kind}`;
    this.worldPanel.appendChild(el);
    const midX = (from.x + to.x) / 2;
    const midY = Math.min(from.y, to.y) - 60;
    const anim = el.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) scale(1)` },
        { transform: `translate(${midX}px, ${midY}px) scale(1.25)`, offset: 0.5 },
        { transform: `translate(${to.x}px, ${to.y}px) scale(0.6)` },
      ],
      { duration: this.reducedMotion ? 1 : balance.anim.pickupFlyMs, easing: 'ease-in' },
    );
    anim.onfinish = () => el.remove();
  }

  // ───────────── пауза ─────────────

  togglePause(): void {
    const s = this.ctrl?.state;
    if (!s || s.status !== 'playing') return;
    if (s.paused) this.resume();
    else this.pause();
  }

  pause(): void {
    const ctrl = this.ctrl;
    if (!ctrl || ctrl.state.status !== 'playing' || ctrl.state.paused) return;
    ctrl.pause();
    this.pauseScreen?.destroy();
    this.pauseScreen = new PauseScreen(this.screens, {
      onResume: () => this.resume(),
      onRestart: () => this.startLevel(this.levelId),
      onMenu: () => this.startLevel(this.levelId),
      onSettings: () => undefined,
    });
    this.root.classList.add('mine--paused');
  }

  resume(): void {
    const ctrl = this.ctrl;
    this.pauseScreen?.destroy();
    this.pauseScreen = null;
    this.root.classList.remove('mine--paused');
    if (ctrl && ctrl.state.paused) ctrl.resume();
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.pause();
  };

  private onBlur = () => this.pause();

  // ───────────── клавиатура (11.4) ─────────────

  private onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const ctrl = this.ctrl;
    const target = e.target as HTMLElement | null;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
    if (typing) return;
    if (e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З' || e.key === 'Escape') {
      e.preventDefault();
      this.togglePause();
      return;
    }
    if (!ctrl || ctrl.state.status !== 'playing' || ctrl.state.paused) return;
    const s = ctrl.state;
    const dirs: Record<string, number> = { ArrowUp: 0, ArrowLeft: 1, ArrowDown: 2, ArrowRight: 3 };
    if (e.key in dirs) {
      e.preventDefault();
      const d = DIRS[dirs[e.key]];
      const g = s.grid;
      const x = cx(g, s.hero.cell) + d[0];
      const y = cy(g, s.hero.cell) + d[1];
      if (!inBounds(g, x, y)) return;
      const cell = idx(g, x, y);
      if (g.cells[cell] === Cell.LIFT) ctrl.setIntent('home');
      else ctrl.tap(cell);
      return;
    }
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      ctrl.setIntent('stay');
      return;
    }
    if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
      e.preventDefault();
      ctrl.setIntent('home');
    }
  };

  destroy(): void {
    this.destroyed = true;
    clearTimeout(this.roundOverTimer);
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    this.ro?.disconnect();
    this.unsub?.();
    this.panel.destroy();
    this.results?.destroy();
    this.pauseScreen?.destroy();
    this.game?.destroy(true);
    this.root.remove();
  }
}
