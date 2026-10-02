// Хранилище: по умолчанию localStorage с префиксом ключей `mine:`; темп — под общим ключом серии (13.4).

import type { HintLevel } from '../config/levels';
import type { PaceStorage } from '../shared/pace';

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function defaultStorage(): KeyValueStorage {
  return {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // приватный режим или квота — живём без сохранения
      }
    },
  };
}

export interface Settings {
  sfxVolume: number;
  ambientVolume: number;
  soundOn: boolean;
  reducedMotion: boolean | null;
  quality: 'high' | 'low';
  autoLowered: boolean;
  hints: HintLevel;
  sfxLang: 'de' | 'ru';
}

export interface Progress {
  /** Лучшие звёзды по уровням. */
  stars: Record<number, number>;
  best: Record<number, number>;
  tutorial: { start: boolean; planted: boolean; koboldAwake: boolean };
}

const DEFAULT_SETTINGS: Settings = {
  sfxVolume: 0.8,
  ambientVolume: 0.55,
  soundOn: true,
  reducedMotion: null,
  quality: 'high',
  autoLowered: false,
  hints: 'all',
  sfxLang: 'de',
};

const DEFAULT_PROGRESS: Progress = {
  stars: {},
  best: {},
  tutorial: { start: false, planted: false, koboldAwake: false },
};

export class GameStore {
  settings: Settings;
  progress: Progress;

  constructor(private readonly kv: KeyValueStorage) {
    this.settings = { ...DEFAULT_SETTINGS, ...this.read<Partial<Settings>>('mine:settings', {}) };
    const p = this.read<Partial<Progress>>('mine:progress', {});
    this.progress = {
      stars: { ...(p.stars ?? {}) },
      best: { ...(p.best ?? {}) },
      tutorial: { ...DEFAULT_PROGRESS.tutorial, ...(p.tutorial ?? {}) },
    };
  }

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = this.kv.get(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  saveSettings(): void {
    this.kv.set('mine:settings', JSON.stringify(this.settings));
  }

  saveProgress(): void {
    this.kv.set('mine:progress', JSON.stringify(this.progress));
  }

  /** Записать итог раунда; вернуть, побит ли рекорд. */
  recordResult(level: number, stars: number, score: number): boolean {
    const prevStars = this.progress.stars[level] ?? 0;
    const prevBest = this.progress.best[level] ?? 0;
    if (stars > prevStars) this.progress.stars[level] = stars;
    const record = score > prevBest;
    if (record) this.progress.best[level] = score;
    this.saveProgress();
    return record;
  }

  /** Следующий уровень открывается после победы хотя бы на одну звезду (4.5). */
  isUnlocked(level: number): boolean {
    if (level <= 1) return true;
    return (this.progress.stars[level - 1] ?? 0) >= 1;
  }

  /** Хранилище темпа: общий для серии ключ, без префикса игры. */
  paceStorage(): PaceStorage {
    return this.kv;
  }
}
