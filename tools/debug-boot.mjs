import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.slice(0, 500)));
await page.goto(process.argv[2] || 'http://localhost:5173/?seed=5&level=2');
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => {
    const m = window.mine;
    if (!m) return 'no mine';
    const g = m.app.game;
    return JSON.stringify({
      key: globalThis.__artKey,
      round: !!m.app.round,
      report: m.app.genReport,
      scenes: g
        ? g.scene.getScenes(false).map((s) => s.sys.settings.key + ':' + s.sys.settings.status)
        : null,
    });
  });
  console.log(i, st);
}
await browser.close();
