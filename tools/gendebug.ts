// Отладка генератора: печатает уровень в ASCII.
import { getLevel } from '../src/config/levels';
import { generateLevel } from '../src/core/levelGen';
import { Cell } from '../src/core/grid';
const id = +(process.argv[2] ?? 6);
const seed = +(process.argv[3] ?? 1);
const land = process.argv[4] === 'land';
const def = getLevel(id);
const l = generateLevel(def, land, seed);
const ch: Record<number, string> = {
  [Cell.FLOOR]: '.',
  [Cell.ROCK]: 'R',
  [Cell.HARD]: 'X',
  [Cell.BEDROCK]: '#',
  [Cell.VEIN]: 'V',
  [Cell.POCKET]: 'P',
  [Cell.LIFT]: 'L',
};
const g = l.grid;
let out = '';
for (let y = 0; y < g.h; y++) {
  for (let x = 0; x < g.w; x++) {
    const i = y * g.w + x;
    let c = ch[g.cells[i]];
    if (l.lairs.includes(i)) c = 'K';
    if (l.spares.includes(i)) c = 'S';
    if (i === l.start) c = 'H';
    if (l.minRoute.includes(i) && c === '.') c = '·';
    out += c;
  }
  out += '\n';
}
console.log(out);
console.log({
  attempts: l.attempts,
  relaxed: l.relaxed,
  kMin: l.kMin,
  steps: l.minRouteSteps,
  dilemma: l.dilemma,
  s2: l.s2,
  s3: l.s3,
  warnings: l.warnings,
});
