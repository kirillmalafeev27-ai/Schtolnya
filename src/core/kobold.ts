// Кобольд: путь к герою и подсказка о следующих шагах (план, 2.4).

import { Grid, isWalkable } from './grid';
import { bfsDist, nextStep } from './pathfinding';
import type { GameState, KoboldState } from './state';

/** Поле расстояний до героя по проходам: кобольду порода и скала непроходимы (2.4.2). */
export function koboldField(g: Grid, heroCell: number): Int32Array {
  return bfsDist(g, [heroCell], (i) => isWalkable(g, i));
}

/** Следующая клетка кобольда к герою; -1 — пути нет или он уже на месте. */
export function koboldNext(s: GameState, k: KoboldState, field = koboldField(s.grid, s.hero.cell)): number {
  return nextStep(s.grid, k.cell, field);
}

/** Следующие `n` шагов кобольда при неподвижном герое — для зелёных отпечатков лап (2.8.5). */
export function koboldPreview(s: GameState, k: KoboldState, n: number): number[] {
  if (k.mode === 'sleep') return [];
  const field = koboldField(s.grid, s.hero.cell);
  const out: number[] = [];
  let c = k.cell;
  for (let i = 0; i < n; i++) {
    const nx = nextStep(s.grid, c, field);
    if (nx < 0) break;
    out.push(nx);
    c = nx;
  }
  return out;
}

/** Путь кобольда до героя целиком (для отладки). */
export function koboldFullPath(s: GameState, k: KoboldState): number[] {
  return koboldPreview(s, k, s.grid.w * s.grid.h);
}

/** Расстояние по пути от героя до кобольда (для тревоги и звука); Infinity — недостижим. */
export function koboldPathDistance(s: GameState, k: KoboldState): number {
  const field = koboldField(s.grid, s.hero.cell);
  const d = field[k.cell];
  return d < 0 ? Infinity : d;
}
