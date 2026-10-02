import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:5173/?test&level=1&seed=99');
await page.waitForFunction(() => !!window.mine?.app.round, null, { timeout: 30000 });
await page.waitForTimeout(500);
const intent = () => page.evaluate(() => JSON.stringify(window.mine.app.round.state.hero.intent));
const out = [];
for (const k of ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'h']) { await page.keyboard.press(k); await page.waitForTimeout(100); out.push(k + ' -> ' + await intent()); }
// ответ клавишей 1..4
const before = await page.evaluate(() => window.mine.app.round.state.stats.correct + window.mine.app.round.state.stats.wrong);
await page.waitForTimeout(300);
const c = await page.evaluate(() => Number(document.querySelector('.quiz').dataset.testCorrect));
await page.keyboard.press(String(c + 1));
await page.waitForTimeout(200);
const after = await page.evaluate(() => window.mine.app.round.state.stats.correct + window.mine.app.round.state.stats.wrong);
out.push(`answered by key: ${before} -> ${after}`);
// пауза по P и по скрытию вкладки
await page.keyboard.press('p'); await page.waitForTimeout(100);
out.push('paused after P: ' + await page.evaluate(() => window.mine.app.round.state.paused));
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
out.push('paused after Esc: ' + await page.evaluate(() => window.mine.app.round.state.paused));
await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(100);
out.push('paused after hide: ' + await page.evaluate(() => window.mine.app.round.state.paused));
console.log(out.join('\n')); console.log('errors', errs);
await browser.close();
