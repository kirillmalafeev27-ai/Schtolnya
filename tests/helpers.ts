// Помощники для тестов: состояние из ASCII-карты.

import { getLevel } from '../src/config/levels';
import { Cell, createGrid, idx } from '../src/core/grid';
import type { GeneratedLevel } from '../src/core/levelGen';
import { reduce, type GameAction } from '../src/core/rules';
import { createState, type GameState } from '../src/core/state';
import type { GameEvent } from '../src/core/events';

/**
 * Легенда: `#` скала, `.` проход, `R` порода, `X` крепкая порода, `V` жила, `P` карман,
 * `L` подъёмник, `H` герой, `K` логово кобольда, `S` запасная шашка.
 */
export function fromAscii(
  rows: string[],
  opts: { level?: number; tMed?: number; sticks?: number; awake?: boolean } = {},
): GameState {
  const h = rows.length;
  const w = rows[0].length;
  const g = createGrid(w, h, Cell.BEDROCK);
  let hero = -1;
  let lift = -1;
  let vein = -1;
  const lairs: number[] = [];
  const spares: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const i = idx(g, x, y);
      const map: Record<string, number> = {
        '#': Cell.BEDROCK,
        '.': Cell.FLOOR,
        R: Cell.ROCK,
        X: Cell.HARD,
        V: Cell.VEIN,
        P: Cell.POCKET,
        L: Cell.LIFT,
        H: Cell.FLOOR,
        K: Cell.FLOOR,
        S: Cell.FLOOR,
      };
      g.cells[i] = map[ch] ?? Cell.BEDROCK;
      if (ch === 'H') hero = i;
      if (ch === 'L') lift = i;
      if (ch === 'V') vein = i;
      if (ch === 'K') lairs.push(i);
      if (ch === 'S') spares.push(i);
    }
  }
  const level = getLevel(opts.level ?? 1);
  const gen: GeneratedLevel = {
    seed: 1,
    attempts: 1,
    relaxed: false,
    warnings: [],
    grid: g,
    lift,
    start: hero,
    vein,
    lairs,
    spares,
    pockets: [],
    rubble: [],
    shortcuts: [],
    kMin: 1,
    minRoute: [],
    minRouteSteps: 0,
    dilemma: null,
    s2: 16,
    s3: 20,
  };
  const s = createState(
    { ...level, startSticks: opts.sticks ?? level.startSticks },
    gen,
    { tMed: opts.tMed ?? 5, p: 0.8 },
  );
  if (opts.awake) for (const k of s.kobolds) k.mode = 'awake';
  return s;
}

export function at(s: GameState, x: number, y: number): number {
  return y * s.grid.w + x;
}

export class Runner {
  events: GameEvent[] = [];
  constructor(public s: GameState) {}
  do(a: GameAction): GameEvent[] {
    const r = reduce(this.s, a);
    this.s = r.state;
    this.events.push(...r.events);
    return r.events;
  }
  correct(): GameEvent[] {
    return this.do({ type: 'ANSWER', correct: true, timeMs: 3000 });
  }
  wrong(): GameEvent[] {
    return this.do({ type: 'ANSWER', correct: false, timeMs: 3000 });
  }
  intent(kind: 'move' | 'plant' | 'home' | 'stay', cell?: number): GameEvent[] {
    return this.do({ type: 'SET_INTENT', kind, cell });
  }
  /** Время идёт кадрами по 50 мс. */
  wait(seconds: number, step = 0.05): GameEvent[] {
    const out: GameEvent[] = [];
    let t = seconds;
    while (t > 1e-9 && this.s.status === 'playing') {
      const dt = Math.min(step, t);
      out.push(...this.do({ type: 'TICK', dt }));
      t -= dt;
    }
    return out;
  }
  has(type: GameEvent['type']): boolean {
    return this.events.some((e) => e.type === type);
  }
}
