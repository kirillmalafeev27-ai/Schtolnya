// Сквозной тест «пройти раунд» (план, 13.1.5): Playwright играет настоящим вводом —
// тапает по миру, жмёт клавиши и кнопки ответов. Решения принимает бот из симуляции.
// Запуск: npx tsx tools/e2e.ts [url] [level] [seed] [width] [height]

import { chromium, type Page } from 'playwright-core';
import type { GameState } from '../src/core/state';
import { decide, newMemory } from './bots';

const url = process.argv[2] ?? 'http://localhost:5173/';
const level = process.argv[3] ?? '1';
const seed = process.argv[4] ?? '12345';
const width = +(process.argv[5] ?? 390);
const height = +(process.argv[6] ?? 844);
const mode = process.argv[7] ?? 'mouse';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

async function readState(page: Page): Promise<GameState | null> {
  const raw = await page.evaluate(() => {
    const w = window as unknown as { mine?: { app: { round: { state: unknown } | null } } };
    const s = w.mine?.app.round?.state as Record<string, unknown> | undefined;
    if (!s) return null;
    const g = s.grid as { w: number; h: number; cells: Uint8Array; cracked: Uint8Array };
    return JSON.stringify({ ...s, grid: { w: g.w, h: g.h, cells: Array.from(g.cells), cracked: Array.from(g.cracked) } });
  });
  if (!raw) return null;
  const s = JSON.parse(raw);
  s.grid.cells = Uint8Array.from(s.grid.cells);
  s.grid.cracked = Uint8Array.from(s.grid.cracked);
  return s as GameState;
}

async function cellPoint(page: Page, cell: number): Promise<{ x: number; y: number }> {
  return page.evaluate((c) => {
    const w = window as unknown as {
      mine: { app: { gameScene: { cellToCss(c: number): { x: number; y: number } }; worldElement: HTMLElement } };
    };
    const p = w.mine.app.gameScene.cellToCss(c);
    const host = w.mine.app.worldElement.querySelector('.mine__canvas-host')!.getBoundingClientRect();
    return { x: host.left + p.x, y: host.top + p.y };
  }, cell);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: mode === 'touch' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
  });
  await page.goto(`${url}?test&level=${level}&seed=${seed}`);
  await page.waitForFunction(() => !!(window as unknown as { mine?: { app: { round: unknown } } }).mine?.app.round, null, { timeout: 30000 });
  const mem = newMemory();
  let answers = 0;
  let actions = 0;
  const t0 = Date.now();
  let last: GameState | null = null;
  while (Date.now() - t0 < 6 * 60 * 1000) {
    const s = await readState(page);
    if (!s) break;
    last = s;
    if (s.status !== 'playing') break;
    if (s.paused) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      continue;
    }
    const d = decide('lure', s, mem);
    if (d) {
      actions++;
      if (d.kind === 'stay') await page.keyboard.press('Space');
      else if (d.kind === 'home') await page.click('.gear__home');
      else if (d.cell !== undefined) {
        const p = await cellPoint(page, d.cell);
        if (mode === 'touch') await page.touchscreen.tap(p.x, p.y);
        else await page.mouse.click(p.x, p.y);
      }
      await page.waitForTimeout(60);
    }
    // Ответ: верный с вероятностью 0.9.
    const answered = await page.evaluate(() => {
      const quiz = document.querySelector<HTMLElement>('.quiz');
      if (!quiz || quiz.dataset.mode !== 'active' || quiz.classList.contains('quiz--paused')) return false;
      const correct = Number(quiz.dataset.testCorrect ?? -1);
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.quiz__card:not(.quiz__card--out) .quiz__opt'));
      if (!buttons.length || buttons.some((b) => b.disabled)) return false;
      const pick = Math.random() < 0.9 ? correct : (correct + 1) % buttons.length;
      buttons[pick]?.click();
      return true;
    });
    if (answered) answers++;
    await page.waitForTimeout(450 + Math.random() * 400);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `shots/e2e-${level}-${width}x${height}-${mode}.png` });
  console.log(
    JSON.stringify({
      status: last?.status,
      cause: last?.cause,
      score: last?.finalScore,
      stars: last?.stars,
      answers,
      actions,
      gameTime: last?.time.toFixed(1),
      results: await page.locator('.results').count(),
      errors: errors.filter((e) => !e.includes('[vite]')).slice(0, 10),
    }),
  );
  await browser.close();
}

void main();
