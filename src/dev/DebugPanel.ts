// Отладочная панель (план, 13.7; только dev-сборка, клавиша `): FPS, сид, темп, kMin, пороги звёзд,
// число источников света; наложения и кнопки-читы.

import { ru } from '../i18n/ru';
import type { MineApp } from '../app/MineApp';

export class DebugPanel {
  readonly el: HTMLElement;
  private timer = 0;
  private readonly draw = { grid: false, koboldPath: false, crosses: false };
  private immortal = false;

  constructor(
    host: HTMLElement,
    private readonly app: MineApp,
  ) {
    const D = ru.debug;
    this.el = document.createElement('div');
    this.el.className = 'debug';
    this.el.innerHTML = `
      <b>${D.title}</b>
      <pre class="debug__info"></pre>
      <label><input type="checkbox" data-k="grid"> ${D.grid}</label>
      <label><input type="checkbox" data-k="koboldPath"> ${D.koboldPath}</label>
      <label><input type="checkbox" data-k="crosses"> ${D.crosses}</label>
      <label><input type="checkbox" data-k="immortal"> ${D.immortal}</label>
      <button type="button" data-a="sleep">${D.sleep}</button>
      <button type="button" data-a="wake">${D.wake}</button>
      <button type="button" data-a="sticks">${D.sticks}</button>`;
    host.appendChild(this.el);
    this.el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const k = inp.dataset.k!;
        if (k === 'immortal') {
          this.immortal = inp.checked;
          app.round?.setImmortal(inp.checked);
        } else {
          this.draw[k as keyof typeof this.draw] = inp.checked;
          this.redraw();
        }
      });
    });
    this.el.querySelectorAll<HTMLButtonElement>('button[data-a]').forEach((b) => {
      b.addEventListener('click', () => {
        const r = app.round;
        if (!r) return;
        if (b.dataset.a === 'sleep') r.debugKobolds('sleep');
        if (b.dataset.a === 'wake') r.debugKobolds('awake');
        if (b.dataset.a === 'sticks') r.debugAddSticks(5);
        this.redraw();
      });
    });
    this.timer = window.setInterval(() => this.refresh(), 250);
    this.refresh();
  }

  private redraw(): void {
    this.app.gameScene?.debugDraw(this.draw);
  }

  private refresh(): void {
    const r = this.app.round;
    const s = r?.state;
    const game = this.app.gameScene?.game;
    const lines = [
      `FPS ${game ? game.loop.actualFps.toFixed(0) : '—'}`,
      `seed ${r?.gen.seed ?? '—'}  level ${r?.level.id ?? '—'}`,
      s ? `T_med ${s.params.tMed.toFixed(2)} s  p ${s.params.p.toFixed(2)}` : '',
      s ? `kMin ${s.kMin}  S2 ${s.s2}  S3 ${s.s3}` : '',
      `lights ${this.app.gameScene?.lightCount ?? 0}`,
      s?.fuse ? `fuse ${s.fuse.remaining.toFixed(1)} / ${s.fuse.total.toFixed(1)} s` : '',
    ];
    this.el.querySelector('.debug__info')!.textContent = lines.filter(Boolean).join('\n');
    if (this.draw.koboldPath && s?.kobolds.some((k) => k.mode === 'awake')) this.redraw();
    if (r && this.immortal) r.setImmortal(true);
  }

  destroy(): void {
    clearInterval(this.timer);
    this.app.gameScene?.debugDraw({ grid: false, koboldPath: false, crosses: false });
    this.el.remove();
  }
}
