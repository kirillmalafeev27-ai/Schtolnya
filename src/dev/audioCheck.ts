// Dev-страница: каждый пресет рисуется в OfflineAudioContext, считаются пик, RMS и длина,
// рисуется спектрограмма. Кнопка ▶ проигрывает звук вживую.

import * as S from '../audio/presets';
import { Mixer } from '../shared/audio/mixer';

type Play = (m: Mixer) => void;

const presets: Record<string, Play> = {
  step0: (m) => S.step(m, {}, 0),
  step1: (m) => S.step(m, {}, 1),
  step2: (m) => S.step(m, {}, 2),
  plant: (m) => S.plant(m, {}),
  hiss: (m) => {
    const h = S.fuseHiss(m, {});
    h?.set(0.2);
    for (let i = 0; i < 8; i++) h?.crackle();
  },
  tick: (m) => S.tick(m, {}, true),
  blast: (m) => S.blast(m, {}),
  rumble: (m) => S.rumble(m, {}),
  crack: (m) => S.crack(m, {}),
  schnapp: (m) => S.schnapp(m, {}),
  kling: (m) => S.kling(m, {}),
  vein: (m) => S.vein(m, {}),
  glitter: (m) => S.glitter(m, {}),
  snore: (m) => S.snore(m, {}),
  growl: (m) => S.growl(m, {}, false),
  growlAngry: (m) => S.growl(m, {}, true),
  koboldStep: (m) => S.koboldStep(m, {}),
  bonk: (m) => S.bonk(m, {}),
  caught: (m) => S.caught(m, {}),
  liftBell: (m) => S.liftBell(m, {}),
  bellDull: (m) => S.bellDull(m, {}),
  cage: (m) => S.cage(m, {}),
  click: (m) => S.click(m),
  softBonk: (m) => S.softBonk(m),
  knock: (m) => S.knock(m, {}),
  drone: (m) => S.drone(m),
  drip: (m) => S.drip(m, {}),
  creak: (m) => S.creak(m, {}),
};

const SR = 44100;
const LEN = 3;

function fftMag(re: Float32Array): Float32Array {
  const n = re.length;
  const im = new Float32Array(n);
  const r = re.slice();
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [r[i], r[j]] = [r[j], r[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ur = r[i + k];
        const ui = im[i + k];
        const vr = r[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = r[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        r[i + k] = ur + vr;
        im[i + k] = ui + vi;
        r[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
      }
    }
  }
  const out = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(r[i], im[i]);
  return out;
}

function spectrogram(cv: HTMLCanvasElement, data: Float32Array): void {
  const W = 300;
  const H = 90;
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const N = 1024;
  const win = new Float32Array(N);
  for (let x = 0; x < W; x++) {
    const start = Math.floor((x / W) * (data.length - N));
    for (let i = 0; i < N; i++) win[i] = data[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    const mag = fftMag(win);
    for (let y = 0; y < H; y++) {
      // Логарифмическая ось частот 40 Гц…16 кГц.
      const f = 40 * Math.pow(16000 / 40, 1 - y / H);
      const bin = Math.min(mag.length - 1, Math.round((f / SR) * N));
      const db = 20 * Math.log10(mag[bin] + 1e-9);
      const v = Math.max(0, Math.min(1, (db + 40) / 60));
      const o = (y * W + x) * 4;
      img.data[o] = 255 * Math.min(1, v * 1.8);
      img.data[o + 1] = 255 * Math.max(0, v * 1.6 - 0.5);
      img.data[o + 2] = 80 * (1 - v);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

async function render(play: Play): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, SR * LEN, SR);
  const m = Mixer.offline(ctx);
  play(m);
  const buf = await ctx.startRendering();
  return buf.getChannelData(0);
}

const results: Record<string, { peak: number; rms: number; activeS: number }> = {};

async function main(): Promise<void> {
  const grid = document.getElementById('grid')!;
  for (const [name, play] of Object.entries(presets)) {
    const data = await render(play);
    let peak = 0;
    let sum = 0;
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]);
      if (a > peak) peak = a;
      sum += data[i] * data[i];
      if (a > 0.01) last = i;
    }
    const rms = Math.sqrt(sum / Math.max(1, last));
    results[name] = { peak: +peak.toFixed(3), rms: +rms.toFixed(4), activeS: +(last / SR).toFixed(2) };
    const fig = document.createElement('figure');
    fig.innerHTML = `<figcaption><b>${name}</b><span>peak ${peak.toFixed(2)} · rms ${rms.toFixed(3)} · ${(last / SR).toFixed(2)} s</span><button>▶</button></figcaption><canvas></canvas>`;
    spectrogram(fig.querySelector('canvas')!, data);
    let live: Mixer | null = null;
    fig.querySelector('button')!.addEventListener('click', () => {
      live ??= new Mixer({ duckLevel: 0.35, duckMs: 300, pitchJitter: 0.05 });
      live.unlock();
      setTimeout(() => play(live!), 50);
    });
    grid.appendChild(fig);
  }
  (window as unknown as { audioResults: typeof results }).audioResults = results;
}

void main();
