// Учёт темпа игрока (план, раздел 3). Темп — свойство ученика, хранилище общее для всей серии.

export interface PaceStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface PaceConfig {
  defaultTMed: number;
  minTMed: number;
  maxTMed: number;
  timeWindow: number;
  defaultP: number;
  minP: number;
  maxP: number;
  correctWindow: number;
}

export interface PaceSnapshot {
  /** Медиана времени ответа, секунды. */
  tMed: number;
  /** Доля верных ответов. */
  p: number;
}

/** Общий для серии ключ хранилища (13.4). */
export const PACE_KEY = 'series:pace';

interface PaceData {
  times: number[];
  results: number[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function median(values: readonly number[]): number {
  if (!values.length) return NaN;
  const s = values.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export class PaceTracker {
  private data: PaceData;

  constructor(
    private readonly storage: PaceStorage,
    private readonly cfg: PaceConfig,
  ) {
    this.data = this.load();
  }

  private load(): PaceData {
    try {
      const raw = this.storage.get(PACE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<PaceData>;
        return {
          times: Array.isArray(d.times) ? d.times.filter((t) => typeof t === 'number' && t > 0) : [],
          results: Array.isArray(d.results) ? d.results.filter((r) => r === 0 || r === 1) : [],
        };
      }
    } catch {
      // повреждённые данные — начинаем заново
    }
    return { times: [], results: [] };
  }

  /** Текущие T_med и p; фиксируются на старте раунда вызывающим кодом (3.4). */
  snapshot(): PaceSnapshot {
    const c = this.cfg;
    const t = this.data.times.length ? median(this.data.times) / 1000 : c.defaultTMed;
    const p = this.data.results.length
      ? this.data.results.reduce((a, b) => a + b, 0) / this.data.results.length
      : c.defaultP;
    return { tMed: clamp(t, c.minTMed, c.maxTMed), p: clamp(p, c.minP, c.maxP) };
  }

  /**
   * Записать ответ. `countTime = false` — ответ дан при горящем фитиле: в T_med не идёт (3.2),
   * но в долю верных идёт.
   */
  record(timeMs: number, correct: boolean, countTime: boolean): void {
    if (countTime && timeMs > 0) {
      this.data.times.push(Math.round(timeMs));
      if (this.data.times.length > this.cfg.timeWindow)
        this.data.times.splice(0, this.data.times.length - this.cfg.timeWindow);
    }
    this.data.results.push(correct ? 1 : 0);
    if (this.data.results.length > this.cfg.correctWindow)
      this.data.results.splice(0, this.data.results.length - this.cfg.correctWindow);
    try {
      this.storage.set(PACE_KEY, JSON.stringify(this.data));
    } catch {
      // хранилище недоступно — темп живёт до конца сессии
    }
  }
}
