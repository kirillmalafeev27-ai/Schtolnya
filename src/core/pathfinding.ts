// Поиск путей: BFS по проходам и 0-1(-2) BFS по стоимости взрывов (план, 5.8).
// Все обходы детерминированы: соседи перебираются в порядке вверх, влево, вниз, вправо.

import { Grid, neighbor } from './grid';

export type Passable = (i: number) => boolean;

/** Расстояния в шагах от источников; недостижимые клетки — -1. */
export function bfsDist(g: Grid, sources: readonly number[], passable: Passable): Int32Array {
  const dist = new Int32Array(g.w * g.h).fill(-1);
  const queue = new Int32Array(g.w * g.h);
  let head = 0;
  let tail = 0;
  for (const s of sources) {
    if (s < 0 || dist[s] === 0) continue;
    dist[s] = 0;
    queue[tail++] = s;
  }
  while (head < tail) {
    const c = queue[head++];
    for (let d = 0; d < 4; d++) {
      const n = neighbor(g, c, d);
      if (n < 0 || dist[n] >= 0 || !passable(n)) continue;
      dist[n] = dist[c] + 1;
      queue[tail++] = n;
    }
  }
  return dist;
}

/**
 * Следующий шаг из `from` по полю расстояний `dist` (посчитанному от цели):
 * сосед с расстоянием на единицу меньше; при равенстве — первый в порядке DIRS.
 */
export function nextStep(g: Grid, from: number, dist: Int32Array): number {
  const d0 = dist[from];
  if (d0 <= 0) return -1;
  for (let d = 0; d < 4; d++) {
    const n = neighbor(g, from, d);
    if (n >= 0 && dist[n] === d0 - 1) return n;
  }
  return -1;
}

/**
 * Кратчайший путь из `from` в `to` (без `from`, с `to`). `passable` решает, можно ли войти в клетку;
 * сама цель допускается всегда. Пустой массив — путь не нужен (from === to); null — пути нет.
 */
export function findPath(g: Grid, from: number, to: number, passable: Passable): number[] | null {
  if (from === to) return [];
  // Поле расстояний от цели: в клетку `from` разрешено «войти», чтобы обход до неё дошёл.
  const dist = bfsDist(g, [to], (i) => i === from || passable(i));
  if (dist[from] < 0) return null;
  const path: number[] = [];
  let c = from;
  while (c !== to) {
    c = nextStep(g, c, dist);
    if (c < 0) return null;
    path.push(c);
  }
  return path;
}

/**
 * Минимальная стоимость взрывов до каждой клетки (стоимость входа в клетку — `cost(i)`,
 * значения 0, 1 или 2; Infinity — непроходимо). Источники имеют стоимость 0.
 */
export function blastDist(g: Grid, sources: readonly number[], cost: (i: number) => number): Float64Array {
  const n = g.w * g.h;
  const dist = new Float64Array(n).fill(Infinity);
  // Очередь с корзинами по стоимости (алгоритм Дейкстры для малых целых весов).
  const buckets: number[][] = [[]];
  for (const s of sources) {
    if (s < 0) continue;
    dist[s] = 0;
    buckets[0].push(s);
  }
  for (let b = 0; b < buckets.length; b++) {
    const bucket = buckets[b];
    for (let k = 0; k < bucket.length; k++) {
      const c = bucket[k];
      if (dist[c] !== b) continue;
      for (let d = 0; d < 4; d++) {
        const nb = neighbor(g, c, d);
        if (nb < 0) continue;
        const w = cost(nb);
        if (!isFinite(w)) continue;
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
