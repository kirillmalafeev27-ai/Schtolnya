// Скала (7.5.2): массивный блок в ракурсе Bomberman — светлый верх, тёмная лицевая грань,
// горизонтальные пласты, изредка голубая друза. Без мела, гладкая и холодная: видно, что она навсегда.

import { palette as P } from '../../config/palette';
import {
  celShade,
  glint,
  halftone,
  hatch,
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

function roundRectPts(x: number, y: number, w: number, h: number, r: number, seg = 5): Pt[] {
  const pts: Pt[] = [];
  const corners = [
    { cx: x + w - r, cy: y + r, a0: -Math.PI / 2 },
    { cx: x + w - r, cy: y + h - r, a0: 0 },
    { cx: x + r, cy: y + h - r, a0: Math.PI / 2 },
    { cx: x + r, cy: y + r, a0: Math.PI },
  ];
  for (const c of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = c.a0 + (i / seg) * (Math.PI / 2);
      pts.push({ x: c.cx + Math.cos(a) * r, y: c.cy + Math.sin(a) * r });
    }
  }
  return pts;
}

export const bedrock: Recipe = (ctx, w, h, cell, variant, rng) => {
  const C = cell;
  const iw = inkW(C) * 0.72;
  const m = iw * 1.15;
  const r = C * 0.13;
  const base = adjust(P.bedrock.base, rr(rng, -0.012, 0.012));
  const faceY = C - m * 0.2; // граница верха и лицевой грани

  // Общий силуэт блока — жирной тушью под заливкой.
  const silhouette = roundRect(m, m, w - m * 2, h - m * 2, r);
  inkBehind(ctx, silhouette, iw);

  // Лицевая грань: тёмный сланец с пластами.
  const frontColor = mix(P.bedrock.shadow, base, 0.35);
  ctx.fillStyle = frontColor;
  ctx.fill(silhouette);
  ctx.save();
  ctx.clip(silhouette);
  // Пласты — светлые и тёмные полосы.
  for (let k = 0; k < 2; k++) {
    const y = faceY + (h - m - faceY) * (0.3 + k * 0.36);
    const pts = wobble(
      [
        { x: 0, y },
        { x: w, y: y + rr(rng, -1.5, 1.5) },
      ],
      0.8,
      rng,
      false,
      14,
    );
    ctx.strokeStyle = withAlpha(P.ink, 0.6);
    ctx.lineWidth = Math.max(1.5, C * 0.016);
    ctx.stroke(pathFrom(pts, false));
    ctx.strokeStyle = withAlpha(P.bedrock.light, 0.4);
    ctx.lineWidth = Math.max(1, C * 0.01);
    ctx.stroke(
      pathFrom(
        pts.map((p) => ({ x: p.x, y: p.y + C * 0.016 })),
        false,
      ),
    );
  }
  // Самая глубокая тень — штриховка у основания.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, h - m - (h - faceY) * 0.42, w, h);
  ctx.clip();
  hatch(
    ctx,
    { x: 0, y: faceY, w, h: h - faceY },
    -Math.PI / 4,
    Math.max(3, C * 0.045),
    Math.max(1, C * 0.011),
    P.ink,
    0.5,
  );
  ctx.restore();
  ctx.restore();

  // Верх блока: трёхтоновая светотень, широкая фаска-блик сверху слева.
  const topPts = roundRectPts(m, m, w - m * 2, faceY - m, r);
  const top: Shape = { pts: topPts, path: pathFrom(topPts) };
  celShade(ctx, top, { base, light: P.bedrock.light, shadow: mix(P.bedrock.shadow, base, 0.25) }, C * 0.1, {
    dots: true,
    dotAlpha: 0.3,
    lightK: 0.75,
  });
  ctx.save();
  ctx.clip(top.path);
  // Слабые пласты на верхней грани — гладкий, холодный камень.
  ctx.strokeStyle = withAlpha(P.bedrock.shadow, 0.55);
  ctx.lineWidth = Math.max(1.2, C * 0.012);
  ctx.lineCap = 'round';
  for (let k = 0; k < 2 + (variant % 2); k++) {
    const y = C * rr(rng, 0.3, 0.78);
    const x0 = C * rr(rng, 0.12, 0.35);
    const x1 = C * rr(rng, 0.55, 0.88);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) / 2, y + rr(rng, -3, 3), x1, y + rr(rng, -2, 2));
    ctx.stroke();
  }
  // Пара сколов по кромке.
  ctx.fillStyle = withAlpha(P.ink, 0.45);
  for (let k = 0; k < 2; k++) {
    const ex = rr(rng, 0.2, 0.8) * w;
    ctx.beginPath();
    ctx.moveTo(ex - C * 0.04, faceY - m * 0.1);
    ctx.lineTo(ex + rr(rng, -0.01, 0.01) * C, faceY - C * 0.05);
    ctx.lineTo(ex + C * 0.045, faceY - m * 0.1);
    ctx.fill();
  }
  ctx.restore();
  // Губа верхней грани — тонкая линия, отделяющая верх от лицевой грани.
  ink(ctx, top.path, iw * 0.35);
  // Блик-кромка сверху слева.
  ctx.save();
  ctx.strokeStyle = withAlpha(P.panel, 0.42);
  ctx.lineWidth = Math.max(2, C * 0.022);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(m + r, m + C * 0.03);
  ctx.lineTo(w * 0.62, m + C * 0.03);
  ctx.moveTo(m + C * 0.03, m + r);
  ctx.lineTo(m + C * 0.03, C * 0.5);
  ctx.stroke();
  ctx.restore();
  // Растр по лицевой грани справа — объём.
  ctx.save();
  ctx.clip(silhouette);
  ctx.beginPath();
  ctx.rect(w * 0.55, faceY, w, h);
  ctx.clip();
  halftone(ctx, { x: w * 0.5, y: faceY, w: w * 0.5, h: h - faceY }, P.ink, C * 0.06, 0.4, C * 0.016, 0.35, {
    x: 1,
    y: 0,
  });
  ctx.restore();

  // Голубая друза — только у последних вариантов.
  if (variant >= 4) druse(ctx, rng, C, variant === 4 ? 0.26 : 0.72, faceY + C * 0.12, iw);
};

/** Кристаллы-друза: голубые призмы с бликами (только декор). */
function druse(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  C: number,
  fx: number,
  baseY: number,
  iw: number,
): void {
  const n = 3 + Math.floor(rng() * 2);
  const bx = fx * C;
  const shapes: Shape[] = [];
  const tips: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42 + rr(rng, -0.1, 0.1);
    const len = C * rr(rng, 0.16, 0.3);
    const wd = C * 0.05;
    const ox = bx + (i - (n - 1) / 2) * C * 0.045;
    const tip = { x: ox + Math.cos(ang) * len, y: baseY + Math.sin(ang) * len };
    const nx = -Math.sin(ang) * wd;
    const ny = Math.cos(ang) * wd;
    const pts: Pt[] = [
      { x: ox + nx, y: baseY + ny },
      { x: tip.x + nx * 0.8 - Math.cos(ang) * wd, y: tip.y + ny * 0.8 - Math.sin(ang) * wd },
      tip,
      { x: tip.x - nx * 0.8 - Math.cos(ang) * wd, y: tip.y - ny * 0.8 - Math.sin(ang) * wd },
      { x: ox - nx, y: baseY - ny },
    ];
    shapes.push({ pts, path: pathFrom(pts) });
    tips.push(tip);
  }
  for (const sh of shapes) inkBehind(ctx, sh.path, iw * 0.45);
  shapes.forEach((sh, i) => {
    celShade(
      ctx,
      sh,
      { base: P.crystalDecor, light: adjust(P.crystalDecor, 0.18), shadow: adjust(P.crystalDecor, -0.24) },
      C * 0.045,
    );
    ink(ctx, sh.path, iw * 0.22);
    if (i === 1) glint(ctx, tips[i].x, tips[i].y + C * 0.03, C * 0.055);
  });
}
