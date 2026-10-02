// Герой (7.5.12): искатель сокровищ в белой каске с налобным фонарём. Сборка из частей.
// Все части смотрят вправо; влево герой разворачивается отражением контейнера.

import { palette as P } from '../../config/palette';
import {
  blob,
  celShade,
  glint,
  ink,
  inkBehind,
  pathFrom,
  roundRect,
  rr,
  type Pt,
  type Shape,
} from '../../shared/comicKit';
import type { Recipe } from '../ArtFactory';
import { adjust, mix, withAlpha } from '../color';
import { inkW } from './common';

const H = P.hero;
const skinTones = { base: H.skin, light: adjust(H.skin, 0.08), shadow: adjust(H.skin, -0.14, -6) };
const shirtTones = { base: H.shirt, light: P.panel, shadow: adjust(H.shirt, -0.16, -10) };
const pantsTones = { base: H.pants, light: adjust(H.pants, 0.12), shadow: adjust(H.pants, -0.12) };
const bootTones = { base: H.boots, light: adjust(H.boots, 0.12), shadow: adjust(H.boots, -0.08) };
const helmetTones = { base: H.helmet, light: P.panel, shadow: adjust(H.helmet, -0.18, 20) };
const hairTones = { base: P.timber.shadow, light: P.timber.base, shadow: mix(P.timber.shadow, P.ink, 0.4) };
const scarfTones = { base: H.scarf, light: adjust(H.scarf, 0.14), shadow: adjust(H.scarf, -0.14) };

const iwOf = (cell: number) => inkW(cell) * 0.55;

function shape(pts: Pt[]): Shape {
  return { pts, path: pathFrom(pts) };
}

/** Голова: лицо, глаза, каска с налобным фонарём. Варианты: 0 обычная, 1 тревога, 2 закопчённая, 3 радость. */
export const heroHead: Recipe = (ctx, w, h, cell, variant, rng) => {
  const iw = iwOf(cell);
  const cx = w * 0.47;
  const faceY = h * 0.6;
  const sooty = variant === 2;
  const skin = sooty
    ? { base: P.scorch, light: mix(P.scorch, P.floor.light, 0.4), shadow: P.ink }
    : skinTones;

  // Волосы сзади (видны из-под каски).
  const hair = blob(rng, w * 0.26, h * 0.56, w * 0.17, h * 0.18, { n: 9, jitter: 0.3 });
  // Ухо.
  const ear = blob(rng, w * 0.3, h * 0.62, w * 0.075, h * 0.09, { n: 7, jitter: 0.1 });
  // Лицо.
  const face = blob(rng, cx, faceY, w * 0.31, h * 0.3, { n: 10, jitter: 0.04, flatBottom: 0.05 });
  // Каска: купол и козырёк.
  const dome = shape([
    { x: w * 0.16, y: h * 0.48 },
    { x: w * 0.2, y: h * 0.3 },
    { x: w * 0.34, y: h * 0.14 },
    { x: w * 0.52, y: h * 0.09 },
    { x: w * 0.7, y: h * 0.14 },
    { x: w * 0.82, y: h * 0.3 },
    { x: w * 0.84, y: h * 0.46 },
  ]);
  const domeSmooth = { pts: dome.pts, path: smoothPath(dome.pts) };
  const brim = roundRect(w * 0.1, h * 0.43, w * 0.86, h * 0.1, h * 0.05);

  for (const s of [hair.path, ear.path, face.path, domeSmooth.path, brim]) inkBehind(ctx, s, iw);
  celShade(ctx, hair, hairTones, w * 0.05);
  celShade(ctx, ear, skin, w * 0.03);
  celShade(ctx, face, skin, w * 0.07, { lightK: 0.6 });
  ink(ctx, ear.path, iw * 0.35);

  // Глаза, брови, нос, рот.
  const eyeY = h * 0.62;
  const eyes: { x: number; r: number }[] = [
    { x: w * 0.55, r: w * 0.08 },
    { x: w * 0.73, r: w * 0.065 },
  ];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (variant === 2) {
    // Глаза-крестики.
    ctx.strokeStyle = P.panel;
    ctx.lineWidth = w * 0.035;
    for (const e of eyes) {
      const r = e.r * 0.8;
      ctx.beginPath();
      ctx.moveTo(e.x - r, eyeY - r);
      ctx.lineTo(e.x + r, eyeY + r);
      ctx.moveTo(e.x + r, eyeY - r);
      ctx.lineTo(e.x - r, eyeY + r);
      ctx.stroke();
    }
  } else if (variant === 3) {
    // Радость: глаза-дуги.
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = w * 0.035;
    for (const e of eyes) {
      ctx.beginPath();
      ctx.arc(e.x, eyeY + e.r * 0.4, e.r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    for (const e of eyes) {
      const sclera = new Path2D();
      sclera.ellipse(e.x, eyeY, e.r * 0.82, e.r, 0, 0, Math.PI * 2);
      ctx.fillStyle = P.panel;
      ctx.fill(sclera);
      ink(ctx, sclera, iw * 0.35);
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.ellipse(e.x + e.r * 0.28, eyeY + e.r * 0.05, e.r * 0.42, e.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      glint(ctx, e.x + e.r * 0.12, eyeY - e.r * 0.25, e.r * 0.3);
    }
  }
  // Брови.
  ctx.strokeStyle = sooty ? P.panel : hairTones.shadow;
  ctx.lineWidth = w * 0.035;
  const worried = variant === 1;
  for (const e of eyes) {
    ctx.beginPath();
    const y0 = eyeY - e.r * 1.45;
    if (worried) {
      // Брови домиком.
      ctx.moveTo(e.x - e.r * 0.9, y0 + e.r * 0.15);
      ctx.lineTo(e.x + e.r * 0.8, y0 - e.r * 0.45);
    } else if (variant === 0) {
      ctx.moveTo(e.x - e.r * 0.9, y0 - e.r * 0.2);
      ctx.lineTo(e.x + e.r * 0.8, y0 + e.r * 0.05);
    } else {
      ctx.moveTo(e.x - e.r * 0.8, y0);
      ctx.quadraticCurveTo(e.x, y0 - e.r * 0.4, e.x + e.r * 0.8, y0);
    }
    ctx.stroke();
  }
  // Нос.
  const nose = blob(rng, w * 0.85, h * 0.68, w * 0.065, h * 0.06, { n: 7, jitter: 0.05 });
  inkBehind(ctx, nose.path, iw * 0.6);
  celShade(ctx, nose, skin, w * 0.02);
  // Рот.
  ctx.strokeStyle = sooty ? P.panel : P.ink;
  ctx.lineWidth = w * 0.03;
  ctx.beginPath();
  if (variant === 1) {
    ctx.ellipse(w * 0.66, h * 0.8, w * 0.035, h * 0.03, 0, 0, Math.PI * 2);
  } else if (variant === 3) {
    ctx.moveTo(w * 0.56, h * 0.76);
    ctx.quadraticCurveTo(w * 0.68, h * 0.88, w * 0.8, h * 0.76);
  } else {
    ctx.moveTo(w * 0.6, h * 0.79);
    ctx.quadraticCurveTo(w * 0.7, h * 0.83, w * 0.78, h * 0.77);
  }
  ctx.stroke();
  if (variant === 3) {
    ctx.fillStyle = P.panel;
    ctx.beginPath();
    ctx.moveTo(w * 0.58, h * 0.77);
    ctx.quadraticCurveTo(w * 0.68, h * 0.85, w * 0.78, h * 0.77);
    ctx.fill();
  }
  // Румянец.
  if (!sooty) {
    ctx.fillStyle = withAlpha(H.scarf, 0.25);
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.74, w * 0.06, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Каска поверх лба.
  const helmet = sooty
    ? { base: mix(H.helmet, P.scorch, 0.55), light: mix(P.panel, P.scorch, 0.4), shadow: P.scorch }
    : helmetTones;
  celShade(ctx, domeSmooth, helmet, w * 0.07, { lightK: 0.7 });
  ink(ctx, domeSmooth.path, iw * 0.35);
  ctx.fillStyle = helmet.shadow;
  ctx.fill(brim);
  ctx.fillStyle = helmet.base;
  ctx.fillRect(w * 0.12, h * 0.43, w * 0.82, h * 0.035);
  ink(ctx, brim, iw * 0.35);
  // Гребень каски.
  ctx.strokeStyle = withAlpha(P.ink, 0.5);
  ctx.lineWidth = w * 0.025;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.2);
  ctx.quadraticCurveTo(w * 0.5, h * 0.06, w * 0.72, h * 0.2);
  ctx.stroke();
  // Налобный фонарь.
  const lampX = w * 0.82;
  const lampY = h * 0.31;
  const rim = new Path2D();
  rim.ellipse(lampX, lampY, w * 0.1, h * 0.105, 0, 0, Math.PI * 2);
  inkBehind(ctx, rim, iw * 0.7);
  ctx.fillStyle = P.metal.base;
  ctx.fill(rim);
  const glass = new Path2D();
  glass.ellipse(lampX + w * 0.015, lampY, w * 0.07, h * 0.075, 0, 0, Math.PI * 2);
  ctx.fillStyle = sooty ? P.metal.shadow : H.lamp;
  ctx.fill(glass);
  if (!sooty) glint(ctx, lampX - w * 0.01, lampY - h * 0.025, w * 0.045);
  if (!sooty) glint(ctx, w * 0.36, h * 0.22, w * 0.06);
  // Дым из волос у закопчённого.
  if (sooty) {
    ctx.fillStyle = withAlpha(P.blast.smoke, 0.85);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w * (0.18 + i * 0.05), h * (0.42 - i * 0.12), w * (0.05 + i * 0.015), 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

function smoothPath(pts: Pt[]): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    p.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  p.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  p.closePath();
  return p;
}

/** Туловище: рубашка с воротом, подтяжки, ремень с пряжкой. */
export const heroBody: Recipe = (ctx, w, h, cell, _v, rng) => {
  const iw = iwOf(cell);
  const torso = shape([
    { x: w * 0.2, y: h * 0.22 },
    { x: w * 0.36, y: h * 0.12 },
    { x: w * 0.64, y: h * 0.12 },
    { x: w * 0.8, y: h * 0.22 },
    { x: w * 0.78, y: h * 0.88 },
    { x: w * 0.22, y: h * 0.88 },
  ]);
  const t = { pts: torso.pts, path: smoothPath(torso.pts) };
  inkBehind(ctx, t.path, iw);
  celShade(ctx, t, shirtTones, w * 0.08, { dots: true, dotAlpha: 0.22 });
  ctx.save();
  ctx.clip(t.path);
  // Подтяжки.
  ctx.strokeStyle = H.pants;
  ctx.lineWidth = w * 0.07;
  for (const sx of [0.38, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(w * sx, h * 0.1);
    ctx.lineTo(w * (sx + (sx < 0.5 ? 0.02 : -0.02)), h * 0.78);
    ctx.stroke();
  }
  // Ворот.
  ctx.fillStyle = shirtTones.shadow;
  ctx.beginPath();
  ctx.moveTo(w * 0.4, h * 0.12);
  ctx.lineTo(w * 0.5, h * 0.3);
  ctx.lineTo(w * 0.6, h * 0.12);
  ctx.fill();
  // Складки.
  ctx.strokeStyle = withAlpha(P.ink, 0.35);
  ctx.lineWidth = w * 0.02;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.5);
  ctx.quadraticCurveTo(w * 0.34, h * 0.58, w * 0.3, h * 0.68);
  ctx.stroke();
  ctx.restore();
  ink(ctx, t.path, iw * 0.35);
  // Ремень.
  const belt = roundRect(w * 0.18, h * 0.74, w * 0.64, h * 0.16, h * 0.04);
  inkBehind(ctx, belt, iw * 0.7);
  ctx.fillStyle = H.belt;
  ctx.fill(belt);
  ctx.fillStyle = withAlpha(P.panel, 0.18);
  ctx.fillRect(w * 0.2, h * 0.75, w * 0.6, h * 0.035);
  const buckle = roundRect(w * 0.44, h * 0.745, w * 0.13, h * 0.13, h * 0.02);
  ctx.fillStyle = P.metal.light;
  ctx.fill(buckle);
  ink(ctx, buckle, iw * 0.35);
  void rng;
};

/** Шарф: оранжевый хвост, развевается назад. */
export const heroScarf: Recipe = (ctx, w, h, cell) => {
  const iw = iwOf(cell) * 0.8;
  const pts: Pt[] = [
    { x: w * 0.95, y: h * 0.25 },
    { x: w * 0.6, y: h * 0.18 },
    { x: w * 0.3, y: h * 0.36 },
    { x: w * 0.06, y: h * 0.3 },
    { x: w * 0.18, y: h * 0.62 },
    { x: w * 0.42, y: h * 0.7 },
    { x: w * 0.7, y: h * 0.56 },
    { x: w * 0.95, y: h * 0.7 },
  ];
  const s = { pts, path: smoothPath(pts) };
  inkBehind(ctx, s.path, iw);
  celShade(ctx, s, scarfTones, h * 0.12);
  ctx.strokeStyle = withAlpha(P.ink, 0.4);
  ctx.lineWidth = Math.max(1, h * 0.04);
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.42);
  ctx.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.82, h * 0.42);
  ctx.stroke();
};

/** Рука: рукав и кисть. */
export const heroArm: Recipe = (ctx, w, h, cell) => {
  const iw = iwOf(cell) * 0.8;
  const sleeve = roundRect(w * 0.14, h * 0.04, w * 0.72, h * 0.6, w * 0.3);
  const hand = new Path2D();
  hand.ellipse(w * 0.5, h * 0.76, w * 0.34, h * 0.17, 0, 0, Math.PI * 2);
  inkBehind(ctx, sleeve, iw);
  inkBehind(ctx, hand, iw);
  ctx.fillStyle = shirtTones.base;
  ctx.fill(sleeve);
  ctx.fillStyle = shirtTones.shadow;
  ctx.fillRect(w * 0.55, h * 0.04, w * 0.3, h * 0.58);
  ctx.fillStyle = skinTones.base;
  ctx.fill(hand);
  ctx.fillStyle = skinTones.shadow;
  ctx.beginPath();
  ctx.ellipse(w * 0.6, h * 0.8, w * 0.2, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Закатанный рукав.
  ctx.fillStyle = shirtTones.light;
  ctx.fillRect(w * 0.14, h * 0.5, w * 0.72, h * 0.08);
  ink(ctx, sleeve, iw * 0.35);
};

/** Нога: штанина и сапог. */
export const heroLeg: Recipe = (ctx, w, h, cell) => {
  const iw = iwOf(cell) * 0.8;
  const leg = roundRect(w * 0.16, 0, w * 0.68, h * 0.66, w * 0.12);
  const boot = new Path2D();
  boot.moveTo(w * 0.12, h * 0.55);
  boot.lineTo(w * 0.84, h * 0.55);
  boot.lineTo(w * 0.86, h * 0.8);
  boot.quadraticCurveTo(w * 1.0, h * 0.84, w * 0.98, h * 0.96);
  boot.lineTo(w * 0.08, h * 0.96);
  boot.closePath();
  inkBehind(ctx, leg, iw);
  inkBehind(ctx, boot, iw);
  ctx.fillStyle = pantsTones.base;
  ctx.fill(leg);
  ctx.fillStyle = pantsTones.shadow;
  ctx.fillRect(w * 0.55, 0, w * 0.3, h * 0.6);
  ctx.fillStyle = bootTones.base;
  ctx.fill(boot);
  ctx.fillStyle = bootTones.light;
  ctx.fillRect(w * 0.18, h * 0.58, w * 0.5, h * 0.06);
  ctx.fillStyle = P.ink;
  ctx.fillRect(w * 0.08, h * 0.9, w * 0.9, h * 0.06);
};

/** Мешочек для самородка: пустой — тусклый, с главным самородком — светится золотом. */
export const heroPouch: Recipe = (ctx, w, h, cell, variant, rng) => {
  const iw = iwOf(cell) * 0.7;
  if (variant === 1) {
    const g = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, w / 2);
    g.addColorStop(0, withAlpha(P.gold.light, 0.85));
    g.addColorStop(1, withAlpha(P.gold.light, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const bag = blob(rng, w / 2, h * 0.6, w * 0.3, h * 0.28, { n: 8, jitter: 0.08, flatBottom: 0.1 });
  inkBehind(ctx, bag.path, iw);
  celShade(
    ctx,
    bag,
    variant === 1
      ? { base: P.timber.light, light: adjust(P.timber.light, 0.12), shadow: P.timber.base }
      : { base: P.timber.base, light: P.timber.light, shadow: P.timber.shadow },
    w * 0.07,
  );
  // Завязка.
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = w * 0.06;
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.36);
  ctx.lineTo(w * 0.68, h * 0.36);
  ctx.stroke();
  if (variant === 1) {
    const nug = blob(rng, w * 0.5, h * 0.3, w * 0.16, h * 0.12, { n: 6, jitter: 0.2, smooth: 1 });
    inkBehind(ctx, nug.path, iw * 0.6);
    celShade(ctx, nug, { base: P.gold.base, light: P.gold.light, shadow: P.gold.shadow }, w * 0.05);
    glint(ctx, w * 0.44, h * 0.26, w * 0.12);
    glint(ctx, w * 0.78, h * 0.5, w * 0.08);
  }
};

/** Шашка на поясе. */
export const heroBeltStick: Recipe = (ctx, w, h, cell) => {
  const iw = iwOf(cell) * 0.5;
  const body = roundRect(w * 0.15, h * 0.08, w * 0.7, h * 0.84, w * 0.25);
  inkBehind(ctx, body, iw);
  ctx.fillStyle = P.dynamite.base;
  ctx.fill(body);
  ctx.fillStyle = P.dynamite.label;
  ctx.fillRect(w * 0.15, h * 0.4, w * 0.7, h * 0.18);
  ctx.fillStyle = P.dynamite.light;
  ctx.fillRect(w * 0.28, h * 0.12, w * 0.14, h * 0.26);
  void rr;
};

/** Призрак героя на месте закладки (слой 5). */
export const ghost: Recipe = (ctx, w, h, cell) => {
  const iw = inkW(cell) * 0.4;
  const body = new Path2D();
  body.moveTo(w * 0.24, h * 0.94);
  body.lineTo(w * 0.28, h * 0.46);
  body.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.72, h * 0.46);
  body.lineTo(w * 0.76, h * 0.94);
  body.closePath();
  const head = new Path2D();
  head.ellipse(w * 0.5, h * 0.3, w * 0.27, h * 0.16, 0, 0, Math.PI * 2);
  const helmet = new Path2D();
  helmet.ellipse(w * 0.5, h * 0.2, w * 0.3, h * 0.1, 0, Math.PI, 0);
  helmet.closePath();
  ctx.save();
  ctx.globalAlpha = 0.62;
  for (const p of [body, head, helmet]) {
    ctx.fillStyle = P.panel;
    ctx.fill(p);
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([iw * 1.4, iw * 1.1]);
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = iw;
  ctx.lineCap = 'round';
  for (const p of [body, head, helmet]) ctx.stroke(p);
  ctx.restore();
  void mix;
};
