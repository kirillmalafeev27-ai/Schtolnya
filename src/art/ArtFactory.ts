// Фабрика процедурного арта: рисует все текстуры манифеста на Canvas 2D при запуске (план, 7.3).

import type Phaser from 'phaser';
import { manifest, type ArtEntry } from './manifest';
import { mulberry32 } from '../shared/comicKit';

/** Рецепт рисует текстуру в канву размером w × h пикселей; `cell` — размер клетки в пикселях. */
export type Recipe = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cell: number,
  variant: number,
  rng: () => number,
) => void;

export interface GenReport {
  ms: number;
  count: number;
  pixels: number;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export class ArtFactory {
  constructor(
    private readonly textures: Phaser.Textures.TextureManager,
    readonly cellPx: number,
    private readonly recipes: Record<string, Recipe>,
  ) {}

  /** Сгенерировать все текстуры манифеста. Можно передать бюджет кадра для прогресса. */
  async generateAll(onProgress?: (done: number, total: number) => void, sliceMs = 60): Promise<GenReport> {
    const list = manifest();
    const t0 = performance.now();
    let pixels = 0;
    let sliceStart = performance.now();
    for (let i = 0; i < list.length; i++) {
      pixels += this.generate(list[i]);
      if (performance.now() - sliceStart > sliceMs) {
        onProgress?.(i + 1, list.length);
        // Уступаем поток таймером, а не кадром: кадр рендера может быть дорогим, а экран загрузки — это DOM.
        await new Promise((r) => setTimeout(r, 0));
        sliceStart = performance.now();
      }
    }
    onProgress?.(list.length, list.length);
    return { ms: performance.now() - t0, count: list.length, pixels };
  }

  generate(entry: ArtEntry): number {
    const canvas = renderEntry(entry, this.cellPx, this.recipes);
    putCanvas(this.textures, entry.key, canvas);
    return canvas.width * canvas.height;
  }

  /** Добавить (или заменить) текстуру из готовой канвы. */
  put(key: string, canvas: HTMLCanvasElement): void {
    putCanvas(this.textures, key, canvas);
  }
}

/**
 * Зарегистрировать канву как обычную текстуру. В отличие от addCanvas (CanvasTexture),
 * не читает пиксели обратно с видеокарты — регистрация почти бесплатна.
 */
export function putCanvas(
  textures: Phaser.Textures.TextureManager,
  key: string,
  canvas: HTMLCanvasElement,
): void {
  if (textures.exists(key)) textures.remove(key);
  textures.addImage(key, canvas as unknown as HTMLImageElement);
}

/** Нарисовать одну текстуру манифеста в отдельную канву. */
export function renderEntry(
  entry: ArtEntry,
  cellPx: number,
  recipes: Record<string, Recipe>,
): HTMLCanvasElement {
  const recipe = recipes[entry.recipe];
  const cw = Math.ceil(entry.w * cellPx);
  const ch = Math.ceil(entry.h * cellPx);
  const canvas = makeCanvas(cw, ch);
  const ctx = canvas.getContext('2d')!;
  const seed = hashString(entry.key) ^ (entry.variant * 0x9e3779b1);
  if (recipe) recipe(ctx, cw, ch, cellPx, entry.variant, mulberry32(seed));
  return canvas;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
