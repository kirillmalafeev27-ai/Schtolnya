// Серые заглушки для прототипа (этап 2): простые фигуры под теми же ключами, что и настоящий арт.

import { palette as P } from '../../config/palette';
import type { Recipe } from '../ArtFactory';

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) => {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
};

const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

const block =
  (
    fillTop: string,
    fillFront: string,
    mark?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  ): Recipe =>
  (ctx, w, h) => {
    const front = h - w;
    rect(ctx, 0, 0, w, h - front, fillTop);
    rect(ctx, 0, h - front - 2, w, front + 2, fillFront);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    mark?.(ctx, w, h);
  };

const cross = (double: boolean) => (ctx: CanvasRenderingContext2D, w: number) => {
  ctx.strokeStyle = P.chalk;
  ctx.lineWidth = w * 0.06;
  const k = double ? [-0.08, 0.08] : [0];
  for (const o of k) {
    ctx.beginPath();
    ctx.moveTo(w * (0.32 + o), w * 0.28);
    ctx.lineTo(w * (0.68 + o), w * 0.64);
    ctx.moveTo(w * (0.68 + o), w * 0.28);
    ctx.lineTo(w * (0.32 + o), w * 0.64);
    ctx.stroke();
  }
};

export const placeholderRecipes: Record<string, Recipe> = {
  floor: (ctx, w, h) => {
    rect(ctx, 0, 0, w, h, '#5a5a62');
    ctx.strokeStyle = '#4a4a52';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  },
  backdrop: (ctx, w, h) => rect(ctx, 0, 0, w, h, P.caveDeep),
  bedrock: block('#7c7f88', '#4b4e57'),
  rock: block('#a8a49c', '#77736c', cross(false)),
  rockCracked: block('#a8a49c', '#77736c', (ctx, w) => {
    cross(false)(ctx, w);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, w * 0.2);
    ctx.lineTo(w * 0.45, w * 0.5);
    ctx.lineTo(w * 0.3, w * 0.8);
    ctx.stroke();
  }),
  hard: block('#8a857e', '#5b5752', cross(true)),
  vein: block('#a8a49c', '#77736c', (ctx, w) => {
    ctx.strokeStyle = '#d8c060';
    ctx.lineWidth = w * 0.08;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, w * 0.6);
    ctx.lineTo(w * 0.5, w * 0.35);
    ctx.lineTo(w * 0.85, w * 0.55);
    ctx.stroke();
  }),
  pocket: block('#a8a49c', '#77736c', (ctx, w) => circle(ctx, w * 0.5, w * 0.45, w * 0.08, '#d8c060')),
  pocketSpark: (ctx, w) => circle(ctx, w / 2, w / 2, w * 0.3, '#ffffff'),
  lift: (ctx, w, h) => {
    rect(ctx, w * 0.1, h * 0.35, w * 0.8, h * 0.62, '#8a7a6a');
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(w * 0.1, h * 0.35, w * 0.8, h * 0.62);
    rect(ctx, w * 0.3, 0, 4, h * 0.35, '#555');
    rect(ctx, w * 0.7, 0, 4, h * 0.35, '#555');
  },
  liftFront: () => undefined,
  daylight: (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,255,230,0.15)';
    ctx.beginPath();
    ctx.moveTo(w * 0.35, 0);
    ctx.lineTo(w * 0.65, 0);
    ctx.lineTo(w * 0.9, h);
    ctx.lineTo(w * 0.1, h);
    ctx.fill();
  },
  lair: (ctx, w, h) => {
    ctx.fillStyle = '#9a8a60';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.6, w * 0.45, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  mushroom: (ctx, w, h) => circle(ctx, w / 2, h * 0.4, w * 0.3, '#8adcd0'),
  timberPost: (ctx, w, h) => rect(ctx, w * 0.2, 0, w * 0.6, h, '#7a6a5a'),
  timberBeam: (ctx, w, h) => rect(ctx, 0, 0, w, h, '#7a6a5a'),
  lantern: (ctx, w, h) => circle(ctx, w / 2, h * 0.6, w * 0.35, '#e0c080'),
  stickItem: (ctx, w, h) => rect(ctx, w * 0.35, h * 0.1, w * 0.3, h * 0.8, '#c06060'),
  nuggetBig: (ctx, w, h) => circle(ctx, w / 2, h / 2, h * 0.4, '#e0c040'),
  nuggetSmall: (ctx, w, h) => circle(ctx, w / 2, h / 2, h * 0.4, '#e0c040'),
  dynPlanted: (ctx, w, h) => rect(ctx, w * 0.3, h * 0.1, w * 0.4, h * 0.8, '#c06060'),
  fuseSpark: (ctx, w) => circle(ctx, w / 2, w / 2, w * 0.3, '#fff0a0'),
  shadow: (ctx, w, h) => {
    ctx.fillStyle = 'rgba(27,16,32,0.35)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.48, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  scorch: (ctx, w, h) => {
    ctx.fillStyle = 'rgba(30,25,35,0.5)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.45, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  rubble: (ctx, w, h) => circle(ctx, w / 2, h / 2, h * 0.4, '#8a867e'),
  heroBody: (ctx, w, h) => rect(ctx, w * 0.2, 0, w * 0.6, h, '#d0d0d8'),
  heroHead: (ctx, w, h, _c, v) => {
    circle(ctx, w / 2, h / 2, h * 0.42, v === 2 ? '#555' : '#e8e8ee');
    ctx.fillStyle = P.ink;
    ctx.fillRect(w * 0.55, h * 0.45, w * 0.08, h * 0.08);
  },
  heroLeg: (ctx, w, h) => rect(ctx, 0, 0, w, h, '#606878'),
  heroArm: (ctx, w, h) => rect(ctx, 0, 0, w, h, '#c8c8d0'),
  heroScarf: (ctx, w, h) => rect(ctx, 0, 0, w, h, '#b0b0b8'),
  heroPouch: (ctx, w, h, _c, v) => circle(ctx, w / 2, h / 2, w * 0.4, v ? '#e0c040' : '#807060'),
  heroBeltStick: (ctx, w, h) => rect(ctx, 0, 0, w, h, '#c06060'),
  koboldBody: (ctx, w, h) => circle(ctx, w / 2, h / 2, h * 0.45, '#6a8a5a'),
  koboldHead: (ctx, w, h, _c, v) =>
    circle(ctx, w / 2, h / 2, h * 0.42, v === 1 ? '#8a6a5a' : v === 2 ? '#444' : '#7a9a6a'),
  koboldSleep: (ctx, w, h) => circle(ctx, w / 2, h * 0.55, h * 0.4, '#6a8a5a'),
  koboldFoot: (ctx, w, h) => rect(ctx, 0, 0, w, h, '#4a6a3a'),
  koboldEyes: (ctx, w, h) => {
    circle(ctx, w * 0.3, h / 2, h * 0.3, P.kobold.eyes);
    circle(ctx, w * 0.7, h / 2, h * 0.3, P.kobold.eyes);
  },
  koboldCandle: (ctx, w, h) => rect(ctx, w * 0.3, h * 0.3, w * 0.4, h * 0.7, '#eee'),
  stunStar: (ctx, w) => circle(ctx, w / 2, w / 2, w * 0.4, '#fff'),
  steam: (ctx, w) => circle(ctx, w / 2, w / 2, w * 0.4, 'rgba(255,255,255,0.6)'),
  boom: (ctx, w) => {
    circle(ctx, w / 2, w / 2, w * 0.45, '#ffb040');
    circle(ctx, w / 2, w / 2, w * 0.25, '#ffffff');
  },
  flameH: (ctx, w, h) => rect(ctx, 0, h * 0.2, w, h * 0.6, '#ff9030'),
  flameV: (ctx, w, h) => rect(ctx, w * 0.2, 0, w * 0.6, h, '#ff9030'),
  flameEnd: (ctx, w) => circle(ctx, w / 2, w / 2, w * 0.4, '#ff9030'),
  debris: (ctx, w, h) => rect(ctx, w * 0.2, h * 0.2, w * 0.6, h * 0.6, '#8a867e'),
  smoke: (ctx, w, h) => circle(ctx, w / 2, h / 2, h * 0.45, 'rgba(150,145,160,0.8)'),
  spark: (ctx, w) => circle(ctx, w / 2, w / 2, w * 0.4, '#fff0a0'),
  dust: (ctx, w) => circle(ctx, w / 2, w / 2, w * 0.4, 'rgba(200,190,180,0.7)'),
  glow: (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  glowSoft: (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  tape: (ctx, w, h) => {
    rect(ctx, 0, 0, w, h, 'rgba(232,50,47,0.55)');
  },
  tapeCenter: (ctx, w, h) => rect(ctx, 0, 0, w, h, 'rgba(232,50,47,0.7)'),
  crackMark: (ctx, w) => {
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, w * 0.2);
    ctx.lineTo(w * 0.5, w * 0.5);
    ctx.lineTo(w * 0.4, w * 0.8);
    ctx.stroke();
  },
  x2: (ctx, _w, h) => {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${h * 0.8}px sans-serif`;
    ctx.fillText('×2', 2, h * 0.8);
  },
  boot: (ctx, w, h, _c, v) => {
    ctx.fillStyle = v ? P.hints.twoSteps : P.hints.oneStep;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.4, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  paw: (ctx, w) => circle(ctx, w / 2, w / 2, w * 0.35, P.hints.koboldSteps),
  target: (ctx, w) => {
    ctx.strokeStyle = P.bad;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w * 0.38, 0, Math.PI * 2);
    ctx.stroke();
  },
  ghost: (ctx, w, h) => {
    ctx.globalAlpha = 0.45;
    rect(ctx, w * 0.25, h * 0.4, w * 0.5, h * 0.55, '#ffffff');
    circle(ctx, w / 2, h * 0.3, w * 0.28, '#ffffff');
    ctx.globalAlpha = 1;
  },
  routeDot: (ctx, w, _h, _c, v) => circle(ctx, w / 2, w / 2, w * 0.4, v ? P.bad : P.chalk),
  zzz: (ctx, _w, h) => {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${h * 0.7}px sans-serif`;
    ctx.fillText('Zzz', 4, h * 0.75);
  },
  vignette: (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
    g.addColorStop(0, 'rgba(15,22,38,0)');
    g.addColorStop(1, 'rgba(15,22,38,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
};
