// Взрыв и атмосфера (7.5.14): звезда, языки пламени, обломки, комиксный дым, искры, пыль.

import { palette as P } from '../../config/palette';
import {
  blob,
  celShade,
  explosion,
  facetBlob,
  glint,
  ink,
  inkBehind,
  smokePuff,
} from '../../shared/comicKit';
import type { Recipe } from '../ArtFactory';
import { adjust, withAlpha } from '../color';
import { inkW } from './common';

const B = P.blast;

/** Трёхслойная звезда взрыва: белое ядро, жёлтый слой, оранжево-красный край, контур тушью. */
export const boom: Recipe = (ctx, w, h, cell, _v, rng) => {
  const r = Math.min(w, h) / 2;
  explosion(
    ctx,
    rng,
    w / 2,
    h / 2,
    r * 0.5,
    r * 0.94,
    13,
    { core: B.core, inner: B.inner, mid: B.mid, outer: B.outer },
    inkW(cell) * 0.75,
  );
  // Белые искры-глинты в ядре.
  glint(ctx, w * 0.42, h * 0.42, r * 0.14);
  glint(ctx, w * 0.6, h * 0.56, r * 0.1);
};

/** Капля огня, вытянутая по направлению луча (кончик — наружу). */
function teardrop(cx: number, cy: number, len: number, rad: number): Path2D {
  const p = new Path2D();
  p.moveTo(cx + len * 0.62, cy);
  p.bezierCurveTo(
    cx + len * 0.2,
    cy - rad * 0.55,
    cx - len * 0.05,
    cy - rad,
    cx - len * 0.3,
    cy - rad * 0.55,
  );
  p.arc(cx - len * 0.3, cy, rad * 0.55, -Math.PI / 2, Math.PI / 2, true);
  p.bezierCurveTo(cx - len * 0.05, cy + rad, cx + len * 0.2, cy + rad * 0.55, cx + len * 0.62, cy);
  p.closePath();
  return p;
}

/**
 * Струя огня вдоль клетки (слева направо — наружу от центра взрыва): клубы-капли в три слоя,
 * общий контур тушью только по внешнему силуэту.
 */
function fireJet(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  len: number,
  thick: number,
  cell: number,
  tip: boolean,
): void {
  const iw = inkW(cell) * 0.5;
  const n = tip ? 3 : 4;
  const puffs: { x: number; y: number; l: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const shrink = tip ? 1 - t * 0.55 : 1;
    puffs.push({
      x: len * (0.1 + t * 0.8),
      y: (rng() - 0.5) * thick * 0.22,
      l: (len / n) * 1.9 * shrink,
      r: thick * (0.42 + rng() * 0.08) * shrink,
    });
  }
  const layer = (k: number, color: string, outline: boolean) => {
    const path = new Path2D();
    for (const p of puffs) path.addPath(teardrop(p.x, p.y, p.l * k, p.r * k));
    if (outline) {
      ctx.save();
      ctx.strokeStyle = P.ink;
      ctx.lineJoin = 'round';
      ctx.lineWidth = iw * 2;
      ctx.stroke(path);
      ctx.restore();
    }
    ctx.fillStyle = color;
    ctx.fill(path);
  };
  layer(1, B.outer, true);
  layer(0.78, B.mid, false);
  layer(0.55, B.inner, false);
  layer(0.28, B.core, false);
}

export const flameH: Recipe = (ctx, w, h, cell, _v, rng) => {
  ctx.save();
  ctx.translate(0, h / 2);
  fireJet(ctx, rng, w, h * 0.92, cell, false);
  ctx.restore();
};

export const flameV: Recipe = (ctx, w, h, cell, _v, rng) => {
  ctx.save();
  ctx.translate(w / 2, 0);
  ctx.rotate(Math.PI / 2);
  fireJet(ctx, rng, h, w * 0.92, cell, false);
  ctx.restore();
};

/** Кончик луча: струя сужается к концу (смотрит вправо, поворачивается по лучу). */
export const flameEnd: Recipe = (ctx, w, h, cell, _v, rng) => {
  ctx.save();
  ctx.translate(0, h / 2);
  fireJet(ctx, rng, w, h * 0.92, cell, true);
  ctx.restore();
};

/** Обломок породы с контуром. */
export const debris: Recipe = (ctx, w, h, cell, variant, rng) => {
  const tones =
    variant % 2
      ? { base: P.rock.base, light: P.rock.light, shadow: P.rock.shadow }
      : { base: P.hardRock.base, light: P.hardRock.light, shadow: P.hardRock.shadow };
  const s = facetBlob(rng, w / 2, h / 2, w * 0.36, h * 0.32, 5 + (variant % 3), 0.25);
  inkBehind(ctx, s.path, inkW(cell) * 0.3);
  celShade(ctx, s, tones, w * 0.14);
};

/** Комиксный дым: облако кругов, контур тушью, растр в тени. */
export const smoke: Recipe = (ctx, w, h, cell, _v, rng) => {
  smokePuff(
    ctx,
    rng,
    w / 2,
    h / 2,
    Math.min(w, h) * 0.36,
    { base: B.smoke, light: adjust(B.smoke, 0.14), shadow: adjust(B.smoke, -0.16, 10) },
    inkW(cell) * 0.4,
  );
};

/** Искра: маленькая яркая звезда. */
export const spark: Recipe = (ctx, w, h) => {
  glint(ctx, w / 2, h / 2, w * 0.48, P.fuseSpark);
  glint(ctx, w / 2, h / 2, w * 0.22, P.panel);
};

/** Пыль из-под сапог. */
export const dust: Recipe = (ctx, w, h, cell, _v, rng) => {
  const s = blob(rng, w / 2, h / 2, w * 0.36, h * 0.32, { n: 7, jitter: 0.2 });
  inkBehind(ctx, s.path, inkW(cell) * 0.18);
  ctx.fillStyle = P.floor.light;
  ctx.fill(s.path);
};

/** Мягкое свечение — для запасного пути без светового фильтра (8.5). */
export const glow: Recipe = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export const glowSoft: Recipe = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

/** Виньетка запасного пути: края затемнены текстурой (8.5). */
export const vignette: Recipe = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, withAlpha(P.caveDeep, 0));
  g.addColorStop(0.6, withAlpha(P.caveDeep, 0.35));
  g.addColorStop(1, withAlpha(P.caveDeep, 0.92));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

void ink;
