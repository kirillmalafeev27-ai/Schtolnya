// Пресеты звуков «Шахты» (план, 10.2): всё синтезируется, без аудиофайлов.

import type { Mixer, Voice } from '../shared/audio/mixer';
import { bell, noise, noiseLoop, tone } from '../shared/audio/synth';

export interface At {
  pan?: number;
  vol?: number;
}

const rr = (a: number, b: number) => a + Math.random() * (b - a);

function v(m: Mixer, at: At, extra: Parameters<Mixer['voice']>[0] = {}): Voice | null {
  return m.voice({ pan: at.pan, gain: at.vol ?? 1, ...extra });
}

// ───────────── герой ─────────────

/** Шаг по гравию: три варианта хруста и глухой удар каблука. */
export function step(m: Mixer, at: At, variant: number): void {
  const x = v(m, at, { life: 0.4 });
  if (!x) return;
  const base = [1900, 2600, 2200][variant % 3];
  tone(x, { f: 120, f1: 60, r: 0.07, gain: 0.32, filter: { type: 'lowpass', f: 300 } });
  const grains = 3 + (variant % 2);
  for (let i = 0; i < grains; i++) {
    noise(x, {
      at: 0.008 + i * rr(0.012, 0.024),
      a: 0.002,
      r: rr(0.018, 0.04),
      gain: rr(0.12, 0.22),
      filter: { type: 'bandpass', f: base * rr(0.75, 1.3), q: 2.2 },
    });
  }
}

/** Закладка: скрежет шашки о камень и чирк спички с шипением. */
export function plant(m: Mixer, at: At): void {
  const x = v(m, at, { life: 1, echo: 0.1 });
  if (!x) return;
  noise(x, { a: 0.03, r: 0.14, gain: 0.18, filter: { type: 'bandpass', f: 900, f1: 1500, q: 3 } });
  noise(x, { at: 0.2, a: 0.004, r: 0.06, gain: 0.35, filter: { type: 'highpass', f: 2800 } });
  noise(x, {
    at: 0.23,
    a: 0.02,
    hold: 0.08,
    r: 0.3,
    gain: 0.16,
    filter: { type: 'bandpass', f: 5200, f1: 3800, q: 1.4 },
  });
  tone(x, { at: 0.2, f: 240, f1: 120, r: 0.12, gain: 0.08, type: 'triangle' });
}

/** Шипение фитиля: петля, высота которой растёт к концу. */
export interface Hiss {
  set(frac: number): void;
  crackle(): void;
  stop(): void;
}

export function fuseHiss(m: Mixer, at: At): Hiss | null {
  const x = v(m, at, { life: Infinity, jitter: 0 });
  if (!x) return null;
  const loop = noiseLoop(x, { filter: { type: 'bandpass', f: 3000, q: 1.6 }, gain: 0.07, fadeIn: 0.25 });
  if (!loop) return null;
  return {
    set(frac) {
      const t = x.ctx.currentTime;
      const k = 1 - Math.max(0, Math.min(1, frac));
      loop.filter.frequency.setTargetAtTime(2600 + k * k * 4200, t, 0.1);
      loop.gain.gain.setTargetAtTime(0.06 + k * 0.07, t, 0.1);
    },
    crackle() {
      const c = m.voice({ pan: at.pan, gain: at.vol ?? 1, life: 0.2 });
      if (!c) return;
      noise(c, { a: 0.001, r: rr(0.008, 0.02), gain: rr(0.06, 0.14), filter: { type: 'highpass', f: 3500 } });
    },
    stop() {
      x.stop(0.06);
      try {
        loop.src.stop(x.ctx.currentTime + 0.1);
      } catch {
        // уже остановлен
      }
    },
  };
}

/** Тиканье последних трёх секунд. */
export function tick(m: Mixer, at: At, strong: boolean): void {
  const x = v(m, at, { life: 0.3 });
  if (!x) return;
  tone(x, {
    f: strong ? 1500 : 1150,
    r: 0.035,
    gain: strong ? 0.32 : 0.18,
    type: 'square',
    filter: { type: 'bandpass', f: 1600, q: 4 },
  });
  noise(x, { a: 0.001, r: 0.012, gain: 0.12, filter: { type: 'highpass', f: 4000 } });
}

/** Взрыв: низкий раскат, треск, дробь обломков, хвост эха. Сам не приглушается. */
export function blast(m: Mixer, at: At): void {
  const x = v(m, at, { life: 3.2, echo: 0.55, duck: false, jitter: 0.04 });
  if (!x) return;
  tone(x, { f: 82, f1: 32, a: 0.003, hold: 0.04, r: 0.9, gain: 0.95 });
  tone(x, { f: 46, f1: 28, a: 0.01, hold: 0.1, r: 1.1, gain: 0.6 });
  noise(x, {
    kind: 'brown',
    a: 0.006,
    hold: 0.12,
    r: 1.5,
    gain: 0.95,
    filter: { type: 'lowpass', f: 900, f1: 120 },
  });
  noise(x, { a: 0.002, r: 0.28, gain: 0.55, filter: { type: 'highpass', f: 1800, f1: 900 } });
  noise(x, { at: 0.05, a: 0.01, r: 0.5, gain: 0.3, filter: { type: 'bandpass', f: 600, f1: 250, q: 0.8 } });
  // Дробь обломков.
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t = 0.12 + Math.pow(Math.random(), 0.8) * 0.9;
    noise(x, {
      at: t,
      a: 0.001,
      r: rr(0.015, 0.05),
      gain: rr(0.05, 0.16) * (1 - t * 0.6),
      filter: { type: 'bandpass', f: rr(1200, 3800), q: 3 },
    });
  }
}

/** Далёкий рокот после взрыва (эмбиент). */
export function rumble(m: Mixer, at: At): void {
  const x = m.voice({ bus: 'ambient', pan: at.pan, gain: at.vol ?? 1, life: 3.5, echo: 0.3 });
  if (!x) return;
  noise(x, {
    kind: 'brown',
    a: 0.6,
    hold: 0.4,
    r: 2.2,
    gain: 0.5,
    filter: { type: 'lowpass', f: 160, q: 0.7 },
  });
  for (let i = 0; i < 6; i++) {
    noise(x, {
      at: rr(0.4, 2.2),
      a: 0.001,
      r: rr(0.01, 0.03),
      gain: rr(0.02, 0.06),
      filter: { type: 'bandpass', f: rr(1500, 3000), q: 4 },
    });
  }
}

/** Хруст крепкой породы. */
export function crack(m: Mixer, at: At): void {
  const x = v(m, at, { life: 0.8, echo: 0.2 });
  if (!x) return;
  noise(x, { a: 0.001, r: 0.09, gain: 0.5, filter: { type: 'highpass', f: 1300 } });
  tone(x, { f: 140, f1: 70, r: 0.16, gain: 0.4 });
  for (let i = 0; i < 5; i++) {
    noise(x, {
      at: 0.03 + i * rr(0.02, 0.045),
      a: 0.001,
      r: rr(0.01, 0.03),
      gain: rr(0.15, 0.3),
      filter: { type: 'bandpass', f: rr(1800, 4200), q: 5 },
    });
  }
}

/** Подбор шашки: щелчок застёжки. */
export function schnapp(m: Mixer, at: At): void {
  const x = v(m, at, { life: 0.4 });
  if (!x) return;
  noise(x, { a: 0.001, r: 0.02, gain: 0.3, filter: { type: 'bandpass', f: 3200, q: 3 } });
  tone(x, {
    at: 0.015,
    f: 620,
    f1: 1300,
    r: 0.07,
    gain: 0.16,
    type: 'square',
    filter: { type: 'lowpass', f: 2600 },
  });
}

/** «Дзынь» самородка; step поднимает высоту при подсчёте. */
export function kling(m: Mixer, at: At, step = 0): void {
  const x = v(m, at, { life: 1.4, echo: 0.25 });
  if (!x) return;
  const f = 1568 * Math.pow(2, step / 12);
  tone(x, { f, r: 0.7, gain: 0.22, type: 'sine' });
  tone(x, { f: f * 1.5, r: 0.45, gain: 0.12 });
  tone(x, { f: f * 4.07, r: 0.15, gain: 0.05 });
}

/** Вскрытие жилы: хрустальный аккорд с мерцанием. */
export function vein(m: Mixer, at: At): void {
  const x = v(m, at, { life: 2.5, echo: 0.45, jitter: 0 });
  if (!x) return;
  const notes = [1318.5, 1661.2, 1975.5, 2637];
  notes.forEach((f, i) => {
    tone(x, { at: i * 0.055, f, r: 1.3 - i * 0.15, gain: 0.16, type: 'sine' });
    tone(x, { at: i * 0.055, f: f * 2.01, r: 0.4, gain: 0.04, type: 'triangle' });
  });
  noise(x, { a: 0.05, hold: 0.1, r: 0.8, gain: 0.05, filter: { type: 'highpass', f: 7000 } });
}

/** Мелкое мерцание кармана с самородками. */
export function glitter(m: Mixer, at: At): void {
  const x = v(m, at, { life: 1, echo: 0.3 });
  if (!x) return;
  for (let i = 0; i < 4; i++) tone(x, { at: i * 0.06, f: rr(2400, 3600), r: 0.25, gain: 0.07 });
}

// ───────────── кобольд ─────────────

/** Храп: вдох-выдох с низким рокотом. Тихо, с панорамой по x. */
export function snore(m: Mixer, at: At): void {
  const x = v(m, at, { life: 2.4, jitter: 0.08 });
  if (!x) return;
  noise(x, { kind: 'brown', a: 0.7, r: 0.25, gain: 0.13, filter: { type: 'bandpass', f: 520, q: 1.2 } });
  tone(x, {
    at: 0.75,
    f: 68,
    f1: 58,
    a: 0.08,
    hold: 0.45,
    r: 0.3,
    gain: 0.12,
    type: 'sawtooth',
    filter: { type: 'lowpass', f: 380, q: 2 },
    vib: { hz: 22, depth: 0.06 },
  });
}

/** Рык; angry — ниже и громче. */
export function growl(m: Mixer, at: At, angry: boolean): void {
  const x = v(m, at, { life: 1.4, echo: 0.2 });
  if (!x) return;
  const f = angry ? 64 : 92;
  const len = angry ? 0.75 : 0.5;
  for (const det of [1, 1.035]) {
    tone(x, {
      f: f * det,
      f1: f * det * 0.82,
      a: 0.05,
      hold: len * 0.6,
      r: len * 0.5,
      gain: angry ? 0.3 : 0.22,
      type: 'sawtooth',
      filter: { type: 'lowpass', f: angry ? 620 : 820, q: 3 },
      vib: { hz: 27, depth: 0.09 },
    });
  }
  noise(x, { a: 0.04, hold: len * 0.5, r: 0.3, gain: 0.12, filter: { type: 'bandpass', f: 700, q: 2 } });
}

/** Шаг кобольда: мягкий удар лапы и цокот когтей. Громкость и панорама — по расстоянию. */
export function koboldStep(m: Mixer, at: At): void {
  const x = v(m, at, { life: 0.4 });
  if (!x) return;
  tone(x, { f: 100, f1: 55, r: 0.08, gain: 0.5, filter: { type: 'lowpass', f: 380 } });
  noise(x, { a: 0.002, r: 0.04, gain: 0.18, filter: { type: 'lowpass', f: 900 } });
  noise(x, { at: 0.03, a: 0.001, r: 0.015, gain: 0.12, filter: { type: 'bandpass', f: 3400, q: 6 } });
}

/** Оглушение: «бонк» и звон звёздочек. */
export function bonk(m: Mixer, at: At): void {
  const x = v(m, at, { life: 1.4, echo: 0.2 });
  if (!x) return;
  tone(x, { f: 560, f1: 240, r: 0.22, gain: 0.55, type: 'triangle', vib: { hz: 16, depth: 0.05 } });
  noise(x, { a: 0.001, r: 0.03, gain: 0.25, filter: { type: 'bandpass', f: 1200, q: 2 } });
  for (let i = 0; i < 5; i++) tone(x, { at: 0.12 + i * 0.09, f: rr(2200, 3400), r: 0.18, gain: 0.08 });
}

/** Поимка: рык и возня. */
export function caught(m: Mixer, at: At): void {
  growl(m, at, true);
  const x = v(m, at, { life: 0.8 });
  if (!x) return;
  for (let i = 0; i < 4; i++) {
    noise(x, {
      at: i * 0.07,
      a: 0.01,
      r: 0.06,
      gain: 0.18,
      filter: { type: 'bandpass', f: rr(500, 1100), q: 1.5 },
    });
  }
}

// ───────────── подъёмник ─────────────

/** Колокол клети: старт раунда и победа. */
export function liftBell(m: Mixer, at: At, twice = true): void {
  const x = v(m, at, { life: 3.2, echo: 0.4, jitter: 0 });
  if (!x) return;
  bell(x, { f: 740, gain: 0.2, r: 2.2 });
  if (twice) bell(x, { f: 740, at: 0.42, gain: 0.16, r: 2 });
}

/** Глухой звон: подъёмник без жилы. */
export function bellDull(m: Mixer, at: At): void {
  const x = v(m, at, { life: 0.8 });
  if (!x) return;
  bell(x, {
    f: 370,
    gain: 0.24,
    r: 0.35,
    partials: [
      [1, 1, 1],
      [1.5, 0.4, 0.6],
      [2.4, 0.2, 0.4],
    ],
  });
  noise(x, { a: 0.001, r: 0.05, gain: 0.25, filter: { type: 'lowpass', f: 700 } });
}

/** Скрип каната и грохот клети. */
export function cage(m: Mixer, at: At, durS = 1.2): void {
  const x = v(m, at, { life: durS + 1, echo: 0.25 });
  if (!x) return;
  noise(x, {
    kind: 'brown',
    a: 0.15,
    hold: durS * 0.6,
    r: 0.5,
    gain: 0.35,
    filter: { type: 'lowpass', f: 260 },
  });
  for (let i = 0; i < 3; i++) {
    tone(x, {
      at: i * 0.32,
      f: rr(160, 210),
      f1: rr(220, 280),
      a: 0.06,
      hold: 0.12,
      r: 0.14,
      gain: 0.07,
      type: 'sawtooth',
      filter: { type: 'bandpass', f: 1100, q: 7 },
    });
  }
  for (let i = 0; i < 7; i++) {
    noise(x, {
      at: rr(0.05, durS),
      a: 0.001,
      r: 0.03,
      gain: rr(0.05, 0.12),
      filter: { type: 'bandpass', f: rr(2500, 4200), q: 8 },
    });
  }
}

// ───────────── ответы и отказы ─────────────

/** Верный ответ: короткий щелчок. */
export function click(m: Mixer): void {
  const x = m.voice({ life: 0.3, gain: 0.8 });
  if (!x) return;
  tone(x, { f: 1900, f1: 1300, r: 0.05, gain: 0.5, type: 'triangle' });
  noise(x, { a: 0.001, r: 0.014, gain: 0.3, filter: { type: 'highpass', f: 5000 } });
}

/** Ошибка: мягкий «бонк», не обидный. */
export function softBonk(m: Mixer): void {
  const x = m.voice({ life: 0.5, gain: 0.8 });
  if (!x) return;
  tone(x, { f: 330, f1: 190, r: 0.2, gain: 0.22, filter: { type: 'lowpass', f: 900 } });
  tone(x, { at: 0.07, f: 250, f1: 160, r: 0.18, gain: 0.12, filter: { type: 'lowpass', f: 700 } });
}

/** Отказ: глухой стук (KLOPF). */
export function knock(m: Mixer, at: At, times = 2): void {
  const x = v(m, at, { life: 0.6, echo: 0.15 });
  if (!x) return;
  for (let i = 0; i < times; i++) {
    tone(x, { at: i * 0.11, f: 150, f1: 90, r: 0.08, gain: 0.4 });
    noise(x, { at: i * 0.11, a: 0.001, r: 0.04, gain: 0.25, filter: { type: 'lowpass', f: 600 } });
  }
}

// ───────────── эмбиент ─────────────

export interface Loop {
  stop(): void;
}

/** Гул штольни: низкие биения и тёмный шум с медленным дыханием. */
export function drone(m: Mixer): Loop | null {
  const x = m.voice({ bus: 'ambient', life: Infinity, jitter: 0 });
  if (!x) return null;
  const ctx = x.ctx;
  const t = x.t;
  const oscs: AudioScheduledSourceNode[] = [];
  for (const [f, g] of [
    [55, 0.07],
    [55.6, 0.06],
    [82.4, 0.025],
  ] as const) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(g, t + 2.5);
    o.connect(gn);
    gn.connect(x.out);
    o.start(t);
    oscs.push(o);
  }
  const rumbleLoop = noiseLoop(x, {
    kind: 'brown',
    filter: { type: 'lowpass', f: 220, q: 0.6 },
    gain: 0.32,
    fadeIn: 2.5,
  });
  const airLoop = noiseLoop(x, {
    kind: 'white',
    filter: { type: 'bandpass', f: 420, q: 0.9 },
    gain: 0.012,
    fadeIn: 3,
  });
  // Медленное «дыхание» штольни.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const depth = ctx.createGain();
  depth.gain.value = 90;
  lfo.connect(depth);
  if (rumbleLoop) depth.connect(rumbleLoop.filter.frequency);
  lfo.start(t);
  oscs.push(lfo);
  if (rumbleLoop) oscs.push(rumbleLoop.src);
  if (airLoop) oscs.push(airLoop.src);
  return {
    stop() {
      x.stop(0.6);
      const end = ctx.currentTime + 0.7;
      for (const o of oscs) {
        try {
          o.stop(end);
        } catch {
          // уже остановлен
        }
      }
    },
  };
}

/** Капля: «плинк» с длинным эхом в случайной точке панорамы. */
export function drip(m: Mixer, at: At): void {
  const x = m.voice({ bus: 'ambient', pan: at.pan, gain: at.vol ?? 1, life: 2, echo: 0.6, jitter: 0.12 });
  if (!x) return;
  tone(x, { f: 1500, f1: 820, a: 0.002, r: 0.08, gain: 0.45 });
  if (Math.random() < 0.5) tone(x, { at: rr(0.18, 0.4), f: 1700, f1: 1000, a: 0.002, r: 0.06, gain: 0.2 });
}

/** Скрип крепи. */
export function creak(m: Mixer, at: At): void {
  const x = m.voice({ bus: 'ambient', pan: at.pan, gain: at.vol ?? 1, life: 1.6, echo: 0.3, jitter: 0.15 });
  if (!x) return;
  const len = rr(0.35, 0.8);
  tone(x, {
    f: rr(95, 140),
    f1: rr(120, 190),
    a: 0.1,
    hold: len,
    r: 0.2,
    gain: 0.3,
    type: 'sawtooth',
    filter: { type: 'bandpass', f: rr(600, 900), q: 8 },
    vib: { hz: rr(9, 15), depth: 0.12 },
  });
}
