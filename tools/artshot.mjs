// Снимок страницы предпросмотра арта: node tools/artshot.mjs out.png "query" width
import { chromium } from 'playwright-core';
const out = process.argv[2] || 'shots/art.png';
const q = process.argv[3] || '';
const width = +(process.argv[4] || 1400);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width, height: 900 } });
const logs = [];
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') logs.push(m.text());
});
await page.goto(`http://localhost:5173/art.html?${q}`);
await page
  .waitForFunction(() => window.artReady === true, null, { timeout: 30000 })
  .catch(() => logs.push('timeout'));
console.log(await page.title());
await page.screenshot({ path: out, fullPage: true });
console.log(logs.join('\n'));
await browser.close();
