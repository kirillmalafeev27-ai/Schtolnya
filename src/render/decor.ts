// Декор, вычисляемый из топологии уровня (план, 7.5.1 и 7.5.9): крепь, фонари, рельсы, лужи.
// Детерминирован по сиду уровня.

import { balance } from '../config/balance';
import { Cell, cx, cy, Grid, idx, inBounds, manhattan } from '../core/grid';
import { mulberry32 } from '../shared/comicKit';

export interface Post {
  cell: number;
  /** Сторона клетки, у стены которой стоит стойка. */
  side: 'n' | 'w' | 'e';
}

export interface Lantern {
  cell: number;
  side: Post['side'];
  /** Фаза покачивания и мерцания. */
  phase: number;
}

export interface Rail {
  cell: number;
  dir: 'h' | 'v';
  /** Начало и конец участка: на концах рельсы обрываются шпалой. */
  start: boolean;
  end: boolean;
}

export interface Decor {
  posts: Post[];
  lanterns: Lantern[];
  rails: Rail[];
  puddles: number[];
  /** Варианты текстур блоков по клеткам. */
  variants: Uint8Array;
}

const isFloorLike = (g: Grid, x: number, y: number) =>
  inBounds(g, x, y) && g.cells[idx(g, x, y)] !== Cell.BEDROCK && g.cells[idx(g, x, y)] !== Cell.LIFT;
const isBed = (g: Grid, x: number, y: number) => !inBounds(g, x, y) || g.cells[idx(g, x, y)] === Cell.BEDROCK;

export function buildDecor(g: Grid, seed: number, avoid: { lift: number; lairs: number[] }): Decor {
  const rnd = mulberry32(seed ^ 0xdec0);
  const n = g.w * g.h;
  const variants = new Uint8Array(n);
  for (let i = 0; i < n; i++) variants[i] = Math.floor(rnd() * 251);

  // Рельсы: прямые участки проходов длиной от 3 клеток (по проходам и завалам — завал лёг поверх рельсов).
  const rails: Rail[] = [];
  const railMask = new Uint8Array(n);
  const scan = (horizontal: boolean) => {
    const outer = horizontal ? g.h : g.w;
    const inner = horizontal ? g.w : g.h;
    for (let o = 1; o < outer - 1; o++) {
      let runStart = -1;
      for (let k = 0; k <= inner; k++) {
        const x = horizontal ? k : o;
        const y = horizontal ? o : k;
        const corridor =
          k < inner &&
          isFloorLike(g, x, y) &&
          (horizontal ? isBed(g, x, y - 1) && isBed(g, x, y + 1) : isBed(g, x - 1, y) && isBed(g, x + 1, y));
        if (corridor && runStart < 0) runStart = k;
        if (!corridor && runStart >= 0) {
          const len = k - runStart;
          if (len >= 3) {
            for (let j = runStart; j < k; j++) {
              const cell = horizontal ? idx(g, j, o) : idx(g, o, j);
              if (railMask[cell]) continue;
              railMask[cell] = 1;
              rails.push({ cell, dir: horizontal ? 'h' : 'v', start: j === runStart, end: j === k - 1 });
            }
          }
          runStart = -1;
        }
      }
    }
  };
  scan(true);
  scan(false);

  // Крепь: стойки у стен вдоль проходов примерно через каждые 3 клетки.
  const posts: Post[] = [];
  const every = balance.art.timberEvery;
  const near = (cell: number) => posts.some((p) => manhattan(g, p.cell, cell) < every);
  const order: number[] = [];
  for (let i = 0; i < n; i++) if (isFloorLike(g, cx(g, i), cy(g, i))) order.push(i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const cell of order) {
    if (cell === avoid.lift + g.w || avoid.lairs.includes(cell)) continue;
    const x = cx(g, cell);
    const y = cy(g, cell);
    if (near(cell)) continue;
    // Стойка видна у северной стены (на её лицевой грани) или у боковой стены вертикального прохода.
    if (isBed(g, x, y - 1) && y - 1 > 0) posts.push({ cell, side: 'n' });
    else if (isBed(g, x - 1, y) && isBed(g, x + 1, y)) posts.push({ cell, side: rnd() < 0.5 ? 'w' : 'e' });
  }

  // Фонари: на 4–6 стойках, разнесённых подальше друг от друга и от ствола со светом дня.
  const L = balance.light.lanterns;
  const want = L.minCount + Math.floor(rnd() * (L.maxCount - L.minCount + 1));
  const lanterns: Lantern[] = [];
  const candidates = posts.filter((p) => manhattan(g, p.cell, avoid.lift) > 2);
  while (lanterns.length < want && candidates.length) {
    let best = -1;
    let bestScore = -Infinity;
    for (let k = 0; k < candidates.length; k++) {
      const c = candidates[k].cell;
      let dmin = manhattan(g, c, avoid.lift) * 0.8;
      for (const l of lanterns) dmin = Math.min(dmin, manhattan(g, c, l.cell));
      const score = dmin + rnd() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    }
    const [p] = candidates.splice(best, 1);
    lanterns.push({ cell: p.cell, side: p.side, phase: rnd() * Math.PI * 2 });
  }

  // Лужицы: изредка на проходах без рельсов.
  const puddles: number[] = [];
  for (const cell of order) {
    if (puddles.length >= 3) break;
    if (!railMask[cell] && g.cells[cell] === Cell.FLOOR && rnd() < 0.12) puddles.push(cell);
  }

  return { posts, lanterns, rails, puddles, variants };
}
