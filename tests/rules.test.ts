import { describe, expect, it } from 'vitest';
import { balance } from '../src/config/balance';
import { blastCells, blastCross } from '../src/core/blast';
import { Cell } from '../src/core/grid';
import { heroRoute, shelterMarks, standCellFor, heroPassable, burningCross } from '../src/core/intent';
import { koboldPreview } from '../src/core/kobold';
import { reduce, run, type GameAction } from '../src/core/rules';
import { at, fromAscii, Runner } from './helpers';

const R = balance.rules;

describe('крест взрыва (2.3.6)', () => {
  it('центр и лучи на 2 клетки только по проходам', () => {
    const s = fromAscii([
      '#########',
      '#...#...#',
      '#.#.#.#.#',
      '#...R...#',
      '#.#.#.#.#',
      '#H......#',
      '#########',
    ]);
    const origin = at(s, 4, 3);
    const cells = blastCells(s.grid, origin, 2);
    expect(cells[0]).toBe(origin);
    expect(new Set(cells)).toEqual(new Set([origin, at(s, 3, 3), at(s, 2, 3), at(s, 5, 3), at(s, 6, 3)]));
  });

  it('любая непроходимая клетка гасит луч и сама не повреждается', () => {
    const s = fromAscii([
      '#######',
      '#.....#',
      '#.R...#',
      '#.X.R.#',
      '#H....#',
      '#######',
    ]);
    const origin = at(s, 4, 3);
    const c = blastCross(s.grid, origin, 2);
    // Влево: (3,3) проход, (2,3) крепкая порода — луч гаснет на ней.
    expect(c.cells).toContain(at(s, 3, 3));
    expect(c.cells).not.toContain(at(s, 2, 3));
    expect(c.rays[1]).toBe(1);
    // Вверх: (4,2), (4,1) — проходы.
    expect(c.cells).toContain(at(s, 4, 2));
    expect(c.cells).toContain(at(s, 4, 1));
  });
});

describe('намерения и действия (2.2)', () => {
  const map = ['#####L###', '#.......#', '#.##R##.#', '#H.....K#', '#########'];

  it('тап по проходу — идти туда по шагу на верный ответ', () => {
    const r = new Runner(fromAscii(map));
    const target = at(r.s, 3, 3);
    r.intent('move', target);
    expect(r.s.hero.intent).toEqual({ kind: 'move', target });
    r.correct();
    expect(r.s.hero.cell).toBe(at(r.s, 2, 3));
    r.correct();
    expect(r.s.hero.cell).toBe(target);
    expect(r.s.hero.intent.kind).toBe('stay');
  });

  it('неверный ответ не выполняет действия', () => {
    const r = new Runner(fromAscii(map));
    r.intent('move', at(r.s, 3, 3));
    r.wrong();
    expect(r.s.hero.cell).toBe(at(r.s, 1, 3));
    expect(r.s.stats.wrong).toBe(1);
  });

  it('при «стоять» верный ответ копится как готовое действие, не больше одного', () => {
    const r = new Runner(fromAscii(map));
    r.intent('stay');
    r.correct();
    expect(r.s.hero.ready).toBe(true);
    const before = r.s.stats.correct;
    r.correct();
    expect(r.s.stats.correct).toBe(before);
    expect(r.s.hero.cell).toBe(at(r.s, 1, 3));
  });

  it('готовое действие выполняется в момент выбора намерения', () => {
    const r = new Runner(fromAscii(map));
    r.correct();
    expect(r.s.hero.ready).toBe(true);
    const ev = r.intent('move', at(r.s, 3, 3));
    expect(ev.some((e) => e.type === 'ACTION_SPENT')).toBe(true);
    expect(r.s.hero.cell).toBe(at(r.s, 2, 3));
    expect(r.s.hero.ready).toBe(false);
  });

  it('тап по скале намерение не ставит: DENIED(bedrock)', () => {
    const r = new Runner(fromAscii(map));
    const ev = r.intent('plant', at(r.s, 2, 2));
    expect(ev).toEqual([{ type: 'DENIED', reason: 'bedrock', cell: at(r.s, 2, 2) }]);
    expect(r.s.hero.intent.kind).toBe('stay');
  });

  it('маршрут обходит бодрствующего кобольда; если пути нет — «Путь закрыт»', () => {
    const s = fromAscii(['#########', '#H.K....#', '#########'], { awake: true });
    const r = new Runner(s);
    const ev = r.intent('move', at(r.s, 6, 1));
    expect(ev).toEqual([{ type: 'DENIED', reason: 'noPath', cell: at(r.s, 6, 1) }]);
  });

  it('путь закрыт после выбора намерения — ответ не пропадает, а копится', () => {
    const s = fromAscii(['#######', '#H....#', '#.###.#', '#.....#', '#######']);
    const r = new Runner(s);
    r.intent('move', at(r.s, 5, 1));
    // Кобольд встаёт прямо в цели.
    r.s.kobolds.push({ ...r.s.kobolds[0], id: 0, cell: at(r.s, 5, 1), lair: at(r.s, 5, 1), mode: 'awake' } as never);
    r.correct();
    expect(r.s.hero.cell).toBe(at(r.s, 1, 1));
    expect(r.s.hero.ready).toBe(true);
    expect(r.has('DENIED')).toBe(true);
  });
});

describe('шашки и взрыв (2.3)', () => {
  const map = ['#####L###', '#H..R...#', '#.#####.#', '#.......#', '#######K#', '#########'];

  it('закладка рядом, автоукрытие, взрыв разрушает только клетку с шашкой', () => {
    const r = new Runner(fromAscii(map));
    const rock = at(r.s, 4, 1);
    r.intent('plant', rock);
    expect(r.s.hero.intent).toEqual({ kind: 'plant', target: rock });
    r.correct(); // шаг к месту закладки
    r.correct();
    expect(r.s.hero.cell).toBe(at(r.s, 3, 1));
    r.correct(); // закладка
    expect(r.s.fuse?.cell).toBe(rock);
    expect(r.s.hero.sticks).toBe(4);
    expect(r.s.hero.intent.kind).toBe('shelter');
    // в укрытие: из (3,1) нужно выйти из креста (2..3,1 в кресте) — до (1,1)? (1,1) на расстоянии 3 от центра.
    r.correct();
    r.correct();
    expect(burningCross(r.s)!.has(r.s.hero.cell)).toBe(false);
    expect(r.s.hero.intent.kind).toBe('stay');
    r.wait(r.s.params.fuseS + 0.1);
    expect(r.has('BLAST')).toBe(true);
    expect(r.s.grid.cells[rock]).toBe(Cell.FLOOR);
    expect(r.s.status).toBe('playing');
  });

  it('одновременно горит только одна шашка: WARTE! (fuseBusy)', () => {
    const r = new Runner(fromAscii(['#####L###', '#R.HR...#', '#########'], {}));
    r.intent('plant', at(r.s, 4, 1));
    r.correct();
    expect(r.s.fuse).not.toBeNull();
    const ev = r.intent('plant', at(r.s, 1, 1));
    expect(ev).toEqual([{ type: 'DENIED', reason: 'fuseBusy', cell: at(r.s, 1, 1) }]);
  });

  it('если шашек нет — LEER! (noSticks)', () => {
    const r = new Runner(fromAscii(['#####L###', '#R.HR...#', '#########'], { sticks: 0 }));
    const ev = r.intent('plant', at(r.s, 4, 1));
    expect(ev).toEqual([{ type: 'DENIED', reason: 'noSticks', cell: at(r.s, 4, 1) }]);
  });

  it('крепкая порода поддаётся со второго взрыва', () => {
    const r = new Runner(fromAscii(['#####L####', '#.....H.X#', '##########']));
    const hard = at(r.s, 8, 1);
    r.intent('plant', hard);
    r.correct(); // шаг на (7,1)
    r.correct(); // закладка
    r.intent('move', at(r.s, 1, 1));
    for (let i = 0; i < 4; i++) r.correct();
    r.wait(r.s.params.fuseS + 0.1);
    expect(r.s.grid.cells[hard]).toBe(Cell.ROCK);
    expect(r.s.grid.cracked[hard]).toBe(1);
    expect(r.has('ROCK_CRACKED')).toBe(true);
    r.intent('plant', hard);
    for (let i = 0; i < 6; i++) r.correct();
    expect(r.s.fuse?.cell).toBe(hard);
  });

  it('герой на кресте в момент взрыва — проигрыш', () => {
    const r = new Runner(fromAscii(['#####L###', '#H..R...#', '#########']));
    r.intent('plant', at(r.s, 4, 1));
    r.correct();
    r.correct();
    r.correct();
    r.intent('stay');
    r.wait(r.s.params.fuseS + 0.1);
    expect(r.s.status).toBe('lost');
    expect(r.s.cause).toBe('blast');
    expect(r.has('HERO_BLASTED')).toBe(true);
  });

  it('жила → главный самородок, карман → малый', () => {
    const r = new Runner(fromAscii(['###L#####', '#..H.V..#', '#.......#', '#########']));
    const vein = at(r.s, 5, 1);
    r.intent('plant', vein);
    r.correct();
    r.correct();
    r.intent('move', at(r.s, 1, 2));
    for (let i = 0; i < 4; i++) r.correct();
    r.wait(r.s.params.fuseS + 0.1);
    expect(r.s.grid.cells[vein]).toBe(Cell.FLOOR);
    expect(r.s.items.find((i) => i.cell === vein)?.kind).toBe('vein');
    expect(r.has('VEIN_OPENED')).toBe(true);
  });

  it('тап по герою снимает автоукрытие (приманка)', () => {
    const r = new Runner(fromAscii(['#####L###', '#H..R...#', '#########']));
    r.intent('plant', at(r.s, 4, 1));
    r.correct();
    r.correct();
    r.correct();
    expect(r.s.hero.intent.kind).toBe('shelter');
    r.intent('stay', r.s.hero.cell);
    expect(r.s.hero.intent.kind).toBe('stay');
    r.correct();
    expect(r.s.hero.cell).toBe(at(r.s, 3, 1));
    expect(r.s.hero.ready).toBe(true);
  });

  it('фитиль: отсчёт DREI ZWEI EINS в последние 3 секунды', () => {
    const r = new Runner(fromAscii(['#####L###', '#H..R...#', '#########']));
    r.intent('plant', at(r.s, 4, 1));
    r.correct();
    r.correct();
    r.correct();
    const ev = r.wait(r.s.params.fuseS + 0.1);
    const counts = ev.filter((e) => e.type === 'FUSE_COUNTDOWN').map((e) => (e as { n: number }).n);
    expect(counts).toEqual([3, 2, 1]);
  });

  it('длительность фитиля зажата в 6..16 с', () => {
    expect(fromAscii(['#H#'], { tMed: 3, level: 6 }).params.fuseS).toBe(R.fuseMinS);
    expect(fromAscii(['#H#'], { tMed: 10, level: 1 }).params.fuseS).toBe(R.fuseMaxS);
  });
});

describe('место закладки и подсказки (2.2.2, 2.8)', () => {
  it('из равных по пути соседних клеток — та, откуда ближе укрытие', () => {
    // Порода в (4,2); подойти можно с (4,1) или (4,3) — обе в 2 шагах от героя в (3,2)? Нет: герой в (2,2) за скалой.
    const s = fromAscii(['#########', '#...#.###', '#.H.R.###', '#...#...#', '#########']);
    const stand = standCellFor(s, at(s, 4, 2));
    expect(stand).toBe(at(s, 3, 2));
  });

  it('следы-укрытия: белые в один шаг, оранжевые в два', () => {
    const s = fromAscii(['#########', '#.......#', '#.##R##.#', '#H......#', '#########']);
    const stand = at(s, 4, 3);
    const cross = new Set(blastCells(s.grid, at(s, 4, 2), 2));
    const marks = shelterMarks(s.grid, stand, cross, heroPassable(s));
    // крест вниз: (4,3) — центр не проход, (4,3) проход в кресте; (4,4) скала.
    expect(cross.has(stand)).toBe(true);
    expect(marks.one.sort()).toEqual([at(s, 3, 3), at(s, 5, 3)].sort());
    expect(marks.two.sort()).toEqual([at(s, 2, 3), at(s, 6, 3)].sort());
  });

  it('нет укрытия — событие NO_SHELTER и намерение «стоять»', () => {
    const r = new Runner(fromAscii(['#####', '#HR.#', '#####']));
    r.intent('plant', at(r.s, 2, 1));
    const ev = r.correct();
    expect(ev.some((e) => e.type === 'NO_SHELTER')).toBe(true);
    expect(r.s.hero.intent.kind).toBe('stay');
  });

  it('превью креста совпадает с результатом взрыва', () => {
    const s = fromAscii(['#########', '#.......#', '#.##R##.#', '#H......#', '#########']);
    const preview = blastCells(s.grid, at(s, 4, 2), 2);
    const r = new Runner(s);
    r.intent('plant', at(r.s, 4, 2));
    for (let i = 0; i < 8 && !r.s.fuse; i++) r.correct();
    r.intent('move', at(r.s, 1, 1));
    for (let i = 0; i < 8; i++) r.correct();
    const ev = r.wait(20);
    const blast = ev.find((e) => e.type === 'BLAST') as { cells: number[] } | undefined;
    expect(blast?.cells).toEqual(preview);
  });
});

describe('кобольд (2.4)', () => {
  it('спит; просыпается от первого взрыва', () => {
    const r = new Runner(fromAscii(['#####L####', '#H..R...K#', '##########']));
    expect(r.s.kobolds[0].mode).toBe('sleep');
    r.intent('plant', at(r.s, 4, 1));
    r.correct();
    r.correct();
    r.correct();
    r.intent('move', at(r.s, 1, 1));
    r.correct();
    r.correct();
    r.wait(r.s.params.fuseS + 0.05);
    expect(r.events.some((e) => e.type === 'KOBOLD_WAKE' && e.cause === 'blast')).toBe(true);
  });

  it('просыпается, когда герой подходит к логову на 3 клетки по пути', () => {
    const r = new Runner(fromAscii(['#####L####', '#H......K#', '##########']));
    r.intent('move', at(r.s, 5, 1));
    for (let i = 0; i < 3; i++) r.correct();
    expect(r.s.kobolds[0].mode).toBe('sleep');
    r.correct(); // (5,1): до логова (8,1) три клетки
    expect(r.s.kobolds[0].mode).toBe('awake');
  });

  it('просыпается сам через wakeAnswers × T_med', () => {
    const r = new Runner(fromAscii(['#####L####', '#H......K#', '##########']));
    r.wait(r.s.params.wakeS - 0.1);
    expect(r.s.kobolds[0].mode).toBe('sleep');
    r.wait(0.2);
    expect(r.s.kobolds[0].mode).toBe('awake');
  });

  it('идёт к герою, приседает за 150 мс до шага, шаг раз в koboldStepAnswers × T_med', () => {
    const r = new Runner(fromAscii(['#####L######', '#H........K#', '############'], { awake: true }));
    const k = r.s.kobolds[0];
    const interval = r.s.params.koboldStepS;
    expect(k.stepInterval).toBeCloseTo(interval);
    const ev1 = r.wait(interval - R.crouchS - 0.06);
    expect(ev1.some((e) => e.type === 'KOBOLD_CROUCH')).toBe(false);
    const ev2 = r.wait(0.1);
    expect(ev2.some((e) => e.type === 'KOBOLD_CROUCH')).toBe(true);
    expect(ev2.some((e) => e.type === 'KOBOLD_STEP')).toBe(false);
    const ev3 = r.wait(0.2);
    expect(ev3.some((e) => e.type === 'KOBOLD_STEP')).toBe(true);
    expect(r.s.kobolds[0].cell).toBe(at(r.s, 9, 1));
  });

  it('при равных путях направления в порядке: вверх, влево, вниз, вправо', () => {
    // Кобольд в (3,3), герой в (1,1): пути через (3,1)… и через (1,3)… равны; первым идёт «вверх».
    const s = fromAscii(['#####', '#H..#', '#.#.#', '#..K#', '#####'], { awake: true });
    expect(koboldPreview(s, s.kobolds[0], 3)).toEqual([at(s, 3, 2), at(s, 3, 1), at(s, 2, 1)]);
  });

  it('порода непроходима для кобольда', () => {
    const s = fromAscii(['#######', '#H.R.K#', '#######'], { awake: true });
    expect(koboldPreview(s, s.kobolds[0], 3)).toEqual([]);
  });

  it('поимка: кобольд входит на клетку героя', () => {
    const r = new Runner(fromAscii(['######', '#H.K.#', '######'], { awake: true }));
    r.wait(r.s.params.koboldStepS * 2 + 0.1);
    expect(r.s.status).toBe('lost');
    expect(r.s.cause).toBe('kobold');
  });

  it('кобольд на кресте оглушается, затем злее: интервал × 0.9, не меньше 0.8 × T_med', () => {
    const r = new Runner(fromAscii(['###L#########', '#.H.R......K#', '#.###########', '#...........#', '#############']));
    r.intent('plant', at(r.s, 4, 1));
    r.correct();
    r.correct();
    // уходим из креста влево-вниз
    r.intent('move', at(r.s, 1, 3));
    r.correct();
    r.correct();
    r.correct();
    // будим и подводим кобольда: ставим его прямо на крест справа от породы
    const k = r.s.kobolds[0];
    k.mode = 'awake';
    k.cell = at(r.s, 5, 1);
    k.stepTimer = 100;
    r.wait(r.s.params.fuseS + 0.1);
    expect(r.s.kobolds[0].mode).toBe('stunned');
    const before = r.s.kobolds[0].stepInterval;
    r.wait(r.s.params.stunS + 0.1);
    expect(r.s.kobolds[0].mode).toBe('awake');
    expect(r.s.kobolds[0].stepInterval).toBeCloseTo(Math.max(before * R.angerFactor, r.s.params.minStepS));
    expect(r.s.kobolds[0].anger).toBe(1);
  });

  it('злость не опускает интервал ниже 0.8 × T_med', () => {
    const r = new Runner(fromAscii(['#####L####', '#H......K#', '##########']));
    const k = r.s.kobolds[0];
    for (let i = 0; i < 30; i++) {
      k.stepInterval = Math.max(k.stepInterval * R.angerFactor, r.s.params.minStepS);
    }
    expect(k.stepInterval).toBeCloseTo(r.s.params.minStepS);
  });

  it('через оглушённого кобольда можно пройти', () => {
    const s = fromAscii(['########', '#H.K..L#', '########']);
    s.hero.hasVein = true;
    s.kobolds[0].mode = 'stunned';
    s.kobolds[0].stunTimer = 100;
    const r = new Runner(s);
    r.intent('move', at(r.s, 5, 1));
    expect(heroRoute(r.s)).not.toBeNull();
    for (let i = 0; i < 4; i++) r.correct();
    expect(r.s.hero.cell).toBe(at(r.s, 5, 1));
    expect(r.s.status).toBe('playing');
  });

  it('очнулся под героем — поимка', () => {
    const s = fromAscii(['########', '#H.K...#', '########']);
    s.kobolds[0].mode = 'stunned';
    s.kobolds[0].stunTimer = 1;
    const r = new Runner(s);
    r.intent('move', at(r.s, 3, 1));
    r.correct();
    r.correct();
    expect(r.s.hero.cell).toBe(at(r.s, 3, 1));
    r.wait(1.1);
    expect(r.s.status).toBe('lost');
  });

  it('обмен клетками за один тик — поимка', () => {
    const s = fromAscii(['######', '#.H..#', '######'], { awake: false });
    // Ставим кобольда справа от героя, бодрствующего, со шагом «сейчас».
    s.kobolds.push({
      id: 0,
      cell: at(s, 3, 1),
      lair: at(s, 3, 1),
      mode: 'awake',
      stepTimer: 0.01,
      stepInterval: 5,
      anger: 0,
      stunTimer: 0,
      crouching: true,
      prevCell: at(s, 3, 1),
      movedFrame: -1,
    });
    // Герой «только что» перешёл из (3,1) в (2,1) в этом же кадре (искусственно).
    s.hero.prevCell = at(s, 3, 1);
    s.hero.cell = at(s, 2, 1);
    s.hero.movedFrame = s.frame + 1;
    // Кобольд шагнёт в (2,1) — на клетку героя; правило обмена тоже сработало бы.
    const r = reduce(s, { type: 'TICK', dt: 0.02 });
    expect(r.state.status).toBe('lost');
  });

  it('двое кобольдов не встают на одну клетку — второй ждёт', () => {
    const s = fromAscii(['#########', '#H....KK#', '#########'], { awake: true });
    const r = new Runner(s);
    r.wait(s.params.koboldStepS + 0.05);
    const cells = r.s.kobolds.map((k) => k.cell);
    expect(new Set(cells).size).toBe(2);
  });

  it('после подбора главного самородка кобольд просыпается и злеет', () => {
    const s = fromAscii(['###L#####', '#.H.....#', '#......K#', '#########']);
    s.items.push({ id: 99, cell: at(s, 3, 1), kind: 'vein' });
    const r = new Runner(s);
    const before = r.s.kobolds[0].stepInterval;
    r.intent('move', at(r.s, 3, 1));
    r.correct();
    expect(r.s.hero.hasVein).toBe(true);
    expect(r.s.kobolds[0].mode).toBe('awake');
    expect(r.s.kobolds[0].anger).toBe(1);
    expect(r.s.kobolds[0].stepInterval).toBeCloseTo(before * R.angerFactor);
  });
});

describe('добыча, счёт и итог (2.5, 2.6)', () => {
  it('без главного самородка подъёмник не уезжает', () => {
    const r = new Runner(fromAscii(['###L###', '#..H..#', '#######']));
    const ev = r.intent('home');
    expect(ev).toEqual([{ type: 'DENIED', reason: 'liftLocked', cell: r.s.lift }]);
    r.intent('move', r.s.lift);
    expect(r.s.status).toBe('playing');
  });

  it('с самородком — победа, счёт и звёзды', () => {
    const s = fromAscii(['###L###', '#.SH..#', '#######']);
    s.hero.hasVein = true;
    s.loot = 10;
    s.hero.sticks = 3;
    s.s2 = 14;
    s.s3 = 18;
    const r = new Runner(s);
    r.intent('home');
    r.correct();
    expect(r.s.status).toBe('won');
    expect(r.s.finalScore).toBe(10 + 3 * 2);
    expect(r.s.stars).toBe(2);
  });

  it('подбор шашки, малого самородка', () => {
    const s = fromAscii(['###L###', '#HS...#', '#######']);
    s.items.push({ id: 50, cell: at(s, 3, 1), kind: 'nugget' });
    const r = new Runner(s);
    r.intent('move', at(r.s, 3, 1));
    r.correct();
    expect(r.s.hero.sticks).toBe(s.hero.sticks + 1);
    r.correct();
    expect(r.s.hero.nuggets).toBe(1);
    expect(r.s.loot).toBe(5);
  });
});

describe('пауза и время (2.7)', () => {
  it('на паузе стоят фитиль и кобольды', () => {
    const r = new Runner(fromAscii(['#####L####', '#H..R...K#', '##########'], { awake: true }));
    r.intent('plant', at(r.s, 4, 1));
    r.correct();
    r.correct();
    r.correct();
    const fuse = r.s.fuse!.remaining;
    const kt = r.s.kobolds[0].stepTimer;
    r.do({ type: 'PAUSE' });
    r.wait(5);
    expect(r.s.fuse!.remaining).toBe(fuse);
    expect(r.s.kobolds[0].stepTimer).toBe(kt);
    r.do({ type: 'RESUME' });
    r.wait(0.5);
    expect(r.s.fuse!.remaining).toBeLessThan(fuse);
  });

  it('шаг времени кадра ограничен 100 мс', () => {
    const s = fromAscii(['#####L####', '#H..R...K#', '##########']);
    const r = reduce(s, { type: 'TICK', dt: 5 });
    expect(r.state.time).toBeCloseTo(balance.time.maxFrameDtS);
  });

  it('ответы при горящем фитиле помечены (не идут в T_med)', () => {
    const r = new Runner(fromAscii(['#####L####', '#H..R...K#', '##########']));
    r.intent('plant', at(r.s, 4, 1));
    const a = r.correct();
    expect(a.find((e) => e.type === 'ANSWERED')).toMatchObject({ fuseBurning: false });
    r.correct();
    r.correct();
    const b = r.correct();
    expect(b.find((e) => e.type === 'ANSWERED')).toMatchObject({ fuseBurning: true });
  });
});

describe('детерминизм (13.3.5)', () => {
  it('одинаковые состояние и журнал действий дают одинаковый результат', () => {
    const base = fromAscii(['###L#######', '#..H..R..K#', '#.#####.#.#', '#.........#', '###########']);
    const actions: GameAction[] = [
      { type: 'SET_INTENT', kind: 'plant', cell: at(base, 6, 1) },
      { type: 'ANSWER', correct: true, timeMs: 3000 },
      { type: 'TICK', dt: 0.05 },
      { type: 'ANSWER', correct: true, timeMs: 3000 },
      { type: 'ANSWER', correct: false, timeMs: 3000 },
      { type: 'ANSWER', correct: true, timeMs: 3000 },
      ...Array.from({ length: 300 }, () => ({ type: 'TICK', dt: 0.05 }) as GameAction),
    ];
    const a = run(base, actions);
    const b = run(base, actions);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(Array.from(a.state.grid.cells)).toEqual(Array.from(b.state.grid.cells));
  });
});
