// Снимки меню и экранов: node tools/menu-shot.mjs <w> <h> [dpr] [what=menu|levels|settings|loading] [progressJson]
import { chromium } from 'playwright-core';
const [w, h, dpr] = [1280, 720, 1].map((d, i) => +(process.argv[2 + i] ?? d));
const what = process.argv[5] ?? 'menu';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('[error]', m.text()));
if (process.argv[6])
  await page.addInitScript((v) => localStorage.setItem('mine:progress', v), process.argv[6]);
await page.goto(`http://localhost:5173/?test`);
if (what === 'loading') {
  // Загрузка проходит быстро — рисуем экран заново поверх меню.
  await page.waitForSelector('.menu', { timeout: 60000 });
  await page.evaluate(async () => {
    const m = await import('/src/ui/screens/LoadingScreen.ts');
    new m.LoadingScreen(document.querySelector('.mine__screens')).progress(0.62);
  });
  await page.waitForTimeout(400);
} else {
  await page.waitForSelector('.menu', { timeout: 60000 });
  await page.waitForTimeout(1500);
  if (what === 'levels') {
    await page.click('.menu__play');
    await page.waitForSelector('.levels');
    await page.waitForTimeout(900);
  }
  if (what === 'settings') {
    await page.click('.menu__settings');
    await page.waitForSelector('.settings');
    await page.waitForTimeout(500);
  }
}
await page.screenshot({ path: `shots/${what}-${w}x${h}.png` });
await browser.close();
