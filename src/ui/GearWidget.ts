// Плашка снаряжения (план, 11.3): лежит на верхней стене в левом углу панели мира и заходит на рамку.

import { ru } from '../i18n/ru';
import { iconLift, iconNugget, iconPalm, iconStick } from './icons';

export class GearWidget {
  readonly el: HTMLElement;
  private readonly sticksN: HTMLElement;
  private readonly sticksIcon: HTMLElement;
  private readonly vein: HTMLElement;
  private readonly score: HTMLElement;
  readonly homeBtn: HTMLButtonElement;
  readonly stayBtn: HTMLButtonElement;
  private lastSticks = -1;
  private lastVein: boolean | null = null;
  private lastScore = -1;

  constructor(host: HTMLElement, handlers: { onHome: () => void; onStay: () => void }) {
    this.el = document.createElement('div');
    this.el.className = 'gear';
    this.el.innerHTML = `
      <div class="gear__slot gear__sticks" title="${ru.gear.sticks}">
        <span class="gear__icon">${iconStick}</span><span class="gear__x">×</span><span class="gear__n" aria-live="polite">0</span>
      </div>
      <div class="gear__slot gear__vein" title="${ru.gear.vein}" role="img" aria-label="${ru.gear.vein}">${iconNugget(false)}</div>
      <div class="gear__slot gear__score" title="${ru.gear.score}"><span class="gear__score-n">0</span></div>
      <button type="button" class="gear__btn gear__home" aria-label="${ru.gear.home}">${iconLift}<span>${ru.gear.home}</span><kbd>H</kbd></button>
      <button type="button" class="gear__btn gear__stay" aria-label="${ru.gear.stay}">${iconPalm}<span>${ru.gear.stay}</span><kbd>␣</kbd></button>`;
    host.appendChild(this.el);
    this.sticksN = this.el.querySelector('.gear__n')!;
    this.sticksIcon = this.el.querySelector('.gear__sticks .gear__icon')!;
    this.vein = this.el.querySelector('.gear__vein')!;
    this.score = this.el.querySelector('.gear__score-n')!;
    this.homeBtn = this.el.querySelector('.gear__home')!;
    this.stayBtn = this.el.querySelector('.gear__stay')!;
    this.homeBtn.addEventListener('click', handlers.onHome);
    this.stayBtn.addEventListener('click', handlers.onStay);
  }

  update(sticks: number, hasVein: boolean, score: number, stayActive: boolean): void {
    if (sticks !== this.lastSticks) {
      const up = this.lastSticks >= 0 && sticks > this.lastSticks;
      this.lastSticks = sticks;
      this.sticksN.textContent = String(sticks);
      this.el.classList.toggle('gear--empty', sticks === 0);
      bump(up ? this.sticksIcon : this.sticksN);
    }
    if (hasVein !== this.lastVein) {
      this.lastVein = hasVein;
      this.vein.innerHTML = iconNugget(hasVein);
      this.vein.classList.toggle('is-full', hasVein);
      if (hasVein) bump(this.vein);
    }
    if (score !== this.lastScore) {
      this.lastScore = score;
      this.score.textContent = String(score);
      bump(this.score);
    }
    this.stayBtn.classList.toggle('is-on', stayActive);
    this.homeBtn.classList.toggle('is-armed', hasVein);
  }

  /** Куда прилетают подобранные предметы (CSS-координаты относительно панели мира). */
  slotCenter(kind: 'stick' | 'vein' | 'nugget', panel: HTMLElement): { x: number; y: number } {
    const target = kind === 'stick' ? this.sticksIcon : kind === 'vein' ? this.vein : this.score;
    const r = target.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    return { x: r.left + r.width / 2 - p.left, y: r.top + r.height / 2 - p.top };
  }

  setDisabled(disabled: boolean): void {
    this.homeBtn.disabled = disabled;
    this.stayBtn.disabled = disabled;
  }
}

function bump(el: HTMLElement): void {
  el.classList.remove('is-bump');
  void el.offsetWidth;
  el.classList.add('is-bump');
}
