// Меню — обложка комикса (план, 11.5.1) поверх живой заставки: штольня с клетью в луче света
// и спящим кобольдом. Название объёмными буквами, «Das Bergwerk», «Glück auf!», кнопка «Играть».

import { ru } from '../../i18n/ru';
import { iconGear } from '../icons';

/** Название объёмными буквами: тыльный слой — тушь с выдавкой, лицевой — золото с бликом. */
export function coverTitle(text: string, extra = ''): string {
  return `<h1 class="cover-title ${extra}"><span class="cover-title__back" aria-hidden="true">${text}</span><span class="cover-title__front">${text}</span></h1>`;
}

export class MenuScreen {
  readonly el: HTMLElement;

  constructor(
    host: HTMLElement,
    h: { onPlay: () => void; onLevels: () => void; onSettings: () => void },
    opts: { showLevels: boolean },
  ) {
    this.el = document.createElement('div');
    this.el.className = 'menu';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', ru.title);
    this.el.innerHTML = `
      <header class="menu__mast">
        <div class="menu__issue">${ru.menu.issue}</div>
        ${coverTitle(ru.title)}
        <span class="menu__glint" style="--x:8%;--y:18%;--d:0s"></span>
        <span class="menu__glint" style="--x:88%;--y:30%;--d:1.1s"></span>
        <span class="menu__glint" style="--x:62%;--y:4%;--d:2.3s"></span>
        <div class="menu__sub-row">
          <div class="menu__subtitle sfx" lang="de">${ru.subtitle}</div>
          <div class="menu__burst sfx" lang="de"><span>${ru.greeting}</span></div>
        </div>
      </header>
      <div class="menu__bottom">
        <p class="menu__tagline">${ru.menu.tagline}</p>
        <div class="menu__buttons">
          <button type="button" class="btn btn--primary btn--big menu__play">${ru.play}</button>
          ${opts.showLevels ? `<button type="button" class="btn menu__levels">${ru.levels}</button>` : ''}
          <button type="button" class="round-btn menu__settings" aria-label="${ru.settings}">${iconGear}</button>
        </div>
      </div>`;
    host.appendChild(this.el);
    this.el.querySelector<HTMLButtonElement>('.menu__play')!.addEventListener('click', h.onPlay);
    this.el.querySelector<HTMLButtonElement>('.menu__levels')?.addEventListener('click', h.onLevels);
    this.el.querySelector<HTMLButtonElement>('.menu__settings')!.addEventListener('click', h.onSettings);
    this.el.querySelector<HTMLButtonElement>('.menu__play')!.focus({ preventScroll: true });
  }

  destroy(): void {
    this.el.remove();
  }
}
