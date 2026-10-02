// Обучение при первом запуске (план, 11.5.7): подсказка в пузыре героя; пока она на экране, игра стоит.

import { ru } from '../i18n/ru';

export class TutorialBubble {
  readonly el: HTMLElement;
  private readonly onKey: (e: KeyboardEvent) => void;

  constructor(host: HTMLElement, text: string, at: { x: number; y: number }, onOk: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'bubble';
    this.el.setAttribute('role', 'alertdialog');
    this.el.setAttribute('aria-label', text);
    this.el.innerHTML = `<p class="bubble__text">${text}</p><button type="button" class="btn btn--primary bubble__ok">${ru.tutorial.ok}</button>`;
    host.appendChild(this.el);
    // Пузырь над героем, но целиком внутри панели; хвост смотрит на героя.
    const hb = host.getBoundingClientRect();
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const margin = 10;
    let left = at.x - w / 2;
    left = Math.max(margin, Math.min(hb.width - w - margin, left));
    let top = at.y - h - 22;
    let below = false;
    if (top < margin + 48) {
      top = at.y + 70;
      below = true;
    }
    top = Math.max(margin, Math.min(hb.height - h - margin, top));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.style.setProperty('--tail-x', `${Math.max(18, Math.min(w - 18, at.x - left))}px`);
    this.el.classList.toggle('bubble--below', below);
    const ok = this.el.querySelector<HTMLButtonElement>('.bubble__ok')!;
    ok.addEventListener('click', onOk);
    this.onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        onOk();
      }
    };
    window.addEventListener('keydown', this.onKey, true);
    ok.focus({ preventScroll: true });
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey, true);
    this.el.remove();
  }
}
