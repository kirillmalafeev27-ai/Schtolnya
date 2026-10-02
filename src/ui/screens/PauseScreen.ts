// Пауза (план, 11.5.4): панель «Пауза» поверх размытого мира.

import { ru } from '../../i18n/ru';

export class PauseScreen {
  readonly el: HTMLElement;

  constructor(
    host: HTMLElement,
    h: { onResume: () => void; onRestart: () => void; onMenu: () => void; onSettings: () => void },
  ) {
    const P = ru.pause;
    this.el = document.createElement('div');
    this.el.className = 'pause';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', P.title);
    this.el.innerHTML = `
      <div class="pause__panel">
        <h2 class="pause__title">${P.title}</h2>
        <button type="button" class="btn btn--primary pause__resume">${P.resume}</button>
        <button type="button" class="btn pause__restart">${P.restart}</button>
        <button type="button" class="btn pause__settings">${ru.settings}</button>
        <button type="button" class="btn btn--ghost pause__menu">${P.menu}</button>
      </div>`;
    host.appendChild(this.el);
    this.el.querySelector<HTMLButtonElement>('.pause__resume')!.addEventListener('click', h.onResume);
    this.el.querySelector<HTMLButtonElement>('.pause__restart')!.addEventListener('click', h.onRestart);
    this.el.querySelector<HTMLButtonElement>('.pause__menu')!.addEventListener('click', h.onMenu);
    this.el.querySelector<HTMLButtonElement>('.pause__settings')!.addEventListener('click', h.onSettings);
    this.el.querySelector<HTMLButtonElement>('.pause__resume')!.focus({ preventScroll: true });
  }

  destroy(): void {
    this.el.remove();
  }
}
