// Общие приёмы рецептов: толщина туши, кучи камней, блоки в ракурсе «три четверти».

import { balance } from '../../config/balance';
import { palette as P } from '../../config/palette';
import {
  blob,
  celShade,
  chalkMark,
  crack,
  ink,
  inkBehind,
  rr,
  type Shape,
  type Tones,
} from '../../shared/comicKit';

/** Толщина контура — около 7% размера клетки (9 px при 128). */
export const inkW = (cell: number): number => cell * balance.art.inkFrac;
/** Для мелких деталей персонажей — тоньше, чтобы не забивать заливку. */
export const inkThin = (cell: number): number => cell * 0.045;

export interface Stone {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface PileOpts {
  tones: Tones;
  /** Камни в долях клетки (от верха канвы). */
  stones: Stone[];
  cell: number;
  rng: () => number;
  /** Число трещин. */
  cracks?: number;
  /** Свежие трещины со светлой кромкой. */
  freshCracks?: boolean;
  jitter?: number;
  smooth?: number;
  n?: number;
  /** Масштаб толщины туши для камней кучи. */
  inkScale?: number;
}

/**
 * Куча камней (несколько blob друг на друге), сзади вперёд. Общий силуэт — жирной тушью под заливкой,
 * границы между камнями — тонкой линией. Возвращает формы камней.
 */
export function drawPile(ctx: CanvasRenderingContext2D, o: PileOpts): Shape[] {
  const C = o.cell;
  const w = inkW(C) * (o.inkScale ?? 0.62);
  const shapes: Shape[] = [];
  // Сортировка по y: задние рисуются первыми.
  const sorted = o.stones.slice().sort((a, b) => a.y + a.ry - (b.y + b.ry));
  for (const s of sorted) {
    shapes.push(
      blob(o.rng, s.x * C, s.y * C, s.rx * C, s.ry * C, {
        n: o.n ?? 8,
        jitter: o.jitter ?? 0.16,
        smooth: o.smooth ?? 2,
        flatBottom: 0.25,
      }),
    );
  }
  // Общий силуэт кучи.
  for (const sh of shapes) inkBehind(ctx, sh.path, w);
  sorted.forEach((s, i) => {
    const sh = shapes[i];
    const k = Math.max(s.rx, s.ry) * C * 0.42;
    celShade(ctx, sh, o.tones, k, { dots: true, hatch: s.ry > 0.18, dotAlpha: 0.32 });
    ink(ctx, sh.path, w * 0.42);
  });
  const nCracks = o.cracks ?? 2;
  for (let i = 0; i < nCracks && shapes.length; i++) {
    const idx = Math.floor(o.rng() * sorted.length);
    const s = sorted[idx];
    const sh = shapes[idx];
    ctx.save();
    ctx.clip(sh.path);
    const from = { x: (s.x + rr(o.rng, -0.3, 0.1) * s.rx) * C, y: (s.y - s.ry * 0.6) * C };
    const ang = Math.PI / 2 + rr(o.rng, -0.5, 0.5);
    if (o.freshCracks)
      crack(ctx, o.rng, { x: from.x + 1.5, y: from.y + 1.5 }, s.ry * C * 1.4, ang, w * 0.7, o.tones.light);
    crack(ctx, o.rng, from, s.ry * C * 1.4, ang, w * 0.42);
    ctx.restore();
  }
  return shapes;
}

/** Меловая метка «можно взрывать» по центру фронта кучи. */
export function chalkOnPile(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  cell: number,
  kind: 'x' | 'xx' | 'star',
  cx = 0.5,
  cy = 0.86,
  size = 0.4,
): void {
  chalkMark(ctx, rng, cx * cell, cy * cell, size * cell, kind, P.chalk, cell * 0.042);
}

/** Мелкие камешки у подножия кучи. */
export function pebbles(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  cell: number,
  tones: Tones,
  y: number,
  n = 3,
): void {
  for (let i = 0; i < n; i++) {
    const x = rr(rng, 0.1, 0.9) * cell;
    const r = rr(rng, 0.04, 0.07) * cell;
    const sh = blob(rng, x, y * cell + rr(rng, -0.03, 0.03) * cell, r, r * 0.75, { n: 6, jitter: 0.2 });
    inkBehind(ctx, sh.path, r * 0.28);
    celShade(ctx, sh, tones, r * 0.5);
  }
}
