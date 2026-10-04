import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizBankProvider } from '../src/shared/questions/QuizBankProvider';
import type { Question, QuestionProvider } from '../src/shared/questions/types';

let serial = 0;
function raw(tag = serial++) {
  return {
    text: 'Waehle die richtige Option.',
    display: `Satz ${tag} ___ heute.`,
    options: [`richtig${tag}`, `falsch${tag}a`, `falsch${tag}b`, `falsch${tag}c`],
    correct: 0,
  };
}

const fallback: QuestionProvider = {
  next: () =>
    Promise.resolve<Question>({
      id: 'local',
      prompt: 'Запасной',
      promptLang: 'de',
      options: ['a', 'b', 'c', 'd'],
      optionsLang: 'de',
      correctIndex: 0,
    }),
  report: () => {},
};

let storage: Map<string, string>;
let generateReplies: Array<() => Response>;
let fetchMock: ReturnType<typeof vi.fn>;

const generateCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url) === '/api/generate-questions').length;
const flush = () => vi.advanceTimersByTimeAsync(0);
const bank = () => new QuizBankProvider(fallback, { generation: true, retryMin: 2, retryMax: 3 });

describe('пул сгенерированных вопросов (как в See Escape)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storage = new Map();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
      },
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    });
    generateReplies = [];
    fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/quiz/status') return Response.json({ generationConfigured: true });
      const reply = generateReplies.shift();
      return reply ? reply() : new Response('boom', { status: 502 });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('до начала игры к модели не обращаются; prepare заказывает пакет из 10', async () => {
    const quiz = bank();
    await flush();
    expect(quiz.status).toBe('online');
    expect((await quiz.next()).id).toBe('local');
    expect(generateCalls()).toBe(0);

    generateReplies.push(() => Response.json({ questions: Array.from({ length: 10 }, () => raw()) }));
    quiz.prepare();
    await flush();
    expect(generateCalls()).toBe(1);
    const body = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);
    expect(body).toMatchObject({ level: 'A2', grammarTopic: 'Präsens', count: 10 });
    expect(quiz.ready).toBe(10);
  });

  it('остаток пула переживает перезагрузку и отдаётся без запроса; другая тема его не берёт', async () => {
    const first = bank();
    await flush();
    generateReplies.push(() => Response.json({ questions: Array.from({ length: 10 }, () => raw()) }));
    first.prepare();
    await flush();
    const shown = await first.next();
    expect(shown.id.startsWith('gen-')).toBe(true);
    expect(first.ready).toBe(9);

    // Новая страница: показанный, но не отвеченный вопрос и девять невыданных — на месте.
    const second = bank();
    expect(second.ready).toBe(10);
    await flush();
    second.prepare();
    await flush();
    expect(generateCalls()).toBe(1);
    expect((await second.next()).prompt).toBe(shown.prompt);

    // Снимок другой темы не подходит.
    storage.set('schtolnya.learning.v1', JSON.stringify({ level: 'B1', grammarTopic: 'Dativ' }));
    expect(bank().ready).toBe(0);

    // И устаревает через сутки.
    storage.delete('schtolnya.learning.v1');
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    expect(bank().ready).toBe(0);
  });

  it('пауза после неудачи растёт: 15 с, 30, 60 … до двух минут; успех её сбрасывает', async () => {
    const quiz = bank();
    await flush();
    quiz.prepare();
    await flush();
    expect(generateCalls()).toBe(1);
    expect(quiz.status).toBe('fallback');

    for (const pause of [15_000, 30_000, 60_000, 120_000, 120_000]) {
      const before = generateCalls();
      await vi.advanceTimersByTimeAsync(pause - 100);
      await quiz.next();
      await flush();
      expect(generateCalls()).toBe(before);
      await vi.advanceTimersByTimeAsync(200);
      await quiz.next();
      await flush();
      expect(generateCalls()).toBe(before + 1);
    }

    // Ответ без новых заданий — тоже неудача.
    await vi.advanceTimersByTimeAsync(120_000);
    generateReplies.push(() => Response.json({ questions: [] }));
    await quiz.next();
    await flush();
    const afterEmpty = generateCalls();
    await quiz.next();
    await flush();
    expect(generateCalls()).toBe(afterEmpty);

    // Успех: следующая неудача снова ждёт 15 с.
    await vi.advanceTimersByTimeAsync(120_000);
    generateReplies.push(() => Response.json({ questions: [raw()] }));
    await quiz.next();
    await flush();
    expect(quiz.ready).toBe(1);
    expect(quiz.status).toBe('online');
    await quiz.next();
    await flush();
    const afterSuccess = generateCalls();
    await vi.advanceTimersByTimeAsync(14_900);
    await quiz.next();
    await flush();
    expect(generateCalls()).toBe(afterSuccess);
    await vi.advanceTimersByTimeAsync(200);
    await quiz.next();
    await flush();
    expect(generateCalls()).toBe(afterSuccess + 1);
  });
});
