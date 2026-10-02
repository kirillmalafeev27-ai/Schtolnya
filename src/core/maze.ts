// Лабиринт штолен (план, 5.2–5.3): узлы — клетки с нечётными координатами,
// рекурсивный бэктрекер соединяет соседние узлы через клетку между ними.

import { Cell, createGrid, Grid, idx } from './grid';
import type { Rng } from './rng';

const STEPS: readonly (readonly [number, number])[] = [
  [0, -2],
  [-2, 0],
  [0, 2],
  [2, 0],
];

export function carveMaze(w: number, h: number, rng: Rng): Grid {
  const g = createGrid(w, h, Cell.BEDROCK);
  const nodesX = (w - 1) / 2;
  const nodesY = (h - 1) / 2;
  const visited = new Uint8Array(w * h);
  const sx = 1 + 2 * rng.int(0, nodesX - 1);
  const sy = 1 + 2 * rng.int(0, nodesY - 1);
  const stack: [number, number][] = [[sx, sy]];
  visited[idx(g, sx, sy)] = 1;
  g.cells[idx(g, sx, sy)] = Cell.FLOOR;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options: [number, number][] = [];
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 1 || ny < 1 || nx > w - 2 || ny > h - 2) continue;
      if (visited[idx(g, nx, ny)]) continue;
      options.push([nx, ny]);
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [nx, ny] = rng.pick(options);
    visited[idx(g, nx, ny)] = 1;
    g.cells[idx(g, nx, ny)] = Cell.FLOOR;
    g.cells[idx(g, (x + nx) / 2, (y + ny) / 2)] = Cell.FLOOR;
    stack.push([nx, ny]);
  }
  return g;
}

/** Внутренние стенки между двумя соседними узлами (кандидаты в петли и срезки). */
export function wallsBetweenNodes(g: Grid): number[] {
  const out: number[] = [];
  for (let y = 1; y < g.h - 1; y++) {
    for (let x = 1; x < g.w - 1; x++) {
      const horizontal = x % 2 === 0 && y % 2 === 1;
      const vertical = x % 2 === 1 && y % 2 === 0;
      if (horizontal || vertical) out.push(idx(g, x, y));
    }
  }
  return out;
}

/** Петли: доля `fraction` стенок между двумя проходами превращается в проходы (5.3). */
export function addLoops(g: Grid, rng: Rng, fraction: number): number[] {
  const candidates = wallsBetweenNodes(g).filter((i) => {
    if (g.cells[i] !== Cell.BEDROCK) return false;
    const x = i % g.w;
    const y = (i / g.w) | 0;
    const horizontal = x % 2 === 0;
    const a = horizontal ? idx(g, x - 1, y) : idx(g, x, y - 1);
    const b = horizontal ? idx(g, x + 1, y) : idx(g, x, y + 1);
    return g.cells[a] === Cell.FLOOR && g.cells[b] === Cell.FLOOR;
  });
  rng.shuffle(candidates);
  const count = Math.round(candidates.length * fraction);
  // Петли стараются не съедать тупики: в тупиках живут кобольды и лежат запасные шашки.
  const isDeadEnd = (i: number) => {
    if (g.cells[i] !== Cell.FLOOR) return false;
    let n = 0;
    for (const [dx, dy] of STEPS) {
      const x = (i % g.w) + dx / 2;
      const y = ((i / g.w) | 0) + dy / 2;
      if (x >= 0 && y >= 0 && x < g.w && y < g.h && g.cells[idx(g, x, y)] === Cell.FLOOR) n++;
    }
    return n === 1;
  };
  const touchesDeadEnd = (i: number) => {
    const x = i % g.w;
    const y = (i / g.w) | 0;
    const horizontal = x % 2 === 0;
    const a = horizontal ? idx(g, x - 1, y) : idx(g, x, y - 1);
    const b = horizontal ? idx(g, x + 1, y) : idx(g, x, y + 1);
    return isDeadEnd(a) || isDeadEnd(b);
  };
  const free = candidates.filter((i) => !touchesDeadEnd(i));
  const guarded = candidates.filter((i) => touchesDeadEnd(i));
  const opened = [...free, ...guarded].slice(0, count);
  for (const i of opened) g.cells[i] = Cell.FLOOR;
  return opened;
}
