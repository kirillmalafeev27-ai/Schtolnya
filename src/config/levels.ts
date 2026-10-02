// Уровни (план, раздел 4). Шаг кобольда и фитиль подобраны симуляцией (раздел 14, DECISIONS.md).

export type HallSize = 'S' | 'M';

/** «all» — все подсказки; «noShelter» — без следов-укрытий; «burningOnly» — крест виден лишь после закладки. */
export type HintLevel = 'all' | 'noShelter' | 'burningOnly';

export interface LevelDef {
  id: number;
  /** Подпись в выборе уровня. */
  name: string;
  hall: HallSize;
  /** Сколько завалов нужно пробить по маршруту с минимумом взрывов (крепкая порода — за два). */
  blastsToVein: readonly [number, number];
  startSticks: number;
  spareSticks: number;
  hardFraction: number;
  pockets: number;
  kobolds: number;
  koboldStepAnswers: number;
  fuseAnswers: number;
  hints: HintLevel;
}

/** Размер зала: [ширина, высота] в портрете; в ландшафте стороны меняются местами (4.1). */
export const hallSizes: Record<HallSize, readonly [number, number]> = {
  S: [9, 11],
  M: [9, 13],
};

export const levels: readonly LevelDef[] = [
  {
    id: 1,
    name: 'Старая штольня',
    hall: 'S',
    blastsToVein: [1, 2],
    startSticks: 5,
    spareSticks: 2,
    hardFraction: 0,
    pockets: 0,
    kobolds: 1,
    koboldStepAnswers: 4.5,
    fuseAnswers: 4.6,
    hints: 'all',
  },
  {
    id: 2,
    name: 'Крепкий пласт',
    hall: 'S',
    blastsToVein: [2, 2],
    startSticks: 5,
    spareSticks: 2,
    hardFraction: 0.15,
    pockets: 1,
    kobolds: 1,
    koboldStepAnswers: 4.0,
    fuseAnswers: 4.4,
    hints: 'all',
  },
  {
    id: 3,
    name: 'Глубокий горизонт',
    hall: 'M',
    blastsToVein: [2, 3],
    startSticks: 5,
    spareSticks: 1,
    hardFraction: 0.25,
    pockets: 1,
    kobolds: 1,
    koboldStepAnswers: 3.8,
    fuseAnswers: 4.2,
    hints: 'all',
  },
  {
    id: 4,
    name: 'Кварцевый забой',
    hall: 'M',
    blastsToVein: [2, 3],
    startSticks: 4,
    spareSticks: 2,
    hardFraction: 0.3,
    pockets: 2,
    kobolds: 1,
    koboldStepAnswers: 3.5,
    fuseAnswers: 4.0,
    hints: 'noShelter',
  },
  {
    id: 5,
    name: 'Два логова',
    hall: 'M',
    blastsToVein: [2, 3],
    startSticks: 4,
    spareSticks: 2,
    hardFraction: 0.3,
    pockets: 2,
    kobolds: 2,
    koboldStepAnswers: 4.0,
    fuseAnswers: 4.0,
    hints: 'noShelter',
  },
  {
    id: 6,
    name: 'Царство кобольдов',
    hall: 'M',
    blastsToVein: [3, 3],
    startSticks: 4,
    spareSticks: 2,
    hardFraction: 0.35,
    pockets: 2,
    kobolds: 2,
    koboldStepAnswers: 3.8,
    fuseAnswers: 4.2,
    hints: 'noShelter',
  },
  {
    id: 7,
    name: 'Бездонная',
    hall: 'M',
    blastsToVein: [3, 3],
    startSticks: 4,
    spareSticks: 2,
    hardFraction: 0.35,
    pockets: 2,
    kobolds: 2,
    koboldStepAnswers: 3.5,
    fuseAnswers: 4.0,
    hints: 'burningOnly',
  },
];

/** Бесконечный уровень — последний в списке («∞» в таблице плана). */
export const ENDLESS_LEVEL_ID = 7;

export function getLevel(id: number): LevelDef {
  return levels.find((l) => l.id === id) ?? levels[0];
}

/** Размер зала с учётом формы панели мира (11.1.4). */
export function hallDims(hall: HallSize, landscape: boolean): { w: number; h: number } {
  const [a, b] = hallSizes[hall];
  return landscape ? { w: b, h: a } : { w: a, h: b };
}
