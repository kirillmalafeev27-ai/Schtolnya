// Намерения героя и маршруты (план, 2.2 и 2.3.8).

import { blastCross } from './blast';
import { Cell, Grid, isDestructible, isWalkable, manhattan, neighbor } from './grid';
import { bfsDist, findPath, Passable } from './pathfinding';
import type { GameState, Intent } from './state';

/** Клетки, где стоит живой (бодрствующий или спящий) кобольд — их маршрут героя обходит (2.2.7). */
export function blockingKoboldCells(s: GameState): Set<number> {
  const set = new Set<number>();
  for (const k of s.kobolds) if (k.mode !== 'stunned') set.add(k.cell);
  return set;
}

export function heroPassable(s: GameState): Passable {
  const blocked = blockingKoboldCells(s);
  const g = s.grid;
  return (i) => isWalkable(g, i) && !blocked.has(i);
}

/** Крест горящей шашки или null. */
export function burningCross(s: GameState): Set<number> | null {
  if (!s.fuse) return null;
  return new Set(blastCross(s.grid, s.fuse.cell, s.params.blastRange).cells);
}

/** Шагов от `from` до ближайшей клетки вне креста по проходам (без кобольдов-препятствий). */
export function stepsToShelter(g: Grid, from: number, cross: Set<number>, passable: Passable): number {
  if (!cross.has(from)) return 0;
  const dist = bfsDist(g, [from], passable);
  let best = Infinity;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] >= 0 && !cross.has(i) && dist[i] < best) best = dist[i];
  }
  return best;
}

/** Отметки укрытий от места закладки: 1 — один шаг, 2 — два шага (2.8.2). */
export function shelterMarks(
  g: Grid,
  stand: number,
  cross: Set<number>,
  passable: Passable,
): { one: number[]; two: number[] } {
  const dist = bfsDist(g, [stand], passable);
  const one: number[] = [];
  const two: number[] = [];
  for (let i = 0; i < dist.length; i++) {
    if (cross.has(i)) continue;
    if (dist[i] === 1) one.push(i);
    else if (dist[i] === 2) two.push(i);
  }
  return { one, two };
}

/** Расстояние от клетки до ближайшего бодрствующего кобольда (по прямой, для разрешения ничьих). */
function koboldDistance(s: GameState, cell: number): number {
  let best = Infinity;
  for (const k of s.kobolds) {
    if (k.mode === 'sleep') continue;
    best = Math.min(best, manhattan(s.grid, cell, k.cell));
  }
  return best === Infinity ? 0 : best;
}

/**
 * Укрытие: ближайшая по пути клетка вне креста горящей шашки; при равенстве — дальше от кобольда (2.3.8).
 * Возвращает null, если укрытия нет.
 */
export function shelterTarget(s: GameState, from = s.hero.cell): number | null {
  const cross = burningCross(s);
  if (!cross) return null;
  if (!cross.has(from)) return from;
  const dist = bfsDist(s.grid, [from], heroPassable(s));
  let best = -1;
  let bestD = Infinity;
  let bestK = -Infinity;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 0 || cross.has(i)) continue;
    const kd = koboldDistance(s, i);
    if (dist[i] < bestD || (dist[i] === bestD && kd > bestK)) {
      best = i;
      bestD = dist[i];
      bestK = kd;
    }
  }
  return best >= 0 ? best : null;
}

/**
 * Место закладки для шашки в `target`: соседняя проходимая клетка, ближайшая по пути;
 * из равных — та, откуда до укрытия меньше шагов (2.2.2). null — подойти нельзя.
 */
export function standCellFor(s: GameState, target: number): number | null {
  const g = s.grid;
  const passable = heroPassable(s);
  const heroDist = bfsDist(g, [s.hero.cell], passable);
  const cross = new Set(blastCross(g, target, s.params.blastRange).cells);
  let best = -1;
  let bestD = Infinity;
  let bestShelter = Infinity;
  for (let d = 0; d < 4; d++) {
    const n = neighbor(g, target, d);
    if (n < 0) continue;
    const dn = n === s.hero.cell ? 0 : heroDist[n];
    if (dn < 0) continue;
    if (n !== s.hero.cell && !passable(n)) continue;
    const sh = stepsToShelter(g, n, cross, passable);
    if (dn < bestD || (dn === bestD && sh < bestShelter)) {
      best = n;
      bestD = dn;
      bestShelter = sh;
    }
  }
  return best >= 0 ? best : null;
}

/** Целевая клетка ходьбы для текущего намерения (или null, если идти некуда). */
export function walkTarget(s: GameState, intent: Intent = s.hero.intent): number | null {
  switch (intent.kind) {
    case 'move':
      return intent.target;
    case 'home':
      return s.lift;
    case 'shelter':
      return shelterTarget(s);
    case 'plant': {
      if (manhattan(s.grid, s.hero.cell, intent.target) === 1) return s.hero.cell;
      return standCellFor(s, intent.target);
    }
    default:
      return null;
  }
}

/** Маршрут героя по текущему намерению (без текущей клетки). null — пути нет. */
export function heroRoute(s: GameState, intent: Intent = s.hero.intent): number[] | null {
  const target = walkTarget(s, intent);
  if (target === null) return intent.kind === 'stay' ? [] : null;
  const g = s.grid;
  const passable = heroPassable(s);
  const pass: Passable = (i) => passable(i) || (i === s.lift && target === s.lift);
  const path = findPath(g, s.hero.cell, target, pass);
  if (!path) return null;
  // Нельзя «войти» в бодрствующего кобольда, даже если он стоит в цели.
  const blocked = blockingKoboldCells(s);
  if (path.some((c) => blocked.has(c))) return null;
  return path;
}

export type TapKind = 'move' | 'plant' | 'home' | 'stay' | 'bedrock' | 'none';

/** Что означает тап по клетке (2.2.2, 2.2.9, 11.4). */
export function classifyTap(s: GameState, cell: number): TapKind {
  const g = s.grid;
  if (cell < 0 || cell >= g.cells.length) return 'none';
  if (cell === s.hero.cell) return 'stay';
  const t = g.cells[cell];
  if (t === Cell.LIFT) return 'home';
  if (t === Cell.FLOOR) return 'move';
  if (isDestructible(t)) return 'plant';
  if (t === Cell.BEDROCK) return 'bedrock';
  return 'none';
}
