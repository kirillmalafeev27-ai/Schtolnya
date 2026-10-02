// Исходы раундов по сидам (для трассировки): npx tsx tools/seeds.ts <level> [koboldStep] [bot]; FUSE=…, FUSEMAX=… — подмена фитиля.
import { balance } from '../src/config/balance';
import { getLevel } from '../src/config/levels';
import { simulateRound } from './sim';
(balance.rules as { fuseMaxS: number }).fuseMaxS = +(process.env.FUSEMAX ?? balance.rules.fuseMaxS);
const base = getLevel(+(process.argv[2] ?? 1));
const def = {
  ...base,
  fuseAnswers: +(process.env.FUSE ?? base.fuseAnswers),
  koboldStepAnswers: +(process.argv[3] ?? base.koboldStepAnswers),
};
const out: string[] = [];
for (let i = 0; i < 24; i++) {
  const seed = 1 + i * 104729;
  const r = simulateRound(def, (process.argv[4] ?? 'cautious') as 'cautious', seed);
  out.push(`${seed}:${r.won ? 'W' : r.cause}@${r.time.toFixed(0)}`);
}
console.log(out.join(' '));
