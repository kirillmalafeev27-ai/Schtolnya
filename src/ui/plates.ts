// DOM-плашки над миром: «Нет укрытия», «Путь закрыт», «Сначала жила».

import { ru } from '../i18n/ru';

export type PlateKind = 'noShelter' | 'pathClosed' | 'veinFirst';

const TEXT: Record<PlateKind, string> = {
  noShelter: ru.plates.noShelter,
  pathClosed: ru.plates.pathClosed,
  veinFirst: ru.plates.veinFirst,
};

export class WorldPlates {
  private readonly els = new Map<PlateKind, HTMLElement>();
  private readonly timers = new Map<PlateKind, number>();

  constructor(
    private readonly host: HTMLElement,
    private readonly locate: (cell: number) => { x: number; y: number; cell: number },
  ) {}

  show(kind: PlateKind, cell: number, visible: boolean): void {
    let el = this.els.get(kind);
    if (!visible) {
      if (el) el.classList.remove('is-on');
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.className = `plate plate--${kind}`;
      el.setAttribute('role', 'status');
      el.textContent = TEXT[kind];
      this.host.appendChild(el);
      this.els.set(kind, el);
    }
    const p = this.locate(cell);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y - p.cell * 0.55}px`;
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
    const old = this.timers.get(kind);
    if (old) clearTimeout(old);
    if (kind !== 'noShelter') {
      this.timers.set(
        kind,
        window.setTimeout(() => el!.classList.remove('is-on'), 1500),
      );
    }
  }

  hideAll(): void {
    for (const el of this.els.values()) el.classList.remove('is-on');
  }
}
