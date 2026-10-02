import Phaser from 'phaser';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/900.css';
import '@fontsource/bangers/400.css';
import './ui/styles.css';
import { balance } from './config/balance';
import { applyPageLayout, computePageLayout } from './shared/layout';
import { applyTheme } from './ui/theme';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

export function mountMine(container: HTMLElement): { destroy(): void } {
  const root = document.createElement('div');
  root.className = 'mine';
  applyTheme(root);
  root.innerHTML = `
    <div class="mine__page">
      <section class="mine__panel mine__world" aria-label="Шахта"><div class="mine__canvas-host"></div></section>
      <section class="mine__panel mine__quiz"></section>
    </div>`;
  container.appendChild(root);
  const host = root.querySelector<HTMLElement>('.mine__canvas-host')!;
  const relayout = () => {
    const r = container.getBoundingClientRect();
    applyPageLayout(root, computePageLayout(r.width, r.height, balance.layout));
  };
  relayout();
  const dpr = Math.min(window.devicePixelRatio || 1, balance.art.maxDpr);
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: host,
    backgroundColor: '#0f1626',
    scale: { mode: Phaser.Scale.NONE, width: host.clientWidth * dpr, height: host.clientHeight * dpr, zoom: 1 / dpr },
    scene: [BootScene, GameScene],
  });
  const ro = new ResizeObserver(() => {
    relayout();
    game.scale.resize(host.clientWidth * dpr, host.clientHeight * dpr);
  });
  ro.observe(container);
  return {
    destroy() {
      ro.disconnect();
      game.destroy(true);
      root.remove();
    },
  };
}
