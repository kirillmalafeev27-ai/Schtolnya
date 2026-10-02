// Ключи всех текстур (план, 7.3.2). Чтобы заменить процедурный арт рисованным, достаточно
// загрузить PNG под теми же ключами — код сцен не меняется.
// Размеры заданы в клетках; при генерации умножаются на размер клетки в пикселях текстуры.

export interface ArtEntry {
  key: string;
  /** Ширина и высота в клетках. */
  w: number;
  h: number;
  /** Имя рецепта и его вариант. */
  recipe: string;
  variant: number;
}

export const FLOOR_VARIANTS = 8;
export const BEDROCK_VARIANTS = 6;
export const ROCK_VARIANTS = 4;
export const HARD_VARIANTS = 3;
export const CRACKED_VARIANTS = 2;
export const VEIN_VARIANTS = 2;
export const POCKET_VARIANTS = 2;
export const DEBRIS_VARIANTS = 6;
export const SMOKE_VARIANTS = 4;
export const MUSHROOM_VARIANTS = 3;

/** Блок в ракурсе «три четверти»: клетка плюс выступ вверх на 0.25 клетки (2.1.3). */
export const BLOCK_H = 1.25;

export const ART = {
  floor: (i: number) => `floor-${i}`,
  floorBaked: 'floor-baked',
  backdrop: 'backdrop',
  bedrock: (i: number) => `bedrock-${i}`,
  rock: (i: number) => `rock-${i}`,
  rockCracked: (i: number) => `rock-cracked-${i}`,
  hard: (i: number) => `hard-${i}`,
  vein: (i: number) => `vein-${i}`,
  pocket: (i: number) => `pocket-${i}`,
  pocketSpark: 'pocket-spark',
  lift: 'lift',
  liftFront: 'lift-front',
  daylight: 'daylight',
  lair: 'lair',
  mushroom: (i: number) => `mushroom-${i}`,
  timberPost: 'timber-post',
  timberBeam: 'timber-beam',
  lantern: 'lantern',
  stickItem: 'stick-item',
  nuggetBig: 'nugget-big',
  nuggetSmall: 'nugget-small',
  dynPlanted: 'dyn-planted',
  fuseSpark: 'fuse-spark',
  shadow: 'shadow',
  scorch: 'scorch',
  rubble: (i: number) => `rubble-${i}`,
  // герой (сборка из частей)
  heroBody: 'hero-body',
  heroHead: 'hero-head',
  heroHeadWorried: 'hero-head-worried',
  heroHeadSooty: 'hero-head-sooty',
  heroHeadHappy: 'hero-head-happy',
  heroLeg: 'hero-leg',
  heroArm: 'hero-arm',
  heroScarf: 'hero-scarf',
  heroPouch: 'hero-pouch',
  heroPouchGold: 'hero-pouch-gold',
  heroBeltStick: 'hero-belt-stick',
  // кобольд
  koboldBody: 'kobold-body',
  koboldHead: 'kobold-head',
  koboldHeadAngry: 'kobold-head-angry',
  koboldHeadSooty: 'kobold-head-sooty',
  koboldSleep: 'kobold-sleep',
  koboldFoot: 'kobold-foot',
  koboldEyes: 'kobold-eyes',
  koboldCandle: 'kobold-candle',
  stunStar: 'stun-star',
  steam: 'steam',
  // взрыв и атмосфера
  boom: 'boom',
  flameH: 'flame-h',
  flameV: 'flame-v',
  flameEnd: 'flame-end',
  debris: (i: number) => `debris-${i}`,
  smoke: (i: number) => `smoke-${i}`,
  spark: 'spark',
  dust: 'dust',
  glow: 'glow',
  glowSoft: 'glow-soft',
  // подсказки (слой 5)
  tapeH: 'tape-h',
  tapeV: 'tape-v',
  tapeCenter: 'tape-center',
  crackMark: 'crack-mark',
  x2: 'x2',
  bootWhite: 'boot-white',
  bootOrange: 'boot-orange',
  paw: 'paw',
  target: 'target',
  ghost: 'ghost',
  routeDot: 'route-dot',
  routeDotRed: 'route-dot-red',
  zzz: 'zzz',
  dangerRing: 'danger-ring',
  vignette: 'vignette',
} as const;

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** Полный список текстур, генерируемых на старте. */
export function manifest(): ArtEntry[] {
  const e: ArtEntry[] = [];
  const add = (key: string, w: number, h: number, recipe: string, variant = 0) =>
    e.push({ key, w, h, recipe, variant });
  for (const i of range(FLOOR_VARIANTS)) add(ART.floor(i), 1, 1, 'floor', i);
  add(ART.backdrop, 2, 2, 'backdrop');
  for (const i of range(BEDROCK_VARIANTS)) add(ART.bedrock(i), 1, BLOCK_H, 'bedrock', i);
  for (const i of range(ROCK_VARIANTS)) add(ART.rock(i), 1, BLOCK_H, 'rock', i);
  for (const i of range(CRACKED_VARIANTS)) add(ART.rockCracked(i), 1, BLOCK_H, 'rockCracked', i);
  for (const i of range(HARD_VARIANTS)) add(ART.hard(i), 1, BLOCK_H, 'hard', i);
  for (const i of range(VEIN_VARIANTS)) add(ART.vein(i), 1, BLOCK_H, 'vein', i);
  for (const i of range(POCKET_VARIANTS)) add(ART.pocket(i), 1, BLOCK_H, 'pocket', i);
  add(ART.pocketSpark, 0.5, 0.5, 'pocketSpark');
  add(ART.lift, 1.2, 2.2, 'lift');
  add(ART.liftFront, 1.2, 0.6, 'liftFront');
  add(ART.daylight, 2.2, 3.2, 'daylight');
  add(ART.lair, 1.1, 0.8, 'lair');
  for (const i of range(MUSHROOM_VARIANTS)) add(ART.mushroom(i), 0.28, 0.32, 'mushroom', i);
  add(ART.timberPost, 0.3, 0.66, 'timberPost');
  add(ART.timberBeam, 1.0, 0.24, 'timberBeam');
  add(ART.lantern, 0.36, 0.52, 'lantern');
  add(ART.stickItem, 0.5, 0.5, 'stickItem');
  add(ART.nuggetBig, 0.62, 0.52, 'nuggetBig');
  add(ART.nuggetSmall, 0.42, 0.36, 'nuggetSmall');
  add(ART.dynPlanted, 0.42, 0.42, 'dynPlanted');
  add(ART.fuseSpark, 0.4, 0.4, 'fuseSpark');
  add(ART.shadow, 0.8, 0.3, 'shadow');
  add(ART.scorch, 1.1, 0.9, 'scorch');
  for (const i of range(DEBRIS_VARIANTS)) add(ART.rubble(i), 0.3, 0.26, 'rubble', i);

  add(ART.heroBody, 0.62, 0.56, 'heroBody');
  add(ART.heroHead, 0.62, 0.6, 'heroHead', 0);
  add(ART.heroHeadWorried, 0.62, 0.6, 'heroHead', 1);
  add(ART.heroHeadSooty, 0.62, 0.6, 'heroHead', 2);
  add(ART.heroHeadHappy, 0.62, 0.6, 'heroHead', 3);
  add(ART.heroLeg, 0.18, 0.3, 'heroLeg');
  add(ART.heroArm, 0.16, 0.3, 'heroArm');
  add(ART.heroScarf, 0.34, 0.2, 'heroScarf');
  add(ART.heroPouch, 0.2, 0.2, 'heroPouch', 0);
  add(ART.heroPouchGold, 0.2, 0.2, 'heroPouch', 1);
  add(ART.heroBeltStick, 0.08, 0.2, 'heroBeltStick');

  add(ART.koboldBody, 0.74, 0.6, 'koboldBody');
  add(ART.koboldHead, 0.82, 0.64, 'koboldHead', 0);
  add(ART.koboldHeadAngry, 0.82, 0.64, 'koboldHead', 1);
  add(ART.koboldHeadSooty, 0.82, 0.64, 'koboldHead', 2);
  add(ART.koboldSleep, 0.96, 0.62, 'koboldSleep');
  add(ART.koboldFoot, 0.22, 0.14, 'koboldFoot');
  add(ART.koboldEyes, 0.4, 0.18, 'koboldEyes');
  add(ART.koboldCandle, 0.14, 0.3, 'koboldCandle');
  add(ART.stunStar, 0.18, 0.18, 'stunStar');
  add(ART.steam, 0.3, 0.3, 'steam');

  add(ART.boom, 1.9, 1.9, 'boom');
  add(ART.flameH, 1.0, 0.8, 'flameH');
  add(ART.flameV, 0.8, 1.0, 'flameV');
  add(ART.flameEnd, 1.0, 0.8, 'flameEnd');
  for (const i of range(DEBRIS_VARIANTS)) add(ART.debris(i), 0.24, 0.22, 'debris', i);
  for (const i of range(SMOKE_VARIANTS)) add(ART.smoke(i), 0.9, 0.8, 'smoke', i);
  add(ART.spark, 0.14, 0.14, 'spark');
  add(ART.dust, 0.16, 0.16, 'dust');
  add(ART.glow, 1, 1, 'glow');
  add(ART.glowSoft, 1, 1, 'glowSoft');

  add(ART.tapeH, 1, 0.42, 'tape', 0);
  add(ART.tapeV, 0.42, 1, 'tape', 1);
  add(ART.tapeCenter, 0.7, 0.7, 'tapeCenter');
  add(ART.crackMark, 0.6, 0.6, 'crackMark');
  add(ART.x2, 0.5, 0.36, 'x2');
  add(ART.bootWhite, 0.3, 0.42, 'boot', 0);
  add(ART.bootOrange, 0.3, 0.42, 'boot', 1);
  add(ART.paw, 0.28, 0.28, 'paw');
  add(ART.target, 0.6, 0.6, 'target');
  add(ART.ghost, 0.7, 1.1, 'ghost');
  add(ART.routeDot, 0.14, 0.14, 'routeDot', 0);
  add(ART.routeDotRed, 0.14, 0.14, 'routeDot', 1);
  add(ART.zzz, 1.2, 0.5, 'zzz');
  add(ART.dangerRing, 0.86, 0.4, 'dangerRing');
  add(ART.vignette, 4, 4, 'vignette');
  return e;
}
