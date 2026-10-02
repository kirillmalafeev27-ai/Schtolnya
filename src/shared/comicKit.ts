// Комикс-кит серии (план, 7.4): инструменты процедурного арта на Canvas 2D.
// Толстая тушь с переменной толщиной, плоская заливка в три тона, растр в тенях,
// штриховка в самых глубоких тенях, белые глинты на всём блестящем.
// Ключевой свет «запечённой» светотени падает сверху слева.

export interface Pt {
  x: number;
  y: number;
}

export interface Tones {
  base: string;
  shadow: string;
  light: string;
}

/** Цвет туши задаётся при запуске из палитры игры (общий модуль не знает палитру конкретной игры). */
let INK = '#1b1020';
let WHITE = '#ffffff';

export function setInk(ink: string, white = '#ffffff'): void {
  INK = ink;
  WHITE = white;
}

export function inkColor(): string {
  return INK;
}

/** Сидированный генератор случайных чисел. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rr = (rng: () => number, a: number, b: number): number => a + (b - a) * rng();

// ───────────────────────── формы ─────────────────────────

/** Сглаживание Чайкина. */
export function chaikin(pts: Pt[], passes: number, closed = true): Pt[] {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const out: Pt[] = [];
    const n = p.length;
    const last = closed ? n : n - 1;
    if (!closed) out.push(p[0]);
    for (let i = 0; i < last; i++) {
      const a = p[i];
      const b = p[(i + 1) % n];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    if (!closed) out.push(p[n - 1]);
    p = out;
  }
  return p;
}

export function pathFrom(pts: Pt[], closed = true): Path2D {
  const path = new Path2D();
  if (!pts.length) return path;
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
  if (closed) path.closePath();
  return path;
}

export function translatePts(pts: Pt[], dx: number, dy: number): Pt[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export interface BlobOpts {
  /** Число опорных точек по эллипсу. */
  n?: number;
  /** Разброс радиуса, доля (по умолчанию ±15%). */
  jitter?: number;
  /** Проходы сглаживания (по умолчанию 2). */
  smooth?: number;
  /** Поворот эллипса. */
  rot?: number;
  /** Сплющенность низа: камни лежат на полу (0 — нет). */
  flatBottom?: number;
}

export interface Shape {
  pts: Pt[];
  path: Path2D;
}

/** Неровная замкнутая форма: точки по эллипсу с разбросом радиуса, сглаживание Чайкина в два прохода. */
export function blob(
  rng: () => number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  opts: BlobOpts = {},
): Shape {
  const n = opts.n ?? 9;
  const jitter = opts.jitter ?? 0.15;
  const rot = opts.rot ?? 0;
  const start = rng() * Math.PI * 2;
  const raw: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * Math.PI * 2;
    const k = 1 + (rng() * 2 - 1) * jitter;
    let x = Math.cos(a) * rx * k;
    let y = Math.sin(a) * ry * k;
    if (opts.flatBottom && y > 0) y *= 1 - opts.flatBottom;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    [x, y] = [x * cr - y * sr, x * sr + y * cr];
    raw.push({ x: cx + x, y: cy + y });
  }
  const pts = chaikin(raw, opts.smooth ?? 2);
  return { pts, path: pathFrom(pts) };
}

/** Многоугольник с неровными, но прямыми гранями — для камней и самородков с гранями. */
export function facetBlob(
  rng: () => number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 7,
  jitter = 0.18,
): Shape {
  const start = rng() * Math.PI * 2;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = start + ((i + rng() * 0.4) / n) * Math.PI * 2;
    const k = 1 + (rng() * 2 - 1) * jitter;
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  return { pts, path: pathFrom(pts) };
}

/** Прямоугольник со скруглёнными углами. */
export function roundRect(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  const rad = Math.min(r, w / 2, h / 2);
  p.moveTo(x + rad, y);
  p.arcTo(x + w, y, x + w, y + h, rad);
  p.arcTo(x + w, y + h, x, y + h, rad);
  p.arcTo(x, y + h, x, y, rad);
  p.arcTo(x, y, x + w, y, rad);
  p.closePath();
  return p;
}

export function rectPts(x: number, y: number, w: number, h: number): Pt[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** Дрожание линии на 0.5–1 px: балки, клеть и рельсы выглядят нарисованными от руки. */
export function wobble(pts: Pt[], amp: number, rng: () => number, closed = false, step = 10): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(1, Math.round(len / step));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const nx = -(b.y - a.y) / (len || 1);
      const ny = (b.x - a.x) / (len || 1);
      const off = (rng() * 2 - 1) * amp * (j === 0 ? 0.3 : 1);
      out.push({ x: lerp(a.x, b.x, t) + nx * off, y: lerp(a.y, b.y, t) + ny * off });
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

// ───────────────────────── светотень ─────────────────────────

/** Путь «всё, кроме фигуры» — для клипа полумесяцев через правило evenodd. */
function outside(pts: Pt[], pad = 4000): Path2D {
  const p = new Path2D();
  p.rect(-pad, -pad, pad * 2, pad * 2);
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
  p.closePath();
  return p;
}

export interface CelOpts {
  /** Растр в тени. */
  dots?: boolean;
  /** Штриховка в самой глубокой тени. */
  hatch?: boolean;
  /** Цвет растра (по умолчанию — тушь). */
  dotColor?: string;
  dotAlpha?: number;
  /** Ширина бликового полумесяца относительно k (по умолчанию 0.5). */
  lightK?: number;
}

/**
 * Трёхтоновая светотень: тень полумесяцем снизу справа, блик полумесяцем сверху слева.
 * k ≈ 12% размера объекта.
 */
export function celShade(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  tones: Tones,
  k: number,
  opts: CelOpts = {},
): void {
  const { pts, path } = shape;
  const lk = (opts.lightK ?? 0.5) * k;
  ctx.save();
  // 1) вся форма — бликом;
  ctx.fillStyle = tones.light;
  ctx.fill(path);
  ctx.clip(path);
  // 2) форма со сдвигом (+lk, +lk) — основным тоном: блик остаётся полумесяцем сверху слева;
  ctx.fillStyle = tones.base;
  ctx.fill(pathFrom(translatePts(pts, lk, lk)));
  // 3) всё вне формы, сдвинутой на (−k, −k), — тенью: тень остаётся полумесяцем снизу справа.
  const crescent = outside(translatePts(pts, -k, -k));
  ctx.fillStyle = tones.shadow;
  ctx.fill(crescent, 'evenodd');
  if (opts.dots || opts.hatch) {
    ctx.clip(crescent, 'evenodd');
    const b = bounds(pts);
    if (opts.dots)
      halftone(ctx, b, opts.dotColor ?? INK, Math.max(4, k * 0.55), k * 0.04, k * 0.2, opts.dotAlpha ?? 0.42);
    if (opts.hatch) {
      // Штриховка — в самой глубокой части тени.
      const deep = outside(translatePts(pts, -k * 1.7, -k * 1.7));
      ctx.clip(deep, 'evenodd');
      hatch(ctx, b, -Math.PI / 4, Math.max(3, k * 0.32), Math.max(1, k * 0.07), INK, 0.55);
    }
  }
  ctx.restore();
}

export function bounds(pts: Pt[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Растр: точки по сетке под 45°, радиус растёт к теневой стороне (вниз вправо).
 * Рисуется в текущем клипе.
 */
export function halftone(
  ctx: CanvasRenderingContext2D,
  region: { x: number; y: number; w: number; h: number },
  color: string,
  spacing: number,
  rMin: number,
  rMax: number,
  alpha = 0.45,
  dir: Pt = { x: 1, y: 1 },
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha *= alpha;
  const len = Math.hypot(dir.x, dir.y) || 1;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  const span = (Math.abs(dx) * region.w + Math.abs(dy) * region.h) / 2 || 1;
  const s = spacing;
  for (let y = region.y - s; y <= region.y + region.h + s; y += s) {
    const row = Math.round((y - region.y) / s);
    for (let x = region.x - s + (row % 2 ? s / 2 : 0); x <= region.x + region.w + s; x += s) {
      const t = ((x - cx) * dx + (y - cy) * dy) / span; // −1…1
      const r = lerp(rMin, rMax, Math.max(0, Math.min(1, (t + 1) / 2)));
      if (r <= 0.2) continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Штриховка для самых глубоких теней. Рисуется в текущем клипе. */
export function hatch(
  ctx: CanvasRenderingContext2D,
  region: { x: number; y: number; w: number; h: number },
  angle: number,
  spacing: number,
  width: number,
  color: string = INK,
  alpha = 0.6,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha *= alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  const R = Math.hypot(region.w, region.h) / 2 + spacing;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  for (let d = -R; d <= R; d += spacing) {
    const px = cx - sa * d;
    const py = cy + ca * d;
    ctx.beginPath();
    ctx.moveTo(px - ca * R, py - sa * R);
    ctx.lineTo(px + ca * R, py + sa * R);
    ctx.stroke();
  }
  ctx.restore();
}

// ───────────────────────── тушь ─────────────────────────

/**
 * Контур в два прохода: сначала штрих шириной 1.35w со сдвигом (+0.35w, +0.35w) —
 * снизу справа линия тяжелее, затем основной штрих шириной w.
 */
export function ink(ctx: CanvasRenderingContext2D, path: Path2D, w: number, color: string = INK): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 1.35;
  ctx.translate(w * 0.35, w * 0.35);
  ctx.stroke(path);
  ctx.translate(-w * 0.35, -w * 0.35);
  ctx.lineWidth = w;
  ctx.stroke(path);
  ctx.restore();
}

/**
 * Контур «под заливкой»: штрих двойной ширины рисуется до заливки, и заливка закрывает его
 * внутреннюю половину — снаружи остаётся линия ширины w, тяжелее снизу справа.
 */
export function inkBehind(ctx: CanvasRenderingContext2D, path: Path2D, w: number, color: string = INK): void {
  ink(ctx, path, w * 2, color);
}

/** Линия тушью по точкам (с дрожанием или без). */
export function inkLine(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  w: number,
  color: string = INK,
  closed = false,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(pathFrom(pts, closed));
  ctx.restore();
}

/** Залить и обвести: самая частая операция. */
export function fillInk(ctx: CanvasRenderingContext2D, path: Path2D, fill: string, w: number): void {
  ctx.fillStyle = fill;
  ctx.fill(path);
  ink(ctx, path, w);
}

/** Белая четырёхлучевая звезда-блик. */
export function glint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string = WHITE,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const t = r * 0.18;
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + t, y - t, x + r, y);
  ctx.quadraticCurveTo(x + t, y + t, x, y + r);
  ctx.quadraticCurveTo(x - t, y + t, x - r, y);
  ctx.quadraticCurveTo(x - t, y - t, x, y - r);
  ctx.fill();
  ctx.restore();
}

/** Ломаная трещина с одним ответвлением. */
export function crack(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  from: Pt,
  len: number,
  angle: number,
  w: number,
  color: string = INK,
): void {
  const seg = 4 + Math.floor(rng() * 2);
  const pts: Pt[] = [from];
  let a = angle;
  let p = from;
  for (let i = 0; i < seg; i++) {
    a += (rng() - 0.5) * 1.1;
    const l = (len / seg) * (0.7 + rng() * 0.6);
    p = { x: p.x + Math.cos(a) * l, y: p.y + Math.sin(a) * l };
    pts.push(p);
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'round';
  // Трещина сужается к концу.
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = w * (1 - (i - 1) / pts.length) + w * 0.25;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  // Ответвление.
  const bi = 1 + Math.floor(rng() * (pts.length - 2));
  const ba = angle + (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.5);
  const bp = pts[bi];
  const bl = len * 0.35;
  ctx.lineWidth = w * 0.55;
  ctx.beginPath();
  ctx.moveTo(bp.x, bp.y);
  const mid = { x: bp.x + Math.cos(ba) * bl * 0.5, y: bp.y + Math.sin(ba) * bl * 0.5 };
  ctx.lineTo(mid.x, mid.y);
  ctx.lineTo(mid.x + Math.cos(ba + 0.4) * bl * 0.5, mid.y + Math.sin(ba + 0.4) * bl * 0.5);
  ctx.stroke();
  ctx.restore();
}

/** Взрыв-баллон под крупные слова-звуки: звезда с неровными лучами. */
export function burst(
  rng: () => number,
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  spikes: number,
  squash = 1,
): Shape {
  const pts: Pt[] = [];
  const start = rng() * Math.PI;
  for (let i = 0; i < spikes * 2; i++) {
    const a = start + (i / (spikes * 2)) * Math.PI * 2 + (rng() - 0.5) * 0.12;
    const r = i % 2 === 0 ? rOut * (0.82 + rng() * 0.3) : rIn * (0.85 + rng() * 0.25);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * squash });
  }
  return { pts, path: pathFrom(pts) };
}

/** Трёхслойная звезда взрыва: белое ядро, жёлтый слой, оранжево-красный край, контур тушью. */
export function explosion(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  spikes: number,
  colors: { core: string; inner: string; mid: string; outer: string },
  w: number,
): void {
  const outer = burst(rng, cx, cy, rIn, rOut, spikes);
  ctx.fillStyle = colors.outer;
  ctx.fill(outer.path);
  const mid = burst(rng, cx, cy, rIn * 0.75, rOut * 0.78, spikes);
  ctx.fillStyle = colors.mid;
  ctx.fill(mid.path);
  const inner = burst(rng, cx, cy, rIn * 0.55, rOut * 0.55, spikes - 2);
  ctx.fillStyle = colors.inner;
  ctx.fill(inner.path);
  const core = blob(rng, cx, cy, rIn * 0.42, rIn * 0.42, { n: 8, jitter: 0.2 });
  ctx.fillStyle = colors.core;
  ctx.fill(core.path);
  ink(ctx, outer.path, w);
}

/** Комиксное облако дыма из нескольких кругов: контур тушью, растр в тени. */
export function smokePuff(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  cx: number,
  cy: number,
  r: number,
  tones: Tones,
  w: number,
): void {
  const circles: { x: number; y: number; r: number }[] = [];
  const n = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.5;
    const d = r * (0.38 + rng() * 0.2);
    circles.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8, r: r * (0.42 + rng() * 0.18) });
  }
  circles.push({ x: cx, y: cy, r: r * 0.55 });
  const path = new Path2D();
  for (const c of circles) {
    path.moveTo(c.x + c.r, c.y);
    path.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  }
  // Обводка всего облака: сначала толстая тушь под всеми кругами.
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = w * 2;
  ctx.stroke(path);
  ctx.fillStyle = tones.shadow;
  ctx.fill(path);
  ctx.clip(path);
  // Основной тон со сдвигом к блику, растр в тени.
  ctx.fillStyle = tones.base;
  for (const c of circles) {
    ctx.beginPath();
    ctx.arc(c.x - r * 0.08, c.y - r * 0.1, c.r * 0.92, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = tones.light;
  for (const c of circles) {
    ctx.beginPath();
    ctx.arc(c.x - c.r * 0.32, c.y - c.r * 0.34, c.r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
  halftone(ctx, { x: cx - r, y: cy, w: r * 2, h: r }, INK, Math.max(4, r * 0.14), 0.3, r * 0.05, 0.35, {
    x: 0.4,
    y: 1,
  });
  ctx.restore();
}

/** Красно-белая диагональная лента с контуром тушью — для креста. */
export function hazardTape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  stripe: number,
  colors: { red: string; white: string },
  inkW: number,
  angle = Math.PI / 4,
): void {
  const path = roundRect(x, y, w, h, Math.min(w, h) * 0.12);
  ctx.save();
  ctx.fillStyle = colors.white;
  ctx.fill(path);
  ctx.clip(path);
  ctx.fillStyle = colors.red;
  const L = Math.hypot(w, h) * 2;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  for (let s = -L; s < L; s += stripe * 2) ctx.fillRect(s, -L, stripe, L * 2);
  ctx.restore();
  ink(ctx, path, inkW);
}

/** Меловой крест, двойной крест или звезда «от руки» неровной линией. */
export function chalkMark(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  cx: number,
  cy: number,
  size: number,
  kind: 'x' | 'xx' | 'star',
  color: string,
  w: number,
): void {
  const strokes: Pt[][] = [];
  const s = size / 2;
  if (kind === 'x' || kind === 'xx') {
    const offs = kind === 'xx' ? [-s * 0.32, s * 0.32] : [0];
    for (const o of offs) {
      strokes.push([
        { x: cx - s + o, y: cy - s * 0.85 },
        { x: cx + s * 0.95 + o, y: cy + s * 0.9 },
      ]);
      strokes.push([
        { x: cx + s * 0.9 + o, y: cy - s * 0.9 },
        { x: cx - s * 0.95 + o, y: cy + s * 0.85 },
      ]);
    }
  } else {
    const pts: Pt[] = [];
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      pts.push({ x: cx + Math.cos(a) * s, y: cy + Math.sin(a) * s });
    }
    strokes.push(pts);
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const st of strokes) {
    const wob = wobble(st, w * 0.22, rng, false, w * 2);
    // Подложка тушью — чтобы мел читался на светлом камне.
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = w * 1.7;
    ctx.stroke(pathFrom(wob, false));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke(pathFrom(wob, false));
    // Меловая неровность: редкие тёмные «пропуски».
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = w * 0.3;
    ctx.setLineDash([w * 0.6, w * 2.2]);
    ctx.stroke(pathFrom(wob, false));
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Отпечаток сапога. */
export function bootPrint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
  w: number,
  angle = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const s = size;
  const sole = new Path2D();
  sole.ellipse(0, -s * 0.18, s * 0.27, s * 0.3, 0, 0, Math.PI * 2);
  const heel = new Path2D();
  heel.ellipse(0, s * 0.3, s * 0.21, s * 0.17, 0, 0, Math.PI * 2);
  for (const p of [sole, heel]) {
    ctx.fillStyle = fill;
    ctx.fill(p);
    ink(ctx, p, w);
  }
  // Протектор.
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = w * 0.5;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -s * 0.18 + k * s * 0.12);
    ctx.lineTo(s * 0.16, -s * 0.18 + k * s * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

/** Отпечаток лапы: подушечка и четыре пальца. */
export function pawPrint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
  w: number,
  angle = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const s = size;
  const pad = new Path2D();
  pad.ellipse(0, s * 0.12, s * 0.25, s * 0.2, 0, 0, Math.PI * 2);
  const toes: Path2D[] = [];
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + (k - 1.5) * 0.55;
    const t = new Path2D();
    t.ellipse(
      Math.cos(a) * s * 0.36,
      s * 0.05 + Math.sin(a) * s * 0.36,
      s * 0.09,
      s * 0.12,
      a + Math.PI / 2,
      0,
      Math.PI * 2,
    );
    toes.push(t);
  }
  for (const p of [pad, ...toes]) {
    ctx.fillStyle = fill;
    ctx.fill(p);
    ink(ctx, p, w);
  }
  ctx.restore();
}

/** Мягкая круговая подсветка (для свечений в запасном пути без светового фильтра). */
export function radialGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha: number,
): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** Контактная тень: эллипс цвета туши с прозрачностью 35% и растром (7.5.16). */
export function contactShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.save();
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.35;
  ctx.fill(p);
  ctx.clip(p);
  ctx.globalAlpha = 1;
  halftone(
    ctx,
    { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 },
    INK,
    Math.max(3, rx * 0.16),
    0.5,
    rx * 0.06,
    0.4,
    { x: 0, y: 1 },
  );
  ctx.restore();
}
