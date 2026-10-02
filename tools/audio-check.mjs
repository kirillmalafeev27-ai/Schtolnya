// Отрисовать все пресеты офлайн и снять спектрограммы: node tools/audio-check.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text());
});
await page.goto('http://localhost:5173/audio.html');
await page.waitForFunction(() => !!window.audioResults, null, { timeout: 120000 });
const r = await page.evaluate(() => window.audioResults);
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(12), JSON.stringify(v));
await page.screenshot({ path: 'shots/audio.png', fullPage: true });
await browser.close();
