// Сетка шахты (план, 2.1). Клетки хранятся в Uint8Array, индекс клетки i = y * w + x.

export const Cell = {
  FLOOR: 0, // проход
  ROCK: 1, // порода: одна шашка
  HARD: 2, // крепкая порода: две шашки
  BEDROCK: 3, // скала: неразрушима
  VEIN: 4, // жила: одна шашка, под ней главный самородок
  POCKET: 5, // золотой карман: одна шашка, под ним малый самородок
  LIFT: 6, // подъёмник: старт и выход
} as const;

export type CellType = (typeof Cell)[keyof typeof Cell];

export interface Grid {
  readonly w: number;
  readonly h: number;
  readonly cells: Uint8Array;
  /** Порода, которая была крепкой и треснула от первого взрыва (только для картинки). */
  readonly cracked: Uint8Array;
}

/** Направления в фиксированном порядке: вверх, влево, вниз, вправо (2.4.3). */
export const DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 0],
];

export function createGrid(w: number, h: number, fill: CellType = Cell.BEDROCK): Grid {
  const cells = new Uint8Array(w * h);
  cells.fill(fill);
  return { w, h, cells, cracked: new Uint8Array(w * h) };
}

export function cloneGrid(g: Grid): Grid {
  return { w: g.w, h: g.h, cells: g.cells.slice(), cracked: g.cracked.slice() };
}

export const idx = (g: Grid, x: number, y: number): number => y * g.w + x;
export const cx = (g: Grid, i: number): number => i % g.w;
export const cy = (g: Grid, i: number): number => (i / g.w) | 0;

export function inBounds(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.w && y < g.h;
}

export function isBorder(g: Grid, i: number): boolean {
  const x = cx(g, i);
  const y = cy(g, i);
  return x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1;
}

/** Соседи по 4 сторонам в порядке DIRS; за пределами сетки — -1. */
export function neighbor(g: Grid, i: number, dir: number): number {
  const x = cx(g, i) + DIRS[dir][0];
  const y = cy(g, i) + DIRS[dir][1];
  return inBounds(g, x, y) ? y * g.w + x : -1;
}

export function neighbors(g: Grid, i: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < 4; d++) {
    const n = neighbor(g, i, d);
    if (n >= 0) out.push(n);
  }
  return out;
}

export function isWalkable(g: Grid, i: number): boolean {
  return g.cells[i] === Cell.FLOOR;
}

export function isDestructible(t: number): boolean {
  return t === Cell.ROCK || t === Cell.HARD || t === Cell.VEIN || t === Cell.POCKET;
}

/** Сколько шашек нужно, чтобы превратить клетку в проход (для 0-1 BFS, 5.8). */
export function blastCost(t: number): number {
  switch (t) {
    case Cell.FLOOR:
      return 0;
    case Cell.ROCK:
    case Cell.VEIN:
    case Cell.POCKET:
      return 1;
    case Cell.HARD:
      return 2;
    default:
      return Infinity;
  }
}

export function manhattan(g: Grid, a: number, b: number): number {
  return Math.abs(cx(g, a) - cx(g, b)) + Math.abs(cy(g, a) - cy(g, b));
}

export function isAdjacent(g: Grid, a: number, b: number): boolean {
  return manhattan(g, a, b) === 1;
}

/** Направление от a к соседней b (индекс в DIRS) или -1. */
export function dirTo(g: Grid, a: number, b: number): number {
  const dx = cx(g, b) - cx(g, a);
  const dy = cy(g, b) - cy(g, a);
  for (let d = 0; d < 4; d++) if (DIRS[d][0] === dx && DIRS[d][1] === dy) return d;
  return -1;
}
