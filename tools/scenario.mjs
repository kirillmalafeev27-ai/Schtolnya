// Сценарии для снимков: node tools/scenario.mjs <name> [w h dpr]
import { chromium } from 'playwright-core';
const name = process.argv[2] || 'plant';
const w = +(process.argv[3] || 1280),
  h = +(process.argv[4] || 720),
  dpr = +(process.argv[5] || 1);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[error]', m.text());
});
await page.goto(`http://localhost:5173/?seed=${process.argv[6] || 5}&level=${process.argv[7] || 2}&test`);
await page.waitForFunction(() => !!window.mine?.app?.round, null, { timeout: 60000 });
await page.waitForTimeout(1500);
// Найти ближайшую к герою разрушимую клетку, к которой можно подойти, и заложить.
const plan = await page.evaluate(() => {
  const r = window.mine.app.round;
  const s = r.state;
  const g = s.grid;
  const W = g.w;
  const dist = new Int32Array(g.cells.length).fill(-1);
  const q = [s.hero.cell];
  dist[s.hero.cell] = 0;
  const nb = (i) => [i - W, i - 1, i + W, i + 1];
  while (q.length) {
    const c = q.shift();
    for (const n of nb(c))
      if (n >= 0 && n < g.cells.length && dist[n] < 0 && g.cells[n] === 0) {
        dist[n] = dist[c] + 1;
        q.push(n);
      }
  }
  let best = -1,
    bd = 1e9,
    stand = -1;
  for (let i = 0; i < g.cells.length; i++) {
    if (![1, 2, 4, 5].includes(g.cells[i])) continue;
    for (const n of nb(i))
      if (dist[n] >= 0 && dist[n] < bd) {
        bd = dist[n];
        best = i;
        stand = n;
      }
  }
  return { rock: best, stand, d: bd };
});
console.log('plan', JSON.stringify(plan));
async function answer(n = 1) {
  for (let k = 0; k < n; k++) await page.evaluate(() => window.mine.app.round.answer(true, 3000));
}
await page.evaluate((p) => window.mine.app.round.setIntent('plant', p.rock), plan);
if (name === 'preview') {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `shots/sc-${name}.png` });
} else {
  for (let k = 0; k < plan.d + 1; k++) await answer();
  await page.waitForTimeout(600);
  if (name === 'plant') {
    await page.screenshot({ path: `shots/sc-${name}.png` });
  } else {
    // Ускорить фитиль до конца и снять взрыв.
    await page.evaluate(() => window.mine.app.round.setIntent('stay'));
    await page.evaluate(() => {
      const r = window.mine.app.round;
      while (r.state.fuse) r.tick(0.1);
    });
    await page.waitForTimeout(+(process.argv[8] || 420));
    await page.screenshot({ path: `shots/sc-${name}.png` });
  }
}
console.log(
  await page.evaluate(
    () => `frames=${window.mine.app.game.loop.frame} status=${window.mine.app.round.state.status}`,
  ),
);
await browser.close();
