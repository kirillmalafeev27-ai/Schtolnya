// Источник вопросов — общий для серии (план, раздел 12). Игра не знает, откуда берутся вопросы.

export interface Question {
  id: string;
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
}
