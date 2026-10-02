// Маленький синтезатор поверх WebAudio: тон и шум с огибающей, фильтром и сдвигом высоты.
// Все частоты умножаются на voice.rate — так повторяющиеся звуки звучат с разбросом высоты.

import type { Voice } from './mixer';

const FLOOR = 0.0001;

export interface FilterOpts {
  type: BiquadFilterType;
  f: number;
  /** Конечная частота среза (экспоненциальный сдвиг за время звука). */
  f1?: number;
  q?: number;
}

interface EnvOpts {
  /** Задержка от начала голоса, с. */
  at?: number;
  a?: number;
  hold?: number;
  r: number;
  gain: number;
}

export interface ToneOpts extends EnvOpts {
  type?: OscillatorType;
  f: number;
  f1?: number;
  /** Время сдвига высоты (по умолчанию — вся длина звука). */
  glide?: number;
  filter?: FilterOpts;
  /** Вибрато: частота и глубина (доля). */
  vib?: { hz: number; depth: number };
}

export interface NoiseOpts extends EnvOpts {
  kind?: 'white' | 'brown';
  filter?: FilterOpts;
  /** Скорость воспроизведения буфера (сдвигает «зерно» шума). */
  speed?: number;
}

function envelope(p: AudioParam, t: number, o: EnvOpts): number {
  const a = o.a ?? 0.004;
  const hold = o.hold ?? 0;
  p.setValueAtTime(FLOOR, t);
  p.linearRampToValueAtTime(Math.max(FLOOR, o.gain), t + a);
  if (hold > 0) p.setValueAtTime(Math.max(FLOOR, o.gain), t + a + hold);
  p.exponentialRampToValueAtTime(FLOOR, t + a + hold + o.r);
  return a + hold + o.r;
}

function filter(v: Voice, t: number, dur: number, o: FilterOpts): BiquadFilterNode {
  const f = v.ctx.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.f * v.rate, t);
  if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 * v.rate), t + dur);
  if (o.q !== undefined) f.Q.value = o.q;
  return f;
}

/** Тон: осциллятор с огибающей. */
export function tone(v: Voice, o: ToneOpts): void {
  const ctx = v.ctx;
  const t = v.t + (o.at ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  const g = ctx.createGain();
  const dur = envelope(g.gain, t, o);
  osc.frequency.setValueAtTime(o.f * v.rate, t);
  if (o.f1 !== undefined)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1 * v.rate), t + (o.glide ?? dur));
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib.hz;
    const depth = ctx.createGain();
    depth.gain.value = o.f * v.rate * o.vib.depth;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  if (o.filter) {
    const f = filter(v, t, dur, o.filter);
    osc.connect(f);
    f.connect(g);
  } else osc.connect(g);
  g.connect(v.out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Шум с огибающей и фильтром. */
export function noise(v: Voice, o: NoiseOpts): void {
  const buf = v.mixer.noise(o.kind ?? 'white');
  if (!buf) return;
  const ctx = v.ctx;
  const t = v.t + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = (o.speed ?? 1) * v.rate;
  const g = ctx.createGain();
  const dur = envelope(g.gain, t, o);
  if (o.filter) {
    const f = filter(v, t, dur, o.filter);
    src.connect(f);
    f.connect(g);
  } else src.connect(g);
  g.connect(v.out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

/** Колокол: набор негармоничных обертонов с разным затуханием. */
export function bell(
  v: Voice,
  o: { f: number; at?: number; gain: number; r: number; partials?: [number, number, number][] },
): void {
  // [отношение частоты, громкость, доля затухания]
  const parts = o.partials ?? [
    [0.5, 0.35, 1.2],
    [1, 1, 1],
    [1.19, 0.45, 0.7],
    [1.56, 0.32, 0.55],
    [2, 0.38, 0.5],
    [2.51, 0.2, 0.35],
    [3.01, 0.14, 0.28],
  ];
  for (const [ratio, amp, decay] of parts) {
    tone(v, { f: o.f * ratio, at: o.at, a: 0.002, r: o.r * decay, gain: o.gain * amp });
  }
}

/** Петля шума без огибающей: для гула и шипения фитиля. Возвращает узлы для управления. */
export function noiseLoop(
  v: Voice,
  o: { kind?: 'white' | 'brown'; filter: FilterOpts; gain: number; fadeIn?: number },
): { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null {
  const buf = v.mixer.noise(o.kind ?? 'white');
  if (!buf) return null;
  const ctx = v.ctx;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter.type;
  f.frequency.value = o.filter.f;
  if (o.filter.q !== undefined) f.Q.value = o.filter.q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(FLOOR, v.t);
  g.gain.linearRampToValueAtTime(o.gain, v.t + (o.fadeIn ?? 0.05));
  src.connect(f);
  f.connect(g);
  g.connect(v.out);
  src.start(v.t, Math.random() * 1.5);
  return { src, filter: f, gain: g };
}
