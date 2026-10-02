// Боты для симуляции баланса (план, раздел 14): осторожный, напористый, заманивающий.

import { blastCross } from '../src/core/blast';
import { Cell, Grid, isDestructible, manhattan, neighbor } from '../src/core/grid';
import { burningCross, heroPassable, heroRoute, shelterMarks } from '../src/core/intent';
import { koboldPathDistance } from '../src/core/kobold';
import { bfsDist } from '../src/core/pathfinding';
import { remainingCost, routeCost, veinTargets } from '../src/core/routes';
import type { IntentAction } from '../src/core/rules';
import type { GameState } from '../src/core/state';

export type BotKind = 'cautious' | 'bold' | 'lure';

export interface BotDecision {
  kind: IntentAction;
  cell?: number;
}

export interface BotMemory {
  /** Ключ последнего отклонённого решения — не повторять его, пока ничего не изменилось. */
  denied: string;
  luring: boolean;
  lureStand: number;
  lureAttempts: number;
  lureSuccess: number;
  lastStunCount: number;
}

export function newMemory(): BotMemory {
  return { denied: '', luring: false, lureStand: -1, lureAttempts: 0, lureSuccess: 0, lastStunCount: 0 };
}

/** Маршрут от героя к клетке у жилы: лексикографически (взрывы, шаги) или (шаги) при бюджете взрывов. */
function routeToVein(s: GameState, mode: 'minBlasts' | 'minSteps', budget: number): number[] | null {
  const g = s.grid;
  const from = s.hero.cell;
  const cost = routeCost(g, s.vein);
  const targets = new Set(veinTargets(g, s.vein));
  if (targets.has(from)) return [];
  const n = g.w * g.h;
  if (mode === 'minBlasts') {
    const blasts = new Float64Array(n).fill(Infinity);
    const steps = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    blasts[from] = 0;
    steps[from] = 0;
    for (;;) {
      let c = -1;
      for (let i = 0; i < n; i++) {
        if (done[i] || !isFinite(blasts[i])) continue;
        if (c < 0 || blasts[i] < blasts[c] || (blasts[i] === blasts[c] && steps[i] < steps[c])) c = i;
      }
      if (c < 0) break;
      done[c] = 1;
      for (let d = 0; d < 4; d++) {
        const nb = neighbor(g, c, d);
        if (nb < 0 || done[nb]) continue;
        const w = cost(nb);
        if (!isFinite(w)) continue;
        const b = blasts[c] + w;
        const st = steps[c] + 1;
        if (b < blasts[nb] || (b === blasts[nb] && st < steps[nb])) {
          blasts[nb] = b;
          steps[nb] = st;
          prev[nb] = c;
        }
      }
    }
    let best = -1;
    for (const t of targets) {
      if (!isFinite(blasts[t])) continue;
      if (best < 0 || blasts[t] < blasts[best] || (blasts[t] === blasts[best] && steps[t] < steps[best])) best = t;
    }
    if (best < 0) return null;
    const path: number[] = [];
    for (let c = best; c !== from && c >= 0; c = prev[c]) path.push(c);
    return path.reverse();
  }
  // Кратчайший по шагам при бюджете взрывов: BFS по состояниям (клетка, взрывы).
  const B = budget + 1;
  const dist = new Int32Array(n * B).fill(-1);
  const prev = new Int32Array(n * B).fill(-1);
  const q = new Int32Array(n * B);
  let h = 0;
  let t = 0;
  dist[from * B] = 0;
  q[t++] = from * B;
  let goal = -1;
  while (h < t) {
    const st = q[h++];
    const c = (st / B) | 0;
    const b = st % B;
    if (targets.has(c)) {
      goal = st;
      break;
    }
    for (let d = 0; d < 4; d++) {
      const nb = neighbor(g, c, d);
      if (nb < 0) continue;
      const w = cost(nb);
      if (!isFinite(w) || b + w > budget) continue;
      const ns = nb * B + b + w;
      if (dist[ns] >= 0) continue;
      dist[ns] = dist[st] + 1;
      prev[ns] = st;
      q[t++] = ns;
    }
  }
  if (goal < 0) return null;
  const path: number[] = [];
  let st = goal;
  while (st >= 0 && st !== from * B) {
    path.push((st / B) | 0);
    st = prev[st];
  }
  return path.reverse();
}

function firstObstacle(g: Grid, path: number[]): number {
  for (const c of path) if (g.cells[c] !== Cell.FLOOR) return c;
  return -1;
}

function awakeKobolds(s: GameState) {
  return s.kobolds.filter((k) => k.mode === 'awake');
}

/** Укрытие от места закладки: шагов до ближайшей клетки вне креста. */
function shelterStepsFrom(s: GameState, stand: number, rock: number): number {
  const cross = new Set(blastCross(s.grid, rock, s.params.blastRange).cells);
  const marks = shelterMarks(s.grid, stand, cross, heroPassable(s));
  if (marks.one.length) return 1;
  if (marks.two.length) return 2;
  return 3;
}

/** Поле расстояний от ближайшего бодрствующего кобольда по проходам. */
function koboldDistField(s: GameState): Int32Array | null {
  const ks = awakeKobolds(s);
  if (!ks.length) return null;
  return bfsDist(s.grid, ks.map((k) => k.cell), (i) => s.grid.cells[i] === Cell.FLOOR);
}

/** Бегство: бодрствующий кобольд вплотную — уйти на соседнюю клетку, где до него дальше всего. */
function flee(s: GameState, kd: Int32Array | null, avoid?: Set<number>): BotDecision | null {
  if (!kd) return null;
  const h = s.hero;
  const here = kd[h.cell];
  if (here < 0 || here > 1) return null;
  const pass = heroPassable(s);
  let best = -1;
  let bestD = here;
  for (let d = 0; d < 4; d++) {
    const nb = neighbor(s.grid, h.cell, d);
    if (nb < 0 || !pass(nb) || avoid?.has(nb)) continue;
    if (kd[nb] > bestD) {
      bestD = kd[nb];
      best = nb;
    }
  }
  if (best < 0) return null;
  return { kind: 'move', cell: best };
}

/** Безопасен ли следующий шаг решения: не ведёт ли он вплотную к бодрствующему кобольду. */
function nextStepUnsafe(s: GameState, d: BotDecision, kd: Int32Array | null): boolean {
  if (!kd || d.kind === 'stay') return false;
  const intent =
    d.kind === 'move' ? { kind: 'move' as const, target: d.cell! } : d.kind === 'plant' ? { kind: 'plant' as const, target: d.cell! } : { kind: 'home' as const };
  if (d.kind === 'plant' && manhattan(s.grid, s.hero.cell, d.cell!) === 1) return false;
  const route = heroRoute(s, intent);
  if (!route || !route.length) return false;
  const n = route[0];
  return kd[n] >= 0 && kd[n] <= 1;
}

export function decide(bot: BotKind, s: GameState, mem: BotMemory): BotDecision | null {
  const h = s.hero;

  // Горит фитиль: в укрытие (или приманка у заманивающего).
  if (s.fuse) {
    const cross = burningCross(s)!;
    if (bot === 'lure' && mem.luring) {
      const ks = awakeKobolds(s);
      const onCross = ks.some((k) => cross.has(k.cell));
      const late = s.fuse.remaining < 0.6 * s.params.tMed;
      const danger = ks.some((k) => koboldPathDistance(s, k) <= 1);
      if (onCross || late || danger) {
        mem.luring = false;
        return shelterMove(s, cross);
      }
      return h.intent.kind === 'stay' ? null : { kind: 'stay' };
    }
    if (cross.has(h.cell)) {
      const it = h.intent;
      if (it.kind === 'shelter') return null;
      if (it.kind === 'move' && !cross.has(it.target)) return null;
      return shelterMove(s, cross);
    }
    // В укрытии: если кобольд подошёл вплотную — отойти, не заходя в крест.
    const f = flee(s, koboldDistField(s), cross);
    if (f) return want(s, f);
    return h.intent.kind === 'stay' ? null : { kind: 'stay' };
  }
  mem.luring = false;

  // Кобольд вплотную — сначала уйти.
  const kd = koboldDistField(s);
  const f = flee(s, kd);
  if (f) return want(s, f);
  const plan = planRoute(bot, s, mem);
  if (!plan) return null;
  if (nextStepUnsafe(s, plan, kd)) return s.hero.intent.kind === 'stay' ? null : { kind: 'stay' };
  const key = `${plan.kind}:${plan.cell ?? ''}`;
  if (key === mem.denied) return s.hero.intent.kind === 'stay' ? null : { kind: 'stay' };
  return plan;
}

function planRoute(bot: BotKind, s: GameState, mem: BotMemory): BotDecision | null {
  const h = s.hero;
  const g = s.grid;

  if (h.hasVein) return h.intent.kind === 'home' ? null : { kind: 'home' };

  const veinItem = s.items.find((it) => it.kind === 'vein');
  if (veinItem) return want(s, { kind: 'move', cell: veinItem.cell });

  // Заманивающий: кобольд в пределах 4 клеток и шашка есть — приманка у соседней породы с укрытием в шаг.
  if (bot === 'lure' && h.sticks > 1) {
    const near = awakeKobolds(s).filter((k) => koboldPathDistance(s, k) <= 4);
    if (near.length) {
      for (let d = 0; d < 4; d++) {
        const rock = neighbor(g, h.cell, d);
        if (rock < 0 || !isDestructible(g.cells[rock]) || rock === s.vein) continue;
        if (shelterStepsFrom(s, h.cell, rock) !== 1) continue;
        mem.luring = true;
        mem.lureAttempts++;
        mem.lastStunCount = s.stats.stuns;
        return { kind: 'plant', cell: rock };
      }
    }
  }

  const budget = Math.max(0, h.sticks - 1);
  const path = routeToVein(s, bot === 'bold' ? 'minSteps' : 'minBlasts', budget);
  if (!path) {
    const alt = routeToVein(s, 'minBlasts', budget);
    if (!alt) return { kind: 'stay' };
    return followPath(bot, s, alt);
  }
  if (path.length === 0) return want(s, { kind: 'plant', cell: s.vein });
  return followPath(bot, s, path);
}

function followPath(bot: BotKind, s: GameState, path: number[]): BotDecision | null {
  const g = s.grid;
  const obstacle = firstObstacle(g, path);
  if (obstacle < 0) {
    const end = path[path.length - 1];
    if (s.hero.cell === end || manhattan(g, s.hero.cell, s.vein) === 1) return want(s, { kind: 'plant', cell: s.vein });
    return want(s, { kind: 'move', cell: end });
  }
  if (bot === 'cautious' || bot === 'lure') {
    // Закладывает только там, где укрытие в одном шаге: сначала встаёт на такое место (14.3).
    const dist = bfsDist(g, [s.hero.cell], heroPassable(s));
    let best = -1;
    let bestKey = Infinity;
    for (let d = 0; d < 4; d++) {
      const nb = neighbor(g, obstacle, d);
      if (nb < 0 || g.cells[nb] !== Cell.FLOOR) continue;
      const dn = nb === s.hero.cell ? 0 : dist[nb];
      if (dn < 0) continue;
      const key = shelterStepsFrom(s, nb, obstacle) * 100 + dn;
      if (key < bestKey) {
        bestKey = key;
        best = nb;
      }
    }
    if (best >= 0 && bestKey >= 200) {
      // Укрытие только в два шага: поискать другую породу на маршруте в пределах шашек.
      const alt = alternativeObstacle(s, obstacle);
      if (alt) return want(s, alt);
    }
    if (best >= 0 && best !== s.hero.cell) return want(s, { kind: 'move', cell: best });
  }
  return want(s, { kind: 'plant', cell: obstacle });
}

/** Другая разрушимая клетка на границе доступной области, с укрытием в шаг и маршрутом к жиле в пределах шашек. */
function alternativeObstacle(s: GameState, avoid: number): BotDecision | null {
  const g = s.grid;
  const pass = heroPassable(s);
  const dist = bfsDist(g, [s.hero.cell], pass);
  const cost = routeCost(g, s.vein);
  const targets = veinTargets(g, s.vein);
  const toVein = remainingCost(g, targets, cost);
  const budget = Math.max(0, s.hero.sticks - 1);
  let best: { stand: number; rock: number; key: number } | null = null;
  for (let rock = 0; rock < g.cells.length; rock++) {
    if (rock === avoid || rock === s.vein || !isDestructible(g.cells[rock])) continue;
    const need = cost(rock) + toVein[rock];
    if (!isFinite(need) || need > budget) continue;
    for (let d = 0; d < 4; d++) {
      const nb = neighbor(g, rock, d);
      if (nb < 0 || g.cells[nb] !== Cell.FLOOR) continue;
      const dn = nb === s.hero.cell ? 0 : dist[nb];
      if (dn < 0) continue;
      if (shelterStepsFrom(s, nb, rock) !== 1) continue;
      const key = need * 1000 + dn;
      if (!best || key < best.key) best = { stand: nb, rock, key };
    }
  }
  if (!best) return null;
  if (best.stand === s.hero.cell) return { kind: 'plant', cell: best.rock };
  return { kind: 'move', cell: best.stand };
}

function shelterMove(s: GameState, cross: Set<number>): BotDecision {
  const g = s.grid;
  const dist = bfsDist(g, [s.hero.cell], heroPassable(s));
  let best = -1;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 0 || cross.has(i)) continue;
    if (best < 0 || dist[i] < dist[best]) best = i;
  }
  if (best < 0) return { kind: 'stay' };
  return { kind: 'move', cell: best };
}

function want(s: GameState, d: BotDecision): BotDecision | null {
  const it = s.hero.intent;
  if (d.kind === 'plant' && it.kind === 'plant' && it.target === d.cell) return null;
  if (d.kind === 'move' && it.kind === 'move' && it.target === d.cell) return null;
  return d;
}
