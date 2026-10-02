// Симуляция баланса ботами на настоящем движке правил (план, раздел 14).
// Запуск: npm run sim -- --level 3 --runs 2000 [--tmed 5] [--p 0.8] [--bot cautious]

import { balance } from '../src/config/balance';
import { getLevel, levels, type LevelDef } from '../src/config/levels';
import { generateLevel } from '../src/core/levelGen';
import { Rng } from '../src/core/rng';
import { reduce, type GameAction } from '../src/core/rules';
import { createState, type GameState } from '../src/core/state';
import { decide, newMemory, type BotKind } from './bots';

export interface RoundResult {
  won: boolean;
  cause: 'kobold' | 'blast' | 'timeout' | null;
  score: number;
  stars: number;
  stuns: number;
  lureAttempts: number;
  lureSuccess: number;
  time: number;
  answers: number;
}

const DT = 0.05;
const TIME_LIMIT_S = 900;

function normal(rng: Rng): number {
  const u = Math.max(1e-12, rng.float());
  const v = rng.float();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function simulateRound(
  def: LevelDef,
  bot: BotKind,
  seed: number,
  tMed = 5,
  p = 0.8,
  log?: (s: GameState, e: import('../src/core/events').GameEvent) => void,
): RoundResult {
  const rng = new Rng(seed ^ 0x5bd1e995);
  const gen = generateLevel(def, rng.chance(0.5), seed);
  let s: GameState = createState(def, gen, { tMed, p });
  const mem = newMemory();
  const answerDelay = () => tMed * Math.exp(0.5 * normal(rng));
  let nextAnswerAt = answerDelay();
  let answers = 0;
  let needDecision = true;
  let wasReady = false;
  let lastDecisionKey = '';

  const dispatch = (a: GameAction) => {
    const r = reduce(s, a);
    s = r.state;
    for (const e of r.events) {
      if (log) log(s, e);
      if (e.type === 'DENIED') {
        const it = s.hero.intent;
        mem.denied = lastDecisionKey;
        void it;
        continue;
      }
      if (e.type === 'BLAST' || e.type === 'KOBOLD_STEP' || e.type === 'STEP') mem.denied = '';
      if (
        e.type === 'BLAST' ||
        e.type === 'KOBOLD_STEP' ||
        e.type === 'KOBOLD_WAKE' ||
        e.type === 'KOBOLD_RECOVERED' ||
        e.type === 'INTENT' ||
        e.type === 'READY' ||
        e.type === 'PICKUP'
      )
        needDecision = true;
      if (e.type === 'KOBOLD_STUNNED' && mem.lureAttempts > 0) mem.lureSuccess++;
    }
  };

  while (s.status === 'playing' && s.time < TIME_LIMIT_S) {
    if (needDecision || (bot === 'lure' && mem.luring)) {
      needDecision = false;
      const d = decide(bot, s, mem);
      if (d) {
        lastDecisionKey = `${d.kind}:${d.cell ?? ''}`;
        dispatch({ type: 'SET_INTENT', kind: d.kind, cell: d.cell });
      }
      if (s.status !== 'playing') break;
    }
    // Пока действие накоплено, кнопки неактивны: следующий вопрос «замер».
    if (s.hero.ready) {
      wasReady = true;
    } else if (wasReady) {
      wasReady = false;
      nextAnswerAt = s.time + answerDelay();
    }
    if (!s.hero.ready && s.time >= nextAnswerAt) {
      const correct = rng.float() < p;
      const t = Math.round((s.time - (nextAnswerAt - answerDelay())) * 1000);
      dispatch({ type: 'ANSWER', correct, timeMs: Math.max(300, t) });
      answers++;
      nextAnswerAt = s.time + (correct ? 0 : balance.rules.wrongFeedbackMs / 1000) + answerDelay();
      needDecision = true;
      if (s.status !== 'playing') break;
    }
    dispatch({ type: 'TICK', dt: DT });
  }
  const won = s.status === 'won';
  return {
    won,
    cause: won ? null : s.status === 'lost' ? s.cause : 'timeout',
    score: s.finalScore,
    stars: s.stars,
    stuns: s.stats.stuns,
    lureAttempts: mem.lureAttempts,
    lureSuccess: Math.min(mem.lureSuccess, mem.lureAttempts),
    time: s.time,
    answers,
  };
}

export interface BotReport {
  level: number;
  bot: BotKind;
  runs: number;
  winRate: number;
  avgScore: number;
  avgScoreWins: number;
  blastRate: number;
  koboldRate: number;
  timeoutRate: number;
  stunsPerRound: number;
  lureSuccessRate: number;
  stars: [number, number, number];
  avgTimeS: number;
}

export function report(def: LevelDef, bot: BotKind, runs: number, tMed = 5, p = 0.8, seed0 = 1): BotReport {
  let wins = 0;
  let score = 0;
  let scoreWins = 0;
  let blast = 0;
  let kobold = 0;
  let timeout = 0;
  let stuns = 0;
  let lureA = 0;
  let lureS = 0;
  let time = 0;
  const stars: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < runs; i++) {
    const r = simulateRound(def, bot, seed0 + i * 104729, tMed, p);
    if (r.won) {
      wins++;
      scoreWins += r.score;
      stars[r.stars - 1]++;
    }
    score += r.score;
    if (r.cause === 'blast') blast++;
    if (r.cause === 'kobold') kobold++;
    if (r.cause === 'timeout') timeout++;
    stuns += r.stuns;
    lureA += r.lureAttempts;
    lureS += r.lureSuccess;
    time += r.time;
  }
  return {
    level: def.id,
    bot,
    runs,
    winRate: wins / runs,
    avgScore: score / runs,
    avgScoreWins: wins ? scoreWins / wins : 0,
    blastRate: blast / runs,
    koboldRate: kobold / runs,
    timeoutRate: timeout / runs,
    stunsPerRound: stuns / runs,
    lureSuccessRate: lureA ? lureS / lureA : 0,
    stars,
    avgTimeS: time / runs,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(6);

export function formatReport(r: BotReport): string {
  const wins = r.stars[0] + r.stars[1] + r.stars[2];
  const s2 = wins ? (r.stars[1] + r.stars[2]) / wins : 0;
  const s3 = wins ? r.stars[2] / wins : 0;
  return [
    `ур.${r.level}`.padEnd(5),
    r.bot.padEnd(9),
    `побед ${pct(r.winRate)}`,
    `счёт ${r.avgScore.toFixed(1).padStart(5)} (в победах ${r.avgScoreWins.toFixed(1).padStart(5)})`,
    `свой взрыв ${pct(r.blastRate)}`,
    `кобольд ${pct(r.koboldRate)}`,
    `таймаут ${pct(r.timeoutRate)}`,
    `оглуш. ${r.stunsPerRound.toFixed(2)}`,
    `приманки ${pct(r.lureSuccessRate)}`,
    `★★+ ${pct(s2)} ★★★ ${pct(s3)}`,
    `время ${r.avgTimeS.toFixed(0)}с`,
  ].join(' │ ');
}

function main() {
  const args = process.argv.slice(2);
  const arg = (name: string, def: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
  };
  const runs = +arg('runs', '300');
  const tMed = +arg('tmed', String(balance.pace.defaultTMed));
  const p = +arg('p', String(balance.pace.defaultP));
  const levelArg = arg('level', 'all');
  const botArg = arg('bot', 'all');
  const fuseOv = arg('fuse', '');
  const kstepOv = arg('kstep', '');
  const lvls = (levelArg === 'all' ? levels : [getLevel(+levelArg)]).map((l) => ({
    ...l,
    fuseAnswers: fuseOv ? +fuseOv : l.fuseAnswers,
    koboldStepAnswers: kstepOv ? +kstepOv : l.koboldStepAnswers,
  }));
  const bots: BotKind[] = botArg === 'all' ? ['cautious', 'bold', 'lure'] : [botArg as BotKind];
  console.log(`Симуляция: T_med = ${tMed} с, p = ${p}, раундов на бота: ${runs}`);
  for (const def of lvls) {
    for (const bot of bots) {
      const t0 = Date.now();
      const r = report(def, bot, runs, tMed, p);
      console.log(formatReport(r) + ` │ ${((Date.now() - t0) / 1000).toFixed(1)} с`);
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('sim.ts')) main();
