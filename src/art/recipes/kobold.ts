// Кобольд (7.5.13): приземистый горный дух — мшисто-зелёная кожа, крупный висячий нос,
// острые уши, маленькие светящиеся глаза, шапка с огарком свечи, драная жилетка.
// Зелёный — только кобольд.

import { palette as P } from '../../config/palette';
import {
  blob,
  celShade,
  glint,
  halftone,
  ink,
  inkBehind,
  pathFrom,
  rr,
  type Pt,
  type Shape,
} from '../../shared/comicKit';
import type { Recipe } from '../ArtFactory';
import { adjust, mix, withAlpha } from '../color';
import { inkW } from './common';

const K = P.kobold;
const skin = { base: K.skin, light: K.skinLight, shadow: K.skinShadow };
const vest = { base: K.vest, light: adjust(K.vest, 0.1), shadow: adjust(K.vest, -0.1) };
const cap = { base: K.cap, light: adjust(K.cap, 0.12), shadow: adjust(K.cap, -0.1) };
const iwOf = (cell: number) => inkW(cell) * 0.58;

function smooth(pts: Pt[]): Shape {
  const p = new Path2D();
  const n = pts.length;
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    p.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  p.closePath();
  return { pts, path: p };
}

function spots(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  clip: Path2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.save();
  ctx.clip(clip);
  ctx.fillStyle = withAlpha(K.skinShadow, 0.55);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(
      x + rr(rng, 0, w),
      y + rr(rng, 0, h),
      r * rr(rng, 0.5, 1),
      r * rr(rng, 0.4, 0.8),
      rr(rng, 0, 3),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

/** Туловище: круглый живот, драная жилетка с заплатой, короткие руки. */
export const koboldBody: Recipe = (ctx, w, h, cell, _v, rng) => {
  const iw = iwOf(cell);
  const belly = blob(rng, w * 0.5, h * 0.56, w * 0.36, h * 0.4, { n: 10, jitter: 0.05, flatBottom: 0.15 });
  const armL = blob(rng, w * 0.15, h * 0.6, w * 0.1, h * 0.22, { n: 7, jitter: 0.08, rot: 0.3 });
  const armR = blob(rng, w * 0.86, h * 0.58, w * 0.1, h * 0.22, { n: 7, jitter: 0.08, rot: -0.3 });
  for (const s of [armL, belly, armR]) inkBehind(ctx, s.path, iw);
  celShade(ctx, armL, skin, w * 0.04);
  celShade(ctx, belly, skin, w * 0.1, { dots: true, dotAlpha: 0.3 });
  spots(ctx, rng, belly.path, w * 0.2, h * 0.2, w * 0.6, h * 0.6, w * 0.04);
  // Жилетка с рваным краем.
  ctx.save();
  ctx.clip(belly.path);
  const vestPts: Pt[] = [{ x: 0, y: 0 }];
  for (let i = 0; i <= 8; i++) {
    const x = (i / 8) * w * 0.48;
    vestPts.push({ x, y: h * (0.82 + (i % 2 ? 0.08 : -0.02)) });
  }
  vestPts.push({ x: w * 0.48, y: h * 0.4 }, { x: w * 0.4, y: 0 });
  const vestL = { pts: vestPts, path: pathFrom(vestPts) };
  const vestR = {
    pts: vestPts.map((p) => ({ x: w - p.x, y: p.y })),
    path: pathFrom(vestPts.map((p) => ({ x: w - p.x, y: p.y }))),
  };
  for (const v of [vestL, vestR]) {
    celShade(ctx, v, vest, w * 0.06);
    ink(ctx, v.path, iw * 0.35);
  }
  // Заплата.
  ctx.fillStyle = mix(vest.light, P.straw.base, 0.5);
  ctx.fillRect(w * 0.18, h * 0.42, w * 0.13, h * 0.13);
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = iw * 0.25;
  ctx.setLineDash([iw * 0.4, iw * 0.4]);
  ctx.strokeRect(w * 0.18, h * 0.42, w * 0.13, h * 0.13);
  ctx.setLineDash([]);
  ctx.restore();
  ink(ctx, belly.path, iw * 0.35);
  celShade(ctx, armR, skin, w * 0.04);
  ink(ctx, armR.path, iw * 0.3);
  // Пупок-складка.
  ctx.strokeStyle = withAlpha(P.ink, 0.5);
  ctx.lineWidth = iw * 0.3;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.66, w * 0.03, 0.2, Math.PI - 0.2);
  ctx.stroke();
};

/** Голова: шапка, уши, висячий нос, глазницы (сами глаза светятся в слое 5). Варианты: 0, злой, закопчённый. */
export const koboldHead: Recipe = (ctx, w, h, cell, variant, rng) => {
  const iw = iwOf(cell);
  const sooty = variant === 2;
  const angry = variant === 1;
  const sk = sooty
    ? { base: mix(K.skin, P.scorch, 0.7), light: mix(K.skinLight, P.scorch, 0.6), shadow: P.scorch }
    : skin;
  // Уши: длинные, острые, в стороны.
  const earL = smooth([
    { x: w * 0.3, y: h * 0.5 },
    { x: w * 0.02, y: h * 0.32 },
    { x: w * 0.08, y: h * 0.48 },
    { x: w * 0.3, y: h * 0.68 },
  ]);
  const earR = smooth([
    { x: w * 0.7, y: h * 0.5 },
    { x: w * 0.98, y: h * 0.3 },
    { x: w * 0.93, y: h * 0.48 },
    { x: w * 0.72, y: h * 0.68 },
  ]);
  const head = blob(rng, w * 0.5, h * 0.58, w * 0.27, h * 0.3, { n: 10, jitter: 0.05 });
  // Нос — крупный, висячий, вперёд и вниз.
  const nose = smooth([
    { x: w * 0.56, y: h * 0.52 },
    { x: w * 0.74, y: h * 0.56 },
    { x: w * 0.8, y: h * 0.74 },
    { x: w * 0.7, y: h * 0.86 },
    { x: w * 0.58, y: h * 0.78 },
  ]);
  // Шапка, съехавшая набок.
  const capSh = smooth([
    { x: w * 0.24, y: h * 0.42 },
    { x: w * 0.3, y: h * 0.16 },
    { x: w * 0.5, y: h * 0.06 },
    { x: w * 0.7, y: h * 0.12 },
    { x: w * 0.78, y: h * 0.38 },
    { x: w * 0.5, y: h * 0.44 },
  ]);
  for (const s of [earL, earR, head, nose, capSh]) inkBehind(ctx, s.path, iw);
  for (const e of [earL, earR]) {
    celShade(ctx, e, sk, w * 0.03);
    ctx.save();
    ctx.clip(e.path);
    ctx.fillStyle = withAlpha(sooty ? P.ink : K.skinShadow, 0.6);
    ctx.beginPath();
    ctx.ellipse(
      e === earL ? w * 0.16 : w * 0.84,
      h * 0.46,
      w * 0.06,
      h * 0.05,
      e === earL ? -0.6 : 0.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
    ink(ctx, e.path, iw * 0.3);
  }
  celShade(ctx, head, sk, w * 0.07, { dots: true, dotAlpha: 0.28 });
  if (!sooty) spots(ctx, rng, head.path, w * 0.26, h * 0.4, w * 0.48, h * 0.4, w * 0.025);
  // Глазницы: тёмные впадины — сами глаза рисуются отдельно и светятся.
  for (const ex of [0.47, 0.62]) {
    const sock = new Path2D();
    sock.ellipse(w * ex, h * 0.55, w * 0.062, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fillStyle = mix(K.skinShadow, P.ink, 0.6);
    ctx.fill(sock);
  }
  // Брови.
  ctx.strokeStyle = P.ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.035;
  ctx.beginPath();
  if (angry) {
    ctx.moveTo(w * 0.4, h * 0.44);
    ctx.lineTo(w * 0.53, h * 0.5);
    ctx.moveTo(w * 0.69, h * 0.44);
    ctx.lineTo(w * 0.57, h * 0.5);
  } else {
    ctx.moveTo(w * 0.4, h * 0.47);
    ctx.lineTo(w * 0.52, h * 0.45);
    ctx.moveTo(w * 0.57, h * 0.45);
    ctx.lineTo(w * 0.69, h * 0.47);
  }
  ctx.stroke();
  // Рот: ухмылка с зубом или оскал.
  ctx.lineWidth = w * 0.025;
  const mouth = new Path2D();
  if (angry) {
    mouth.moveTo(w * 0.38, h * 0.74);
    mouth.quadraticCurveTo(w * 0.48, h * 0.88, w * 0.6, h * 0.76);
    mouth.closePath();
    ctx.fillStyle = mix(P.ink, P.dynamite.shadow, 0.3);
    ctx.fill(mouth);
    ctx.fillStyle = P.wax;
    for (const tx of [0.42, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(w * tx, h * 0.745);
      ctx.lineTo(w * (tx + 0.03), h * 0.8);
      ctx.lineTo(w * (tx + 0.06), h * 0.75);
      ctx.fill();
    }
  } else {
    mouth.moveTo(w * 0.38, h * 0.76);
    mouth.quadraticCurveTo(w * 0.48, h * 0.82, w * 0.6, h * 0.76);
    ctx.fillStyle = P.wax;
    ctx.beginPath();
    ctx.moveTo(w * 0.45, h * 0.785);
    ctx.lineTo(w * 0.47, h * 0.83);
    ctx.lineTo(w * 0.5, h * 0.79);
    ctx.fill();
  }
  ctx.strokeStyle = P.ink;
  ctx.stroke(mouth);
  ink(ctx, head.path, iw * 0.32);
  // Нос.
  celShade(ctx, nose, sk, w * 0.045, { lightK: 0.6 });
  if (!sooty) {
    ctx.fillStyle = withAlpha(K.skinShadow, 0.55);
    ctx.beginPath();
    ctx.ellipse(w * 0.72, h * 0.66, w * 0.025, h * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
    glint(ctx, w * 0.66, h * 0.62, w * 0.035);
  }
  ink(ctx, nose.path, iw * 0.32);
  // Злой — румяные щёки и пар (пар отдельной частицей).
  if (angry) {
    ctx.fillStyle = withAlpha(P.dynamite.light, 0.45);
    ctx.beginPath();
    ctx.ellipse(w * 0.36, h * 0.66, w * 0.05, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Шапка.
  celShade(
    ctx,
    capSh,
    sooty ? { base: P.scorch, light: mix(K.cap, P.scorch, 0.5), shadow: P.ink } : cap,
    w * 0.05,
    { dots: true, dotAlpha: 0.3 },
  );
  ctx.save();
  ctx.clip(capSh.path);
  ctx.strokeStyle = withAlpha(P.ink, 0.5);
  ctx.lineWidth = w * 0.03;
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.38);
  ctx.quadraticCurveTo(w * 0.5, h * 0.32, w * 0.78, h * 0.34);
  ctx.stroke();
  ctx.restore();
  ink(ctx, capSh.path, iw * 0.32);
  // Закопчённый: спирали вместо глаз (поверх глазниц).
  if (sooty) {
    ctx.strokeStyle = P.panel;
    ctx.lineWidth = w * 0.018;
    for (const ex of [0.47, 0.62]) {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) {
        const r = (a / (Math.PI * 4)) * w * 0.05;
        const x = w * ex + Math.cos(a) * r;
        const y = h * 0.55 + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
};

/** Спящий кобольд: свернулся клубком, шапка на глаза, нос свисает. */
export const koboldSleep: Recipe = (ctx, w, h, cell, _v, rng) => {
  const iw = iwOf(cell);
  const back = blob(rng, w * 0.46, h * 0.62, w * 0.36, h * 0.32, { n: 10, jitter: 0.05, flatBottom: 0.2 });
  const head = blob(rng, w * 0.74, h * 0.55, w * 0.18, h * 0.24, { n: 9, jitter: 0.05 });
  const ear = smooth([
    { x: w * 0.64, y: h * 0.4 },
    { x: w * 0.5, y: h * 0.18 },
    { x: w * 0.58, y: h * 0.42 },
  ]);
  const nose = smooth([
    { x: w * 0.82, y: h * 0.55 },
    { x: w * 0.94, y: h * 0.62 },
    { x: w * 0.93, y: h * 0.8 },
    { x: w * 0.84, y: h * 0.78 },
  ]);
  const capSh = smooth([
    { x: w * 0.6, y: h * 0.48 },
    { x: w * 0.66, y: h * 0.26 },
    { x: w * 0.82, y: h * 0.22 },
    { x: w * 0.92, y: h * 0.42 },
    { x: w * 0.78, y: h * 0.54 },
  ]);
  const foot = blob(rng, w * 0.18, h * 0.86, w * 0.12, h * 0.07, { n: 7, jitter: 0.08 });
  for (const s of [back, foot, ear, head, nose, capSh]) inkBehind(ctx, s.path, iw);
  // Спина в жилетке.
  celShade(ctx, back, vest, w * 0.06, { dots: true, dotAlpha: 0.32 });
  ctx.save();
  ctx.clip(back.path);
  ctx.fillStyle = skin.base;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.92, w * 0.3, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  halftone(ctx, { x: w * 0.1, y: h * 0.4, w: w * 0.7, h: h * 0.5 }, P.ink, w * 0.04, 0.2, w * 0.012, 0.3);
  ctx.restore();
  ink(ctx, back.path, iw * 0.32);
  celShade(ctx, foot, skin, w * 0.02);
  celShade(ctx, ear, skin, w * 0.02);
  celShade(ctx, head, skin, w * 0.04);
  // Закрытый глаз.
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = w * 0.02;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.56, w * 0.035, 0.2, Math.PI - 0.2);
  ctx.stroke();
  celShade(ctx, nose, skin, w * 0.025);
  ink(ctx, nose.path, iw * 0.3);
  celShade(ctx, capSh, cap, w * 0.03);
  ink(ctx, capSh.path, iw * 0.3);
};

/** Большая зелёная ступня с тремя пальцами. */
export const koboldFoot: Recipe = (ctx, w, h, cell, _v, rng) => {
  const iw = iwOf(cell) * 0.7;
  const f = blob(rng, w * 0.52, h * 0.55, w * 0.42, h * 0.36, { n: 8, jitter: 0.06, flatBottom: 0.3 });
  inkBehind(ctx, f.path, iw);
  celShade(ctx, f, skin, h * 0.12);
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = iw * 0.4;
  for (const tx of [0.62, 0.78]) {
    ctx.beginPath();
    ctx.moveTo(w * tx, h * 0.62);
    ctx.lineTo(w * tx, h * 0.86);
    ctx.stroke();
  }
};

/** Светящиеся глаза — рисуются поверх света (слой 5), видны в самом тёмном углу. */
export const koboldEyes: Recipe = (ctx, w, h) => {
  const g = (x: number) => {
    const grad = ctx.createRadialGradient(x, h / 2, 0, x, h / 2, h * 0.9);
    grad.addColorStop(0, withAlpha(K.eyes, 0.55));
    grad.addColorStop(1, withAlpha(K.eyes, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x - h, 0, h * 2, h);
  };
  const xs = [w * 0.34, w * 0.66];
  for (const x of xs) g(x);
  for (const x of xs) {
    const eye = new Path2D();
    eye.ellipse(x, h / 2, h * 0.3, h * 0.24, 0, 0, Math.PI * 2);
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.ellipse(x, h / 2, h * 0.38, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = K.eyes;
    ctx.fill(eye);
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.ellipse(x + h * 0.05, h / 2, h * 0.07, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    glint(ctx, x - h * 0.1, h * 0.38, h * 0.12);
  }
};

/** Огарок свечи на шапке с маленьким пламенем. */
export const koboldCandle: Recipe = (ctx, w, h, cell) => {
  const iw = iwOf(cell) * 0.6;
  const body = new Path2D();
  body.moveTo(w * 0.22, h * 0.98);
  body.lineTo(w * 0.24, h * 0.5);
  body.quadraticCurveTo(w * 0.5, h * 0.44, w * 0.76, h * 0.5);
  body.lineTo(w * 0.78, h * 0.98);
  body.closePath();
  inkBehind(ctx, body, iw);
  ctx.fillStyle = P.wax;
  ctx.fill(body);
  ctx.fillStyle = adjust(P.wax, -0.12);
  ctx.fillRect(w * 0.55, h * 0.5, w * 0.23, h * 0.48);
  // Потёк воска.
  ctx.fillStyle = P.wax;
  ctx.beginPath();
  ctx.ellipse(w * 0.3, h * 0.62, w * 0.08, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Фитиль и пламя.
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = w * 0.08;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.48);
  ctx.lineTo(w * 0.5, h * 0.38);
  ctx.stroke();
  const flame = new Path2D();
  flame.moveTo(w * 0.5, h * 0.04);
  flame.quadraticCurveTo(w * 0.86, h * 0.26, w * 0.5, h * 0.4);
  flame.quadraticCurveTo(w * 0.14, h * 0.26, w * 0.5, h * 0.04);
  ctx.fillStyle = P.flame.outer;
  ctx.fill(flame);
  ctx.fillStyle = P.flame.core;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.28, w * 0.13, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
};

/** Звёздочка вокруг головы оглушённого — белая, не золото. */
export const stunStar: Recipe = (ctx, w, h, cell) => {
  const iw = iwOf(cell) * 0.4;
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? w * 0.2 : w * 0.44;
    pts.push({ x: w / 2 + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r });
  }
  const s = pathFrom(pts);
  inkBehind(ctx, s, iw);
  ctx.fillStyle = P.panel;
  ctx.fill(s);
};

/** Пар из ушей. */
export const steam: Recipe = (ctx, w, h, cell, _v, rng) => {
  const iw = iwOf(cell) * 0.35;
  const s = blob(rng, w / 2, h / 2, w * 0.36, h * 0.3, { n: 8, jitter: 0.25 });
  inkBehind(ctx, s.path, iw);
  ctx.fillStyle = P.panel;
  ctx.fill(s.path);
};
