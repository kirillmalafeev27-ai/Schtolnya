// Реквизит шахты: подъёмник и свет из ствола (7.5.7), логово (7.5.8), крепь и фонари (7.5.9),
// шашка (7.5.10), самородки, тени, копоть и обломки.

import { palette as P } from '../../config/palette';
import {
  blob,
  celShade,
  contactShadow,
  facetBlob,
  glint,
  halftone,
  ink,
  inkBehind,
  pathFrom,
  roundRect,
  rr,
  wobble,
  type Pt,
  type Shape,
} from '../../shared/comicKit';
import type { Recipe } from '../ArtFactory';
import { adjust, mix, withAlpha } from '../color';
import { inkW } from './common';

const timberTones = { base: P.timber.base, light: P.timber.light, shadow: P.timber.shadow };
const metalTones = { base: P.metal.base, light: P.metal.light, shadow: P.metal.shadow };
const goldTones = { base: P.gold.base, light: P.gold.light, shadow: P.gold.shadow };

/** Брус: прямоугольник с древесными волокнами и дрожащей линией. */
function beam(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  x: number,
  y: number,
  w: number,
  h: number,
  iw: number,
  tones = timberTones,
): Shape {
  const pts = wobble(
    [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    Math.min(w, h) * 0.03 + 0.6,
    rng,
    true,
    Math.max(6, Math.min(w, h) * 0.6),
  );
  const sh = { pts, path: pathFrom(pts) };
  inkBehind(ctx, sh.path, iw);
  celShade(ctx, sh, tones, Math.min(w, h) * 0.22);
  // Волокна вдоль длинной стороны.
  ctx.save();
  ctx.clip(sh.path);
  ctx.strokeStyle = withAlpha(P.ink, 0.38);
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.05);
  ctx.lineCap = 'round';
  const vertical = h > w;
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    if (vertical) {
      const gx = x + w * rr(rng, 0.25, 0.75);
      const y0 = y + h * rr(rng, 0, 0.3);
      ctx.moveTo(gx, y0);
      ctx.quadraticCurveTo(
        gx + rr(rng, -2, 2),
        y0 + h * 0.3,
        gx + rr(rng, -1, 1),
        y0 + h * rr(rng, 0.4, 0.7),
      );
    } else {
      const gy = y + h * rr(rng, 0.25, 0.75);
      const x0 = x + w * rr(rng, 0, 0.3);
      ctx.moveTo(x0, gy);
      ctx.quadraticCurveTo(
        x0 + w * 0.3,
        gy + rr(rng, -2, 2),
        x0 + w * rr(rng, 0.4, 0.7),
        gy + rr(rng, -1, 1),
      );
    }
    ctx.stroke();
  }
  // Сучок.
  if (rng() < 0.5) {
    const kx = x + w * rr(rng, 0.3, 0.7);
    const ky = y + h * rr(rng, 0.3, 0.7);
    ctx.beginPath();
    ctx.ellipse(
      kx,
      ky,
      Math.min(w, h) * 0.12,
      Math.min(w, h) * 0.08,
      vertical ? Math.PI / 2 : 0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();
  ink(ctx, sh.path, iw * 0.35);
  return sh;
}

// ───────────── подъёмник ─────────────

/** Деревянная клеть: канаты уходят вверх за кадр, колесо блока, колокол (7.5.7). */
export const lift: Recipe = (ctx, w, h, cell, _v, rng) => {
  const C = cell;
  const iw = inkW(C) * 0.6;
  const cx = w / 2;
  const cageTop = h - C * 1.08;
  const cageBot = h - C * 0.06;
  const cageW = C * 0.92;
  const x0 = cx - cageW / 2;
  // Канаты — вверх за кадр.
  ctx.save();
  ctx.lineCap = 'round';
  for (const rx of [cx - C * 0.22, cx + C * 0.22]) {
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = C * 0.06;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, cageTop + C * 0.1);
    ctx.stroke();
    ctx.strokeStyle = P.rope;
    ctx.lineWidth = C * 0.03;
    ctx.stroke();
    // Витки каната.
    ctx.strokeStyle = withAlpha(P.ink, 0.5);
    ctx.lineWidth = 1.5;
    for (let y = 4; y < cageTop; y += C * 0.07) {
      ctx.beginPath();
      ctx.moveTo(rx - C * 0.014, y);
      ctx.lineTo(rx + C * 0.014, y + C * 0.03);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Колесо блока высоко над клетью.
  const wy = h - C * 1.86;
  const wheel = new Path2D();
  wheel.arc(cx, wy, C * 0.24, 0, Math.PI * 2);
  inkBehind(ctx, wheel, iw);
  ctx.fillStyle = P.metal.base;
  ctx.fill(wheel);
  ctx.save();
  ctx.clip(wheel);
  ctx.fillStyle = P.metal.shadow;
  ctx.beginPath();
  ctx.arc(cx + C * 0.04, wy + C * 0.04, C * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.metal.base;
  ctx.beginPath();
  ctx.arc(cx - C * 0.02, wy - C * 0.02, C * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = C * 0.03;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(cx, wy);
    ctx.lineTo(cx + Math.cos(a) * C * 0.2, wy + Math.sin(a) * C * 0.2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, wy, C * 0.055, 0, Math.PI * 2);
  ctx.fillStyle = P.metal.light;
  ctx.fill();
  ink(ctx, wheel, iw * 0.4);

  // Клеть: задняя стенка, стойки, перекладины.
  const back = roundRect(
    x0 + C * 0.06,
    cageTop + C * 0.06,
    cageW - C * 0.12,
    cageBot - cageTop - C * 0.12,
    C * 0.03,
  );
  ctx.fillStyle = mix(P.timber.shadow, P.ink, 0.45);
  ctx.fill(back);
  ctx.save();
  ctx.clip(back);
  halftone(ctx, { x: x0, y: cageTop, w: cageW, h: cageBot - cageTop }, P.ink, C * 0.07, 0.6, C * 0.02, 0.5);
  ctx.restore();
  // Крыша клети.
  beam(ctx, rng, x0 - C * 0.04, cageTop - C * 0.02, cageW + C * 0.08, C * 0.13, iw);
  // Пол клети.
  beam(ctx, rng, x0 - C * 0.03, cageBot - C * 0.14, cageW + C * 0.06, C * 0.14, iw);
  // Стойки.
  for (const sx of [x0, x0 + cageW - C * 0.11])
    beam(ctx, rng, sx, cageTop + C * 0.06, C * 0.11, cageBot - cageTop - C * 0.18, iw);
  // Перекладины-решётка.
  for (const yy of [0.36, 0.62])
    beam(ctx, rng, x0 + C * 0.09, cageTop + (cageBot - cageTop) * yy, cageW - C * 0.18, C * 0.07, iw * 0.8);
  // Колокол сбоку.
  const bx = x0 + cageW + C * 0.06;
  const by = cageTop + C * 0.16;
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = C * 0.025;
  ctx.beginPath();
  ctx.moveTo(x0 + cageW - C * 0.02, cageTop + C * 0.04);
  ctx.lineTo(bx, by - C * 0.08);
  ctx.stroke();
  const bell: Pt[] = [
    { x: bx - C * 0.07, y: by + C * 0.1 },
    { x: bx - C * 0.05, y: by - C * 0.02 },
    { x: bx, y: by - C * 0.08 },
    { x: bx + C * 0.05, y: by - C * 0.02 },
    { x: bx + C * 0.07, y: by + C * 0.1 },
  ];
  const bellSh = { pts: bell, path: pathFrom(bell) };
  inkBehind(ctx, bellSh.path, iw * 0.6);
  celShade(ctx, bellSh, metalTones, C * 0.03);
  glint(ctx, bx - C * 0.02, by + C * 0.01, C * 0.03);
};

/** Передняя перекладина клети — рисуется поверх героя в клети. */
export const liftFront: Recipe = (ctx, w, h, cell, _v, rng) => {
  const C = cell;
  const iw = inkW(C) * 0.6;
  const x0 = w / 2 - C * 0.46;
  beam(ctx, rng, x0, h - C * 0.3, C * 0.92, C * 0.08, iw * 0.8);
};

/** Свет из ствола: тёплый конус ступенями, как в комиксе — самое яркое место уровня. */
export const daylight: Recipe = (ctx, w, h) => {
  const bands = [
    { k: 1.0, a: 0.16 },
    { k: 0.72, a: 0.2 },
    { k: 0.44, a: 0.26 },
  ];
  for (const b of bands) {
    const topW = w * 0.22 * b.k;
    const botW = w * 0.5 * b.k;
    ctx.fillStyle = withAlpha(P.daylight, b.a);
    ctx.beginPath();
    ctx.moveTo(w / 2 - topW, 0);
    ctx.lineTo(w / 2 + topW, 0);
    ctx.lineTo(w / 2 + botW, h);
    ctx.lineTo(w / 2 - botW, h);
    ctx.closePath();
    ctx.fill();
  }
  // Пылинки в луче.
  const rng = (() => {
    let s = 7;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  })();
  ctx.fillStyle = withAlpha(P.daylight, 0.8);
  for (let i = 0; i < 22; i++) {
    const t = rng();
    const y = t * h;
    const spread = (w * 0.22 + (w * 0.28 * y) / h) * 0.8;
    ctx.beginPath();
    ctx.arc(w / 2 + (rng() * 2 - 1) * spread, y, 1 + rng() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Пятно света на полу.
  ctx.fillStyle = withAlpha(P.daylight, 0.22);
  ctx.beginPath();
  ctx.ellipse(w / 2, h - w * 0.08, w * 0.42, w * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
};

// ───────────── логово ─────────────

/** Гнездо из соломы и хлама (7.5.8). */
export const lair: Recipe = (ctx, w, h, cell, _v, rng) => {
  const C = cell;
  const iw = inkW(C) * 0.5;
  const cx = w / 2;
  const cy = h * 0.6;
  // Подложка гнезда.
  const nest = blob(rng, cx, cy, w * 0.44, h * 0.3, { n: 10, jitter: 0.12 });
  inkBehind(ctx, nest.path, iw);
  celShade(ctx, nest, { base: P.straw.base, light: P.straw.light, shadow: P.straw.shadow }, C * 0.06, {
    dots: true,
    dotAlpha: 0.3,
  });
  // Углубление.
  const hole = blob(rng, cx, cy - h * 0.02, w * 0.28, h * 0.15, { n: 8, jitter: 0.1 });
  ctx.fillStyle = mix(P.straw.shadow, P.ink, 0.45);
  ctx.fill(hole.path);
  // Соломинки.
  ctx.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const a = rr(rng, 0, Math.PI * 2);
    const r0 = rr(rng, 0.62, 1.02);
    const x = cx + Math.cos(a) * w * 0.4 * r0;
    const y = cy + Math.sin(a) * h * 0.27 * r0;
    const len = C * rr(rng, 0.08, 0.18);
    const da = a + Math.PI / 2 + rr(rng, -0.6, 0.6);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = C * 0.022;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(da) * len, y + Math.sin(da) * len * 0.6);
    ctx.stroke();
    ctx.strokeStyle = i % 3 ? P.straw.light : P.straw.base;
    ctx.lineWidth = C * 0.011;
    ctx.stroke();
  }
  // Хлам: обломок доски и ржавая кружка.
  ctx.save();
  ctx.translate(cx + w * 0.28, cy + h * 0.12);
  ctx.rotate(-0.4);
  beam(ctx, rng, -C * 0.14, -C * 0.03, C * 0.28, C * 0.06, iw * 0.7);
  ctx.restore();
  const cup = roundRect(cx - w * 0.38, cy + h * 0.02, C * 0.1, C * 0.09, C * 0.02);
  inkBehind(ctx, cup, iw * 0.6);
  ctx.fillStyle = P.metal.base;
  ctx.fill(cup);
};

/** Светящийся бирюзовый гриб. */
export const mushroom: Recipe = (ctx, w, h, cell, variant, rng) => {
  const C = cell;
  const iw = inkW(C) * 0.35;
  const cx = w / 2 + rr(rng, -2, 2);
  const stemH = h * (0.42 + variant * 0.06);
  const stem = roundRect(cx - w * 0.1, h - stemH, w * 0.2, stemH - h * 0.04, w * 0.08);
  inkBehind(ctx, stem, iw);
  ctx.fillStyle = mix(P.chalk, P.mushroom, 0.25);
  ctx.fill(stem);
  const cap = new Path2D();
  const capY = h - stemH + h * 0.04;
  cap.moveTo(cx - w * 0.42, capY);
  cap.quadraticCurveTo(cx - w * 0.38, capY - h * 0.5, cx, capY - h * 0.52);
  cap.quadraticCurveTo(cx + w * 0.38, capY - h * 0.5, cx + w * 0.42, capY);
  cap.closePath();
  inkBehind(ctx, cap, iw);
  ctx.fillStyle = P.mushroom;
  ctx.fill(cap);
  ctx.save();
  ctx.clip(cap);
  ctx.fillStyle = adjust(P.mushroom, -0.22);
  ctx.fillRect(cx, capY - h * 0.6, w, h);
  ctx.fillStyle = adjust(P.mushroom, 0.2);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(
      cx + rr(rng, -0.25, 0.15) * w,
      capY - h * rr(rng, 0.18, 0.38),
      w * rr(rng, 0.05, 0.09),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
  glint(ctx, cx - w * 0.14, capY - h * 0.32, w * 0.09);
};

// ───────────── крепь и фонари ─────────────

/** Деревянная стойка крепи у стены: толстый столб с шапкой-подушкой. */
export const timberPost: Recipe = (ctx, w, h, cell, _v, rng) => {
  const iw = inkW(cell) * 0.5;
  const pw = w * 0.62;
  beam(ctx, rng, (w - pw) / 2, h * 0.12, pw, h * 0.86, iw);
  // Шапка стойки (подушка под кровлю).
  beam(ctx, rng, w * 0.04, h * 0.03, w * 0.92, h * 0.12, iw * 0.8);
};

export const timberBeam: Recipe = (ctx, w, h, cell, _v, rng) => {
  beam(ctx, rng, 2, 2, w - 4, h - 4, inkW(cell) * 0.5);
};

/** Шахтёрский фонарь: крюк, металлическая рамка, стекло со светом и язычок пламени. */
export const lantern: Recipe = (ctx, w, h, cell, _v, rng) => {
  const C = cell;
  const iw = inkW(C) * 0.42;
  const cx = w / 2;
  // Ручка-крюк.
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = C * 0.03;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, h * 0.17, w * 0.2, Math.PI, 0);
  ctx.stroke();
  // Колпак.
  const capPts: Pt[] = [
    { x: cx - w * 0.3, y: h * 0.3 },
    { x: cx, y: h * 0.12 },
    { x: cx + w * 0.3, y: h * 0.3 },
  ];
  const cap = { pts: capPts, path: pathFrom(capPts) };
  inkBehind(ctx, cap.path, iw);
  celShade(ctx, cap, metalTones, C * 0.02);
  // Стекло со светом.
  const glass = roundRect(cx - w * 0.27, h * 0.3, w * 0.54, h * 0.48, w * 0.08);
  inkBehind(ctx, glass, iw);
  ctx.fillStyle = P.lantern;
  ctx.fill(glass);
  ctx.save();
  ctx.clip(glass);
  ctx.fillStyle = withAlpha(P.flame.inner, 0.9);
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.56, w * 0.2, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Язычок пламени.
  const flame = new Path2D();
  flame.moveTo(cx, h * 0.38);
  flame.quadraticCurveTo(cx + w * 0.12, h * 0.55, cx, h * 0.64);
  flame.quadraticCurveTo(cx - w * 0.12, h * 0.55, cx, h * 0.38);
  ctx.fillStyle = P.flame.core;
  ctx.fill(flame);
  // Прутья рамки.
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = C * 0.018;
  for (const fx of [-0.14, 0.14]) {
    ctx.beginPath();
    ctx.moveTo(cx + fx * w, h * 0.3);
    ctx.lineTo(cx + fx * w, h * 0.78);
    ctx.stroke();
  }
  // Дно.
  const bottom = roundRect(cx - w * 0.32, h * 0.76, w * 0.64, h * 0.1, w * 0.04);
  inkBehind(ctx, bottom, iw);
  ctx.fillStyle = P.metal.base;
  ctx.fill(bottom);
  glint(ctx, cx - w * 0.14, h * 0.4, w * 0.1);
  void rng;
};

// ───────────── динамит и добыча ─────────────

/** Шашка: красный цилиндр со светлой бумажной полосой, контур тушью, кусочек фитиля. */
function stick(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  len: number,
  rad: number,
  angle: number,
  iw: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const body = roundRect(-len / 2, -rad, len, rad * 2, rad * 0.55);
  inkBehind(ctx, body, iw);
  ctx.fillStyle = P.dynamite.base;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = P.dynamite.shadow;
  ctx.fillRect(-len / 2, rad * 0.35, len, rad);
  ctx.fillStyle = P.dynamite.light;
  ctx.fillRect(-len / 2 + rad * 0.4, -rad * 0.65, len - rad * 0.8, rad * 0.32);
  // Бумажная полоса.
  ctx.fillStyle = P.dynamite.label;
  ctx.fillRect(-len * 0.16, -rad, len * 0.32, rad * 2);
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = iw * 0.4;
  ctx.strokeRect(-len * 0.16, -rad - 2, len * 0.32, rad * 2 + 4);
  ctx.restore();
  ink(ctx, body, iw * 0.35);
  // Фитиль.
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = rad * 0.35;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(len / 2, 0);
  ctx.quadraticCurveTo(len / 2 + rad * 1.2, -rad * 0.4, len / 2 + rad * 1.4, -rad * 1.4);
  ctx.stroke();
  ctx.strokeStyle = P.rope;
  ctx.lineWidth = rad * 0.16;
  ctx.stroke();
  ctx.restore();
}

/** Запасная шашка на полу — с глинтом. */
export const stickItem: Recipe = (ctx, w, h, cell) => {
  const iw = inkW(cell) * 0.42;
  stick(ctx, w * 0.46, h * 0.55, w * 0.62, w * 0.13, -0.5, iw);
  glint(ctx, w * 0.3, h * 0.42, w * 0.1);
};

/** Шашка, торчащая из грани породы: видно торец с запалом. */
export const dynPlanted: Recipe = (ctx, w, h, cell) => {
  const iw = inkW(cell) * 0.42;
  stick(ctx, w * 0.5, h * 0.5, w * 0.62, w * 0.16, -Math.PI / 2 + 0.25, iw);
};

/** Искра фитиля: бело-жёлтая звезда. */
export const fuseSpark: Recipe = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, withAlpha(P.fuseSpark, 0.9));
  g.addColorStop(1, withAlpha(P.fuseSpark, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  glint(ctx, w / 2, h / 2, w * 0.46, P.fuseSpark);
  glint(ctx, w / 2, h / 2, w * 0.22, P.panel);
};

function nugget(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  w: number,
  h: number,
  cell: number,
  big: boolean,
): void {
  const iw = inkW(cell) * (big ? 0.5 : 0.4);
  const sh = facetBlob(rng, w / 2, h * 0.55, w * 0.38, h * 0.34, big ? 8 : 7, 0.2);
  inkBehind(ctx, sh.path, iw);
  celShade(ctx, sh, goldTones, w * 0.12, { lightK: 0.7 });
  // Гравировка граней.
  ctx.save();
  ctx.clip(sh.path);
  ctx.strokeStyle = P.gold.engrave;
  ctx.lineWidth = Math.max(1.2, w * 0.025);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const c = { x: w * 0.48, y: h * 0.52 };
  for (let i = 0; i < sh.pts.length; i += 2) {
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(sh.pts[i].x, sh.pts[i].y);
  }
  ctx.stroke();
  ctx.restore();
  ink(ctx, sh.path, iw * 0.35);
  glint(ctx, w * 0.36, h * 0.38, w * (big ? 0.16 : 0.14));
  if (big) glint(ctx, w * 0.66, h * 0.66, w * 0.08);
}

export const nuggetBig: Recipe = (ctx, w, h, cell, _v, rng) => nugget(ctx, rng, w, h, cell, true);
export const nuggetSmall: Recipe = (ctx, w, h, cell, _v, rng) => nugget(ctx, rng, w, h, cell, false);

// ───────────── тени, копоть, обломки ─────────────

/** Контактная тень: эллипс цвета туши 35% с растром (7.5.16). */
export const shadow: Recipe = (ctx, w, h) => {
  contactShadow(ctx, w / 2, h / 2, w * 0.46, h * 0.42);
};

/** Пятно копоти после взрыва. */
export const scorch: Recipe = (ctx, w, h, cell, _v, rng) => {
  const sh = blob(rng, w / 2, h / 2, w * 0.44, h * 0.4, { n: 12, jitter: 0.25 });
  ctx.save();
  ctx.fillStyle = withAlpha(P.scorch, 0.75);
  ctx.fill(sh.path);
  ctx.clip(sh.path);
  halftone(ctx, { x: 0, y: 0, w, h }, P.ink, cell * 0.06, cell * 0.012, cell * 0.024, 0.55);
  ctx.restore();
  // Лучи копоти.
  ctx.strokeStyle = withAlpha(P.scorch, 0.6);
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rr(rng, -0.2, 0.2);
    ctx.lineWidth = cell * rr(rng, 0.02, 0.04);
    ctx.beginPath();
    ctx.moveTo(w / 2 + Math.cos(a) * w * 0.3, h / 2 + Math.sin(a) * h * 0.28);
    ctx.lineTo(w / 2 + Math.cos(a) * w * 0.49, h / 2 + Math.sin(a) * h * 0.47);
    ctx.stroke();
  }
};

/** Обломок породы на полу после взрыва. */
export const rubble: Recipe = (ctx, w, h, cell, variant, rng) => {
  const tones =
    variant % 2
      ? { base: P.rock.base, light: P.rock.light, shadow: P.rock.shadow }
      : { base: P.hardRock.base, light: P.hardRock.light, shadow: P.hardRock.shadow };
  const sh = facetBlob(rng, w / 2, h / 2, w * 0.38, h * 0.34, 6, 0.25);
  inkBehind(ctx, sh.path, inkW(cell) * 0.25);
  celShade(ctx, sh, tones, w * 0.14);
};
