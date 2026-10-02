// Экран загрузки (план, 11.5.8): обложка, полоса-«фитиль» и один из фактов о шахте.

import { ru } from '../../i18n/ru';
import { tipsRu } from '../../i18n/tips.ru';
import { coverTitle } from './MenuScreen';

export class LoadingScreen {
  readonly el: HTMLElement;
  private readonly bar: HTMLElement;

  constructor(host: HTMLElement) {
    const tip = tipsRu[Math.floor(Math.random() * tipsRu.length)];
    this.el = document.createElement('div');
    this.el.className = 'loading';
    this.el.setAttribute('role', 'status');
    this.el.innerHTML = `
      <div class="loading__panel">
        ${coverTitle(ru.title, 'loading__title')}
        <div class="loading__fuse" aria-hidden="true"><div class="loading__burn"></div><div class="loading__spark"></div></div>
        <div class="loading__label sfx" lang="de">${ru.loading}</div>
        <figure class="loading__tip">
          <figcaption>${ru.loadingTipTitle}</figcaption>
          <p>${tip}</p>
        </figure>
      </div>`;
    host.appendChild(this.el);
    this.bar = this.el.querySelector('.loading__fuse')!;
  }

  progress(frac: number): void {
    this.bar.style.setProperty('--p', String(Math.max(0, Math.min(1, frac))));
  }

  /** Плавно исчезнуть и удалиться. */
  hide(): void {
    this.el.classList.add('is-out');
    window.setTimeout(() => this.el.remove(), 260);
  }
}
