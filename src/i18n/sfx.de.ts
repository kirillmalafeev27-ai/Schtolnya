// Слова-звуки (план, 9.3). Немецкие — погружение в язык и традиция немецких комиксов.
// Язык слов можно переключить в настройках; русский набор — запасной.

export type SfxKey =
  | 'gluckAuf'
  | 'zisch'
  | 'knister'
  | 'drei'
  | 'zwei'
  | 'eins'
  | 'kawumm'
  | 'knacks'
  | 'funkel'
  | 'schnapp'
  | 'kling'
  | 'schnarch'
  | 'ha'
  | 'grrr'
  | 'grrr2'
  | 'trapp'
  | 'aua'
  | 'habDich'
  | 'autsch'
  | 'hoppla'
  | 'klopf'
  | 'leer'
  | 'warte'
  | 'geschafft'
  | 'knapp';

export const sfxDe: Record<SfxKey, string> = {
  gluckAuf: 'GLÜCK AUF!',
  zisch: 'ZISCH!',
  knister: 'KNISTER…',
  drei: 'DREI!',
  zwei: 'ZWEI!',
  eins: 'EINS!',
  kawumm: 'KAWUMM!',
  knacks: 'KNACKS!',
  funkel: 'FUNKEL!',
  schnapp: 'SCHNAPP!',
  kling: 'KLING!',
  schnarch: 'SCHNARCH…',
  ha: 'HÄ?!',
  grrr: 'GRRR!',
  grrr2: 'GRRR!!',
  trapp: 'TRAPP TRAPP',
  aua: 'AUA!',
  habDich: 'HAB DICH!',
  autsch: 'AUTSCH…',
  hoppla: 'HOPPLA!',
  klopf: 'KLOPF',
  leer: 'LEER!',
  warte: 'WARTE!',
  geschafft: 'GESCHAFFT!',
  knapp: 'KNAPP!',
};

/** Русский набор для тех, кто переключил язык слов-звуков. Пишется шрифтом Rubik. */
export const sfxRu: Record<SfxKey, string> = {
  gluckAuf: 'В ДОБРЫЙ ЧАС!',
  zisch: 'ПШШ!',
  knister: 'ТРЕСЬ…',
  drei: 'ТРИ!',
  zwei: 'ДВА!',
  eins: 'ОДИН!',
  kawumm: 'БАБАХ!',
  knacks: 'ХРУСЬ!',
  funkel: 'БЛЕСК!',
  schnapp: 'ХВАТЬ!',
  kling: 'ДЗЫНЬ!',
  schnarch: 'ХРРР…',
  ha: 'А?!',
  grrr: 'РРРР!',
  grrr2: 'РРРР!!',
  trapp: 'ТОП-ТОП',
  aua: 'АЙ!',
  habDich: 'ПОПАЛСЯ!',
  autsch: 'ОЙ…',
  hoppla: 'ОПА!',
  klopf: 'ТУК',
  leer: 'ПУСТО!',
  warte: 'ЖДИ!',
  geschafft: 'ПОЛУЧИЛОСЬ!',
  knapp: 'ЕЛЕ УСПЕЛ!',
};
