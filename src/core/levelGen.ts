// Генерация уровня (план, раздел 5). Детерминирована по сиду.

import { balance } from '../config/balance';
import { hallDims, LevelDef } from '../config/levels';
import { Cell, cloneGrid, cx, cy, Grid, idx, isBorder, manhattan, neighbor } from './grid';
import { addLoops, carveMaze, wallsBetweenNodes } from './maze';
import { bfsDist, blastDist } from './pathfinding';
import { Rng, deriveSeed } from './rng';
import { cheapestRouteCells, findDilemma, minBlastsToVein, minRoute, openRegion, routeCost, veinTargets } from './routes';

export interface GeneratedLevel {
  seed: number;
  /** С какой попытки получился уровень (1…). */
  attempts: number;
  /** Требования пришлось ослабить (5.14). */
  relaxed: boolean;
  warnings: string[];
  grid: Grid;
  lift: number;
  start: number;
  vein: number;
  lairs: number[];
  spares: number[];
  pockets: number[];
  rubble: number[];
  shortcuts: number[];
  kMin: number;
  minRoute: number[];
  minRouteSteps: number;
  dilemma: { altBlasts: number; altSteps: number } | null;
  s2: number;
  s3: number;
}

export interface GenOptions {
  /** Сколько левых колонок узлов не годятся для подъёмника (там лежит плашка снаряжения). */
  liftSkipColumns?: number;
}

const G = balance.gen;

function floorNeighbors(g: Grid, i: number): number {
  let n = 0;
  for (let d = 0; d < 4; d++) {
    const nb = neighbor(g, i, d);
    if (nb >= 0 && g.cells[nb] === Cell.FLOOR) n++;
  }
  return n;
}

function nonBedrockNeighbors(g: Grid, i: number): number {
  let n = 0;
  for (let d = 0; d < 4; d++) {
    const nb = neighbor(g, i, d);
    if (nb >= 0 && g.cells[nb] !== Cell.BEDROCK && g.cells[nb] !== Cell.LIFT) n++;
  }
  return n;
}

function lairsConnected(g: Grid, start: number, lairs: number[]): boolean {
  const open = openRegion(g, start);
  return lairs.every((l) => open[l] >= 0);
}

/** Стенка-скала между двумя непроходимыми для героя, но не скальными клетками или проходами. */
function isWallBetweenPassages(g: Grid, i: number): boolean {
  if (g.cells[i] !== Cell.BEDROCK || isBorder(g, i)) return false;
  const x = cx(g, i);
  const y = cy(g, i);
  const open = (xx: number, yy: number) => {
    const t = g.cells[idx(g, xx, yy)];
    return t === Cell.FLOOR || t === Cell.ROCK || t === Cell.HARD;
  };
  return (open(x - 1, y) && open(x + 1, y)) || (open(x, y - 1) && open(x, y + 1));
}

interface Attempt {
  ok: boolean;
  reason?: string;
  level?: Omit<GeneratedLevel, 'seed' | 'attempts' | 'relaxed' | 'warnings'>;
}

function tryGenerate(def: LevelDef, w: number, h: number, rng: Rng, strict: boolean, opts: GenOptions): Attempt {
  const [lo, hi] = def.blastsToVein;
  const g = carveMaze(w, h, rng);
  addLoops(g, rng, G.loopFraction);

  // Подъёмник и старт (5.4).
  const nodesX: number[] = [];
  const skip = opts.liftSkipColumns ?? 0;
  for (let x = 1 + 2 * skip; x < w - 1; x += 2) nodesX.push(x);
  if (!nodesX.length) for (let x = 1; x < w - 1; x += 2) nodesX.push(x);
  const lx = rng.pick(nodesX);
  const lift = idx(g, lx, 0);
  const start = idx(g, lx, 1);
  g.cells[lift] = Cell.LIFT;

  // Расстояния от старта (5.5).
  const floorPass = (i: number) => g.cells[i] === Cell.FLOOR;
  const dist = bfsDist(g, [start], floorPass);
  let maxDist = 0;
  for (let i = 0; i < dist.length; i++) maxDist = Math.max(maxDist, dist[i]);

  // Жила: в стенке рядом с далёким проходом (5.6).
  const veinCandidates: number[] = [];
  for (let i = 0; i < g.cells.length; i++) {
    if (g.cells[i] !== Cell.BEDROCK || isBorder(g, i)) continue;
    let far = false;
    for (let d = 0; d < 4; d++) {
      const nb = neighbor(g, i, d);
      if (nb >= 0 && g.cells[nb] === Cell.FLOOR && dist[nb] >= G.veinDistFrac * maxDist) far = true;
    }
    if (far && manhattan(g, i, start) > 2) veinCandidates.push(i);
  }
  if (!veinCandidates.length) return { ok: false, reason: 'vein' };
  rng.shuffle(veinCandidates);

  // Логова: тупики далеко от старта и не рядом с жилой (5.7). Перебираем места жилы,
  // пока для неё находятся логова — это та же жила по правилу 5.6, просто выбранная с оглядкой на 5.7.
  const deadEnds: number[] = [];
  for (let i = 0; i < g.cells.length; i++) {
    if (g.cells[i] !== Cell.FLOOR || i === start) continue;
    if (floorNeighbors(g, i) === 1) deadEnds.push(i);
  }
  const pickLairs = (vein: number): number[] => {
    // Логово, далёкое от жилы по штольням, оставляет место для завалов между стартом и жилой.
    const fromVein = bfsDist(g, [vein], floorPass);
    const cands = deadEnds
      .filter((i) => dist[i] >= G.lairDistFrac * maxDist && manhattan(g, i, vein) >= G.lairVeinMinDist)
      .map((i) => ({ i, key: -Math.max(0, fromVein[i]) - rng.float() * 3 }))
      .sort((a, b) => a.key - b.key)
      .map((o) => o.i);
    const out: number[] = [];
    // Перебор пар: для двух кобольдов ищем пару, разнесённую не меньше чем на lairLairMinDist.
    for (const c of cands) {
      if (out.length >= def.kobolds) break;
      if (out.every((l) => manhattan(g, l, c) >= G.lairLairMinDist)) out.push(c);
    }
    return out;
  };
  let vein = -1;
  let lairs: number[] = [];
  for (const v of veinCandidates) {
    const l = pickLairs(v);
    if (l.length >= def.kobolds) {
      vein = v;
      lairs = l;
      break;
    }
  }
  if (vein < 0) {
    if (strict) return { ok: false, reason: 'lair' };
    vein = veinCandidates[0];
    lairs = pickLairs(vein);
    // Ослабленный режим: самые далёкие от старта проходы.
    const fallback = [...deadEnds, ...Array.from(dist.keys()).filter((i) => g.cells[i] === Cell.FLOOR)]
      .filter((i) => i !== start && !lairs.includes(i) && manhattan(g, i, vein) >= 2)
      .sort((a, b) => dist[b] - dist[a]);
    for (const c of fallback) {
      if (lairs.length >= def.kobolds) break;
      if (lairs.every((l) => manhattan(g, l, c) >= 2)) lairs.push(c);
    }
    if (lairs.length < def.kobolds) return { ok: false, reason: 'lair' };
  }
  g.cells[vein] = Cell.VEIN;

  // Завалы: по одной клетке маршрута, пока kMin не попадёт в диапазон (5.8).
  // Кандидаты — проходы на любом самом дешёвом маршруте; ближние к жиле — чаще.
  const rubble: number[] = [];
  let kMin = minBlastsToVein(g, start, vein);
  const toVeinSteps = bfsDist(g, veinTargets(g, vein), (i) => g.cells[i] !== Cell.BEDROCK && g.cells[i] !== Cell.LIFT);
  let guard = 0;
  while (kMin < lo && guard++ < 60) {
    const keyed = cheapestRouteCells(g, start, vein)
      .filter((c) => g.cells[c] === Cell.FLOOR && c !== start && !lairs.includes(c) && manhattan(g, c, start) > 1)
      .map((c) => ({ c, key: Math.max(0, toVeinSteps[c]) + rng.float() * 4 }));
    keyed.sort((a, b) => a.key - b.key);
    let accepted = false;
    for (const { c } of keyed) {
      const tryTypes = rng.chance(def.hardFraction) ? [Cell.HARD, Cell.ROCK] : [Cell.ROCK];
      for (const t of tryTypes) {
        g.cells[c] = t;
        if (!lairsConnected(g, start, lairs)) {
          g.cells[c] = Cell.FLOOR;
          break;
        }
        const k = minBlastsToVein(g, start, vein);
        if (k > hi) {
          g.cells[c] = Cell.FLOOR;
          continue;
        }
        kMin = k;
        accepted = true;
        rubble.push(c);
        break;
      }
      if (accepted) break;
    }
    if (!accepted) return { ok: false, reason: 'rubble' };
  }
  if (kMin < lo || kMin > hi) return { ok: false, reason: 'kMin' };

  // Крепкая порода вне маршрута: часть боковых проходов-тупиков тоже завалена — для разнообразия.
  // (Не влияет на kMin: проверяется ниже.)

  // Срезки: 3–5 стенок-скал между проходами превращаются в породу (5.9).
  const shortcuts: number[] = [];
  const wallCands = rng.shuffle(wallsBetweenNodes(g).filter((i) => isWallBetweenPassages(g, i) && i !== vein));
  const wantShortcuts = rng.int(G.shortcutsMin, G.shortcutsMax);
  for (const c of wallCands) {
    if (shortcuts.length >= wantShortcuts) break;
    if (manhattan(g, c, lift) <= 1) continue;
    g.cells[c] = rng.chance(def.hardFraction * 0.5) ? Cell.HARD : Cell.ROCK;
    const k = minBlastsToVein(g, start, vein);
    if (k < lo) {
      g.cells[c] = Cell.BEDROCK;
      continue;
    }
    kMin = k;
    shortcuts.push(c);
  }

  // Дилемма маршрута (5.10): если её нет, подходящая стенка превращается в породу.
  const budget = def.startSticks + def.spareSticks - 1;
  let dilemma = findDilemma(g, start, vein, kMin, budget, G.dilemmaMinShorter);
  if (!dilemma.exists) {
    const more = rng.shuffle(
      wallsBetweenNodes(g).filter(
        (i) => isWallBetweenPassages(g, i) && i !== vein && !shortcuts.includes(i) && manhattan(g, i, lift) > 1,
      ),
    );
    const fixes: number[] = [];
    for (const c of more) {
      g.cells[c] = Cell.ROCK;
      const k = minBlastsToVein(g, start, vein);
      if (k >= lo && k <= hi && findDilemma(g, start, vein, k, budget, G.dilemmaMinShorter).exists) fixes.push(c);
      g.cells[c] = Cell.BEDROCK;
      if (fixes.length >= G.dilemmaFixTries) break;
    }
    if (fixes.length) {
      const c = rng.pick(fixes);
      g.cells[c] = Cell.ROCK;
      kMin = minBlastsToVein(g, start, vein);
      shortcuts.push(c);
      dilemma = findDilemma(g, start, vein, kMin, budget, G.dilemmaMinShorter);
    }
  }
  if (!dilemma.exists && strict) return { ok: false, reason: 'dilemma' };

  const info = minRoute(g, start, vein);
  if (!info) return { ok: false, reason: 'route' };
  const routeSet = new Set(info.route);

  // Запасные шашки: тупики, достижимые без взрывов или одним взрывом, вдали от маршрута (5.11).
  const fromStart = blastDist(g, [start], routeCost(g, vein));
  const nearRoute = bfsDist(g, info.route, (i) => g.cells[i] !== Cell.BEDROCK && g.cells[i] !== Cell.LIFT);
  const spareCands = rng.shuffle(
    Array.from({ length: g.cells.length }, (_, i) => i).filter(
      (i) =>
        g.cells[i] === Cell.FLOOR &&
        i !== start &&
        !lairs.includes(i) &&
        floorNeighbors(g, i) <= 1 &&
        fromStart[i] <= 1 &&
        nearRoute[i] >= G.spareMinRouteDist,
    ),
  );
  const spares: number[] = [];
  for (const c of spareCands) {
    if (spares.length >= def.spareSticks) break;
    if (spares.every((s) => manhattan(g, s, c) >= 2)) spares.push(c);
  }
  if (spares.length < def.spareSticks) {
    if (strict) return { ok: false, reason: 'spares' };
    const rest = Array.from({ length: g.cells.length }, (_, i) => i)
      .filter(
        (i) =>
          g.cells[i] === Cell.FLOOR && i !== start && !lairs.includes(i) && !spares.includes(i) && fromStart[i] <= 1,
      )
      .sort((a, b) => nearRoute[b] - nearRoute[a]);
    for (const c of rest) {
      if (spares.length >= def.spareSticks) break;
      spares.push(c);
    }
  }

  // Карманы: в стенках вдоль боковых проходов, не на минимальном маршруте (5.12).
  const pockets: number[] = [];
  if (def.pockets > 0) {
    const pocketCands = rng.shuffle(
      Array.from({ length: g.cells.length }, (_, i) => i).filter((i) => {
        if (g.cells[i] !== Cell.BEDROCK || isBorder(g, i)) return false;
        if (manhattan(g, i, lift) <= 1 || manhattan(g, i, vein) <= 1) return false;
        let side = false;
        for (let d = 0; d < 4; d++) {
          const nb = neighbor(g, i, d);
          if (nb < 0) continue;
          if (routeSet.has(nb)) return false;
          if (g.cells[nb] === Cell.FLOOR && !lairs.includes(nb)) side = true;
        }
        return side;
      }),
    );
    // Сначала карманы, которые не открывают новых путей (у них один открытый сосед).
    pocketCands.sort((a, b) => nonBedrockNeighbors(g, a) - nonBedrockNeighbors(g, b));
    for (const c of pocketCands) {
      if (pockets.length >= def.pockets) break;
      if (pockets.some((p) => manhattan(g, p, c) < 3)) continue;
      g.cells[c] = Cell.POCKET;
      const k = minBlastsToVein(g, start, vein);
      if (k < lo) {
        g.cells[c] = Cell.BEDROCK;
        continue;
      }
      kMin = k;
      pockets.push(c);
    }
    if (pockets.length < def.pockets && strict) return { ok: false, reason: 'pockets' };
  }

  if (!lairsConnected(g, start, lairs)) return { ok: false, reason: 'lairRegion' };

  const finalInfo = minRoute(g, start, vein);
  if (!finalInfo) return { ok: false, reason: 'route' };
  kMin = finalInfo.kMin;
  if (kMin < lo || kMin > hi) return { ok: false, reason: 'kMinFinal' };

  // Проверка запаса шашек (5.13).
  const supplyOk = def.startSticks >= kMin + 1 && def.startSticks + spares.length >= kMin + 3;
  if (!supplyOk && strict) return { ok: false, reason: 'supply' };

  const finalDilemma = findDilemma(g, start, vein, kMin, budget, G.dilemmaMinShorter);
  if (!finalDilemma.exists && strict) return { ok: false, reason: 'dilemmaFinal' };

  // Пороги звёзд (5.15).
  const s2 = balance.score.vein + balance.score.stick * (def.startSticks - kMin - 1);
  const s3 = s2 + balance.score.s3Bonus;

  return {
    ok: true,
    level: {
      grid: g,
      lift,
      start,
      vein,
      lairs,
      spares,
      pockets,
      rubble,
      shortcuts,
      kMin,
      minRoute: finalInfo.route,
      minRouteSteps: finalInfo.steps,
      dilemma: finalDilemma.exists ? { altBlasts: finalDilemma.altBlasts, altSteps: finalDilemma.altSteps } : null,
      s2,
      s3,
    },
  };
}

export function generateLevel(
  def: LevelDef,
  landscape: boolean,
  seed: number,
  opts: GenOptions = { liftSkipColumns: 1 },
): GeneratedLevel {
  const { w, h } = hallDims(def.hall, landscape);
  const reasons: Record<string, number> = {};
  for (let attempt = 0; attempt < G.maxAttempts; attempt++) {
    const rng = new Rng(deriveSeed(seed, attempt));
    const res = tryGenerate(def, w, h, rng, true, opts);
    if (res.ok && res.level) {
      return { ...res.level, seed, attempts: attempt + 1, relaxed: false, warnings: [] };
    }
    reasons[res.reason ?? '?'] = (reasons[res.reason ?? '?'] ?? 0) + 1;
  }
  const warning = `levelGen: уровень ${def.id}, сид ${seed}: за ${G.maxAttempts} попыток строгие требования не выполнены (${JSON.stringify(reasons)}), требования ослаблены`;
  for (let attempt = 0; attempt < G.maxAttempts * 4; attempt++) {
    const rng = new Rng(deriveSeed(seed, 1000 + attempt));
    const res = tryGenerate(def, w, h, rng, false, opts);
    if (res.ok && res.level) {
      return { ...res.level, seed, attempts: G.maxAttempts + attempt + 1, relaxed: true, warnings: [warning] };
    }
  }
  throw new Error(`levelGen: не удалось построить уровень ${def.id} для сида ${seed}`);
}

/** Копия уровня (генератор отдаёт новую сетку, но состояние раунда не должно делить её с другими). */
export function cloneLevel(l: GeneratedLevel): GeneratedLevel {
  return { ...l, grid: cloneGrid(l.grid), lairs: l.lairs.slice(), spares: l.spares.slice() };
}
