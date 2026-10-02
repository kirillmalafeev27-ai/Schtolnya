import { describe, expect, it } from 'vitest';
import { levels } from '../src/config/levels';
import { blastCells } from '../src/core/blast';
import { Cell, isDestructible, neighbor } from '../src/core/grid';
import { validateLevel } from '../src/core/levelCheck';
import { generateLevel } from '../src/core/levelGen';
import { Rng } from '../src/core/rng';
import { reduce } from '../src/core/rules';
import { createState } from '../src/core/state';

describe('генератор уровней (раздел 5)', () => {
  it('детерминирован по сиду', () => {
    const a = generateLevel(levels[2], false, 12345);
    const b = generateLevel(levels[2], false, 12345);
    expect(Array.from(a.grid.cells)).toEqual(Array.from(b.grid.cells));
    expect(a.lairs).toEqual(b.lairs);
    expect(a.spares).toEqual(b.spares);
  });

  it('на 1000 сидов выдаёт только корректные уровни (все уровни, обе ориентации)', () => {
    let relaxed = 0;
    let total = 0;
    const perLevel = Math.ceil(1000 / levels.length);
    for (const def of levels) {
      for (let seed = 1; seed <= perLevel; seed++) {
        const landscape = seed % 2 === 0;
        const lvl = generateLevel(def, landscape, seed * 7919 + def.id);
        const errors = validateLevel(def, lvl);
        if (errors.length) throw new Error(`уровень ${def.id}, сид ${seed}: ${errors.join('; ')}`);
        if (lvl.relaxed) relaxed++;
        total++;
      }
    }
    expect(total).toBeGreaterThanOrEqual(1000);
    // Ослабление требований допустимо, но должно быть редкостью.
    expect(relaxed / total).toBeLessThan(0.02);
  });
});

describe('превью креста совпадает с результатом взрыва (1000 случайных закладок)', () => {
  it('клетка в клетку', () => {
    const rng = new Rng(777);
    let checked = 0;
    for (let n = 0; checked < 1000 && n < 5000; n++) {
      const def = levels[rng.int(0, levels.length - 1)];
      const lvl = generateLevel(def, rng.chance(0.5), rng.int(1, 1e9));
      let s = createState(def, lvl, { tMed: 5, p: 0.8 });
      const g = s.grid;
      // Случайная разрушимая клетка, к которой можно подойти: ставим героя на соседний проход.
      const targets: { cell: number; stand: number }[] = [];
      for (let i = 0; i < g.cells.length; i++) {
        if (!isDestructible(g.cells[i])) continue;
        for (let d = 0; d < 4; d++) {
          const nb = neighbor(g, i, d);
          if (nb >= 0 && g.cells[nb] === Cell.FLOOR && !s.lairs.includes(nb)) targets.push({ cell: i, stand: nb });
        }
      }
      if (!targets.length) continue;
      const t = rng.pick(targets);
      s.hero.cell = t.stand;
      s.kobolds.forEach((k) => (k.mode = 'sleep'));
      const preview = blastCells(s.grid, t.cell, s.params.blastRange);
      let r = reduce(s, { type: 'SET_INTENT', kind: 'plant', cell: t.cell });
      r = reduce(r.state, { type: 'ANSWER', correct: true, timeMs: 3000 });
      s = r.state;
      expect(s.fuse?.cell).toBe(t.cell);
      // Не двигаемся: ждём взрыва.
      s = reduce(s, { type: 'SET_INTENT', kind: 'stay' }).state;
      let blast: number[] | null = null;
      for (let k = 0; k < 400 && !blast; k++) {
        const rr = reduce(s, { type: 'TICK', dt: 0.05 });
        s = rr.state;
        for (const e of rr.events) if (e.type === 'BLAST') blast = e.cells;
      }
      expect(blast).toEqual(preview);
      checked++;
    }
    expect(checked).toBe(1000);
  });
});
