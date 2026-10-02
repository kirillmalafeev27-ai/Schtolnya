// Подсказки (7.5.15): красно-белая лента креста, следы-укрытия, отпечатки лап, мишень, «×2», трещина.
// Рисуются в слое 5 — поверх света.

import { palette as P } from '../../config/palette';
import {
  bootPrint,
  burst,
  glint,
  hazardTape,
  ink,
  inkBehind,
  pawPrint,
  roundRect,
} from '../../shared/comicKit';
import type { Recipe } from '../ArtFactory';
import { withAlpha } from '../color';
import { inkW } from './common';

export const tape: Recipe = (ctx, w, h, cell, variant) => {
  const iw = inkW(cell) * 0.38;
  const m = iw * 1.2;
  if (variant === 0) hazardTape(ctx, -m, m, w + m * 2, h - m * 2, h * 0.3, P.tape, iw);
  else hazardTape(ctx, m, -m, w - m * 2, h + m * 2, w * 0.3, P.tape, iw);
};

/** Центр креста — две скрещённые ленты на клетке, которая разрушится. */
export const tapeCenter: Recipe = (ctx, w, h, cell) => {
  const iw = inkW(cell) * 0.38;
  const t = w * 0.3;
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(a);
    hazardTape(ctx, -w * 0.62, -t / 2, w * 1.24, t, t * 0.55, P.tape, iw, Math.PI / 4);
    ctx.restore();
  }
};

/** Трещина-отметка «разрушится». */
export const crackMark: Recipe = (ctx, w, h, cell) => {
  const iw = inkW(cell) * 0.5;
  const pts = [
    { x: w * 0.36, y: h * 0.08 },
    { x: w * 0.56, y: h * 0.34 },
    { x: w * 0.42, y: h * 0.5 },
    { x: w * 0.64, y: h * 0.74 },
    { x: w * 0.5, y: h * 0.94 },
  ];
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = iw * 2.4;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = P.panel;
  ctx.lineWidth = iw;
  ctx.stroke();
};

/** Значок «×2» у крепкой породы. */
export const x2: Recipe = (ctx, w, h, cell) => {
  const iw = inkW(cell) * 0.4;
  const badge = roundRect(iw, iw, w - iw * 2, h - iw * 2, h * 0.3);
  inkBehind(ctx, badge, iw);
  ctx.fillStyle = P.panel;
  ctx.fill(badge);
  ctx.fillStyle = P.ink;
  ctx.font = `900 ${Math.round(h * 0.62)}px Rubik, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('×2', w / 2, h / 2 + h * 0.03);
};

/** Следы-укрытия: белые — один шаг, оранжевые — два. */
export const boot: Recipe = (ctx, w, h, cell, variant) => {
  const iw = inkW(cell) * 0.32;
  const fill = variant ? P.hints.twoSteps : P.hints.oneStep;
  bootPrint(ctx, w * 0.34, h * 0.42, h * 0.62, fill, iw, -0.15);
  bootPrint(ctx, w * 0.7, h * 0.6, h * 0.62, fill, iw, 0.12);
};

/** Бледный зелёный отпечаток лапы кобольда. */
export const paw: Recipe = (ctx, w, h, cell) => {
  pawPrint(ctx, w / 2, h / 2, w * 0.82, P.hints.koboldSteps, inkW(cell) * 0.25);
};

/** Мишень над кобольдом на кресте горящей шашки. */
export const target: Recipe = (ctx, w, h, cell) => {
  const iw = inkW(cell) * 0.38;
  const r = w * 0.36;
  const ring = new Path2D();
  ring.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = iw * 3.2;
  ctx.stroke(ring);
  ctx.strokeStyle = P.panel;
  ctx.lineWidth = iw * 2;
  ctx.stroke(ring);
  ctx.strokeStyle = P.bad;
  ctx.lineWidth = iw * 1.1;
  ctx.stroke(ring);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const x0 = w / 2 + Math.cos(a) * r * 0.55;
    const y0 = h / 2 + Math.sin(a) * r * 0.55;
    const x1 = w / 2 + Math.cos(a) * r * 1.35;
    const y1 = h / 2 + Math.sin(a) * r * 1.35;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = iw * 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = P.bad;
    ctx.lineWidth = iw * 1.1;
    ctx.stroke();
  }
  ctx.fillStyle = P.bad;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, iw * 1.1, 0, Math.PI * 2);
  ctx.fill();
};

/** Точка маршрута: мел или красная (на кресте горящей шашки). */
export const routeDot: Recipe = (ctx, w, h, cell, variant) => {
  const p = new Path2D();
  p.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2);
  inkBehind(ctx, p, inkW(cell) * 0.16);
  ctx.fillStyle = variant ? P.bad : P.chalk;
  ctx.fill(p);
};

/** Сигнальное кольцо под ногами персонажа, стоящего на кресте: лента не закрывает фигуру. */
export const dangerRing: Recipe = (ctx, w, h, cell) => {
  const iw = inkW(cell) * 0.3;
  const outer = new Path2D();
  outer.ellipse(w / 2, h / 2, w * 0.46, h * 0.42, 0, 0, Math.PI * 2);
  const inner = new Path2D();
  inner.ellipse(w / 2, h / 2, w * 0.3, h * 0.24, 0, 0, Math.PI * 2);
  const ring = new Path2D();
  ring.addPath(outer);
  ring.addPath(inner);
  ctx.save();
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = iw * 2;
  ctx.stroke(outer);
  ctx.stroke(inner);
  ctx.clip(ring, 'evenodd');
  ctx.fillStyle = P.tape.white;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = P.tape.red;
  for (let x = -h; x < w + h; x += h * 0.36) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h * 0.18, h);
    ctx.lineTo(x + h * 0.18 + h, 0);
    ctx.lineTo(x + h, 0);
    ctx.fill();
  }
  ctx.restore();
};

/** Пузырь сна «Zzz» над спящим кобольдом. */
export const zzz: Recipe = (ctx, w, h, cell, _v, rng) => {
  const iw = inkW(cell) * 0.32;
  const b = burst(rng, w * 0.5, h * 0.5, h * 0.38, h * 0.46, 9, 1);
  void b;
  ctx.font = `${Math.round(h * 0.62)}px Bangers, Rubik, sans-serif`;
  ctx.textBaseline = 'middle';
  const sizes = [0.42, 0.55, 0.7];
  let x = w * 0.08;
  sizes.forEach((s, i) => {
    ctx.font = `${Math.round(h * s)}px Bangers, Rubik, sans-serif`;
    const y = h * (0.7 - i * 0.18);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = iw * 1.6;
    ctx.strokeText('z', x, y);
    ctx.fillStyle = withAlpha(P.panel, 0.95);
    ctx.fillText('z', x, y);
    x += ctx.measureText('z').width * 1.15;
  });
  glint(ctx, w * 0.9, h * 0.2, h * 0.1);
  void ink;
};
