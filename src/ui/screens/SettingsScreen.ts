// Настройки (план, 11.5.6): громкость, «меньше движения», качество графики, подсказки, язык слов-звуков.

import type { Settings } from '../../app/storage';
import type { HintLevel } from '../../config/levels';
import { ru } from '../../i18n/ru';
import type { QuizSettings, QuizStatus } from '../../shared/questions/QuizBankProvider';

/** Тема заданий — уровень и грамматика, как в меню обучения See Escape. */
export interface LearningControls {
  settings: QuizSettings;
  levels: readonly string[];
  grammarTopics: readonly string[];
  status: QuizStatus;
  onChange: (patch: Partial<QuizSettings>) => void;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export class SettingsScreen {
  readonly el: HTMLElement;

  constructor(
    host: HTMLElement,
    initial: Settings,
    h: { onChange: (patch: Partial<Settings>) => void; onClose: () => void },
    learning?: LearningControls,
  ) {
    const S = ru.settingsScreen;
    const st = { ...initial };
    this.el = document.createElement('div');
    this.el.className = 'settings';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', S.title);
    const seg = (name: string, value: string, opts: [string, string][]) =>
      `<div class="seg" role="radiogroup" data-name="${name}">${opts
        .map(
          ([v, label]) =>
            `<button type="button" role="radio" class="seg__opt" data-v="${v}" aria-checked="${v === value}">${label}</button>`,
        )
        .join('')}</div>`;
    const pct = (v: number) => Math.round(v * 100);
    this.el.innerHTML = `
      <div class="settings__panel">
        <h2 class="settings__title">${S.title}</h2>
        <div class="settings__row">
          <span class="settings__label">${S.sound}</span>
          ${seg('soundOn', String(st.soundOn), [
            ['true', S.on],
            ['false', S.off],
          ])}
        </div>
        <label class="settings__row">
          <span class="settings__label">${S.sfxVolume}</span>
          <input class="slider" type="range" min="0" max="100" step="5" data-name="sfxVolume" value="${pct(st.sfxVolume)}">
        </label>
        <label class="settings__row">
          <span class="settings__label">${S.ambientVolume}</span>
          <input class="slider" type="range" min="0" max="100" step="5" data-name="ambientVolume" value="${pct(st.ambientVolume)}">
        </label>
        <div class="settings__row">
          <span class="settings__label">${S.reducedMotion}</span>
          ${seg('reducedMotion', String(!!st.reducedMotion), [
            ['true', S.on],
            ['false', S.off],
          ])}
        </div>
        <div class="settings__row">
          <span class="settings__label">${S.quality}</span>
          ${seg('quality', st.quality, [
            ['high', S.qualityHigh],
            ['low', S.qualityLow],
          ])}
        </div>
        <p class="settings__note" data-note="quality" hidden>${S.qualityNextRound}</p>
        ${st.autoLowered ? `<p class="settings__note">${S.autoLowQuality}</p>` : ''}
        <div class="settings__row settings__row--col">
          <span class="settings__label">${S.hints}</span>
          ${seg('hints', st.hints, [
            ['all', S.hintsAll],
            ['noShelter', S.hintsNoShelter],
            ['burningOnly', S.hintsBurning],
          ])}
        </div>
        <div class="settings__row">
          <span class="settings__label">${S.sfxLang}</span>
          ${seg('sfxLang', st.sfxLang, [
            ['de', S.sfxLangDe],
            ['ru', S.sfxLangRu],
          ])}
        </div>
        ${learning ? this.learningHtml(learning, seg) : ''}
        <button type="button" class="btn btn--primary settings__done">${S.done}</button>
      </div>`;
    host.appendChild(this.el);

    this.el.querySelectorAll<HTMLElement>('.seg').forEach((g) => {
      const name = g.dataset.name as keyof Settings | 'level';
      g.querySelectorAll<HTMLButtonElement>('.seg__opt').forEach((b) => {
        b.addEventListener('click', () => {
          g.querySelectorAll('.seg__opt').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
          const raw = b.dataset.v!;
          if (name === 'level') {
            learning?.onChange({ level: raw as QuizSettings['level'] });
            return;
          }
          let patch: Partial<Settings>;
          if (name === 'soundOn') patch = { soundOn: raw === 'true' };
          else if (name === 'reducedMotion') patch = { reducedMotion: raw === 'true' };
          else if (name === 'quality') {
            patch = { quality: raw as 'high' | 'low', autoLowered: false };
            this.el.querySelector<HTMLElement>('[data-note="quality"]')!.hidden = false;
          } else if (name === 'hints') patch = { hints: raw as HintLevel };
          else patch = { sfxLang: raw as 'de' | 'ru' };
          h.onChange(patch);
        });
      });
    });
    this.el.querySelectorAll<HTMLInputElement>('.slider').forEach((inp) => {
      inp.addEventListener('input', () => {
        const v = Number(inp.value) / 100;
        h.onChange(inp.dataset.name === 'sfxVolume' ? { sfxVolume: v } : { ambientVolume: v });
      });
    });
    this.el
      .querySelector<HTMLSelectElement>('.settings__select[data-name="grammarTopic"]')
      ?.addEventListener('change', (e) => {
        learning?.onChange({ grammarTopic: (e.target as HTMLSelectElement).value });
      });
    this.el.querySelector<HTMLButtonElement>('.settings__done')!.addEventListener('click', h.onClose);
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        h.onClose();
      }
    });
    this.el
      .querySelector<HTMLButtonElement>('.seg__opt[aria-checked="true"]')
      ?.focus({ preventScroll: true });
  }

  private learningHtml(
    l: LearningControls,
    seg: (name: string, value: string, opts: [string, string][]) => string,
  ) {
    const S = ru.settingsScreen;
    return `
        <h3 class="settings__section">${S.learning}</h3>
        <div class="settings__row">
          <span class="settings__label">${S.level}</span>
          ${seg(
            'level',
            l.settings.level,
            l.levels.map((v) => [v, v]),
          )}
        </div>
        <label class="settings__row settings__row--col">
          <span class="settings__label">${S.grammarTopic}</span>
          <select class="settings__select" data-name="grammarTopic" lang="de">
            ${l.grammarTopics
              .map(
                (t) =>
                  `<option value="${esc(t)}"${t === l.settings.grammarTopic ? ' selected' : ''}>${esc(t)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <p class="settings__note" data-note="learning" role="status">${S.status[l.status]}</p>`;
  }

  /** Состояние генерации вопросов меняется, пока экран открыт. */
  setLearningStatus(status: QuizStatus): void {
    const note = this.el.querySelector<HTMLElement>('[data-note="learning"]');
    if (note) note.textContent = ru.settingsScreen.status[status];
  }

  destroy(): void {
    this.el.remove();
  }
}
