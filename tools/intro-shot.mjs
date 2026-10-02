// Снимок интро раунда: node tools/intro-shot.mjs [w h dpr waitMs level seed]
import { chromium } from 'playwright-core';
const [w, h, dpr, wait, level, seed] = [1280, 720, 1, 900, 1, 5].map((d, i) => +(process.argv[2 + i] ?? d));
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('[error]', m.text()));
await page.goto(`http://localhost:5173/?seed=${seed}&level=${level}&test`);
await page.waitForSelector('.intro', { timeout: 60000 });
await page.waitForTimeout(wait);
await page.screenshot({ path: `shots/intro-${w}x${h}.png` });
await browser.close();
