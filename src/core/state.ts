// Состояние раунда — чистые данные (план, 13.3.1).

import { balance } from '../config/balance';
import type { HintLevel, LevelDef } from '../config/levels';
import { cloneGrid, Grid } from './grid';
import type { GeneratedLevel } from './levelGen';

export type IntentKind = 'move' | 'plant' | 'home' | 'stay' | 'shelter';

export type Intent =
  | { kind: 'stay' }
  | { kind: 'move'; target: number }
  | { kind: 'home' }
  | { kind: 'plant'; target: number }
  | { kind: 'shelter' };

export type ItemKind = 'stick' | 'vein' | 'nugget';

export interface Item {
  id: number;
  cell: number;
  kind: ItemKind;
}

export interface HeroState {
  cell: number;
  /** Куда смотрит герой: -1 влево, 1 вправо (по последнему горизонтальному шагу). */
  facing: -1 | 1;
  sticks: number;
  hasVein: boolean;
  nuggets: number;
  intent: Intent;
  /** Готовое действие: не больше одного (2.2.4). */
  ready: boolean;
  prevCell: number;
  movedFrame: number;
}

export type KoboldMode = 'sleep' | 'awake' | 'stunned';

export interface KoboldState {
  id: number;
  cell: number;
  lair: number;
  mode: KoboldMode;
  /** Секунд до следующего шага (только у бодрствующего). */
  stepTimer: number;
  /** Текущий интервал шага, с учётом злости. */
  stepInterval: number;
  anger: number;
  stunTimer: number;
  crouching: boolean;
  prevCell: number;
  movedFrame: number;
}

export interface FuseState {
  cell: number;
  stand: number;
  remaining: number;
  total: number;
  /** Последнее показанное число отсчёта (DREI=3 … EINS=1), 0 — отсчёт не начат. */
  lastCount: number;
}

export type Status = 'playing' | 'won' | 'lost';
export type LoseCause = 'kobold' | 'blast';

/** Параметры раунда: фиксируются на старте и внутри раунда не меняются (3.4). */
export interface RoundParams {
  tMed: number;
  p: number;
  fuseS: number;
  koboldStepS: number;
  minStepS: number;
  stunS: number;
  wakeS: number;
  blastRange: number;
  hints: HintLevel;
}

export interface RoundStats {
  correct: number;
  wrong: number;
  answerTimesMs: number[];
  blasts: number;
  stuns: number;
  sticksUsed: number;
  pickedSticks: number;
  pocketsOpened: number;
}

export interface GameState {
  levelId: number;
  seed: number;
  grid: Grid;
  lift: number;
  start: number;
  vein: number;
  lairs: number[];
  items: Item[];
  nextItemId: number;
  hero: HeroState;
  fuse: FuseState | null;
  kobolds: KoboldState[];
  time: number;
  frame: number;
  paused: boolean;
  status: Status;
  cause: LoseCause | null;
  /** Добыча за раунд (жила и самородки); шашки добавляются к счёту в конце. */
  loot: number;
  finalScore: number;
  stars: 0 | 1 | 2 | 3;
  kMin: number;
  s2: number;
  s3: number;
  startSticks: number;
  params: RoundParams;
  stats: RoundStats;
  anyBlast: boolean;
}

export interface Pace {
  tMed: number;
  p: number;
}

export function makeParams(level: LevelDef, pace: Pace): RoundParams {
  const r = balance.rules;
  const t = pace.tMed;
  const fuseS = Math.min(r.fuseMaxS, Math.max(r.fuseMinS, level.fuseAnswers * t));
  return {
    tMed: t,
    p: pace.p,
    fuseS,
    koboldStepS: level.koboldStepAnswers * t,
    minStepS: r.minStepAnswers * t,
    stunS: r.stunAnswers * t,
    wakeS: r.wakeAnswers * t,
    blastRange: r.blastRange,
    hints: level.hints,
  };
}

export function createState(level: LevelDef, gen: GeneratedLevel, pace: Pace): GameState {
  const params = makeParams(level, pace);
  let itemId = 1;
  const items: Item[] = gen.spares.map((cell) => ({ id: itemId++, cell, kind: 'stick' as const }));
  const kobolds: KoboldState[] = gen.lairs.map((lair, id) => ({
    id,
    cell: lair,
    lair,
    mode: 'sleep' as const,
    stepTimer: params.koboldStepS,
    stepInterval: params.koboldStepS,
    anger: 0,
    stunTimer: 0,
    crouching: false,
    prevCell: lair,
    movedFrame: -1,
  }));
  return {
    levelId: level.id,
    seed: gen.seed,
    grid: cloneGrid(gen.grid),
    lift: gen.lift,
    start: gen.start,
    vein: gen.vein,
    lairs: gen.lairs.slice(),
    items,
    nextItemId: itemId,
    hero: {
      cell: gen.start,
      facing: 1,
      sticks: level.startSticks,
      hasVein: false,
      nuggets: 0,
      intent: { kind: 'stay' },
      ready: false,
      prevCell: gen.start,
      movedFrame: -1,
    },
    fuse: null,
    kobolds,
    time: 0,
    frame: 0,
    paused: false,
    status: 'playing',
    cause: null,
    loot: 0,
    finalScore: 0,
    stars: 0,
    kMin: gen.kMin,
    s2: gen.s2,
    s3: gen.s3,
    startSticks: level.startSticks,
    params,
    stats: {
      correct: 0,
      wrong: 0,
      answerTimesMs: [],
      blasts: 0,
      stuns: 0,
      sticksUsed: 0,
      pickedSticks: 0,
      pocketsOpened: 0,
    },
    anyBlast: false,
  };
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    grid: cloneGrid(s.grid),
    lairs: s.lairs.slice(),
    items: s.items.map((it) => ({ ...it })),
    hero: { ...s.hero, intent: { ...s.hero.intent } as Intent },
    fuse: s.fuse ? { ...s.fuse } : null,
    kobolds: s.kobolds.map((k) => ({ ...k })),
    params: { ...s.params },
    stats: { ...s.stats, answerTimesMs: s.stats.answerTimesMs.slice() },
  };
}
