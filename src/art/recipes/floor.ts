// Пол (7.5.1): утоптанная земля с каменной крошкой. Тон клетки гуляет на ±6%, оттенок — на ±4°.
// Сетка читается по швам пола: тёмная кромка снизу справа, светлая — сверху слева.

import { palette as P } from '../../config/palette';
import { blob, celShade, facetBlob, halftone, inkBehind, rr } from '../../shared/comicKit';
import type { Recipe } from '../ArtFactory';
import { adjust, withAlpha } from '../color';

export const floor: Recipe = (ctx, w, h, cell, variant, rng) => {
  const dl = rr(rng, -0.06, 0.06) * 0.6;
  const dh = rr(rng, -4, 4);
  const base = adjust(P.floor.base, dl, dh);
  const light = adjust(P.floor.light, dl, dh);
  const shadow = adjust(P.floor.shadow, dl, dh);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Пятна утоптанной земли.
  for (let i = 0; i < 6; i++) {
    const sh = blob(rng, rr(rng, 0, w), rr(rng, 0, h), rr(rng, 0.12, 0.3) * cell, rr(rng, 0.08, 0.2) * cell, {
      n: 7,
      jitter: 0.3,
    });
    ctx.fillStyle = withAlpha(i % 2 ? light : shadow, 0.22);
    ctx.fill(sh.path);
  }

  // Шов: кромки плитки.
  const sw = Math.max(2, cell * 0.035);
  ctx.fillStyle = withAlpha(shadow, 0.95);
  ctx.fillRect(0, h - sw, w, sw);
  ctx.fillRect(w - sw, 0, sw, h);
  ctx.fillStyle = withAlpha(P.ink, 0.35);
  ctx.fillRect(0, h - sw * 0.45, w, sw * 0.45);
  ctx.fillRect(w - sw * 0.45, 0, sw * 0.45, h);
  ctx.fillStyle = withAlpha(light, 0.45);
  ctx.fillRect(0, 0, w, sw * 0.7);
  ctx.fillRect(0, 0, sw * 0.7, h);

  // Растр в нижнем правом углу — пол ниже по свету.
  ctx.save();
  const corner = new Path2D();
  corner.moveTo(w, h * 0.35);
  corner.lineTo(w, h);
  corner.lineTo(w * 0.35, h);
  corner.closePath();
  ctx.clip(corner);
  halftone(ctx, { x: 0, y: 0, w, h }, P.ink, cell * 0.075, 0.2, cell * 0.018, 0.22);
  ctx.restore();

  // Каменная крошка.
  const n = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const x = rr(rng, 0.08, 0.92) * w;
    const y = rr(rng, 0.08, 0.92) * h;
    const r = rr(rng, 0.025, 0.06) * cell;
    const sh = facetBlob(rng, x, y, r, r * 0.72, 6, 0.25);
    inkBehind(ctx, sh.path, Math.max(1, r * 0.22));
    celShade(
      ctx,
      sh,
      { base: P.floor.pebble, light: adjust(P.floor.pebble, 0.12), shadow: shadow },
      r * 0.55,
    );
  }
  // Мелкий гравий точками.
  ctx.fillStyle = withAlpha(P.ink, 0.45);
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.arc(rr(rng, 0, w), rr(rng, 0, h), rr(rng, 0.6, 1.4) * (cell / 128), 0, Math.PI * 2);
    ctx.fill();
  }
  // Изредка трещинка в земле.
  if (variant % 3 === 0) {
    ctx.strokeStyle = withAlpha(P.ink, 0.5);
    ctx.lineWidth = Math.max(1, cell * 0.012);
    ctx.lineCap = 'round';
    ctx.beginPath();
    let x = rr(rng, 0.2, 0.5) * w;
    let y = rr(rng, 0.3, 0.7) * h;
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += rr(rng, 0.06, 0.12) * w;
      y += rr(rng, -0.08, 0.08) * h;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
};

/** Фон за стенами: темнота, дальние балки, редкие друзы (слой 0). */
export const backdrop: Recipe = (ctx, w, h, cell, _v, rng) => {
  ctx.fillStyle = P.caveDeep;
  ctx.fillRect(0, 0, w, h);
  // Дальние балки — едва видны.
  ctx.strokeStyle = withAlpha(P.timber.shadow, 0.35);
  ctx.lineWidth = cell * 0.09;
  for (let i = 0; i < 2; i++) {
    const x = rr(rng, 0.1, 0.9) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + rr(rng, -0.05, 0.05) * w, h);
    ctx.stroke();
  }
  // Растр темноты.
  halftone(ctx, { x: 0, y: 0, w, h }, P.ambient, cell * 0.12, cell * 0.012, cell * 0.03, 0.6);
  // Редкая друза вдалеке.
  ctx.fillStyle = withAlpha(P.crystalDecor, 0.18);
  const x = rr(rng, 0.2, 0.8) * w;
  const y = rr(rng, 0.2, 0.8) * h;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * cell * 0.05, y);
    ctx.lineTo(x + k * cell * 0.05 + cell * 0.03, y - cell * (0.12 + k * 0.03));
    ctx.lineTo(x + k * cell * 0.05 + cell * 0.06, y);
    ctx.fill();
  }
};
