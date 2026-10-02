// Выбор уровня (план, 11.5.2): страница из панелей-карточек со звёздами; закрытые затемнены.

import type { LevelDef } from '../../config/levels';
import { ru } from '../../i18n/ru';
import { iconLock, iconStar } from '../icons';

export interface LevelCard {
  def: LevelDef;
  stars: number;
  best: number | null;
  locked: boolean;
}

export class LevelSelectScreen {
  readonly el: HTMLElement;

  constructor(
    host: HTMLElement,
    cards: LevelCard[],
    h: { onPick: (id: number) => void; onBack: () => void },
  ) {
    const L = ru.levelSelect;
    this.el = document.createElement('div');
    this.el.className = 'levels';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', L.title);
    const last = cards[cards.length - 1]?.def.id;
    this.el.innerHTML = `
      <div class="levels__page">
        <header class="levels__head">
          <button type="button" class="btn levels__back">${ru.back}</button>
          <h2 class="levels__title">${L.title}</h2>
        </header>
        <div class="levels__grid">
          ${cards
            .map((c, i) => {
              const endless = c.def.id === last;
              const label = c.locked
                ? `${ru.levelN(c.def.id)}. ${ru.locked}`
                : `${ru.levelN(c.def.id)}: ${c.def.name}`;
              return `
              <button type="button" class="levels__card${c.locked ? ' is-locked' : ''}${endless ? ' is-endless' : ''}"
                data-id="${c.def.id}" style="--i:${i}" aria-label="${label}" ${c.locked ? 'aria-disabled="true"' : ''}>
                <span class="levels__num sfx">${endless ? '∞' : c.def.id}</span>
                <span class="levels__name">${endless ? ru.endless : c.def.name}</span>
                <span class="levels__stars" aria-label="${L.starsLabel(c.stars)}">${[1, 2, 3].map((k) => iconStar(c.stars >= k)).join('')}</span>
                <span class="levels__best">${c.locked ? ru.levelLockedHint : c.best !== null ? L.best(c.best) : L.noBest}</span>
                ${c.locked ? `<span class="levels__lock">${iconLock}</span>` : ''}
              </button>`;
            })
            .join('')}
        </div>
      </div>`;
    host.appendChild(this.el);
    this.el.querySelector<HTMLButtonElement>('.levels__back')!.addEventListener('click', h.onBack);
    this.el.querySelectorAll<HTMLButtonElement>('.levels__card').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.classList.contains('is-locked')) {
          b.classList.remove('is-nope');
          void b.offsetWidth;
          b.classList.add('is-nope');
          return;
        }
        h.onPick(Number(b.dataset.id));
      });
    });
    const first = this.el.querySelector<HTMLButtonElement>('.levels__card:not(.is-locked)');
    first?.focus({ preventScroll: true });
  }

  destroy(): void {
    this.el.remove();
  }
}
