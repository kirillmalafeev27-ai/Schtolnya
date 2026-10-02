// Все числа баланса и тайминги игры. В сценах и логике магических чисел нет (план, 0.4).
// Длительности, заданные «в ответах», умножаются на T_med игрока (план, 3.5).

export const balance = {
  /** Общие для всех уровней значения (план, 4.3). */
  rules: {
    blastRange: 2,
    stunAnswers: 4,
    wakeAnswers: 8,
    wrongFeedbackMs: 1000,
    /** Фитиль: fuseAnswers × T_med, но не меньше и не больше этих секунд (2.3.4). */
    fuseMinS: 6,
    fuseMaxS: 16,
    /** Кобольд приседает за столько секунд до шага (2.4.4). */
    crouchS: 0.15,
    /** После оглушения интервал шага × angerFactor, но не меньше minStepAnswers × T_med (2.4.6). */
    angerFactor: 0.9,
    minStepAnswers: 0.8,
    /** Кобольд просыпается, когда герой подходит к логову на столько клеток по пути (2.4.1). */
    wakeProximity: 3,
    /** Отсчёт DREI! ZWEI! EINS! — последние секунды фитиля (2.8.3). */
    countdownFrom: 3,
    /** Подсказка «Нет укрытия» — если ближе стольких шагов укрытия нет (2.8.2). */
    shelterHintSteps: 2,
  },

  score: {
    vein: 10,
    nugget: 5,
    stick: 2,
    /** S3 = S2 + s3Bonus (5.15). */
    s3Bonus: 4,
  },

  /** Темп игрока (план, раздел 3). */
  pace: {
    defaultTMed: 5.0,
    minTMed: 3,
    maxTMed: 10,
    timeWindow: 20,
    defaultP: 0.8,
    minP: 0.5,
    maxP: 1,
    correctWindow: 30,
  },

  /** Честность времени (2.7). */
  time: {
    maxFrameDtS: 0.1,
    doubleTapGuardMs: 120,
  },

  /** Генерация уровня (раздел 5). */
  gen: {
    loopFraction: 0.15,
    shortcutsMin: 3,
    shortcutsMax: 5,
    veinDistFrac: 0.7,
    lairDistFrac: 0.5,
    lairVeinMinDist: 3,
    lairLairMinDist: 4,
    spareMinRouteDist: 3,
    dilemmaMinShorter: 4,
    maxAttempts: 50,
    /** Сколько стенок можно превратить в породу, чтобы появилась дилемма маршрута (5.10). */
    dilemmaFixTries: 6,
  },

  /** Анимации и отклик. Ничто из этого не задерживает логику (0.5, 9.1). */
  anim: {
    stepMs: 180,
    plantMs: 250,
    blastMs: 400,
    smokeMs: 800,
    hitStopMs: 80,
    whiteFlashMs: 60,
    answerFlashMs: 150,
    questionFlipMs: 150,
    finalAnimMaxMs: 2000,
    introMaxMs: 2500,
    koboldCrouchMs: 150,
    /** Самый долгий отклик на действие (9.1.3). */
    actionAnimMaxMs: 400,
    maxSfxWords: 3,
    sfxWordMs: 900,
    trappIntervalMs: 4000,
    alarmCells: 3,
    vignettePulseHz: 1.6,
    lanternBlinkMs: 260,
    dustDimMs: 1000,
    maxFlashesPerSecond: 3,
    pickupFlyMs: 420,
    countFlyMs: 260,
    tallyStepMs: 220,
    resultPanelDelayMs: 380,
  },

  /** Камера (9.2). */
  camera: {
    shakeBlastPx: 8,
    shakeCrackPx: 3,
    shakeWakePx: 2,
    shakeCaughtPx: 6,
    shakeMs: 260,
    veinZoom: 1.03,
    veinZoomMs: 220,
  },

  /** Частицы (13.6). */
  particles: {
    maxTotal: 300,
    maxPerBlast: 120,
    debrisPerBlast: 18,
    sparksPerBlast: 40,
    smokePerBlast: 9,
    stepDust: 5,
    ambientDust: 26,
  },

  /** Свет (раздел 8). Радиусы — в клетках. */
  light: {
    maxLights: 12,
    ambientStrength: 0.3,
    floorMinLight: 0.55,
    steps: [0.3, 0.65, 1.0] as const,
    thresholds: [0.475, 0.825] as const,
    band: 0.04,
    dotSpacingCssPx: 6,
    lanterns: { radius: 3.0, intensity: 1.0, flicker: 0.12, swingDeg: 4, minCount: 4, maxCount: 6 },
    heroLamp: { radius: 2.5, intensity: 0.9, offset: 0.4 },
    daylight: { radius: 3.0, intensity: 1.3 },
    fuseSpark: { radius: 1.5, intensity: 1.1, flicker: 0.35 },
    blastFlash: { radius: 5.0, intensity: 2.0, fadeMs: 400 },
    vein: { radius: 1.2, intensity: 0.6, periodS: 2 },
    mushrooms: { radius: 1.5, intensity: 0.5, periodS: 4 },
    koboldEyes: { radius: 0.6, intensity: 0.6 },
    awakeCooling: 0.1,
    dustDim: 0.75,
  },

  /** Арт (7.3, 13.5). */
  art: {
    cellPx: 128,
    cellPxLow: 96,
    blockRise: 0.25,
    inkFrac: 0.07,
    minCellCssPx: 36,
    maxDpr: 2,
    genBudgetMs: 1500,
    floorVariants: 8,
    timberEvery: 3,
  },

  /** Раскладка экрана (11.1). */
  layout: {
    landscapeRatio: 1.2,
    quizPortraitFrac: 0.42,
    quizPortraitMin: 300,
    quizPortraitMax: 420,
    quizLandscapeFrac: 0.34,
    quizLandscapeMin: 340,
    quizLandscapeMax: 480,
    gutterMin: 10,
    gutterMax: 14,
  },

  /** Качество (13.6.4). */
  quality: {
    lowFpsThreshold: 45,
    lowFpsWindowS: 3,
  },

  /** Вопросы (раздел 12). */
  questions: {
    noRepeatWithin: 10,
    retryAfterMin: 4,
    retryAfterMax: 6,
    fontMaxPx: 24,
    fontMinPx: 16,
  },

  /** Звук (раздел 10). */
  audio: {
    duckAfterBlastMs: 300,
    duckLevel: 0.35,
    pitchJitter: 0.05,
    dripMinS: 4,
    dripMaxS: 9,
    creakMinS: 7,
    creakMaxS: 16,
    koboldHearCells: 9,
  },
} as const;

export type Balance = typeof balance;
