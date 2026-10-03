// Панель вопроса (план, 11.2) — общий DOM-модуль серии. Не знает правил конкретной игры:
// шапку (значок и подпись) задаёт игра, панель лишь показывает вопрос и сообщает об ответе.

import type { AnswerReport, Question, QuestionProvider } from './questions/types';

export interface QuestionPanelTimings {
  wrongFeedbackMs: number;
  answerFlashMs: number;
  flipMs: number;
  doubleTapGuardMs: number;
  fontMaxPx: number;
  fontMinPx: number;
}

export interface QuestionPanelText {
  groupLabel: string;
  optionLabel: (n: number, text: string) => string;
  readyHint: string;
  hoppla: string;
}

export interface AnswerResult {
  question: Question;
  correct: boolean;
  timeMs: number;
}

export type PanelMode = 'intro' | 'active' | 'ready' | 'over';

/** Вариант длиннее этого числа знаков — целое предложение, варианты встают столбиком. */
const LONG_OPTION_CHARS = 22;

export class QuestionPanel {
  readonly el: HTMLElement;
  private readonly head: HTMLElement;
  private readonly headIcon: HTMLElement;
  private readonly headText: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly readyEl: HTMLElement;
  private readonly hopplaEl: HTMLElement;
  private card: HTMLElement | null = null;
  private buttons: HTMLButtonElement[] = [];

  private current: Question | null = null;
  private upcoming: Promise<Question> | null = null;
  private mode: PanelMode = 'intro';
  private paused = false;
  private feedback = false;
  private shownAt = 0;
  private activeMs = 0;
  private activeSince = -1;
  private destroyed = false;
  private timers: number[] = [];
  private landscape = false;

  /** Вызывается при каждом ответе; возвращает, засчитан ли ответ игрой (false — игра его не приняла). */
  onAnswer: (r: AnswerResult) => boolean = () => true;

  constructor(
    host: HTMLElement,
    private readonly provider: QuestionProvider,
    private readonly timings: QuestionPanelTimings,
    private readonly text: QuestionPanelText,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'quiz';
    this.el.setAttribute('role', 'group');
    const headId = `quiz-head-${Math.random().toString(36).slice(2, 8)}`;
    this.el.setAttribute('aria-labelledby', headId);
    this.el.innerHTML = `
      <div class="quiz__head" id="${headId}" aria-live="polite">
        <span class="quiz__icon" aria-hidden="true"></span>
        <span class="quiz__caption"></span>
      </div>
      <div class="quiz__stage"></div>
      <div class="quiz__ready" aria-live="polite"></div>
      <div class="quiz__hoppla sfx" aria-hidden="true"></div>`;
    host.appendChild(this.el);
    this.head = this.el.querySelector('.quiz__head')!;
    this.headIcon = this.el.querySelector('.quiz__icon')!;
    this.headText = this.el.querySelector('.quiz__caption')!;
    this.stage = this.el.querySelector('.quiz__stage')!;
    this.readyEl = this.el.querySelector('.quiz__ready')!;
    this.hopplaEl = this.el.querySelector('.quiz__hoppla')!;
    this.readyEl.textContent = text.readyHint;
    this.hopplaEl.textContent = text.hoppla;
    this.el.dataset.mode = this.mode;
    window.addEventListener('keydown', this.onKey);
  }

  /** Шапка: что сделает верный ответ. */
  setHeader(iconSvg: string, caption: string, tone: 'normal' | 'ready' | 'danger' = 'normal'): void {
    if (this.headText.textContent !== caption) {
      this.headText.textContent = caption;
      this.head.classList.remove('quiz__head--pop');
      void this.head.offsetWidth;
      this.head.classList.add('quiz__head--pop');
    }
    if (this.headIcon.dataset.svg !== iconSvg) {
      this.headIcon.innerHTML = iconSvg;
      this.headIcon.dataset.svg = iconSvg;
    }
    this.head.dataset.tone = tone;
  }

  setLandscape(landscape: boolean): void {
    this.landscape = landscape;
    this.el.dataset.orient = landscape ? 'landscape' : 'portrait';
    this.fitPrompt();
  }

  /** Загрузить первый вопрос и заранее следующий (12.4). */
  async start(): Promise<void> {
    this.upcoming = this.provider.next();
    await this.showNext(false);
  }

  /**
   * Сбросить показанный и заранее взятый вопросы и взять новые — когда пришли сгенерированные
   * вопросы по выбранной теме, а на экране ещё запасной. Неотвеченные вопросы возвращаются поставщику.
   */
  async reload(): Promise<void> {
    if (this.destroyed || this.feedback) return;
    const current = this.current;
    const upcoming = this.upcoming;
    this.upcoming = null;
    if (current) this.provider.release?.(current);
    if (upcoming) {
      const q = await upcoming;
      this.provider.release?.(q);
    }
    if (this.destroyed) return;
    this.upcoming = this.provider.next();
    await this.showNext(false);
  }

  setMode(mode: PanelMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.el.dataset.mode = mode;
    this.updateClock();
    this.updateButtons();
  }

  getMode(): PanelMode {
    return this.mode;
  }

  /** На паузе вопрос размыт (2.7.2). */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.el.classList.toggle('quiz--paused', paused);
    this.updateClock();
    this.updateButtons();
  }

  private answerable(): boolean {
    return this.mode === 'active' && !this.paused && !this.feedback && !!this.current;
  }

  /** Время ответа считается только пока вопрос активен (12.5). */
  private updateClock(): void {
    const now = performance.now();
    if (this.answerable()) {
      if (this.activeSince < 0) this.activeSince = now;
    } else if (this.activeSince >= 0) {
      this.activeMs += now - this.activeSince;
      this.activeSince = -1;
    }
  }

  private elapsed(): number {
    return this.activeMs + (this.activeSince >= 0 ? performance.now() - this.activeSince : 0);
  }

  private updateButtons(): void {
    const enabled = this.answerable();
    for (const b of this.buttons) {
      b.disabled = !enabled && !b.classList.contains('is-right') && !b.classList.contains('is-wrong');
      b.setAttribute('aria-disabled', String(!enabled));
    }
  }

  private async showNext(animate: boolean): Promise<void> {
    if (this.destroyed) return;
    const q = await (this.upcoming ?? this.provider.next());
    if (this.destroyed) return;
    this.current = q;
    this.upcoming = this.provider.next();
    const card = this.buildCard(q);
    const old = this.card;
    this.card = card;
    if (old && animate) {
      old.classList.add('quiz__card--out');
      card.classList.add('quiz__card--in');
      this.stage.appendChild(card);
      this.later(() => old.remove(), this.timings.flipMs);
      this.later(() => card.classList.remove('quiz__card--in'), this.timings.flipMs);
    } else {
      old?.remove();
      this.stage.appendChild(card);
    }
    // Тестовый крючок: сквозной тест знает верный вариант (только при флаге __MINE_TEST__).
    if ((window as unknown as { __MINE_TEST__?: boolean }).__MINE_TEST__)
      this.el.dataset.testCorrect = String(q.correctIndex);
    this.feedback = false;
    this.activeMs = 0;
    this.activeSince = -1;
    this.shownAt = performance.now();
    this.updateClock();
    this.updateButtons();
    this.fitPrompt();
  }

  private buildCard(q: Question): HTMLElement {
    const card = document.createElement('div');
    card.className = 'quiz__card';
    const task = document.createElement('div');
    task.className = 'quiz__task';
    if (q.instruction) {
      const instruction = document.createElement('p');
      instruction.className = 'quiz__instruction';
      instruction.textContent = q.instruction;
      task.appendChild(instruction);
    }
    const prompt = document.createElement('p');
    prompt.className = 'quiz__prompt';
    prompt.lang = q.promptLang;
    prompt.textContent = q.prompt;
    task.appendChild(prompt);
    const opts = document.createElement('div');
    opts.className = 'quiz__options';
    opts.dataset.n = String(q.options.length);
    // Целые предложения (порядок слов) в сетку 2 × 2 не помещаются — тогда варианты идут столбиком.
    if (q.options.some((o) => o.length > LONG_OPTION_CHARS)) opts.dataset.long = '';
    this.buttons = q.options.map((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quiz__opt';
      b.dataset.i = String(i);
      b.setAttribute('aria-label', this.text.optionLabel(i + 1, text));
      const kbd = document.createElement('kbd');
      kbd.textContent = String(i + 1);
      kbd.setAttribute('aria-hidden', 'true');
      const span = document.createElement('span');
      span.className = 'quiz__opt-text';
      span.lang = q.optionsLang;
      span.textContent = text;
      b.append(kbd, span);
      b.addEventListener('click', () => this.choose(i));
      opts.appendChild(b);
      return b;
    });
    card.append(task, opts);
    return card;
  }

  /** Если текст не помещается, шрифт ужимается с 24 до 16 px (11.2.2). */
  fitPrompt(): void {
    const card = this.card;
    if (!card) return;
    const task = card.querySelector<HTMLElement>('.quiz__task');
    const prompt = card.querySelector<HTMLElement>('.quiz__prompt');
    if (!task || !prompt) return;
    const { fontMaxPx, fontMinPx } = this.timings;
    const instruction = card.querySelector<HTMLElement>('.quiz__instruction');
    const cs = getComputedStyle(task);
    const room =
      task.clientHeight -
      parseFloat(cs.paddingTop || '0') -
      parseFloat(cs.paddingBottom || '0') -
      (instruction ? instruction.offsetHeight + parseFloat(cs.rowGap || '0') : 0);
    let size = fontMaxPx;
    prompt.style.fontSize = `${size}px`;
    while (
      size > fontMinPx &&
      (prompt.scrollWidth > task.clientWidth + 1 || prompt.scrollHeight > room + 1)
    ) {
      size -= 1;
      prompt.style.fontSize = `${size}px`;
    }
    for (const b of this.buttons) {
      const span = b.querySelector<HTMLElement>('.quiz__opt-text');
      if (!span) continue;
      let s = this.landscape ? 20 : 19;
      span.style.fontSize = `${s}px`;
      while (s > 13 && span.scrollWidth > b.clientWidth - 30) {
        s -= 1;
        span.style.fontSize = `${s}px`;
      }
    }
  }

  private choose(i: number): void {
    if (!this.answerable() || !this.current) return;
    // Защита от двойного тапа (2.7.4).
    if (performance.now() - this.shownAt < this.timings.doubleTapGuardMs) return;
    const q = this.current;
    const timeMs = Math.round(this.elapsed());
    const correct = i === q.correctIndex;
    const accepted = this.onAnswer({ question: q, correct, timeMs });
    if (!accepted) return;
    const report: AnswerReport = { id: q.id, correct, timeMs };
    this.provider.report(report);
    this.feedback = true;
    this.updateClock();
    const btn = this.buttons[i];
    if (correct) {
      btn.classList.add('is-right', 'is-flash');
      this.updateButtons();
      this.later(() => void this.showNext(true), this.timings.answerFlashMs);
    } else {
      btn.classList.add('is-wrong');
      this.buttons[q.correctIndex]?.classList.add('is-right');
      this.hopplaEl.classList.remove('is-on');
      void this.hopplaEl.offsetWidth;
      this.hopplaEl.classList.add('is-on');
      this.updateButtons();
      this.later(() => {
        this.hopplaEl.classList.remove('is-on');
        void this.showNext(true);
      }, this.timings.wrongFeedbackMs);
    }
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= this.buttons.length) {
      if (!this.answerable()) return;
      e.preventDefault();
      const b = this.buttons[n - 1];
      b.classList.add('is-pressed');
      this.later(() => b.classList.remove('is-pressed'), 120);
      this.choose(n - 1);
    }
  };

  private later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      if (!this.destroyed) fn();
    }, ms);
    this.timers.push(id);
  }

  destroy(): void {
    this.destroyed = true;
    for (const t of this.timers) clearTimeout(t);
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }
}
