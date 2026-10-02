// Плашка интро (план, 11.5.3): «Жила — здесь. Кобольд спит — пока» с выносками к жиле и логову.

import { ru } from '../i18n/ru';

export interface IntroTarget {
  x: number;
  y: number;
  label: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export class IntroOverlay {
  readonly el: HTMLElement;

  constructor(
    host: HTMLElement,
    targets: IntroTarget[],
    cellPx: number,
    avoid: { x: number; y: number }[] = [],
  ) {
    this.el = document.createElement('div');
    this.el.className = 'intro';
    this.el.setAttribute('role', 'status');
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('intro__lines');
    this.el.appendChild(svg);
    const plate = document.createElement('div');
    plate.className = 'intro__plate';
    plate.textContent = ru.intro.plate;
    this.el.appendChild(plate);
    host.appendChild(this.el);
    // Плашка встаёт по высоте подальше от целей, чтобы их не закрыть.
    const hb = host.getBoundingClientRect();
    let best = 0.5;
    let bestD = -1;
    for (const f of [0.32, 0.5, 0.68]) {
      const y = hb.height * f;
      const d = Math.min(...[...targets, ...avoid].map((t) => Math.abs(t.y - y)), Infinity);
      if (d > bestD) {
        bestD = d;
        best = f;
      }
    }
    plate.style.top = `${best * 100}%`;

    // Выноски: от плашки к целям, на конце — кольцо и подпись.
    const hostBox = host.getBoundingClientRect();
    const pb = plate.getBoundingClientRect();
    const px = pb.left - hostBox.left + pb.width / 2;
    const py = pb.top - hostBox.top + pb.height / 2;
    svg.setAttribute('width', String(hostBox.width));
    svg.setAttribute('height', String(hostBox.height));
    const r = Math.max(14, cellPx * 0.62);
    targets.forEach((t, i) => {
      const ang = Math.atan2(py - t.y, px - t.x);
      const ex = t.x + Math.cos(ang) * r;
      const ey = t.y + Math.sin(ang) * r;
      // Плавная дуга: контрольная точка смещена вбок.
      const mx = (px + ex) / 2 + (i % 2 ? 1 : -1) * 24;
      const my = (py + ey) / 2;
      const d = `M ${px} ${py} Q ${mx} ${my} ${ex} ${ey}`;
      for (const cls of ['intro__line-under', 'intro__line']) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', cls);
        svg.appendChild(path);
      }
      for (const cls of ['intro__ring-under', 'intro__ring']) {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', String(t.x));
        c.setAttribute('cy', String(t.y));
        c.setAttribute('r', String(r));
        c.setAttribute('class', cls);
        svg.appendChild(c);
      }
      const tag = document.createElement('div');
      tag.className = 'intro__tag';
      tag.textContent = t.label;
      tag.style.left = `${t.x}px`;
      tag.style.top = `${t.y + r + 4}px`;
      this.el.appendChild(tag);
    });
    // Плашка поверх линий.
    this.el.appendChild(plate);
    requestAnimationFrame(() => this.el.classList.add('is-on'));
  }

  destroy(): void {
    this.el.remove();
  }
}
