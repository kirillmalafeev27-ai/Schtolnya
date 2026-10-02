// Все строки интерфейса (план, 11.7). Текст в обычном регистре; капсом — только слова-звуки и отсчёт.

export const ru = {
  title: 'Шахта',
  subtitle: 'Das Bergwerk',
  greeting: 'Glück auf!',
  play: 'Играть',
  levels: 'Уровни',
  settings: 'Настройки',
  back: 'Назад',
  close: 'Закрыть',
  levelN: (n: number) => `Уровень ${n}`,
  endless: 'Бесконечная шахта',
  locked: 'Закрыто',
  levelLockedHint: 'Пройди предыдущий уровень хотя бы на одну звезду',

  answer: {
    step: 'Ответ — шаг',
    plant: 'Ответ — заложить шашку',
    shelter: 'Ответ — в укрытие',
    stay: 'Ответ — в запас',
    ready: 'Готов! Выбери, что делать',
    intro: 'Приготовься…',
    over: 'Раунд окончен',
  },
  quizLabel: 'Вопрос',
  optionLabel: (n: number, text: string) => `Вариант ${n}: ${text}`,
  readyHint: 'Готов! Выбери, что делать',

  gear: {
    sticks: 'Шашки',
    vein: 'Главный самородок',
    score: 'Счёт',
    home: 'К подъёмнику',
    stay: 'Стоять',
    pause: 'Пауза',
  },

  plates: {
    noShelter: 'Нет укрытия',
    pathClosed: 'Путь закрыт',
    veinFirst: 'Сначала жила',
  },

  intro: {
    plate: 'Жила — здесь. Кобольд спит — пока',
    vein: 'Жила',
    lair: 'Кобольд',
  },

  pause: {
    title: 'Пауза',
    resume: 'Продолжить',
    restart: 'Начать заново',
    menu: 'В меню',
  },

  results: {
    won: 'Победа!',
    lost: 'Неудача',
    vein: 'Жила',
    nuggets: (n: number) => `Самородки × ${n}`,
    sticks: (n: number) => `Шашки в запасе × ${n}`,
    total: 'Итого',
    stats: 'Статистика',
    blasts: 'Взрывы',
    stuns: 'Оглушения',
    correct: 'Верные ответы',
    wrong: 'Неверные ответы',
    medianAnswer: 'Медиана ответа',
    best: 'Лучший результат',
    cause: 'Причина',
    causeKobold: 'кобольд поймал героя',
    causeBlast: 'герой попал под свой взрыв',
    retry: 'Ещё раз',
    next: 'Дальше',
    menu: 'В меню',
    seconds: (s: number) => `${s.toFixed(1)} с`,
  },

  settingsScreen: {
    title: 'Настройки',
    sfxVolume: 'Громкость эффектов',
    ambientVolume: 'Громкость эмбиента',
    sound: 'Звук',
    reducedMotion: 'Меньше движения',
    quality: 'Качество графики',
    qualityHigh: 'Высокое',
    qualityLow: 'Низкое',
    hints: 'Подсказки',
    hintsAll: 'Все, что разрешает уровень',
    hintsNoShelter: 'Без следов-укрытий',
    hintsBurning: 'Только горящий крест',
    sfxLang: 'Слова-звуки',
    sfxLangDe: 'Немецкие',
    sfxLangRu: 'Русские',
    autoLowQuality: 'Качество снижено автоматически: игра шла медленно',
  },

  tutorial: {
    start:
      'Тапни по проходу — пойду туда. Порода с меловым крестом взрывается: тапни по ней — заложу шашку',
    planted: 'Фитиль горит! Следующий верный ответ уведёт меня в укрытие',
    koboldAwake: 'Проснулся! Заведи его под взрыв — оглушит',
    ok: 'Понятно',
  },

  loading: 'Lädt…',
  webglMissing: 'Световые эффекты недоступны — играем без них',
} as const;

export type Strings = typeof ru;
