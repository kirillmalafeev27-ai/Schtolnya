// Генерируемые вопросы из See Escape (public/js/learning.js, класс QuestionBank, режим grammar):
// те же уровни и темы, тот же запрос к /api/generate-questions (quiz-generation.cjs) и тот же
// пул с исключением уже показанных заданий. Если генерация не настроена или не ответила,
// вопросы берутся из запасного поставщика — локального банка игры.

import type { AnswerReport, Question, QuestionProvider } from './types';

export const LANGUAGE_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export const LEXICAL_TOPICS = [
  'Familie',
  'Freundschaft',
  'Wohnen',
  'Hausarbeit',
  'Schule',
  'Universität',
  'Arbeit',
  'Bewerbung',
  'Reisen',
  'Hotel',
  'Stadt',
  'Landleben',
  'Essen und Trinken',
  'Restaurant',
  'Einkaufen',
  'Kleidung',
  'Gesundheit',
  'Körper',
  'Sport',
  'Freizeit',
  'Musik',
  'Filme und Serien',
  'Natur',
  'Umwelt',
  'Verkehr',
  'Technik',
  'Internet',
  'Bücher',
  'Wetter',
  'Feiertage',
  'Notfälle',
  'Berge',
  'Camping',
  'Tiere',
  'Kunst',
  'Medien',
  'Politik',
  'Alltag',
  'Zeitmanagement',
  'Büroarbeit',
  'Kundenservice',
  'Studium im Ausland',
  'Migration',
  'Wohnungssuche',
  'Finanzen',
  'Termine',
  'Kommunikation',
  'Gefühle',
  'Urlaub am Meer',
  'Winterurlaub',
] as const;
export const GRAMMAR_TOPICS = [
  'Präsens',
  'Perfekt',
  'Präteritum',
  'Futur I',
  'Imperativ',
  'Modalverben',
  'Trennbare Verben',
  'Untrennbare Verben',
  'Reflexive Verben',
  'Verben mit Präpositionen',
  'Lassen',
  'Werden',
  'Sein vs. haben',
  'Nominativ',
  'Akkusativ',
  'Dativ',
  'Genitiv',
  'Artikel',
  'Possessivartikel',
  'Pronomen',
  'Personalpronomen',
  'Relativpronomen',
  'Fragewörter',
  'Negation',
  'Adjektivdeklination',
  'Komparativ',
  'Superlativ',
  'Zahlen und Datum',
  'Temporale Präpositionen',
  'Lokale Präpositionen',
  'Wechselpräpositionen',
  'Präpositionen mit Dativ',
  'Präpositionen mit Akkusativ',
  'Satzklammer',
  'Wortstellung im Hauptsatz',
  'Wortstellung im Nebensatz',
  'weil-Sätze',
  'dass-Sätze',
  'wenn-Sätze',
  'obwohl-Sätze',
  'damit-Sätze',
  'Relativsätze',
  'Indirekte Fragen',
  'Infinitiv mit zu',
  'Konjunktiv II',
  'Passiv',
  'Plusquamperfekt',
  'Doppelkonjunktionen',
  'als vs. wenn',
  'Partizip I und II',
  'Genitivpräpositionen',
] as const;

export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export interface QuizSettings {
  level: LanguageLevel;
  lexicalTopic: string;
  grammarTopic: string;
}

export type QuizStatus = 'checking' | 'online' | 'loading' | 'fallback';

/** Вопрос в виде, в котором его отдаёт quiz-generation.cjs. */
interface RawQuestion {
  text: string;
  display: string;
  options: string[];
  correct: number;
}

const STORAGE_KEY = 'schtolnya.learning.v1';
const DEFAULT_GRAMMAR_TOPIC = 'Präsens';
const DEFAULT_SETTINGS: QuizSettings = {
  level: 'A2',
  lexicalTopic: 'Alltag',
  grammarTopic: DEFAULT_GRAMMAR_TOPIC,
};
/** Сколько вопросов просить за раз и когда дозаказывать. */
const REQUEST_COUNT = 10;
const LOW_WATER = 3;
/** Сколько последних заданий уходит в exclude (как в See Escape). */
const EXCLUDE_LAST = 12;
/** После неудачного запроса генерация не дёргается чаще, чем раз в столько миллисекунд. */
const RETRY_AFTER_MS = 15_000;
const CONFIGURE_SETTLE_MS = 700;

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function validRawQuestion(q: unknown): q is RawQuestion {
  const r = q as RawQuestion | null;
  return Boolean(
    r &&
    typeof r.text === 'string' &&
    typeof r.display === 'string' &&
    Array.isArray(r.options) &&
    r.options.length === 4 &&
    r.options.every((o) => typeof o === 'string' && o.trim()) &&
    Number.isInteger(r.correct) &&
    r.correct >= 0 &&
    r.correct <= 3,
  );
}

function isWortstellungTopic(topic: string): boolean {
  return /Wortstellung/i.test(topic || '');
}

function loadSettings(): QuizSettings {
  const settings = { ...DEFAULT_SETTINGS };
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Partial<QuizSettings>;
    if ((LANGUAGE_LEVELS as readonly string[]).includes(saved.level ?? '')) settings.level = saved.level!;
    if ((LEXICAL_TOPICS as readonly string[]).includes(saved.lexicalTopic ?? ''))
      settings.lexicalTopic = saved.lexicalTopic!;
    if ((GRAMMAR_TOPICS as readonly string[]).includes(saved.grammarTopic ?? ''))
      settings.grammarTopic = saved.grammarTopic!;
  } catch {
    // Испорченное хранилище не должно мешать игре.
  }
  return settings;
}

function saveSettings(settings: QuizSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Приватный режим или квота — живём без сохранения.
  }
}

export interface QuizBankOptions {
  /** false — только запасной банк (сквозные тесты, автономная страница без сервера). */
  generation: boolean;
  /** Неверно отвеченный вопрос возвращается через retryMin…retryMax вопросов (план, 12.3). */
  retryMin: number;
  retryMax: number;
}

export class QuizBankProvider implements QuestionProvider {
  settings: QuizSettings = loadSettings();
  status: QuizStatus;
  lastError = '';
  /** Вызывается, когда меняется состояние генерации (для экрана настроек). */
  onStatus: () => void = () => {};
  /** Пришёл первый пакет по текущей теме: показанный запасной вопрос можно заменить. */
  onFirstBatch: () => void = () => {};

  private generationConfigured = false;
  private pool: RawQuestion[] = [];
  private fetching: Promise<void> | null = null;
  private failedAt = -Infinity;
  private usedDisplays: string[] = [];
  private readonly issued = new Map<string, RawQuestion>();
  private serial = 0;
  private epoch = 0;
  /** Уровень и тему часто меняют подряд: запрос уходит, когда выбор устоялся, а не на каждый щелчок. */
  private configureTimer = 0;
  private awaitingFirstBatch = true;

  constructor(
    private readonly fallback: QuestionProvider,
    private readonly opts: QuizBankOptions,
  ) {
    this.status = opts.generation ? 'checking' : 'fallback';
    if (opts.generation) void this.checkStatus();
  }

  /** Сменить уровень или тему: пул сгенерированных вопросов сбрасывается. */
  configure(patch: Partial<QuizSettings>): void {
    const next = { ...this.settings, ...patch };
    const changed =
      next.level !== this.settings.level ||
      next.lexicalTopic !== this.settings.lexicalTopic ||
      next.grammarTopic !== this.settings.grammarTopic;
    this.settings = next;
    saveSettings(next);
    if (!changed) return;
    this.epoch++;
    this.pool = [];
    this.usedDisplays = [];
    this.issued.clear();
    this.fetching = null;
    this.failedAt = -Infinity;
    this.awaitingFirstBatch = true;
    clearTimeout(this.configureTimer);
    this.configureTimer = window.setTimeout(() => {
      this.configureTimer = 0;
      void this.ensurePool();
    }, CONFIGURE_SETTLE_MS);
  }

  /** Есть ли сгенерированные вопросы наготове. */
  get ready(): number {
    return this.pool.length;
  }

  next(): Promise<Question> {
    const raw = this.pool.shift();
    if (this.pool.length < LOW_WATER) void this.ensurePool();
    if (!raw) return this.fallback.next();
    this.usedDisplays.push(raw.display);
    if (this.usedDisplays.length > 60) this.usedDisplays.splice(0, this.usedDisplays.length - 60);
    return Promise.resolve(this.format(raw));
  }

  report(r: AnswerReport): void {
    const raw = this.issued.get(r.id);
    if (!raw) {
      this.fallback.report(r);
      return;
    }
    this.issued.delete(r.id);
    // Неверно отвеченный вопрос возвращается в том же раунде через несколько вопросов.
    if (!r.correct) {
      const span = this.opts.retryMax - this.opts.retryMin + 1;
      const at = Math.min(this.pool.length, this.opts.retryMin - 1 + Math.floor(Math.random() * span));
      this.pool.splice(at, 0, raw);
    }
  }

  /** Вернуть в пул вопрос, который был выдан, но не показан (как releaseQuestion в See Escape). */
  release(q: Question): void {
    const raw = this.issued.get(q.id);
    if (!raw) return;
    this.issued.delete(q.id);
    this.pool.unshift(raw);
    const i = this.usedDisplays.lastIndexOf(raw.display);
    if (i >= 0) this.usedDisplays.splice(i, 1);
  }

  private format(raw: RawQuestion): Question {
    const correctAnswer = raw.options[raw.correct];
    const options = shuffle(raw.options);
    const id = `gen-${++this.serial}`;
    this.issued.set(id, raw);
    return {
      id,
      instruction: raw.text,
      prompt: raw.display,
      promptLang: 'de',
      options,
      optionsLang: 'de',
      correctIndex: options.indexOf(correctAnswer),
    };
  }

  private setStatus(status: QuizStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.onStatus();
  }

  private async checkStatus(): Promise<void> {
    try {
      const response = await fetch('/api/quiz/status');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { generationConfigured?: boolean };
      this.generationConfigured = Boolean(data.generationConfigured);
    } catch {
      this.generationConfigured = false;
    }
    this.setStatus(this.generationConfigured ? 'online' : 'fallback');
    if (this.generationConfigured) void this.ensurePool();
  }

  private ensurePool(): Promise<void> {
    if (!this.opts.generation || !this.generationConfigured || this.configureTimer) return Promise.resolve();
    if (this.pool.length >= LOW_WATER) return Promise.resolve();
    if (this.fetching) return this.fetching;
    if (Date.now() - this.failedAt < RETRY_AFTER_MS) return Promise.resolve();
    const epoch = this.epoch;
    const { level, lexicalTopic, grammarTopic } = this.settings;
    this.setStatus('loading');
    const task = fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        lexicalTopic,
        grammarTopic,
        isWortstellung: isWortstellungTopic(grammarTopic),
        count: REQUEST_COUNT,
        exclude: this.usedDisplays.slice(-EXCLUDE_LAST),
      }),
    })
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)),
      )
      .then((data: { questions?: unknown[] }) => {
        if (epoch !== this.epoch) return;
        const valid = (data.questions ?? []).filter(validRawQuestion);
        const known = new Set([...this.usedDisplays, ...this.pool.map((q) => q.display)]);
        this.pool.push(...shuffle(valid.filter((q) => !known.has(q.display))));
        this.lastError = '';
        this.failedAt = -Infinity;
        if (this.awaitingFirstBatch && this.pool.length) {
          this.awaitingFirstBatch = false;
          this.onFirstBatch();
        }
      })
      .catch((error: unknown) => {
        if (epoch !== this.epoch) return;
        console.warn('Schtolnya quiz generation fallback:', error);
        this.lastError = error instanceof Error ? error.message : 'generation failed';
        this.failedAt = Date.now();
      })
      .finally(() => {
        if (epoch !== this.epoch) return;
        this.fetching = null;
        this.setStatus(this.lastError ? 'fallback' : 'online');
      });
    this.fetching = task;
    return task;
  }
}
