// Все цвета игры. Цвета закреплены за смыслом (план, 7.1):
// золото — только добыча, красный — только динамит и опасность, зелёный — только кобольд.

export const palette = {
  ink: '#1b1020', // все контуры и тени; чистый чёрный не используется
  page: '#14233d', // просветы между панелями
  pageDots: '#1f3354', // растр просветов
  panel: '#ffffff', // фон панели вопроса
  caption: '#ffe066', // плашки-подписи

  // окружение: холодный сланец и тёмное дерево
  caveDeep: '#0f1626',
  bedrock: { base: '#3b4a63', shadow: '#26314a', light: '#5b6d8c' },
  floor: { base: '#55505c', shadow: '#3a3641', light: '#77717f', pebble: '#8a8390' },
  timber: { base: '#6b4a2f', shadow: '#47301d', light: '#8f6a45' },
  rail: '#7a6a5e',
  crystalDecor: '#7fb8ff', // голубые друзы — только декор
  mushroom: '#5ff2d2', // светящиеся грибы у логова
  scorch: '#2a2230', // копоть после взрыва

  // разрушимая порода — теплее и бугристее скалы
  rock: { base: '#8a7a68', shadow: '#5f5244', light: '#b3a28c' },
  hardRock: { base: '#6a5c4e', shadow: '#43392f', light: '#8c7c69', quartz: '#e8e4f0' },
  chalk: '#f4f1e6',

  // золото — только добыча
  gold: { base: '#ffc533', shadow: '#e08a1e', light: '#fff2a8', engrave: '#a45a12' },

  // красный — только динамит и опасность
  dynamite: { base: '#e8322f', shadow: '#9e1b1b', light: '#ff8a7a', label: '#fff4d6' },
  tape: { red: '#e8322f', white: '#ffffff' },
  fuseSpark: '#fff3a0',
  blast: { core: '#ffffff', inner: '#ffe14d', mid: '#ff8a1f', outer: '#e8322f', smoke: '#9a93a6' },

  // зелёный — только кобольд
  kobold: {
    skin: '#6f9a3a',
    skinShadow: '#4a6b24',
    skinLight: '#9cc35a',
    vest: '#5a4636',
    cap: '#3e3a5a',
    eyes: '#e4ff4a',
  },

  // герой — тот же, что в «Сокровищнице», с каской вместо шляпы
  hero: {
    helmet: '#efeae0',
    lamp: '#ffd27a',
    shirt: '#fff1d6',
    scarf: '#ff6a1a',
    pants: '#2b5d73',
    boots: '#4a2a1a',
    skin: '#f2c094',
    belt: '#5a3a22',
  },

  lantern: '#ffb85c',
  daylight: '#fff6d8',
  ambient: '#1e2840',

  hints: { oneStep: '#fff4d6', twoSteps: '#ffb13b', koboldSteps: '#9cc35a' },
  good: '#3ddc84',
  bad: '#ff4d4d',
} as const;

/** '#rrggbb' → 0xrrggbb для Phaser. */
export function hex(color: string): number {
  return parseInt(color.slice(1, 7), 16);
}

/** '#rrggbb' → [r, g, b] в долях единицы (для шейдеров). */
export function rgb01(color: string): [number, number, number] {
  const n = hex(color);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Цвет с прозрачностью для Canvas 2D. */
export function rgba(color: string, alpha: number): string {
  const n = hex(color);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
