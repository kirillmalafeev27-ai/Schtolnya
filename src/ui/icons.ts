// Нарисованные значки интерфейса: толстая тушь, плоская заливка, блик (план, 7.1 и 11.2.1).

import { palette as P } from '../config/palette';

const INK = P.ink;
const W = 3.2;

const svg = (body: string, vb = '0 0 48 48') =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;

/** Сапог — «Ответ — шаг». */
export const iconBoot = svg(`
  <path d="M15 6h14v20c0 2 1.5 3 4 4l7 3c3 1.3 4 3.3 4 6v3H8v-7c0-3 1-5 3-6l4-2z" fill="${P.hero.boots}" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
  <path d="M8 39h36v4H8z" fill="${P.timber.shadow}" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
  <path d="M15 12h14" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M18 9v16" stroke="${P.timber.light}" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>
  <circle cx="34" cy="33" r="1.6" fill="${P.timber.light}"/>`);

/** Шашка — «Ответ — заложить шашку». */
export const iconDynamite = svg(`
  <g transform="rotate(-24 24 26)">
    <rect x="15" y="12" width="14" height="30" rx="4" fill="${P.dynamite.base}" stroke="${INK}" stroke-width="${W}"/>
    <rect x="15" y="22" width="14" height="8" fill="${P.dynamite.label}" stroke="${INK}" stroke-width="2"/>
    <path d="M19 15v24" stroke="${P.dynamite.light}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M22 12c0-5 3-6 6-7" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
  </g>
  <path d="M33 4l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="${P.fuseSpark}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`);

/** Щит — «Ответ — в укрытие». */
export const iconShield = svg(`
  <path d="M24 4l16 6v12c0 11-7 18-16 22C15 40 8 33 8 22V10z" fill="${P.bedrock.light}" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
  <path d="M24 4v40c9-4 16-11 16-22V10z" fill="${P.bedrock.base}" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
  <path d="M14 13l7-2.6" stroke="${P.panel}" stroke-width="2.6" stroke-linecap="round"/>`);

/** Ладонь — «Ответ — в запас». */
export const iconPalm = svg(`
  <path d="M13 26V14a3 3 0 0 1 6 0v8V9a3 3 0 0 1 6 0v13V11a3 3 0 0 1 6 0v12v-7a3 3 0 0 1 6 0v14c0 9-6 15-14 15c-6 0-9-3-12-8l-5-8a3 3 0 0 1 5-3z"
    fill="${P.hero.skin}" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
  <path d="M16 15v8" stroke="${P.panel}" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>`);

/** Звезда готовности — «Готов!». */
export const iconReady = svg(`
  <path d="M24 2l5 9 10-3-3 10 9 6-9 5 3 10-10-3-5 9-5-9-10 3 3-10-9-5 9-6-3-10 10 3z" fill="${P.caption}" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
  <path d="M22 13h5l-1 13h-3z" fill="${INK}"/><circle cx="24.5" cy="31" r="2.6" fill="${INK}"/>`);

/** Песочные часы — «Приготовься…». */
export const iconWait = svg(`
  <path d="M12 5h24M12 43h24" stroke="${INK}" stroke-width="${W + 0.6}" stroke-linecap="round"/>
  <path d="M15 6c0 9 7 12 7 18s-7 9-7 18h18c0-9-7-12-7-18s7-9 7-18z" fill="${P.panel}" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
  <path d="M19 38c1-4 4-5 5-6c1 1 4 2 5 6z" fill="${P.caption}"/>`);

/** Клеть подъёмника — кнопка «К подъёмнику». */
export const iconLift = svg(`
  <path d="M24 2v8" stroke="${INK}" stroke-width="${W}" stroke-linecap="round"/>
  <rect x="9" y="10" width="30" height="32" rx="2" fill="${P.timber.base}" stroke="${INK}" stroke-width="${W}"/>
  <path d="M9 18h30M9 34h30M17 10v32M31 10v32" stroke="${INK}" stroke-width="2.2"/>
  <path d="M24 30l-6-6h4v-6h4v6h4z" fill="${P.daylight}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`);

/** Пауза. */
export const iconPause = svg(`
  <rect x="11" y="9" width="10" height="30" rx="2" fill="${P.panel}" stroke="${INK}" stroke-width="${W}"/>
  <rect x="27" y="9" width="10" height="30" rx="2" fill="${P.panel}" stroke="${INK}" stroke-width="${W}"/>`);

/** Шестерёнка настроек. */
export const iconGear = svg(`
  <path d="M21 4h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z"
    fill="${P.bedrock.light}" stroke="${INK}" stroke-width="${W}" stroke-linejoin="round"/>
  <circle cx="24" cy="24" r="6" fill="${P.panel}" stroke="${INK}" stroke-width="${W}"/>`);

/** Маленькая шашка для плашки снаряжения. */
export const iconStick = svg(
  `<rect x="6" y="3" width="10" height="26" rx="3" fill="${P.dynamite.base}" stroke="${INK}" stroke-width="2.4"/>
   <rect x="6" y="12" width="10" height="6" fill="${P.dynamite.label}" stroke="${INK}" stroke-width="1.6"/>
   <path d="M9 5v21" stroke="${P.dynamite.light}" stroke-width="2" stroke-linecap="round"/>`,
  '0 0 22 32',
);

/** Самородок: пустая ячейка — контур, полная — золото. */
export function iconNugget(filled: boolean): string {
  if (!filled) {
    return svg(
      `<path d="M8 22l4-11 10-5 11 3 6 10-3 10-11 5-12-3z" fill="none" stroke="${P.floor.pebble}" stroke-width="2.6" stroke-dasharray="4 3" stroke-linejoin="round"/>`,
      '0 0 44 40',
    );
  }
  return svg(
    `<path d="M8 22l4-11 10-5 11 3 6 10-3 10-11 5-12-3z" fill="${P.gold.base}" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
     <path d="M22 6l-4 13 15 3M18 19l-6 12" fill="none" stroke="${P.gold.shadow}" stroke-width="2"/>
     <path d="M14 15l5-5" stroke="${P.gold.light}" stroke-width="3" stroke-linecap="round"/>
     <path d="M31 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="${P.panel}"/>`,
    '0 0 44 40',
  );
}

/** Звезда рейтинга. */
export function iconStar(filled: boolean): string {
  return svg(
    `<path d="M24 3l6 13 14 2-10 10 3 14-13-7-13 7 3-14L4 18l14-2z" fill="${filled ? P.caption : P.floor.shadow}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
     ${filled ? `<path d="M15 19l6-1" stroke="${P.panel}" stroke-width="2.6" stroke-linecap="round"/>` : ''}`,
  );
}

/** Замок закрытого уровня. */
export const iconLock = svg(`
  <path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="${INK}" stroke-width="${W + 1}"/>
  <rect x="10" y="20" width="28" height="22" rx="3" fill="${P.bedrock.light}" stroke="${INK}" stroke-width="${W}"/>
  <circle cx="24" cy="30" r="3" fill="${INK}"/><path d="M24 31v5" stroke="${INK}" stroke-width="3"/>`);
