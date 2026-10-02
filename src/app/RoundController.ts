// Контроллер раунда: держит состояние, прогоняет действия через редуктор и раздаёт события
// виду и интерфейсу. Сам ничего не рисует.

import { balance } from '../config/balance';
import type { LevelDef } from '../config/levels';
import type { GameEvent } from '../core/events';
import { manhattan } from '../core/grid';
import { classifyTap } from '../core/intent';
import type { GeneratedLevel } from '../core/levelGen';
import { reduce, type GameAction, type IntentAction } from '../core/rules';
import { createState, type GameState, type Pace } from '../core/state';

export type RoundListener = (events: GameEvent[], state: GameState) => void;

/** Что сделает следующий верный ответ (11.2.1). */
export type AnswerKind = 'step' | 'plant' | 'shelter' | 'stay' | 'ready';

export class RoundController {
  state: GameState;
  private readonly listeners = new Set<RoundListener>();
  /** Журнал действий раунда: сид + журнал воспроизводят раунд (13.3.5). */
  readonly log: GameAction[] = [];
  private immortal = false;

  constructor(
    readonly level: LevelDef,
    readonly gen: GeneratedLevel,
    readonly pace: Pace,
  ) {
    this.state = createState(level, gen, pace);
  }

  subscribe(fn: RoundListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  dispatch(action: GameAction): GameEvent[] {
    const before = this.state;
    const r = reduce(before, action);
    let events = r.events;
    if (this.immortal && r.state.status === 'lost') {
      // Отладка: «бессмертие» — откатываем проигрыш, оставляя мир как есть.
      r.state.status = 'playing';
      r.state.cause = null;
      events = events.filter((e) => e.type !== 'CAUGHT' && e.type !== 'HERO_BLASTED');
    }
    this.state = r.state;
    if (action.type !== 'TICK' || events.length) this.log.push(action);
    if (events.length) for (const fn of this.listeners) fn(events, this.state);
    return events;
  }

  tick(dt: number): void {
    this.dispatch({ type: 'TICK', dt });
  }

  /** Ответ из панели вопроса. Возвращает, принят ли ответ (при готовом действии — нет). */
  answer(correct: boolean, timeMs: number): boolean {
    const s = this.state;
    if (s.status !== 'playing' || s.paused) return false;
    if (s.hero.ready) return false;
    this.dispatch({ type: 'ANSWER', correct, timeMs });
    return true;
  }

  setIntent(kind: IntentAction, cell?: number): GameEvent[] {
    return this.dispatch({ type: 'SET_INTENT', kind, cell });
  }

  /** Тап по клетке мира (2.2.2): проход — идти, порода — заложить, герой — стоять, клеть — домой. */
  tap(cell: number): GameEvent[] {
    const kind = classifyTap(this.state, cell);
    switch (kind) {
      case 'move':
        return this.setIntent('move', cell);
      case 'plant':
      case 'bedrock':
        return this.setIntent('plant', cell);
      case 'home':
        return this.setIntent('home');
      case 'stay':
        return this.setIntent('stay');
      default:
        return [];
    }
  }

  pause(): void {
    this.dispatch({ type: 'PAUSE' });
  }

  resume(): void {
    this.dispatch({ type: 'RESUME' });
  }

  setImmortal(v: boolean): void {
    this.immortal = v;
  }

  /** Что сделает следующий верный ответ — для шапки панели. */
  answerKind(): AnswerKind {
    const s = this.state;
    const h = s.hero;
    if (h.ready) return 'ready';
    switch (h.intent.kind) {
      case 'stay':
        return 'stay';
      case 'shelter':
        return 'shelter';
      case 'plant':
        return manhattan(s.grid, h.cell, h.intent.target) === 1 ? 'plant' : 'step';
      default:
        return 'step';
    }
  }

  /** Отладка: +N шашек. */
  debugAddSticks(n: number): void {
    this.state = { ...this.state, hero: { ...this.state.hero, sticks: this.state.hero.sticks + n } };
    for (const fn of this.listeners)
      fn([{ type: 'INTENT', intent: this.state.hero.intent, auto: true }], this.state);
  }

  /** Отладка: усыпить или разбудить кобольдов. */
  debugKobolds(mode: 'sleep' | 'awake'): void {
    const s = { ...this.state, kobolds: this.state.kobolds.map((k) => ({ ...k })) };
    for (const k of s.kobolds) {
      k.mode = mode;
      k.stepTimer = k.stepInterval;
      if (mode === 'sleep') k.cell = k.lair;
    }
    this.state = s;
    const events: GameEvent[] = s.kobolds.map((k) =>
      mode === 'awake'
        ? ({ type: 'KOBOLD_WAKE', id: k.id, cause: 'timer' } as GameEvent)
        : ({ type: 'KOBOLD_RECOVERED', id: k.id, anger: k.anger } as GameEvent),
    );
    for (const fn of this.listeners) fn(events, this.state);
  }
}

/** Ограничение шага кадра (2.7.3). */
export function clampDt(dtS: number): number {
  return Math.max(0, Math.min(dtS, balance.time.maxFrameDtS));
}
