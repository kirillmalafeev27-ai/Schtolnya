// Локальный банк вопросов для разработки и автономной страницы (план, 12.1–12.3).

import type { AnswerReport, Question, QuestionProvider } from './types';

export interface LocalBankOptions {
  /** Вопрос не повторяется раньше чем через столько показов. */
  noRepeatWithin: number;
  /** Неверно отвеченный вопрос возвращается через retryMin…retryMax вопросов. */
  retryMin: number;
  retryMax: number;
  seed?: number;
}

function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class LocalBankProvider implements QuestionProvider {
  private readonly bank: Question[];
  private readonly rand: () => number;
  private shown = 0;
  private readonly lastShown = new Map<string, number>();
  private readonly retries: { id: string; at: number }[] = [];
  readonly reports: AnswerReport[] = [];

  constructor(
    bank: readonly Question[],
    private readonly opts: LocalBankOptions,
  ) {
    if (!bank.length) throw new Error('LocalBankProvider: пустой банк');
    this.bank = bank.map((q) => ({ ...q, options: q.options.slice() }));
    this.rand = rngFrom(opts.seed ?? Date.now());
  }

  next(): Promise<Question> {
    const q = this.pick();
    this.shown++;
    this.lastShown.set(q.id, this.shown);
    return Promise.resolve(this.shuffled(q));
  }

  report(r: AnswerReport): void {
    this.reports.push(r);
    if (!r.correct) {
      const span = this.opts.retryMax - this.opts.retryMin + 1;
      const at = this.shown + this.opts.retryMin + Math.floor(this.rand() * span);
      if (!this.retries.some((x) => x.id === r.id)) this.retries.push({ id: r.id, at });
    }
  }

  private pick(): Question {
    // Неверно отвеченный вопрос возвращается, когда подошёл его черёд.
    const due = this.retries.findIndex((x) => x.at <= this.shown + 1);
    if (due >= 0) {
      const [r] = this.retries.splice(due, 1);
      const q = this.bank.find((b) => b.id === r.id);
      if (q) return q;
    }
    const window = Math.min(this.opts.noRepeatWithin, this.bank.length - 1);
    const fresh = this.bank.filter((q) => {
      const last = this.lastShown.get(q.id);
      const pendingRetry = this.retries.some((x) => x.id === q.id);
      return !pendingRetry && (last === undefined || this.shown + 1 - last > window);
    });
    const pool = fresh.length ? fresh : this.bank;
    return pool[Math.floor(this.rand() * pool.length)];
  }

  /** Варианты перемешиваются при показе, correctIndex пересчитывается (12.2). */
  private shuffled(q: Question): Question {
    const order = q.options.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return {
      ...q,
      options: order.map((i) => q.options[i]),
      correctIndex: order.indexOf(q.correctIndex),
    };
  }
}
