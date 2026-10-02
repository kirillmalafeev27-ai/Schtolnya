// Запекание пола уровня в одну текстуру (план, 7.5.1): плитки пола, рельсы со шпалами, лужицы.

import type Phaser from 'phaser';
import { palette as P, rgba } from '../config/palette';
import { Cell, cx, cy, type Grid } from '../core/grid';
import type { Decor } from '../render/decor';
import { mulberry32 } from '../shared/comicKit';
import { makeCanvas } from './ArtFactory';
import { ART, FLOOR_VARIANTS } from './manifest';

export function bakeFloor(
  textures: Phaser.Textures.TextureManager,
  g: Grid,
  decor: Decor,
  cellPx: number,
  seed: number,
): HTMLCanvasElement {
  const canvas = makeCanvas(g.w * cellPx, g.h * cellPx);
  const ctx = canvas.getContext('2d')!;
  const rnd = mulberry32(seed ^ 0xf100);
  ctx.fillStyle = P.floor.shadow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Плитки пола под всеми клетками (блоки сверху их закроют), тон гуляет на ±6%.
  for (let i = 0; i < g.cells.length; i++) {
    const x = cx(g, i) * cellPx;
    const y = cy(g, i) * cellPx;
    const v = decor.variants[i] % FLOOR_VARIANTS;
    const src = textures.get(ART.floor(v)).getSourceImage() as HTMLCanvasElement;
    ctx.save();
    // Поворот плитки на 180° через раз — меньше заметных повторов.
    if (decor.variants[i] & 1) {
      ctx.translate(x + cellPx, y + cellPx);
      ctx.rotate(Math.PI);
      ctx.drawImage(src, 0, 0, cellPx, cellPx);
    } else {
      ctx.drawImage(src, x, y, cellPx, cellPx);
    }
    ctx.restore();
    const tone = (rnd() - 0.5) * 0.12;
    ctx.fillStyle = tone > 0 ? rgba(P.floor.light, tone) : rgba(P.ink, -tone);
    ctx.fillRect(x, y, cellPx, cellPx);
  }

  // Лужицы с бликами.
  for (const cell of decor.puddles) {
    const x = (cx(g, cell) + 0.5) * cellPx;
    const y = (cy(g, cell) + 0.55) * cellPx;
    drawPuddle(ctx, x, y, cellPx, rnd);
  }

  // Рельсы со шпалами вдоль прямых участков.
  for (const r of decor.rails) {
    drawRail(ctx, g, r.cell, r.dir, r.start, r.end, cellPx);
  }

  // Под породой рельсы и плитки тоже есть: после взрыва откроются.
  void Cell;
  return canvas;
}

function drawPuddle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rnd: () => number): void {
  const rx = s * (0.22 + rnd() * 0.1);
  const ry = rx * 0.45;
  ctx.save();
  ctx.fillStyle = rgba(P.caveDeep, 0.85);
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgba(P.bedrock.light, 0.55);
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.25, y - ry * 0.25, rx * 0.45, ry * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.panel;
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.45, y - ry * 0.35, rx * 0.14, ry * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRail(
  ctx: CanvasRenderingContext2D,
  g: Grid,
  cell: number,
  dir: 'h' | 'v',
  start: boolean,
  end: boolean,
  s: number,
): void {
  const x0 = cx(g, cell) * s;
  const y0 = cy(g, cell) * s;
  const lw = Math.max(2, s * 0.035);
  ctx.save();
  ctx.lineCap = 'round';
  // Шпалы.
  const sleepers = 3;
  for (let k = 0; k < sleepers; k++) {
    const t = (k + 0.5) / sleepers;
    if ((start && k === 0) || (end && k === sleepers - 1)) {
      // на концах участка шпала чуть короче
    }
    ctx.fillStyle = P.timber.shadow;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = lw * 0.8;
    if (dir === 'h') {
      const x = x0 + t * s;
      ctx.beginPath();
      ctx.rect(x - s * 0.06, y0 + s * 0.24, s * 0.12, s * 0.52);
      ctx.fill();
      ctx.stroke();
    } else {
      const y = y0 + t * s;
      ctx.beginPath();
      ctx.rect(x0 + s * 0.24, y - s * 0.06, s * 0.52, s * 0.12);
      ctx.fill();
      ctx.stroke();
    }
  }
  // Два рельса.
  const a = start ? 0.08 : 0;
  const b = end ? 0.92 : 1;
  for (const off of [0.36, 0.64]) {
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = lw * 2.2;
    ctx.beginPath();
    if (dir === 'h') {
      ctx.moveTo(x0 + a * s, y0 + off * s);
      ctx.lineTo(x0 + b * s, y0 + off * s);
    } else {
      ctx.moveTo(x0 + off * s, y0 + a * s);
      ctx.lineTo(x0 + off * s, y0 + b * s);
    }
    ctx.stroke();
    ctx.strokeStyle = P.rail;
    ctx.lineWidth = lw * 1.1;
    ctx.stroke();
  }
  ctx.restore();
}
