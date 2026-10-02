// Проверка «всё доступно с клавиатуры» (11.6.3): меню → интро → обучение → ходы → ответ → пауза.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/?test&seed=99');
await page.waitForSelector('.menu__play', { timeout: 60000 });
await page.waitForTimeout(300);
const out = [];
const focused = () => page.evaluate(() => document.activeElement?.className ?? '');
out.push(`menu focus: ${await focused()}`);
await page.keyboard.press('Enter');
await page.waitForSelector('.intro', { timeout: 30000 });
out.push('intro shown');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(200);
out.push(`after skip: intro=${await page.locator('.intro').count()} intent=${await intent()}`);
await page.waitForSelector('.bubble', { timeout: 10000 });
out.push(`bubble focus: ${await focused()}`);
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
out.push(`bubble closed: ${(await page.locator('.bubble').count()) === 0}`);
async function intent() {
  return page.evaluate(() => JSON.stringify(window.mine.app.round?.state.hero.intent ?? null));
}
for (const k of ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'h']) {
  await page.keyboard.press(k);
  await page.waitForTimeout(100);
  out.push(k + ' -> ' + (await intent()));
}
// Ответ клавишей 1..4.
const total = () =>
  page.evaluate(() => window.mine.app.round.state.stats.correct + window.mine.app.round.state.stats.wrong);
const before = await total();
await page.waitForTimeout(300);
const c = await page.evaluate(() => Number(document.querySelector('.quiz').dataset.testCorrect));
await page.keyboard.press(String(c + 1));
await page.waitForTimeout(200);
out.push(`answered by key: ${before} -> ${await total()}`);
// Пауза и возврат.
await page.keyboard.press('p');
await page.waitForTimeout(200);
out.push(
  `paused: ${await page.evaluate(() => window.mine.app.round.state.paused)} focus: ${await focused()}`,
);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
out.push(`resumed: ${!(await page.evaluate(() => window.mine.app.round.state.paused))}`);
console.log(out.join('\n'));
console.log('errors:', errs);
await browser.close();
