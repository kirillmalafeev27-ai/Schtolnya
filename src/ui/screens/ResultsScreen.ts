// Итоги раунда (план, 11.5.5): три панели появляются по очереди — снимок кадра, разбор счёта,
// звёзды и статистика. Кнопки «Ещё раз» и «Дальше» доступны сразу.

import { balance } from '../../config/balance';
import { ru } from '../../i18n/ru';
import { median } from '../../shared/pace';
import { iconNugget, iconStar, iconStick } from '../icons';

export interface ResultsData {
  level: number;
  won: boolean;
  cause: 'kobold' | 'blast' | null;
  vein: boolean;
  nuggets: number;
  sticks: number;
  score: number;
  stars: 0 | 1 | 2 | 3;
  blasts: number;
  stuns: number;
  correct: number;
  wrong: number;
  answerTimesMs: number[];
  best: number;
  record: boolean;
  hasNext: boolean;
  snapshot: HTMLImageElement | HTMLCanvasElement | null;
}

export class ResultsScreen {
  readonly el: HTMLElement;
  private timers: number[] = [];

  constructor(
    host: HTMLElement,
    d: ResultsData,
    handlers: {
      onRetry: () => void;
      onNext: () => void;
      onMenu: () => void;
      onTally?: (step: number) => void;
    },
  ) {
    const R = ru.results;
    const S = balance.score;
    const lines: { icon: string; label: string; value: number }[] = [];
    if (d.won) {
      lines.push({ icon: iconNugget(true), label: R.vein, value: S.vein });
      if (d.nuggets)
        lines.push({ icon: iconNugget(true), label: R.nuggets(d.nuggets), value: d.nuggets * S.nugget });
      if (d.sticks) lines.push({ icon: iconStick, label: R.sticks(d.sticks), value: d.sticks * S.stick });
    }
    const med = d.answerTimesMs.length ? median(d.answerTimesMs) / 1000 : 0;
    this.el = document.createElement('div');
    this.el.className = `results ${d.won ? 'results--won' : 'results--lost'}`;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', d.won ? R.won : R.lost);
    this.el.innerHTML = `
      <div class="results__page">
        <section class="results__panel results__shot">
          <div class="results__shot-img"></div>
          <div class="results__title sfx">${d.won ? R.won : R.lost}</div>
        </section>
        <section class="results__panel results__score">
          <ul class="results__lines">
            ${lines
              .map(
                (l, i) =>
                  `<li class="results__line" style="--i:${i}"><span class="results__line-icon">${l.icon}</span><span class="results__line-label">${l.label}</span><b>+${l.value}</b></li>`,
              )
              .join('')}
            ${!d.won ? `<li class="results__line results__line--cause">${R.cause}: ${d.cause === 'blast' ? R.causeBlast : R.causeKobold}</li>` : ''}
          </ul>
          <div class="results__total"><span>${R.total}</span><b class="results__total-n">0</b></div>
        </section>
        <section class="results__panel results__stats">
          <div class="results__stars">${[1, 2, 3].map((k) => `<span class="results__star" style="--k:${k}">${iconStar(d.stars >= k)}</span>`).join('')}</div>
          <dl class="results__dl">
            <dt>${R.blasts}</dt><dd>${d.blasts}</dd>
            <dt>${R.stuns}</dt><dd>${d.stuns}</dd>
            <dt>${R.correct}</dt><dd>${d.correct}</dd>
            <dt>${R.wrong}</dt><dd>${d.wrong}</dd>
            <dt>${R.medianAnswer}</dt><dd>${med ? R.seconds(med) : '—'}</dd>
            <dt>${R.best}</dt><dd>${d.best}${d.record ? ' ★' : ''}</dd>
          </dl>
          <div class="results__buttons">
            <button type="button" class="btn btn--primary results__retry">${R.retry}</button>
            ${d.hasNext && d.won ? `<button type="button" class="btn results__next">${R.next}</button>` : ''}
            <button type="button" class="btn btn--ghost results__menu">${R.menu}</button>
          </div>
        </section>
      </div>`;
    host.appendChild(this.el);
    const shot = this.el.querySelector<HTMLElement>('.results__shot-img')!;
    if (d.snapshot) {
      d.snapshot.classList.add('results__img');
      shot.appendChild(d.snapshot);
    }
    this.el.querySelector<HTMLButtonElement>('.results__retry')!.addEventListener('click', handlers.onRetry);
    this.el.querySelector<HTMLButtonElement>('.results__next')?.addEventListener('click', handlers.onNext);
    this.el.querySelector<HTMLButtonElement>('.results__menu')!.addEventListener('click', handlers.onMenu);
    this.el.querySelector<HTMLButtonElement>('.results__retry')!.focus({ preventScroll: true });

    // Подсчёт: самородки и шашки по одному летят в счёт («дзынь» с растущей высотой).
    const totalEl = this.el.querySelector<HTMLElement>('.results__total-n')!;
    let acc = 0;
    const step = balance.anim.tallyStepMs;
    const base = balance.anim.resultPanelDelayMs;
    lines.forEach((l, i) => {
      this.later(
        () => {
          acc += l.value;
          totalEl.textContent = String(acc);
          totalEl.classList.remove('is-bump');
          void totalEl.offsetWidth;
          totalEl.classList.add('is-bump');
          handlers.onTally?.(i);
        },
        base + step * (i + 1),
      );
    });
    if (!lines.length) totalEl.textContent = String(d.score);
    this.later(() => this.el.classList.add('is-done'), base + step * (lines.length + 1));
    // Тап пропускает анимацию.
    this.el.addEventListener('pointerdown', () => {
      this.el.classList.add('is-skip');
      totalEl.textContent = String(d.score);
    });
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  destroy(): void {
    for (const t of this.timers) clearTimeout(t);
    this.el.remove();
  }
}
