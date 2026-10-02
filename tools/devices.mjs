// Снимки раунда на устройствах из чек-листа (16): node tools/devices.mjs [level] [seed]
import { chromium } from 'playwright-core';
const level = process.argv[2] ?? '2';
const seed = process.argv[3] ?? '5';
const sizes = [
  [360, 640],
  [390, 844],
  [768, 1024],
  [1280, 720],
  [1920, 1080],
];
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      'mine:progress',
      JSON.stringify({ tutorial: { start: true, planted: true, koboldAwake: true } }),
    ),
  );
  await page.goto(`http://localhost:5173/?test&level=${level}&seed=${seed}`);
  await page.waitForSelector('.intro', { timeout: 60000 });
  await page.keyboard.press('ArrowDown'); // пропустить интро
  await page.waitForTimeout(600);
  // Показать превью закладки у ближайшей породы, чтобы на снимке были подсказки.
  await page.evaluate(() => {
    const r = window.mine.app.round;
    const s = r.state;
    const g = s.grid;
    const W = g.w;
    const dist = new Int32Array(g.cells.length).fill(-1);
    const q = [s.hero.cell];
    dist[s.hero.cell] = 0;
    while (q.length) {
      const c = q.shift();
      for (const n of [c - W, c - 1, c + W, c + 1])
        if (n >= 0 && n < g.cells.length && dist[n] < 0 && g.cells[n] === 0) {
          dist[n] = dist[c] + 1;
          q.push(n);
        }
    }
    let best = -1;
    let bd = 1e9;
    for (let i = 0; i < g.cells.length; i++) {
      if (![1, 2].includes(g.cells[i])) continue;
      for (const n of [i - W, i - 1, i + W, i + 1]) {
        if (dist[n] >= 0 && dist[n] < bd) {
          bd = dist[n];
          best = i;
        }
      }
    }
    if (best >= 0) r.setIntent('plant', best);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/device-${w}x${h}.png` });
  console.log(`${w}x${h}`, errs.length ? errs : 'ok');
  await page.close();
}
await browser.close();
