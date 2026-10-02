// Боты для симуляции баланса (план, раздел 14): осторожный, напористый, заманивающий.

import { blastCross } from '../src/core/blast';
import { Cell, Grid, isDestructible, manhattan, neighbor } from '../src/core/grid';
import { burningCross, heroPassable, heroRoute, shelterMarks } from '../src/core/intent';
import { koboldField, koboldPathDistance } from '../src/core/kobold';
import { bfsDist, nextStep } from '../src/core/pathfinding';
import { remainingCost, routeCost, veinTargets } from '../src/core/routes';
import type { IntentAction } from '../src/core/rules';
import type { GameState } from '../src/core/state';

export type BotKind = 'cautious' | 'bold' | 'lure';

export interface BotDecision {
  kind: IntentAction;
  cell?: number;
}

export interface LurePlan {
  rock: number;
  stand: number;
  shelter: number;
}

export interface BotMemory {
  /** Ключ последнего отклонённого решения — не повторять его, пока ничего не изменилось. */
  denied: string;
  /** Задуманная приманка: куда встать, что заложить, куда уйти. */
  lure: LurePlan | null;
  luring: boolean;
  lureStand: number;
  lureAttempts: number;
  lureSuccess: number;
  lastStunCount: number;
}

export function newMemory(): BotMemory {
  return {
    denied: '',
    lure: null,
    luring: false,
    lureStand: -1,
    lureAttempts: 0,
    lureSuccess: 0,
    lastStunCount: 0,
  };
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
      if (best < 0 || blasts[t] < blasts[best] || (blasts[t] === blasts[best] && steps[t] < steps[best]))
        best = t;
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
  return bfsDist(
    s.grid,
    ks.map((k) => k.cell),
    (i) => s.grid.cells[i] === Cell.FLOOR,
  );
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
    d.kind === 'move'
      ? { kind: 'move' as const, target: d.cell! }
      : d.kind === 'plant'
        ? { kind: 'plant' as const, target: d.cell! }
        : { kind: 'home' as const };
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
    if (bot === 'lure' && mem.luring && mem.lure) {
      // Держим готовое действие и уходим в последний момент: перед взрывом или перед шагом кобольда на героя.
      const plan = mem.lure;
      const ks = awakeKobolds(s);
      const late = s.fuse.remaining < 0.35;
      const danger = ks.some((k) => manhattan(s.grid, k.cell, h.cell) <= 1 && k.stepTimer < 0.4);
      const off = !cross.has(h.cell);
      if (off) return h.intent.kind === 'stay' ? null : { kind: 'stay' };
      if (late || danger) {
        mem.luring = false;
        return { kind: 'move', cell: plan.shelter };
      }
      // Без готового действия при кобольде рядом — ответ сразу уводит в укрытие.
      if (
        !h.ready &&
        ks.some((k) => manhattan(s.grid, k.cell, h.cell) <= 2) &&
        s.fuse.remaining < 2 * s.params.tMed
      )
        return want(s, { kind: 'move', cell: plan.shelter });
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
  if (f) {
    mem.lure = null;
    return want(s, f);
  }
  // Заманивающий: просчитанная приманка, если кобольд идёт к герою.
  if (bot === 'lure') {
    const d = lureStep(s, mem);
    if (d !== undefined) return d;
  }
  const plan = planRoute(bot, s, mem);
  if (!plan) return null;
  const key = `${plan.kind}:${plan.cell ?? ''}`;
  const blocked = key === mem.denied;
  if (kd && plan.kind !== 'stay' && (blocked || nextStepUnsafe(s, plan, kd) || raceLost(s, plan, kd))) {
    // Кобольд успевает перехватить: обходной путь, где герой везде раньше него, иначе — уйти подальше.
    const detour = safeDetour(s, plan, kd);
    if (detour !== undefined) return detour;
    const k = kite(s, kd);
    if (k) return want(s, k);
    return s.hero.intent.kind === 'stay' ? null : { kind: 'stay' };
  }
  if (blocked) return s.hero.intent.kind === 'stay' ? null : { kind: 'stay' };
  return plan;
}

/** Интервал шага ближайшего бодрствующего кобольда. */
function koboldInterval(s: GameState): number {
  const ks = awakeKobolds(s);
  return ks.length ? Math.min(...ks.map((k) => k.stepInterval)) : Infinity;
}

/** Клетки, куда ведёт решение (для обхода). */
function planTargets(s: GameState, plan: BotDecision): number[] {
  const g = s.grid;
  if (plan.kind === 'home') return [s.lift];
  if (plan.kind === 'move') return [plan.cell!];
  if (plan.kind === 'plant') {
    const out: number[] = [];
    for (let d = 0; d < 4; d++) {
      const nb = neighbor(g, plan.cell!, d);
      if (nb >= 0 && (g.cells[nb] === Cell.FLOOR || g.cells[nb] === Cell.LIFT)) out.push(nb);
    }
    return out;
  }
  return [];
}

/** Проигрывает ли герой гонку кобольду на маршруте решения. */
function raceLost(s: GameState, plan: BotDecision, kd: Int32Array): boolean {
  const intent =
    plan.kind === 'move'
      ? { kind: 'move' as const, target: plan.cell! }
      : plan.kind === 'plant'
        ? { kind: 'plant' as const, target: plan.cell! }
        : { kind: 'home' as const };
  const route = heroRoute(s, intent);
  if (!route) return false;
  const E = actionTime(s);
  const I = koboldInterval(s);
  for (let i = 0; i < route.length; i++) {
    const c = route[i];
    if (kd[c] < 0) continue;
    if ((i + 1) * E >= kd[c] * I - 0.3 * I) return true;
  }
  return false;
}

/** Обход: BFS по шагам героя, где каждую клетку герой проходит заметно раньше кобольда. */
function safeDetour(s: GameState, plan: BotDecision, kd: Int32Array): BotDecision | null | undefined {
  const g = s.grid;
  const targets = new Set(planTargets(s, plan));
  if (!targets.size) return undefined;
  const pass = heroPassable(s);
  const E = actionTime(s);
  const I = koboldInterval(s);
  const n = g.cells.length;
  const step = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const q = [s.hero.cell];
  step[s.hero.cell] = 0;
  let goal = targets.has(s.hero.cell) ? s.hero.cell : -1;
  while (q.length && goal < 0) {
    const c = q.shift()!;
    for (let d = 0; d < 4; d++) {
      const nb = neighbor(g, c, d);
      if (nb < 0 || step[nb] >= 0) continue;
      const isTarget = targets.has(nb);
      if (!isTarget && !pass(nb)) continue;
      if (isTarget && nb === s.lift && !s.hero.hasVein) continue;
      const t = (step[c] + 1) * E;
      if (kd[nb] >= 0 && t >= kd[nb] * I - 0.5 * I) continue;
      step[nb] = step[c] + 1;
      prev[nb] = c;
      if (isTarget) {
        goal = nb;
        break;
      }
      q.push(nb);
    }
  }
  if (goal < 0) return undefined;
  if (goal === s.hero.cell) return plan.kind === 'plant' ? want(s, plan) : null;
  let c = goal;
  while (prev[c] !== s.hero.cell && prev[c] >= 0) c = prev[c];
  if (c === s.lift) return want(s, { kind: 'home' });
  // Последний шаг к цели — само решение (закладка с места), иначе — по клетке.
  if (plan.kind === 'plant' && targets.has(c) && c === goal && step[goal] === 1)
    return want(s, { kind: 'move', cell: c });
  return want(s, { kind: 'move', cell: c });
}

/** Уйти подальше от кобольда: соседняя клетка с наибольшим расстоянием, не в тупик. */
function kite(s: GameState, kd: Int32Array): BotDecision | null {
  const g = s.grid;
  const h = s.hero;
  const here = kd[h.cell];
  if (here < 0 || here > 5) return null;
  const pass = heroPassable(s);
  let best = -1;
  let bestScore = -Infinity;
  for (let d = 0; d < 4; d++) {
    const nb = neighbor(g, h.cell, d);
    if (nb < 0 || !pass(nb) || g.cells[nb] !== Cell.FLOOR) continue;
    if (kd[nb] >= 0 && kd[nb] <= here - 1) continue;
    // Простор: сколько клеток за ней дальше от кобольда (не загнать себя в тупик).
    let room = 0;
    const seen = new Set([h.cell, nb]);
    const q = [nb];
    while (q.length && room < 12) {
      const c = q.shift()!;
      for (let e = 0; e < 4; e++) {
        const m = neighbor(g, c, e);
        if (m < 0 || seen.has(m) || !pass(m) || g.cells[m] !== Cell.FLOOR) continue;
        if (kd[m] >= 0 && kd[m] < kd[c]) continue;
        seen.add(m);
        room++;
        q.push(m);
      }
    }
    const score = (kd[nb] < 0 ? 99 : kd[nb]) * 10 + room;
    if (score > bestScore) {
      bestScore = score;
      best = nb;
    }
  }
  if (best < 0) return null;
  return { kind: 'move', cell: best };
}

function planRoute(bot: BotKind, s: GameState, _mem: BotMemory): BotDecision | null {
  const h = s.hero;
  const g = s.grid;

  if (h.hasVein) return h.intent.kind === 'home' ? null : { kind: 'home' };

  const veinItem = s.items.find((it) => it.kind === 'vein');
  if (veinItem) return want(s, { kind: 'move', cell: veinItem.cell });

  void g;
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
    if (s.hero.cell === end || manhattan(g, s.hero.cell, s.vein) === 1)
      return want(s, { kind: 'plant', cell: s.vein });
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
    if (best >= 0 && bestKey >= 300) {
      // Укрытия ближе трёх шагов нет: поискать другую породу на маршруте в пределах шашек.
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

// ───────────── просчитанная приманка (14.3) ─────────────

/** Ожидаемое время одного действия: ответ по логнормальному закону и доля верных. */
function actionTime(s: GameState): number {
  return (s.params.tMed * Math.exp(0.125)) / Math.max(0.3, s.params.p);
}

/**
 * Где окажутся кобольды к моменту взрыва `tb`, если герой стоит в `stand` и уходит в `shelter`
 * в последний момент (перед взрывом или перед шагом кобольда на него). null — героя поймают.
 */
function simulateLure(s: GameState, plan: LurePlan, cross: Set<number>, tb: number): boolean {
  const g = s.grid;
  const fieldStand = koboldField(g, plan.stand);
  const fieldShelter = koboldField(g, plan.shelter);
  // Клетка с шашкой до взрыва — порода, кобольд через неё не пройдёт: поле уже это учитывает.
  let anyHit = false;
  let heroLeaveAt = tb - 0.3;
  const ks = awakeKobolds(s);
  // Сначала найдём, когда кому-то из кобольдов пора шагнуть на героя — тогда уходим раньше.
  for (const k of ks) {
    let c = k.cell;
    let t = k.stepTimer;
    while (t < heroLeaveAt) {
      const nx = nextStep(g, c, fieldStand);
      if (nx < 0) break;
      if (nx === plan.stand) {
        heroLeaveAt = Math.min(heroLeaveAt, t - 0.2);
        break;
      }
      c = nx;
      t += k.stepInterval;
    }
  }
  if (heroLeaveAt < 0) return false;
  for (const k of ks) {
    let c = k.cell;
    let t = k.stepTimer;
    while (t < tb) {
      const field = t < heroLeaveAt ? fieldStand : fieldShelter;
      const target = t < heroLeaveAt ? plan.stand : plan.shelter;
      const nx = nextStep(g, c, field);
      if (nx < 0) break;
      if (nx === target) return false;
      c = nx;
      t += k.stepInterval;
    }
    if (cross.has(c)) anyHit = true;
    if (c === plan.shelter || manhattan(g, c, plan.shelter) === 0) return false;
  }
  return anyHit;
}

/** Найти приманку: порода рядом с героем (или в шаге от него), укрытие в шаг, кобольд попадёт под крест. */
function planLure(s: GameState): LurePlan | null {
  const g = s.grid;
  const h = s.hero;
  const ks = awakeKobolds(s);
  if (!ks.length) return null;
  const near = ks.some((k) => koboldPathDistance(s, k) <= 7);
  if (!near) return null;
  const need = h.hasVein ? 1 : 2;
  if (h.sticks < need) return null;
  const pass = heroPassable(s);
  const stands = [h.cell];
  for (let d = 0; d < 4; d++) {
    const nb = neighbor(g, h.cell, d);
    if (nb >= 0 && g.cells[nb] === Cell.FLOOR && pass(nb)) stands.push(nb);
  }
  const at = actionTime(s);
  const fuse = s.params.fuseS;
  let best: { plan: LurePlan; key: number } | null = null;
  for (const stand of stands) {
    const steps = stand === h.cell ? 0 : 1;
    for (let d = 0; d < 4; d++) {
      const rock = neighbor(g, stand, d);
      if (rock < 0 || rock === s.vein || !isDestructible(g.cells[rock])) continue;
      const cross = new Set(blastCross(g, rock, s.params.blastRange).cells);
      for (let e = 0; e < 4; e++) {
        const shelter = neighbor(g, stand, e);
        if (shelter < 0 || shelter === rock || g.cells[shelter] !== Cell.FLOOR || cross.has(shelter))
          continue;
        if (!pass(shelter)) continue;
        const plan = { rock, stand, shelter };
        // Время закладки случайно: проверяем раннюю, ожидаемую и позднюю.
        const ok = [0.55, 1, 1.6].every((k) => simulateLure(s, plan, cross, (steps + 1) * at * k + fuse));
        if (!ok) continue;
        const key = steps * 10 + (g.cells[rock] === Cell.HARD ? 1 : 0);
        if (!best || key < best.key) best = { plan, key };
      }
    }
  }
  return best?.plan ?? null;
}

/** Шаг приманки: подойти, заложить; undefined — приманки нет, играем дальше по маршруту. */
function lureStep(s: GameState, mem: BotMemory): BotDecision | null | undefined {
  const h = s.hero;
  if (!mem.lure) {
    const plan = planLure(s);
    if (!plan) return undefined;
    mem.lure = plan;
    mem.lureAttempts++;
    mem.lastStunCount = s.stats.stuns;
  }
  const plan = mem.lure;
  if (s.grid.cells[plan.rock] === Cell.FLOOR || h.sticks < 1) {
    mem.lure = null;
    return undefined;
  }
  if (h.cell !== plan.stand) return want(s, { kind: 'move', cell: plan.stand });
  mem.luring = true;
  return want(s, { kind: 'plant', cell: plan.rock });
}
