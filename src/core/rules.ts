// Редуктор правил (план, раздел 2 и 13.3). Состояние меняется только через reduce(state, action).

import { balance } from '../config/balance';
import { blastCross } from './blast';
import type { DenyReason, GameEvent, WakeCause } from './events';
import { Cell, cx, isDestructible, isWalkable, manhattan } from './grid';
import { burningCross, classifyTap, heroRoute, shelterTarget, standCellFor } from './intent';
import { koboldField } from './kobold';
import { bfsDist, nextStep } from './pathfinding';
import { cloneState, GameState, Intent, KoboldState } from './state';

export type IntentAction = 'move' | 'plant' | 'home' | 'stay';

export type GameAction =
  | { type: 'TICK'; dt: number }
  | { type: 'ANSWER'; correct: boolean; timeMs: number }
  | { type: 'SET_INTENT'; kind: IntentAction; cell?: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
}

const R = balance.rules;

export function reduce(state: GameState, action: GameAction): ReduceResult {
  const s = cloneState(state);
  const ev: GameEvent[] = [];
  switch (action.type) {
    case 'TICK':
      tick(s, ev, action.dt);
      break;
    case 'ANSWER':
      answer(s, ev, action.correct, action.timeMs);
      break;
    case 'SET_INTENT':
      setIntentAction(s, ev, action.kind, action.cell);
      break;
    case 'PAUSE':
      if (!s.paused) {
        s.paused = true;
        ev.push({ type: 'PAUSED' });
      }
      break;
    case 'RESUME':
      if (s.paused) {
        s.paused = false;
        ev.push({ type: 'RESUMED' });
      }
      break;
  }
  return { state: s, events: ev };
}

// ───────────────────────── намерения ─────────────────────────

function setIntent(s: GameState, ev: GameEvent[], intent: Intent, auto: boolean): void {
  s.hero.intent = intent;
  ev.push({ type: 'INTENT', intent: { ...intent } as Intent, auto });
}

function bankReady(s: GameState, ev: GameEvent[]): void {
  if (!s.hero.ready) {
    s.hero.ready = true;
    ev.push({ type: 'READY' });
  }
}

function deny(ev: GameEvent[], reason: DenyReason, cell: number): void {
  ev.push({ type: 'DENIED', reason, cell });
}

function spendReady(s: GameState, ev: GameEvent[]): void {
  if (!s.hero.ready) return;
  s.hero.ready = false;
  ev.push({ type: 'ACTION_SPENT' });
  performAction(s, ev);
}

function setIntentAction(s: GameState, ev: GameEvent[], kind: IntentAction, cell?: number): void {
  if (s.status !== 'playing' || s.paused) return;
  const h = s.hero;

  if (kind === 'stay') {
    setIntent(s, ev, { kind: 'stay' }, false);
    return;
  }

  if (kind === 'home') {
    if (!h.hasVein) {
      deny(ev, 'liftLocked', s.lift);
      return;
    }
    if (!heroRoute(s, { kind: 'home' })) {
      deny(ev, 'noPath', s.lift);
      return;
    }
    setIntent(s, ev, { kind: 'home' }, false);
    spendReady(s, ev);
    return;
  }

  if (cell === undefined) return;
  const tap = classifyTap(s, cell);
  switch (tap) {
    case 'none':
      return;
    case 'stay':
      setIntent(s, ev, { kind: 'stay' }, false);
      return;
    case 'home':
      setIntentAction(s, ev, 'home');
      return;
    case 'bedrock':
      deny(ev, 'bedrock', cell);
      return;
    case 'move': {
      const intent: Intent = { kind: 'move', target: cell };
      if (!heroRoute(s, intent)) {
        deny(ev, 'noPath', cell);
        return;
      }
      setIntent(s, ev, intent, false);
      spendReady(s, ev);
      return;
    }
    case 'plant': {
      if (s.fuse) {
        deny(ev, 'fuseBusy', cell);
        return;
      }
      if (h.sticks <= 0) {
        deny(ev, 'noSticks', cell);
        return;
      }
      const adjacent = manhattan(s.grid, h.cell, cell) === 1;
      if (!adjacent && standCellFor(s, cell) === null) {
        deny(ev, 'noPath', cell);
        return;
      }
      if (!adjacent && !heroRoute(s, { kind: 'plant', target: cell })) {
        deny(ev, 'noPath', cell);
        return;
      }
      setIntent(s, ev, { kind: 'plant', target: cell }, false);
      spendReady(s, ev);
      return;
    }
  }
}

// ───────────────────────── ответы и действия ─────────────────────────

function answer(s: GameState, ev: GameEvent[], correct: boolean, timeMs: number): void {
  if (s.status !== 'playing' || s.paused) return;
  if (correct && s.hero.ready) return; // кнопки неактивны: копить больше одного действия нельзя
  ev.push({ type: 'ANSWERED', correct, timeMs, fuseBurning: s.fuse !== null });
  s.stats.answerTimesMs.push(timeMs);
  if (!correct) {
    s.stats.wrong++;
    return;
  }
  s.stats.correct++;
  performAction(s, ev);
}

/** Одно действие героя по текущему намерению: шаг или закладка (2.2.1). */
function performAction(s: GameState, ev: GameEvent[]): void {
  const h = s.hero;
  const intent = h.intent;

  if (intent.kind === 'stay') {
    bankReady(s, ev);
    return;
  }

  if (intent.kind === 'plant') {
    const t = intent.target;
    if (!isDestructible(s.grid.cells[t])) {
      setIntent(s, ev, { kind: 'stay' }, true);
      bankReady(s, ev);
      return;
    }
    if (manhattan(s.grid, h.cell, t) === 1) {
      plant(s, ev, t);
      return;
    }
  }

  const route = heroRoute(s, intent);
  if (!route) {
    const target = intent.kind === 'move' || intent.kind === 'plant' ? intent.target : s.lift;
    deny(ev, 'noPath', target);
    setIntent(s, ev, { kind: 'stay' }, true);
    bankReady(s, ev);
    return;
  }
  if (route.length === 0) {
    setIntent(s, ev, { kind: 'stay' }, true);
    bankReady(s, ev);
    return;
  }
  const next = route[0];
  if (next === s.lift && !h.hasVein) {
    deny(ev, 'liftLocked', s.lift);
    setIntent(s, ev, { kind: 'stay' }, true);
    bankReady(s, ev);
    return;
  }
  moveHero(s, ev, next, intent.kind === 'shelter');
  if (s.status !== 'playing') return;
  // Бегом в укрытие (DECISIONS.md): один верный ответ уводит с креста целиком, а не на одну клетку.
  if (intent.kind === 'shelter') {
    for (let guard = 0; guard < 8; guard++) {
      const cross = burningCross(s);
      if (!cross || !cross.has(h.cell)) break;
      const more = heroRoute(s, h.intent);
      if (!more || !more.length || more[0] === s.lift) break;
      moveHero(s, ev, more[0], true);
      if (s.status !== 'playing') return;
    }
  }

  if (intent.kind === 'move' && h.cell === intent.target) {
    setIntent(s, ev, { kind: 'stay' }, true);
  } else if (intent.kind === 'shelter') {
    const cross = burningCross(s);
    if (!cross || !cross.has(h.cell)) setIntent(s, ev, { kind: 'stay' }, true);
  }
}

function plant(s: GameState, ev: GameEvent[], target: number): void {
  const h = s.hero;
  if (s.fuse) {
    deny(ev, 'fuseBusy', target);
    bankReady(s, ev);
    return;
  }
  if (h.sticks <= 0) {
    deny(ev, 'noSticks', target);
    setIntent(s, ev, { kind: 'stay' }, true);
    bankReady(s, ev);
    return;
  }
  h.sticks--;
  s.stats.sticksUsed++;
  s.fuse = { cell: target, stand: h.cell, remaining: s.params.fuseS, total: s.params.fuseS, lastCount: 0 };
  ev.push({ type: 'PLANTED', cell: target, stand: h.cell, fuseS: s.params.fuseS });
  // Сразу после закладки намерение — «в укрытие» (2.3.8).
  const shelter = shelterTarget(s);
  if (shelter === null) {
    ev.push({ type: 'NO_SHELTER', cell: h.cell });
    setIntent(s, ev, { kind: 'stay' }, true);
  } else if (shelter === h.cell) {
    setIntent(s, ev, { kind: 'stay' }, true);
  } else {
    setIntent(s, ev, { kind: 'shelter' }, true);
  }
}

function moveHero(s: GameState, ev: GameEvent[], next: number, shelter: boolean): void {
  const h = s.hero;
  const from = h.cell;
  const dx = cx(s.grid, next) - cx(s.grid, from);
  if (dx !== 0) h.facing = dx < 0 ? -1 : 1;
  h.prevCell = from;
  h.cell = next;
  h.movedFrame = s.frame;
  ev.push({ type: 'STEP', from, to: next, shelter });

  if (next === s.lift) {
    escape(s, ev);
    return;
  }

  pickups(s, ev, next);

  // Герой вошёл на клетку бодрствующего кобольда (2.4.8).
  for (const k of s.kobolds) {
    if (k.mode === 'awake' && k.cell === next) {
      caught(s, ev, k);
      return;
    }
  }

  // Герой подошёл к логову (2.4.1).
  const asleep = s.kobolds.filter((k) => k.mode === 'sleep');
  if (asleep.length) {
    const g = s.grid;
    const near = bfsDist(g, [next], (i) => isWalkable(g, i));
    for (const k of asleep) {
      const d = near[k.cell];
      if (d >= 0 && d <= R.wakeProximity) wake(s, ev, k, 'proximity');
    }
  }
}

function pickups(s: GameState, ev: GameEvent[], cell: number): void {
  const h = s.hero;
  const here = s.items.filter((it) => it.cell === cell);
  if (!here.length) return;
  s.items = s.items.filter((it) => it.cell !== cell);
  for (const it of here) {
    if (it.kind === 'stick') {
      h.sticks++;
      s.stats.pickedSticks++;
    } else if (it.kind === 'nugget') {
      h.nuggets++;
      s.loot += balance.score.nugget;
    } else if (it.kind === 'vein') {
      h.hasVein = true;
      s.loot += balance.score.vein;
    }
    ev.push({ type: 'PICKUP', kind: it.kind, cell, itemId: it.id });
    if (it.kind === 'vein') {
      // Кобольд сразу просыпается и злеет на одну ступень (2.4.7).
      for (const k of s.kobolds) {
        if (k.mode === 'sleep') wake(s, ev, k, 'vein');
        angerUp(s, k);
        ev.push({ type: 'KOBOLD_ANGER', id: k.id, anger: k.anger });
      }
    }
  }
}

// ───────────────────────── итог ─────────────────────────

function escape(s: GameState, ev: GameEvent[]): void {
  const h = s.hero;
  s.status = 'won';
  s.finalScore = s.loot + h.sticks * balance.score.stick;
  let stars: 0 | 1 | 2 | 3 = 1;
  if (s.finalScore >= s.s2) stars = 2;
  if (s.finalScore >= s.s3) stars = 3;
  s.stars = stars;
  const close = s.kobolds.some((k) => k.mode === 'awake' && manhattan(s.grid, k.cell, h.prevCell) <= 1);
  ev.push({ type: 'ESCAPED', score: s.finalScore, stars, close });
}

function caught(s: GameState, ev: GameEvent[], k: KoboldState): void {
  s.status = 'lost';
  s.cause = 'kobold';
  s.finalScore = 0;
  s.stars = 0;
  ev.push({ type: 'CAUGHT', id: k.id, cell: s.hero.cell });
}

// ───────────────────────── время ─────────────────────────

function tick(s: GameState, ev: GameEvent[], rawDt: number): void {
  if (s.paused || s.status !== 'playing') return;
  const dt = Math.max(0, Math.min(rawDt, balance.time.maxFrameDtS));
  if (dt === 0) return;
  s.time += dt;
  s.frame++;

  for (const k of s.kobolds) {
    updateKobold(s, ev, k, dt);
    if (s.status !== 'playing') return;
  }

  const f = s.fuse;
  if (f) {
    f.remaining -= dt;
    const count = Math.ceil(f.remaining);
    if (f.remaining > 0 && count <= R.countdownFrom && (f.lastCount === 0 || count < f.lastCount)) {
      f.lastCount = count;
      ev.push({ type: 'FUSE_COUNTDOWN', n: count, cell: f.cell });
    }
    if (f.remaining <= 0) detonate(s, ev);
  }
}

function wake(_s: GameState, ev: GameEvent[], k: KoboldState, cause: WakeCause): void {
  if (k.mode !== 'sleep') return;
  k.mode = 'awake';
  k.stepTimer = k.stepInterval;
  k.crouching = false;
  ev.push({ type: 'KOBOLD_WAKE', id: k.id, cause });
}

function angerUp(s: GameState, k: KoboldState): void {
  k.anger++;
  k.stepInterval = Math.max(k.stepInterval * R.angerFactor, s.params.minStepS);
}

function updateKobold(s: GameState, ev: GameEvent[], k: KoboldState, dt: number): void {
  switch (k.mode) {
    case 'sleep':
      if (s.time >= s.params.wakeS) wake(s, ev, k, 'timer');
      return;
    case 'stunned':
      k.stunTimer -= dt;
      if (k.stunTimer <= 0) {
        k.mode = 'awake';
        k.stunTimer = 0;
        angerUp(s, k);
        k.stepTimer = k.stepInterval;
        k.crouching = false;
        ev.push({ type: 'KOBOLD_RECOVERED', id: k.id, anger: k.anger });
        if (s.hero.cell === k.cell) caught(s, ev, k);
      }
      return;
    case 'awake': {
      k.stepTimer -= dt;
      if (k.stepTimer > R.crouchS) return;
      const field = koboldField(s.grid, s.hero.cell);
      const next = nextStep(s.grid, k.cell, field);
      if (next < 0) {
        k.stepTimer = Math.max(k.stepTimer, 0);
        return;
      }
      if (!k.crouching) {
        k.crouching = true;
        ev.push({ type: 'KOBOLD_CROUCH', id: k.id, cell: k.cell, next });
      }
      if (k.stepTimer > 0) return;
      // На одну клетку два кобольда не встают — второй ждёт (2.4.11).
      if (s.kobolds.some((o) => o !== k && o.cell === next)) {
        k.stepTimer = 0;
        return;
      }
      const from = k.cell;
      k.prevCell = from;
      k.cell = next;
      k.movedFrame = s.frame;
      k.crouching = false;
      k.stepTimer += k.stepInterval;
      if (k.stepTimer < R.crouchS) k.stepTimer = k.stepInterval;
      ev.push({ type: 'KOBOLD_STEP', id: k.id, from, to: next });
      const h = s.hero;
      const swapped = h.movedFrame === s.frame && h.prevCell === next && h.cell === from;
      if (next === h.cell || swapped) caught(s, ev, k);
      return;
    }
  }
}

function detonate(s: GameState, ev: GameEvent[]): void {
  const f = s.fuse;
  if (!f) return;
  s.fuse = null;
  const g = s.grid;
  const cross = blastCross(g, f.cell, s.params.blastRange);
  ev.push({ type: 'BLAST', origin: f.cell, cells: cross.cells.slice(), rays: [...cross.rays] });
  s.anyBlast = true;
  s.stats.blasts++;

  // Взрыв разрушает только клетку с шашкой (2.3.5).
  const was = g.cells[f.cell];
  switch (was) {
    case Cell.ROCK:
      g.cells[f.cell] = Cell.FLOOR;
      g.cracked[f.cell] = 0;
      ev.push({ type: 'ROCK_DESTROYED', cell: f.cell, was });
      break;
    case Cell.HARD:
      g.cells[f.cell] = Cell.ROCK;
      g.cracked[f.cell] = 1;
      ev.push({ type: 'ROCK_CRACKED', cell: f.cell });
      break;
    case Cell.VEIN:
      g.cells[f.cell] = Cell.FLOOR;
      s.items.push({ id: s.nextItemId++, cell: f.cell, kind: 'vein' });
      ev.push({ type: 'ROCK_DESTROYED', cell: f.cell, was });
      ev.push({ type: 'VEIN_OPENED', cell: f.cell });
      break;
    case Cell.POCKET:
      g.cells[f.cell] = Cell.FLOOR;
      s.items.push({ id: s.nextItemId++, cell: f.cell, kind: 'nugget' });
      s.stats.pocketsOpened++;
      ev.push({ type: 'ROCK_DESTROYED', cell: f.cell, was });
      ev.push({ type: 'POCKET_OPENED', cell: f.cell });
      break;
  }

  const hit = new Set(cross.cells);
  for (const k of s.kobolds) {
    if (hit.has(k.cell)) {
      k.mode = 'stunned';
      k.stunTimer = s.params.stunS;
      k.crouching = false;
      s.stats.stuns++;
      ev.push({ type: 'KOBOLD_STUNNED', id: k.id, cell: k.cell });
    }
  }
  for (const k of s.kobolds) if (k.mode === 'sleep') wake(s, ev, k, 'blast');

  if (hit.has(s.hero.cell)) {
    s.status = 'lost';
    s.cause = 'blast';
    s.finalScore = 0;
    s.stars = 0;
    ev.push({ type: 'HERO_BLASTED', cell: s.hero.cell });
    return;
  }
  if (s.hero.intent.kind === 'shelter') setIntent(s, ev, { kind: 'stay' }, true);
}

/** Удобный прогон нескольких действий подряд (для тестов, симуляции и повторов). */
export function run(state: GameState, actions: readonly GameAction[]): ReduceResult {
  let s = state;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const r = reduce(s, a);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
