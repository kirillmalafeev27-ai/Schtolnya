// Мировые координаты: 128 виртуальных единиц на клетку (план, 13.5.1).

import { balance } from '../config/balance';
import type { Grid } from '../core/grid';

export const CELL = balance.art.cellPx;
/** Где стоят ноги персонажа внутри клетки (доля клетки сверху): чуть выше выступа нижнего блока. */
export const FOOT = 0.72;

export const cellX = (g: Grid, i: number): number => ((i % g.w) + 0.5) * CELL;
export const cellY = (g: Grid, i: number): number => (((i / g.w) | 0) + 0.5) * CELL;
export const footY = (g: Grid, i: number): number => (((i / g.w) | 0) + FOOT) * CELL;
/** Нижняя кромка клетки — основание блока для сортировки по глубине. */
export const baseY = (g: Grid, i: number): number => (((i / g.w) | 0) + 1) * CELL;

/** Порядок глубины внутри слоя объектов: всё сортируется по y основания (2.1.3). */
export const depthOf = (y: number): number => y;
