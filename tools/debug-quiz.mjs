import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: +(process.argv[2] || 390), height: +(process.argv[3] || 844) },
  deviceScaleFactor: 2,
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173/?seed=5&level=2');
await page.waitForTimeout(5000);
console.log(
  await page.evaluate(() => {
    const q = document.querySelector('.quiz');
    const s = window.mine.app.round?.state;
    return JSON.stringify({
      fps: window.mine.app.game.loop.actualFps,
      frame: window.mine.app.game.loop.frame,
      mode: q.dataset.mode,
      cls: q.className,
      paused: s?.paused,
      status: s?.status,
      pauseEl: !!document.querySelector('.pause'),
      stageFilter: getComputedStyle(document.querySelector('.quiz__stage')).filter,
      cards: document.querySelectorAll('.quiz__card').length,
      cardCls: [...document.querySelectorAll('.quiz__card')].map(
        (c) => c.className + ' ' + getComputedStyle(c).filter + ' ' + getComputedStyle(c).opacity,
      ),
    });
  }),
);
await browser.close();
