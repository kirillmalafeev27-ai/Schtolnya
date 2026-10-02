// Разрушимая порода (7.5.3–7.5.6): тёплые бугристые кучи с меловыми метками.
// Порода — куча камней с крестом; крепкая — крупные валуны с кварцем и двойным крестом;
// треснувшая — свежие трещины; жила — золотые прожилки и звезда; карман — золото в трещине.

import { palette as P } from '../../config/palette';
import {
  blob,
  celShade,
  contactShadow,
  glint,
  ink,
  pathFrom,
  rr,
  type Pt,
  type Shape,
} from '../../shared/comicKit';
import type { Recipe } from '../ArtFactory';
import { adjust, withAlpha } from '../color';
import { chalkOnPile, drawPile, inkW, pebbles, type Stone } from './common';

/** Раскладки куч: камни в долях клетки от верха канвы (канва 1 × 1.25 клетки). */
const PILES: Stone[][] = [
  [
    { x: 0.3, y: 0.36, rx: 0.22, ry: 0.17 },
    { x: 0.68, y: 0.33, rx: 0.24, ry: 0.19 },
    { x: 0.2, y: 0.66, rx: 0.19, ry: 0.17 },
    { x: 0.52, y: 0.58, rx: 0.27, ry: 0.21 },
    { x: 0.83, y: 0.68, rx: 0.16, ry: 0.15 },
    { x: 0.35, y: 0.93, rx: 0.27, ry: 0.2 },
    { x: 0.72, y: 0.96, rx: 0.24, ry: 0.19 },
  ],
  [
    { x: 0.5, y: 0.32, rx: 0.3, ry: 0.2 },
    { x: 0.18, y: 0.55, rx: 0.17, ry: 0.16 },
    { x: 0.8, y: 0.56, rx: 0.19, ry: 0.17 },
    { x: 0.48, y: 0.64, rx: 0.24, ry: 0.19 },
    { x: 0.28, y: 0.95, rx: 0.24, ry: 0.19 },
    { x: 0.64, y: 0.93, rx: 0.25, ry: 0.2 },
    { x: 0.88, y: 1.02, rx: 0.11, ry: 0.1 },
  ],
  [
    { x: 0.36, y: 0.34, rx: 0.27, ry: 0.19 },
    { x: 0.76, y: 0.42, rx: 0.2, ry: 0.17 },
    { x: 0.24, y: 0.68, rx: 0.21, ry: 0.18 },
    { x: 0.6, y: 0.66, rx: 0.25, ry: 0.2 },
    { x: 0.45, y: 0.96, rx: 0.3, ry: 0.2 },
    { x: 0.84, y: 0.95, rx: 0.14, ry: 0.14 },
    { x: 0.12, y: 1.0, rx: 0.1, ry: 0.09 },
  ],
  [
    { x: 0.62, y: 0.33, rx: 0.26, ry: 0.19 },
    { x: 0.24, y: 0.42, rx: 0.2, ry: 0.17 },
    { x: 0.45, y: 0.62, rx: 0.3, ry: 0.21 },
    { x: 0.84, y: 0.68, rx: 0.15, ry: 0.15 },
    { x: 0.3, y: 0.95, rx: 0.25, ry: 0.19 },
    { x: 0.7, y: 0.97, rx: 0.25, ry: 0.19 },
  ],
];

const rockTones = (rng: () => number) => ({
  base: adjust(P.rock.base, rr(rng, -0.02, 0.02), rr(rng, -3, 3)),
  light: P.rock.light,
  shadow: P.rock.shadow,
});

function shadowUnder(ctx: CanvasRenderingContext2D, w: number, h: number, cell: number): void {
  contactShadow(ctx, w / 2, h - cell * 0.1, w * 0.47, cell * 0.11);
}

export const rock: Recipe = (ctx, w, h, cell, variant, rng) => {
  shadowUnder(ctx, w, h, cell);
  drawPile(ctx, { tones: rockTones(rng), stones: PILES[variant % PILES.length], cell, rng, cracks: 2 });
  pebbles(ctx, rng, cell, rockTones(rng), 1.14, 3);
  chalkOnPile(ctx, rng, cell, 'x', 0.5, 0.82, 0.42);
};

/** Порода со свежими трещинами — бывшая крепкая после первого взрыва. */
export const rockCracked: Recipe = (ctx, w, h, cell, variant, rng) => {
  shadowUnder(ctx, w, h, cell);
  const tones = { base: P.hardRock.base, light: P.hardRock.light, shadow: P.hardRock.shadow };
  drawPile(ctx, {
    tones,
    stones: PILES[(variant + 1) % PILES.length],
    cell,
    rng,
    cracks: 6,
    freshCracks: true,
  });
  pebbles(ctx, rng, cell, tones, 1.14, 4);
  chalkOnPile(ctx, rng, cell, 'x', 0.5, 0.82, 0.42);
};

/** Кварцевая прожилка по валуну. */
function quartzVein(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  s: Shape,
  cell: number,
  a: Pt,
  b: Pt,
): void {
  const pts: Pt[] = [a];
  const n = 5;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push({
      x: a.x + (b.x - a.x) * t + rr(rng, -0.04, 0.04) * cell,
      y: a.y + (b.y - a.y) * t + rr(rng, -0.05, 0.05) * cell,
    });
  }
  pts.push(b);
  ctx.save();
  ctx.clip(s.path);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const p = pathFrom(pts, false);
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = cell * 0.06;
  ctx.stroke(p);
  ctx.strokeStyle = P.hardRock.quartz;
  ctx.lineWidth = cell * 0.036;
  ctx.stroke(p);
  ctx.strokeStyle = P.panel;
  ctx.lineWidth = cell * 0.012;
  ctx.stroke(p);
  ctx.restore();
}

export const hard: Recipe = (ctx, w, h, cell, variant, rng) => {
  shadowUnder(ctx, w, h, cell);
  const tones = {
    base: adjust(P.hardRock.base, rr(rng, -0.015, 0.015)),
    light: P.hardRock.light,
    shadow: P.hardRock.shadow,
  };
  const layouts: Stone[][] = [
    [
      { x: 0.62, y: 0.42, rx: 0.36, ry: 0.28 },
      { x: 0.36, y: 0.84, rx: 0.37, ry: 0.28 },
      { x: 0.86, y: 0.98, rx: 0.13, ry: 0.12 },
    ],
    [
      { x: 0.38, y: 0.4, rx: 0.34, ry: 0.27 },
      { x: 0.66, y: 0.82, rx: 0.36, ry: 0.29 },
      { x: 0.14, y: 0.98, rx: 0.12, ry: 0.11 },
    ],
    [
      { x: 0.5, y: 0.38, rx: 0.4, ry: 0.27 },
      { x: 0.5, y: 0.84, rx: 0.42, ry: 0.28 },
    ],
  ];
  const shapes = drawPile(ctx, {
    tones,
    stones: layouts[variant % layouts.length],
    cell,
    rng,
    cracks: 1,
    jitter: 0.08,
    n: 9,
    inkScale: 0.72,
  });
  // Белые кварцевые прожилки.
  for (const s of shapes) {
    const b = s.pts.reduce(
      (acc, p) => ({
        x0: Math.min(acc.x0, p.x),
        x1: Math.max(acc.x1, p.x),
        y0: Math.min(acc.y0, p.y),
        y1: Math.max(acc.y1, p.y),
      }),
      { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity },
    );
    if (b.x1 - b.x0 < cell * 0.4) continue;
    quartzVein(
      ctx,
      rng,
      s,
      cell,
      { x: b.x0, y: b.y0 + (b.y1 - b.y0) * rr(rng, 0.3, 0.6) },
      { x: b.x1, y: b.y0 + (b.y1 - b.y0) * rr(rng, 0.2, 0.7) },
    );
    if (rng() < 0.6)
      quartzVein(
        ctx,
        rng,
        s,
        cell,
        { x: b.x0 + (b.x1 - b.x0) * 0.3, y: b.y0 },
        { x: b.x0 + (b.x1 - b.x0) * 0.55, y: b.y1 },
      );
    ink(ctx, s.path, inkW(cell) * 0.32);
  }
  chalkOnPile(ctx, rng, cell, 'xx', 0.5, 0.8, 0.4);
};

/** Золотая прожилка: толстая, с гравировкой и бликами. */
function goldVein(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  clip: Path2D,
  cell: number,
  a: Pt,
  b: Pt,
  wd: number,
): void {
  const pts: Pt[] = [a];
  const n = 4;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push({
      x: a.x + (b.x - a.x) * t + rr(rng, -0.05, 0.05) * cell,
      y: a.y + (b.y - a.y) * t + rr(rng, -0.07, 0.07) * cell,
    });
  }
  pts.push(b);
  const p = pathFrom(pts, false);
  ctx.save();
  ctx.clip(clip);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = wd + cell * 0.04;
  ctx.stroke(p);
  ctx.strokeStyle = P.gold.shadow;
  ctx.lineWidth = wd;
  ctx.stroke(p);
  ctx.translate(-wd * 0.18, -wd * 0.18);
  ctx.strokeStyle = P.gold.base;
  ctx.lineWidth = wd * 0.66;
  ctx.stroke(p);
  ctx.strokeStyle = P.gold.light;
  ctx.lineWidth = wd * 0.22;
  ctx.stroke(p);
  ctx.restore();
}

export const vein: Recipe = (ctx, w, h, cell, variant, rng) => {
  // Слабое свечение вокруг — жила светится (7.5.5).
  const g = ctx.createRadialGradient(w / 2, h * 0.6, 0, w / 2, h * 0.6, w * 0.6);
  g.addColorStop(0, withAlpha(P.gold.light, 0.35));
  g.addColorStop(1, withAlpha(P.gold.light, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  shadowUnder(ctx, w, h, cell);
  const shapes = drawPile(ctx, {
    tones: rockTones(rng),
    stones: PILES[(variant + 2) % PILES.length],
    cell,
    rng,
    cracks: 1,
  });
  const all = new Path2D();
  for (const s of shapes) all.addPath(s.path);
  goldVein(
    ctx,
    rng,
    all,
    cell,
    { x: 0.02 * cell, y: 0.5 * cell },
    { x: 0.98 * cell, y: 0.78 * cell },
    cell * 0.1,
  );
  goldVein(
    ctx,
    rng,
    all,
    cell,
    { x: 0.3 * cell, y: 0.15 * cell },
    { x: 0.62 * cell, y: 1.1 * cell },
    cell * 0.075,
  );
  goldVein(
    ctx,
    rng,
    all,
    cell,
    { x: 0.7 * cell, y: 0.2 * cell },
    { x: 0.95 * cell, y: 0.45 * cell },
    cell * 0.06,
  );
  for (const s of shapes) ink(ctx, s.path, inkW(cell) * 0.26);
  // Самородки, торчащие из камня.
  for (let i = 0; i < 3; i++) {
    const x = rr(rng, 0.2, 0.8) * cell;
    const y = rr(rng, 0.35, 0.95) * cell;
    const r = cell * rr(rng, 0.045, 0.07);
    const sh = blob(rng, x, y, r, r * 0.8, { n: 6, jitter: 0.25, smooth: 1 });
    celShade(ctx, sh, { base: P.gold.base, light: P.gold.light, shadow: P.gold.shadow }, r * 0.5);
    ink(ctx, sh.path, inkW(cell) * 0.4);
  }
  chalkOnPile(ctx, rng, cell, 'star', 0.5, 0.78, 0.46);
  glint(ctx, 0.3 * cell, 0.5 * cell, cell * 0.08);
  glint(ctx, 0.74 * cell, 0.82 * cell, cell * 0.065);
  glint(ctx, 0.56 * cell, 0.3 * cell, cell * 0.05);
};

export const pocket: Recipe = (ctx, w, h, cell, variant, rng) => {
  shadowUnder(ctx, w, h, cell);
  const shapes = drawPile(ctx, {
    tones: rockTones(rng),
    stones: PILES[(variant + 3) % PILES.length],
    cell,
    rng,
    cracks: 1,
  });
  // Тёмная трещина с золотыми крупинками внутри.
  const front = shapes[shapes.length - 1];
  ctx.save();
  ctx.clip(front.path);
  const cx = 0.6 * cell;
  const cy = 0.72 * cell;
  const crackPts: Pt[] = [
    { x: cx - cell * 0.16, y: cy - cell * 0.1 },
    { x: cx - cell * 0.04, y: cy - cell * 0.02 },
    { x: cx + cell * 0.02, y: cy + cell * 0.08 },
    { x: cx + cell * 0.14, y: cy + cell * 0.12 },
  ];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = cell * 0.075;
  ctx.stroke(pathFrom(crackPts, false));
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const p = crackPts[1 + (i % 2)];
    ctx.fillStyle = P.gold.base;
    ctx.beginPath();
    ctx.arc(p.x + rr(rng, -4, 4), p.y + rr(rng, -3, 3), cell * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
  pebbles(ctx, rng, cell, rockTones(rng), 1.14, 2);
  chalkOnPile(ctx, rng, cell, 'x', 0.38, 0.82, 0.38);
};

/** Золотая искра в трещине кармана (вспыхивает раз в 3–5 с). */
export const pocketSpark: Recipe = (ctx, w, h) => {
  glint(ctx, w / 2, h / 2, w * 0.48, P.gold.light);
  glint(ctx, w / 2, h / 2, w * 0.24, P.panel);
};
