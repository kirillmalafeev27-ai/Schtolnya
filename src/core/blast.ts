// Крест взрыва (план, 2.3.6 и 13.3.6). Единственная функция расчёта креста:
// её используют превью, логика взрыва и отрисовка пламени.

import { Grid, isWalkable, neighbor } from './grid';

export interface BlastCross {
  origin: number;
  /** Все клетки креста: сначала центр, затем лучи вверх, влево, вниз, вправо. */
  cells: number[];
  /** Длина каждого луча (0..range) в порядке DIRS — для пламени. */
  rays: [number, number, number, number];
}

/**
 * Клетки креста от шашки в `origin`. Центр входит всегда. Лучи идут на `range` клеток
 * только по проходам; любая непроходимая клетка гасит луч и сама не повреждается.
 */
export function blastCross(g: Grid, origin: number, range: number): BlastCross {
  const cells = [origin];
  const rays: [number, number, number, number] = [0, 0, 0, 0];
  for (let d = 0; d < 4; d++) {
    let c = origin;
    for (let k = 1; k <= range; k++) {
      c = neighbor(g, c, d);
      if (c < 0 || !isWalkable(g, c)) break;
      cells.push(c);
      rays[d] = k;
    }
  }
  return { origin, cells, rays };
}

export function blastCells(g: Grid, origin: number, range: number): number[] {
  return blastCross(g, origin, range).cells;
}
