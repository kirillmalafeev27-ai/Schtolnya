// Трассировка одного раунда бота (тот же движок, что и в симуляции): печатает события и карту.
import { balance } from '../src/config/balance';
import { getLevel } from '../src/config/levels';
import { Cell } from '../src/core/grid';
import type { GameState } from '../src/core/state';
import type { BotKind } from './bots';
import { simulateRound } from './sim';

if (process.env.FUSEMAX) (balance.rules as { fuseMaxS: number }).fuseMaxS = +process.env.FUSEMAX;
const id = +(process.argv[2] ?? 1);
const seed = +(process.argv[3] ?? 1);
const bot = (process.argv[4] ?? 'cautious') as BotKind;
const fuse = process.argv[5] ? +process.argv[5] : undefined;
const kstep = process.argv[6] ? +process.argv[6] : undefined;
const def = {
  ...getLevel(id),
  ...(fuse ? { fuseAnswers: fuse } : {}),
  ...(kstep ? { koboldStepAnswers: kstep } : {}),
};

function map(s: GameState): string {
  const ch: Record<number, string> = {
    [Cell.FLOOR]: '.',
    [Cell.ROCK]: 'R',
    [Cell.HARD]: 'X',
    [Cell.BEDROCK]: '#',
    [Cell.VEIN]: 'V',
    [Cell.POCKET]: 'P',
    [Cell.LIFT]: 'L',
  };
  let o = '';
  for (let y = 0; y < s.grid.h; y++) {
    for (let x = 0; x < s.grid.w; x++) {
      const i = y * s.grid.w + x;
      let c = ch[s.grid.cells[i]];
      if (s.items.some((it) => it.cell === i)) c = 'S';
      if (s.kobolds.some((k) => k.cell === i)) c = 'K';
      if (s.hero.cell === i) c = 'H';
      if (s.fuse?.cell === i) c = '*';
      o += c;
    }
    o += '\n';
  }
  return o;
}
const r = simulateRound(def, bot, seed, 5, 0.8, (s, e) => {
  const xy = (i: number) => `(${i % s.grid.w},${(i / s.grid.w) | 0})`;
  const ee: Record<string, unknown> = { ...e };
  for (const k of ['from', 'to', 'cell', 'origin', 'stand', 'next'])
    if (typeof ee[k] === 'number') ee[k] = xy(ee[k] as number);
  if (Array.isArray(ee.cells)) ee.cells = (ee.cells as number[]).map(xy).join(' ');
  const it = ee.intent as { target?: number } | undefined;
  if (it && it.target !== undefined) ee.intent = { ...it, target: xy(it.target) };
  if (e.type === ('TICK' as never)) return;
  console.log(s.time.toFixed(1), JSON.stringify(ee));
  if (e.type === 'BLAST' || e.type === 'PLANTED' || e.type === 'HERO_BLASTED' || e.type === 'CAUGHT')
    console.log(map(s));
});
console.log(r);
