// Приложение «Шахта»: страница-комикс, игра Phaser, панель вопроса, экраны и поток раундов.

import Phaser from 'phaser';
import { ArtFactory, type GenReport, type Recipe } from '../art/ArtFactory';
import { manifest } from '../art/manifest';
import { recipes as fullRecipes } from '../art/recipes';
import { setupKit } from '../art/setupKit';
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
import { comicLightRenderNodes, filtersSupported } from '../shared/ComicLightFilter';
import { PaceTracker } from '../shared/pace';
import { QuestionPanel } from '../shared/QuestionPanel';
import { GRAMMAR_TOPICS, LANGUAGE_LEVELS, QuizBankProvider } from '../shared/questions/QuizBankProvider';
import type { QuestionProvider } from '../shared/questions/types';
import { GearWidget } from '../ui/GearWidget';
import { iconBoot, iconDynamite, iconPalm, iconPause, iconReady, iconShield, iconWait } from '../ui/icons';
import { WorldPlates } from '../ui/plates';
import { DebugPanel } from '../dev/DebugPanel';
import { IntroOverlay } from '../ui/IntroOverlay';
import { LevelSelectScreen } from '../ui/screens/LevelSelectScreen';
import { LoadingScreen } from '../ui/screens/LoadingScreen';
import { MenuScreen } from '../ui/screens/MenuScreen';
import { PauseScreen } from '../ui/screens/PauseScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { TutorialBubble } from '../ui/TutorialBubble';
import { ResultsScreen } from '../ui/screens/ResultsScreen';
import { applyTheme } from '../ui/theme';
import { MineAudio } from '../audio/MineAudio';
import { RoundController } from './RoundController';
import { defaultStorage, GameStore, type KeyValueStorage, type Settings } from './storage';

export interface FinishInfo {
  level: number;
  won: boolean;
  score: number;
  stars: 0 | 1 | 2 | 3;
  cause?: 'kobold' | 'blast';
}

export interface MineOptions {
  questions: QuestionProvider;
  /** Сид первого уровня (для отладки и повторяемых снимков). */
  seed?: number;
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
  readonly audio: MineAudio;
  private introActive = false;
  private introTimer = 0;
  private introOverlay: IntroOverlay | null = null;
  /** Что сделает верный ответ — запоминается до ответа для значка над героем. */
  private answerKindNow: string = 'step';
  private mode: 'boot' | 'menu' | 'levels' | 'round' = 'boot';
  private loading: LoadingScreen | null = null;
  private menu: MenuScreen | null = null;
  private levelsScreen: LevelSelectScreen | null = null;
  private settingsScreen: SettingsScreen | null = null;
  private tutorial: TutorialBubble | null = null;
  private tutorialQueue: ('start' | 'planted' | 'koboldAwake')[] = [];
  private debugPanel: DebugPanel | null = null;
  private fpsTimer = 0;
  private slowSeconds = 0;
  /** Автоснижение качества срабатывает один раз за сессию (13.6.4). */
  private autoLoweredThisSession = false;
  private readonly bootStarted = performance.now();
  reducedMotion = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: MineOptions,
  ) {
    this.store = new GameStore(options.storage ?? defaultStorage());
    this.audio = new MineAudio();
    this.applySoundSettings();
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
      {
        groupLabel: ru.quizLabel,
        optionLabel: ru.optionLabel,
        readyHint: ru.readyHint,
        hoppla: sfxDe.hoppla,
      },
    );
    this.panel.onAnswer = (r) => {
      const ctrl = this.ctrl;
      if (!ctrl) return false;
      return ctrl.answer(r.correct, r.timeMs);
    };
    this.panel.setHeader(iconWait, ru.answer.intro);
    if (options.questions instanceof QuizBankProvider) {
      options.questions.onStatus = () => this.settingsScreen?.setLearningStatus(this.quizBank!.status);
      // Пока генерация не ответила, показан запасной вопрос; первый пакет по теме его сменяет.
      options.questions.onFirstBatch = () => void this.panel.reload();
    }

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
    // AudioContext — только по жесту игрока (10.7).
    window.addEventListener('pointerdown', this.onGesture, true);
    window.addEventListener('keydown', this.onGesture, true);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    this.relayout();
    this.ro = new ResizeObserver(() => this.relayout());
    this.ro.observe(container);
    this.ro.observe(this.canvasHost);
    this.loading = new LoadingScreen(this.screens);
    this.fpsTimer = window.setInterval(() => this.watchFps(), 1000);
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
    setupKit();
    const recipes = this.options.recipes ?? fullRecipes;
    await new Promise<void>((resolve) => {
      const bootConfig: BootConfig = {
        cellPx: this.texCellPx,
        recipes,
        onProgress: (done, total) => this.loading?.progress(done / Math.max(1, total)),
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
        render: {
          antialias: true,
          roundPixels: false,
          powerPreference: 'high-performance',
          renderNodes: comicLightRenderNodes() as Record<string, never>,
        },
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
    // Экран загрузки с фактом держится хотя бы мгновение, чтобы не мигать.
    const shown = performance.now() - this.bootStarted;
    if (shown < 900) await new Promise((r) => window.setTimeout(r, 900 - shown));
    if (this.destroyed) return;
    this.loading?.hide();
    this.loading = null;
    // Уровень задан снаружи (встраивание, ?level=) — сразу в раунд, иначе — меню.
    if (this.options.level !== undefined) this.startLevel(this.options.level, this.options.seed);
    else this.showMenu();
  }

  // ───────────── меню и выбор уровня (11.5.1–2) ─────────────

  private get hasProgress(): boolean {
    return Object.values(this.store.progress.stars).some((n) => n > 0);
  }

  /** Меню поверх живой заставки: случайная штольня с фонарями и спящим кобольдом. */
  showMenu(): void {
    if (!this.scene) return;
    this.leaveRound();
    this.closeScreens();
    this.mode = 'menu';
    this.setMenuLayout(true);
    this.startAttract();
    this.menu = new MenuScreen(
      this.screens,
      {
        onPlay: () => {
          if (this.hasProgress) this.showLevels();
          else this.startLevel(1);
        },
        onLevels: () => this.showLevels(),
        onSettings: () => this.openSettings(),
      },
      { showLevels: this.hasProgress },
    );
  }

  showLevels(): void {
    if (!this.scene) return;
    this.menu?.destroy();
    this.menu = null;
    this.levelsScreen?.destroy();
    this.mode = 'levels';
    this.setMenuLayout(true);
    const cards = levels.map((def) => ({
      def,
      stars: this.store.progress.stars[def.id] ?? 0,
      best: this.store.progress.best[def.id] ?? null,
      locked: !this.store.isUnlocked(def.id),
    }));
    this.levelsScreen = new LevelSelectScreen(this.screens, cards, {
      onPick: (id) => this.startLevel(id),
      onBack: () => this.showMenu(),
    });
  }

  /** Меню и выбор уровня — на всю страницу, панель вопроса прячется. */
  private setMenuLayout(on: boolean): void {
    this.root.classList.toggle('mine--menu', on);
    this.relayout();
  }

  private startAttract(): void {
    const scene = this.scene;
    if (!scene) return;
    this.ensureTexQuality();
    const def = getLevel(2);
    const gen = generateLevel(def, this.layout?.landscape ?? false, Math.floor(Math.random() * 1e9));
    const ctrl = new RoundController(def, gen, this.pace.snapshot());
    this.ctrl = null;
    scene.startRound(ctrl, this.sceneOptions(), true);
    this.audio.detach();
  }

  private closeScreens(): void {
    this.menu?.destroy();
    this.menu = null;
    this.levelsScreen?.destroy();
    this.levelsScreen = null;
    this.results?.destroy();
    this.results = null;
    this.pauseScreen?.destroy();
    this.pauseScreen = null;
    this.settingsScreen?.destroy();
    this.settingsScreen = null;
    this.root.classList.remove('mine--paused');
  }

  /** Остановить текущий раунд (без итогов). */
  private leaveRound(): void {
    clearTimeout(this.roundOverTimer);
    clearTimeout(this.introTimer);
    this.introActive = false;
    this.introOverlay?.destroy();
    this.introOverlay = null;
    this.tutorial?.destroy();
    this.tutorial = null;
    this.tutorialQueue = [];
    this.plates.hideAll();
    this.unsub?.();
    this.unsub = null;
    this.ctrl = null;
    this.audio.detach();
    this.panel.setPaused(false);
  }

  // ───────────── настройки (11.5.6) ─────────────

  /** Генерируемые вопросы See Escape, если игра запущена с ними (автономная страница). */
  private get quizBank(): QuizBankProvider | null {
    return this.options.questions instanceof QuizBankProvider ? this.options.questions : null;
  }

  openSettings(): void {
    this.settingsScreen?.destroy();
    const bank = this.quizBank;
    this.settingsScreen = new SettingsScreen(
      this.screens,
      this.store.settings,
      {
        onChange: (patch) => this.applySettings(patch),
        onClose: () => {
          this.settingsScreen?.destroy();
          this.settingsScreen = null;
          const focus = this.screens.querySelector<HTMLButtonElement>('.pause__resume, .menu__play');
          focus?.focus({ preventScroll: true });
        },
      },
      bank
        ? {
            settings: bank.settings,
            levels: LANGUAGE_LEVELS,
            grammarTopics: GRAMMAR_TOPICS,
            status: bank.status,
            onChange: (patch) => bank.configure(patch),
          }
        : undefined,
    );
  }

  private applySettings(patch: Partial<Settings>): void {
    Object.assign(this.store.settings, patch);
    this.store.saveSettings();
    const st = this.store.settings;
    if ('soundOn' in patch || 'sfxVolume' in patch || 'ambientVolume' in patch) this.applySoundSettings();
    if ('reducedMotion' in patch) {
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      this.reducedMotion = st.reducedMotion ?? prefersReduced;
      this.root.classList.toggle('mine--reduced', this.reducedMotion);
      this.scene?.setReduced(this.reducedMotion);
    }
    if ('hints' in patch) this.scene?.setHintLevel(st.hints);
    if ('sfxLang' in patch) this.scene?.setWords(st.sfxLang === 'ru' ? sfxRu : sfxDe, st.sfxLang !== 'ru');
    // Свет выключается сразу; чёткость текстур меняется со следующего раунда.
    if (patch.quality === 'low') this.scene?.disableLighting();
  }

  /** Текстуры под выбранное качество: перерисовываются между раундами (13.6.3). */
  private ensureTexQuality(): void {
    const want = this.store.settings.quality === 'low' ? balance.art.cellPxLow : balance.art.cellPx;
    if (want === this.texCellPx || !this.game || !this.scene) return;
    this.scene.clearRound();
    const factory = new ArtFactory(this.game.textures, want, this.options.recipes ?? fullRecipes);
    for (const e of manifest()) factory.generate(e);
    this.texCellPx = want;
  }

  private sceneOptions() {
    const st = this.store.settings;
    return {
      reduced: this.reducedMotion,
      hints: st.hints,
      words: st.sfxLang === 'ru' ? sfxRu : sfxDe,
      latinWords: st.sfxLang !== 'ru',
      texCellPx: this.texCellPx,
      lighting: st.quality === 'high' && !!this.game && filtersSupported(this.game),
      dpr: this.dpr,
      onPlate: (kind: 'noShelter' | 'pathClosed' | 'veinFirst', cell: number, visible: boolean) =>
        this.plates.show(kind, cell, visible),
      onPickupFly: (kind: 'stick' | 'vein' | 'nugget', from: { x: number; y: number }) =>
        this.flyToGear(kind, from),
      onEvent: (e: GameEvent, st2: GameState) => this.audio.onEvent(e, st2),
    };
  }

  // ───────────── обучение (11.5.7) ─────────────

  private maybeTutorial(kind: 'start' | 'planted' | 'koboldAwake'): void {
    if (this.store.progress.tutorial[kind]) return;
    if (this.tutorial) {
      if (!this.tutorialQueue.includes(kind)) this.tutorialQueue.push(kind);
      return;
    }
    // После текущей пачки событий: подсказка ставит игру на паузу.
    window.setTimeout(() => this.showTutorial(kind), 0);
  }

  private showTutorial(kind: 'start' | 'planted' | 'koboldAwake'): void {
    const ctrl = this.ctrl;
    const at = this.scene?.heroCss();
    if (!ctrl || !at || ctrl.state.status !== 'playing' || this.store.progress.tutorial[kind]) return;
    this.store.progress.tutorial[kind] = true;
    this.store.saveProgress();
    if (!ctrl.state.paused) ctrl.pause();
    this.tutorial = new TutorialBubble(this.overlay, ru.tutorial[kind], at, () => {
      this.tutorial?.destroy();
      this.tutorial = null;
      const next = this.tutorialQueue.shift();
      if (next) this.showTutorial(next);
      else if (this.ctrl === ctrl && ctrl.state.paused && !this.pauseScreen) ctrl.resume();
    });
  }

  // ───────────── качество по FPS (13.6.4) ─────────────

  private watchFps(): void {
    const game = this.game;
    const s = this.ctrl?.state;
    const test = (window as unknown as { __MINE_TEST__?: boolean }).__MINE_TEST__;
    if (!game || !s || test || this.autoLoweredThisSession || this.store.settings.quality === 'low') return;
    if (this.introActive || s.paused || s.status !== 'playing' || document.visibilityState !== 'visible') {
      this.slowSeconds = 0;
      return;
    }
    this.slowSeconds = game.loop.actualFps < 45 ? this.slowSeconds + 1 : 0;
    if (this.slowSeconds < 3) return;
    this.autoLoweredThisSession = true;
    this.applySettings({ quality: 'low', autoLowered: true });
    this.toast(ru.settingsScreen.autoLowQuality);
  }

  private toast(text: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    this.worldPanel.appendChild(el);
    window.setTimeout(() => el.remove(), 3200);
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
    return {
      w: Math.max(2, Math.round(r.width * this.dpr)),
      h: Math.max(2, Math.round(r.height * this.dpr)),
    };
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

  startLevel(id: number, seed: number = Math.floor(Math.random() * 1e9)): void {
    if (!this.scene) return;
    this.levelId = id;
    this.leaveRound();
    this.closeScreens();
    this.mode = 'round';
    this.setMenuLayout(false);
    this.ensureTexQuality();
    const def = getLevel(id);
    const landscape = this.layout?.landscape ?? false;
    const gen = generateLevel(def, landscape, seed);
    for (const w of gen.warnings) console.warn(w);
    // Темп фиксируется на старте раунда и внутри раунда не меняется (3.4).
    const ctrl = new RoundController(def, gen, this.pace.snapshot());
    this.ctrl = ctrl;
    this.scene.startRound(ctrl, this.sceneOptions());
    this.audio.attach(ctrl, this.scene);
    this.unsub = ctrl.subscribe((events, state) => this.onRoundEvents(events, state));
    this.syncUi(ctrl.state);
    this.beginIntro();
  }

  // ───────────── интро раунда (11.5.3) ─────────────

  private beginIntro(): void {
    const scene = this.scene;
    const ctrl = this.ctrl;
    if (!scene || !ctrl) return;
    this.introActive = true;
    this.panel.setMode('intro');
    this.panel.setHeader(iconWait, ru.answer.intro);
    scene.playIntro(950);
    const s = ctrl.state;
    const cellPx = scene.cellCssSize();
    const targets: { x: number; y: number; label: string }[] = [
      { ...scene.cellToCss(s.vein), label: ru.intro.vein },
    ];
    const k = s.kobolds[0];
    if (k) targets.push({ ...scene.cellToCss(k.cell), label: ru.intro.lair });
    this.introOverlay?.destroy();
    this.introOverlay = new IntroOverlay(this.overlay, targets, cellPx, [
      scene.cellToCss(s.lift),
      scene.cellToCss(s.hero.cell),
    ]);
    clearTimeout(this.introTimer);
    this.introTimer = window.setTimeout(() => this.endIntro(), balance.anim.introMaxMs - 200);
  }

  /** Конец интро (по таймеру или тапу): «GLÜCK AUF!» и раунд пошёл. */
  private endIntro(): void {
    if (!this.introActive) return;
    this.introActive = false;
    clearTimeout(this.introTimer);
    this.introOverlay?.destroy();
    this.introOverlay = null;
    this.scene?.finishIntro();
    if (this.ctrl) this.syncUi(this.ctrl.state);
    this.scene?.setRunning(true);
    this.maybeTutorial('start');
  }

  /** Над героем мелькает значок действия верного ответа (9.2). */
  private flashAction(kind: string): void {
    const p = this.scene?.heroCss();
    if (!p) return;
    const icon =
      kind === 'plant'
        ? iconDynamite
        : kind === 'shelter'
          ? iconShield
          : kind === 'stay'
            ? iconPalm
            : iconBoot;
    const el = document.createElement('div');
    el.className = 'act-pop';
    el.innerHTML = icon;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    this.overlay.appendChild(el);
    window.setTimeout(() => el.remove(), 520);
  }

  private onRoundEvents(events: GameEvent[], s: GameState): void {
    for (const e of events) {
      if (e.type === 'ANSWERED') {
        this.pace.record(e.timeMs, e.correct, !e.fuseBurning);
        if (e.correct) this.flashAction(this.answerKindNow);
      }
      if (e.type === 'CAUGHT' || e.type === 'HERO_BLASTED' || e.type === 'ESCAPED') this.onRoundOver(s);
      if (e.type === 'PLANTED') this.maybeTutorial('planted');
      if (e.type === 'KOBOLD_WAKE') this.maybeTutorial('koboldAwake');
      if (e.type === 'PAUSED') {
        this.panel.setPaused(true);
        // Подсказка обучения ставит игру, но не глушит штольню.
        if (!this.tutorial) this.audio.setPaused(true);
      }
      if (e.type === 'RESUMED') {
        this.panel.setPaused(false);
        this.audio.setPaused(false);
      }
    }
    this.syncUi(s);
  }

  private syncUi(s: GameState): void {
    const ctrl = this.ctrl;
    if (!ctrl) return;
    this.gear.update(s.hero.sticks, s.hero.hasVein, s.loot, s.hero.intent.kind === 'stay');
    this.answerKindNow = ctrl.answerKind();
    if (this.introActive) return;
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
        onMenu: () => this.showMenu(),
        onTally: (i) => this.audio.tally(i),
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
      onMenu: () => this.showMenu(),
      onSettings: () => this.openSettings(),
    });
    this.root.classList.add('mine--paused');
  }

  resume(): void {
    const ctrl = this.ctrl;
    this.pauseScreen?.destroy();
    this.pauseScreen = null;
    this.settingsScreen?.destroy();
    this.settingsScreen = null;
    this.root.classList.remove('mine--paused');
    if (ctrl && ctrl.state.paused && !this.tutorial) ctrl.resume();
  }

  private onGesture = (e: Event) => {
    this.audio.unlock();
    // Тап или клавиша пропускают интро (кроме паузы и служебных клавиш).
    if (this.introActive && !this.ctrl?.state.paused) {
      if (e instanceof KeyboardEvent && (e.altKey || e.ctrlKey || e.metaKey || e.key === 'Escape')) return;
      if (e.target instanceof Element && e.target.closest('.mine__pause')) return;
      // Жест пропуска интро не становится ходом или ответом.
      e.stopPropagation();
      if (e.type === 'keydown') e.preventDefault();
      this.scene?.blockInput(300);
      this.endIntro();
    }
  };

  /** Громкости и выключатель звука из настроек (10.8). */
  applySoundSettings(): void {
    const st = this.store.settings;
    this.audio.setVolumes(st.sfxVolume, st.ambientVolume, st.soundOn);
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      this.pause();
      this.audio.setPaused(true);
    } else if (!this.ctrl?.state.paused) this.audio.setPaused(false);
  };

  private onBlur = () => this.pause();

  // ───────────── клавиатура (11.4) ─────────────

  private onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (import.meta.env.DEV && (e.key === '`' || e.key === 'ё' || e.code === 'Backquote')) {
      e.preventDefault();
      if (this.debugPanel) {
        this.debugPanel.destroy();
        this.debugPanel = null;
      } else this.debugPanel = new DebugPanel(this.root, this);
      return;
    }
    if (this.mode !== 'round' || this.settingsScreen || this.tutorial) return;
    const ctrl = this.ctrl;
    const target = e.target as HTMLElement | null;
    const typing =
      target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
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
    clearTimeout(this.introTimer);
    clearInterval(this.fpsTimer);
    this.debugPanel?.destroy();
    this.tutorial?.destroy();
    this.closeScreens();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointerdown', this.onGesture, true);
    window.removeEventListener('keydown', this.onGesture, true);
    this.audio.destroy();
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
