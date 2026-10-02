// Анализ маршрутов к жиле: минимум взрывов, минимальный маршрут, дилемма «взорвать или обойти» (план, 5.8–5.10).

import { blastCost, Cell, Grid, neighbor } from './grid';
import { bfsDist, blastDist } from './pathfinding';

/** Клетки рядом с жилой, с которых её можно взорвать (не скала и не подъёмник). */
export function veinTargets(g: Grid, vein: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < 4; d++) {
    const n = neighbor(g, vein, d);
    if (n < 0) continue;
    const t = g.cells[n];
    if (t === Cell.BEDROCK || t === Cell.LIFT) continue;
    out.push(n);
  }
  return out;
}

/** Стоимость входа в клетку для маршрутов к жиле: саму жилу и подъёмник обходим. */
export function routeCost(g: Grid, vein: number): (i: number) => number {
  return (i) => (i === vein ? Infinity : blastCost(g.cells[i]));
}

/** Минимальное число взрывов от старта до клетки рядом с жилой (kMin). */
export function minBlastsToVein(g: Grid, start: number, vein: number): number {
  const dist = blastDist(g, [start], routeCost(g, vein));
  let best = Infinity;
  for (const t of veinTargets(g, vein)) best = Math.min(best, dist[t]);
  return best;
}

export interface RouteInfo {
  kMin: number;
  /** Маршрут с минимумом взрывов, а среди таких — самый короткий; от старта (включительно) до клетки у жилы. */
  route: number[];
  /** Длина этого маршрута в шагах. */
  steps: number;
}

/** Лексикографически лучший маршрут: сначала минимум взрывов, затем минимум шагов. */
export function minRoute(g: Grid, start: number, vein: number): RouteInfo | null {
  const n = g.w * g.h;
  const cost = routeCost(g, vein);
  const blasts = new Float64Array(n).fill(Infinity);
  const steps = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  blasts[start] = 0;
  steps[start] = 0;
  // Дейкстра на O(n²): сетка крошечная.
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
      const s = steps[c] + 1;
      if (b < blasts[nb] || (b === blasts[nb] && s < steps[nb])) {
        blasts[nb] = b;
        steps[nb] = s;
        prev[nb] = c;
      }
    }
  }
  let best = -1;
  for (const t of veinTargets(g, vein)) {
    if (!isFinite(blasts[t])) continue;
    if (best < 0 || blasts[t] < blasts[best] || (blasts[t] === blasts[best] && steps[t] < steps[best]))
      best = t;
  }
  if (best < 0) return null;
  const route: number[] = [];
  for (let c = best; c >= 0; c = prev[c]) route.push(c);
  route.reverse();
  return { kMin: blasts[best], route, steps: steps[best] };
}

/**
 * Минимальное число шагов до клетки у жилы, если разрешено потратить не больше `b` взрывов,
 * для каждого b от 0 до maxBlasts (BFS по состояниям «клетка + число взрывов», 5.10).
 */
export function stepsByBudget(g: Grid, start: number, vein: number, maxBlasts: number): number[] {
  const n = g.w * g.h;
  const B = maxBlasts + 1;
  const cost = routeCost(g, vein);
  const dist = new Int32Array(n * B).fill(-1);
  const queue = new Int32Array(n * B);
  let head = 0;
  let tail = 0;
  dist[start * B] = 0;
  queue[tail++] = start * B;
  while (head < tail) {
    const st = queue[head++];
    const c = (st / B) | 0;
    const b = st % B;
    for (let d = 0; d < 4; d++) {
      const nb = neighbor(g, c, d);
      if (nb < 0) continue;
      const w = cost(nb);
      if (!isFinite(w) || b + w > maxBlasts) continue;
      const ns = nb * B + b + w;
      if (dist[ns] >= 0) continue;
      dist[ns] = dist[st] + 1;
      queue[tail++] = ns;
    }
  }
  const targets = veinTargets(g, vein);
  const out: number[] = [];
  let best = Infinity;
  for (let b = 0; b <= maxBlasts; b++) {
    for (const t of targets) {
      const v = dist[t * B + b];
      if (v >= 0 && v < best) best = v;
    }
    out.push(best);
  }
  return out;
}

export interface Dilemma {
  exists: boolean;
  /** Шагов по маршруту с минимумом взрывов. */
  minSteps: number;
  /** Лучшая альтернатива: больше взрывов, но короче. */
  altBlasts: number;
  altSteps: number;
}

/** Есть ли путь к жиле с большим числом взрывов, но короче минимального на `minShorter` шагов (5.10). */
export function findDilemma(
  g: Grid,
  start: number,
  vein: number,
  kMin: number,
  maxBlasts: number,
  minShorter: number,
): Dilemma {
  const info = minRoute(g, start, vein);
  if (!info || !isFinite(kMin))
    return { exists: false, minSteps: Infinity, altBlasts: -1, altSteps: Infinity };
  const byBudget = stepsByBudget(g, start, vein, Math.max(maxBlasts, kMin));
  let altBlasts = -1;
  let altSteps = Infinity;
  for (let b = kMin + 1; b < byBudget.length; b++) {
    if (byBudget[b] <= info.steps - minShorter && byBudget[b] < altSteps) {
      altSteps = byBudget[b];
      altBlasts = b;
    }
  }
  return { exists: altBlasts >= 0, minSteps: info.steps, altBlasts, altSteps };
}

/** Клетки, связанные со стартом проходами без взрывов. */
export function openRegion(g: Grid, start: number): Int32Array {
  return bfsDist(g, [start], (i) => g.cells[i] === Cell.FLOOR);
}

/**
 * Сколько ещё взрывов нужно от клетки до ближайшей цели (стоимость самой клетки не входит).
 * Вместе с blastDist от старта даёт множество клеток, лежащих на каком-нибудь самом дешёвом маршруте.
 */
export function remainingCost(
  g: Grid,
  targets: readonly number[],
  cost: (i: number) => number,
): Float64Array {
  const n = g.w * g.h;
  const dist = new Float64Array(n).fill(Infinity);
  const buckets: number[][] = [[]];
  for (const t of targets) {
    dist[t] = 0;
    buckets[0].push(t);
  }
  for (let b = 0; b < buckets.length; b++) {
    const bucket = buckets[b];
    for (let k = 0; k < bucket.length; k++) {
      const c = bucket[k];
      if (dist[c] !== b) continue;
      const w = cost(c);
      if (!isFinite(w)) continue;
      for (let d = 0; d < 4; d++) {
        const nb = neighbor(g, c, d);
        if (nb < 0 || !isFinite(cost(nb))) continue;
        const nd = b + w;
        if (nd < dist[nb]) {
          dist[nb] = nd;
          while (buckets.length <= nd) buckets.push([]);
          buckets[nd].push(nb);
        }
      }
    }
  }
  return dist;
}

/** Клетки, лежащие хотя бы на одном маршруте к жиле с минимумом взрывов. */
export function cheapestRouteCells(g: Grid, start: number, vein: number): number[] {
  const cost = routeCost(g, vein);
  const fromStart = blastDist(g, [start], cost);
  const targets = veinTargets(g, vein).filter((t) => isFinite(cost(t)));
  const toVein = remainingCost(g, targets, cost);
  let kMin = Infinity;
  for (const t of targets) kMin = Math.min(kMin, fromStart[t]);
  const out: number[] = [];
  if (!isFinite(kMin)) return out;
  for (let i = 0; i < g.cells.length; i++) {
    if (fromStart[i] + toVein[i] === kMin) out.push(i);
  }
  return out;
}
