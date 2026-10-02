// Профиль CPU страницы: node tools/profile.mjs url seconds
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:5173/?seed=5&level=2';
const secs = +(process.argv[3] || 6);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
await page.goto(url);
await page.waitForFunction(() => !!window.mine?.app?.round, null, { timeout: 60000 });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
await cdp.send('Profiler.start');
await page.waitForTimeout(secs * 1000);
const { profile } = await cdp.send('Profiler.stop');
const self = new Map();
const dt = {};
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i];
  dt[id] = (dt[id] || 0) + (profile.timeDeltas[i] || 0);
}
for (const n of profile.nodes) {
  const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber}`;
  self.set(key, (self.get(key) || 0) + (dt[n.id] || 0));
}
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [k, v] of top) console.log((v / 1000).toFixed(0).padStart(7) + ' ms  ' + k);
console.log('frames', await page.evaluate(() => window.mine.app.game.loop.frame));
await browser.close();
