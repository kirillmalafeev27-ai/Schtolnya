// Источник вопросов — общий для серии (план, раздел 12). Игра не знает, откуда берутся вопросы.

export interface Question {
  id: string;
  /** Указание к заданию («Waehle die richtige Option.»), как в See Escape; показывается над заданием. */
  instruction?: string;
  /** Текст задания. */
  prompt: string;
  promptLang: 'de' | 'ru';
  /** 2–4 варианта. */
  options: string[];
  optionsLang: 'de' | 'ru';
  correctIndex: number;
}

export interface AnswerReport {
  id: string;
  correct: boolean;
  timeMs: number;
}

export interface QuestionProvider {
  next(): Promise<Question>;
  report(r: AnswerReport): void;
  /** Вернуть выданный, но не показанный вопрос (необязательно). */
  release?(q: Question): void;
}
