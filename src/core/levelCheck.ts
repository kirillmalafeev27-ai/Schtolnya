// Проверка корректности сгенерированного уровня (план, 5 и этап 1).

import { balance } from '../config/balance';
import type { LevelDef } from '../config/levels';
import { Cell, cx, cy, isBorder } from './grid';
import type { GeneratedLevel } from './levelGen';
import { findDilemma, minBlastsToVein, openRegion } from './routes';

export function validateLevel(def: LevelDef, lvl: GeneratedLevel): string[] {
  const errors: string[] = [];
  const g = lvl.grid;
  if (g.w % 2 !== 1 || g.h % 2 !== 1) errors.push('стороны сетки должны быть нечётными');
  for (let i = 0; i < g.cells.length; i++) {
    if (isBorder(g, i) && i !== lvl.lift && g.cells[i] !== Cell.BEDROCK) errors.push(`кольцо не скала в ${i}`);
  }
  if (g.cells[lvl.lift] !== Cell.LIFT || cy(g, lvl.lift) !== 0) errors.push('подъёмник не в верхней стене');
  if (lvl.start !== lvl.lift + g.w || g.cells[lvl.start] !== Cell.FLOOR) errors.push('старт не под подъёмником');
  if (cx(g, lvl.start) % 2 !== 1) errors.push('старт не узел');
  if (g.cells[lvl.vein] !== Cell.VEIN || isBorder(g, lvl.vein)) errors.push('жила не на месте');
  if (lvl.lairs.length !== def.kobolds) errors.push('число логов не совпадает с числом кобольдов');
  const open = openRegion(g, lvl.start);
  for (const l of lvl.lairs) {
    if (g.cells[l] !== Cell.FLOOR) errors.push('логово не проход');
    if (open[l] < 0) errors.push('логово не связано со стартом без взрывов');
  }
  const k = minBlastsToVein(g, lvl.start, lvl.vein);
  if (k !== lvl.kMin) errors.push(`kMin ${lvl.kMin} не совпадает с пересчётом ${k}`);
  const [lo, hi] = def.blastsToVein;
  if (!lvl.relaxed && (k < lo || k > hi)) errors.push(`kMin ${k} вне диапазона ${lo}–${hi}`);
  if (!isFinite(k)) errors.push('жила недостижима');
  for (const s of lvl.spares) if (g.cells[s] !== Cell.FLOOR) errors.push('запасная шашка не на проходе');
  if (!lvl.relaxed && lvl.spares.length !== def.spareSticks) errors.push('не хватает запасных шашек');
  for (const p of lvl.pockets) if (g.cells[p] !== Cell.POCKET) errors.push('карман не на месте');
  if (!lvl.relaxed && lvl.pockets.length !== def.pockets) errors.push('не хватает карманов');
  if (!lvl.relaxed) {
    if (def.startSticks < k + 1) errors.push('стартовых шашек меньше kMin + 1');
    if (def.startSticks + lvl.spares.length < k + 3) errors.push('шашек с запасом меньше kMin + 3');
    const d = findDilemma(
      g,
      lvl.start,
      lvl.vein,
      k,
      def.startSticks + def.spareSticks - 1,
      balance.gen.dilemmaMinShorter,
    );
    if (!d.exists) errors.push('нет дилеммы маршрута');
  }
  const s2 = balance.score.vein + balance.score.stick * (def.startSticks - k - 1);
  if (lvl.s2 !== s2 || lvl.s3 !== s2 + balance.score.s3Bonus) errors.push('пороги звёзд');
  return errors;
}
