// Автономная страница: вопросы генерирует сервер (quiz-generation.cjs из See Escape),
// локальный банк — запасной, когда генерация не настроена или не ответила; localStorage.

import { mountMine } from './embed';
import { balance } from './config/balance';
import bank from './shared/questions/bank.de.json';
import { LocalBankProvider } from './shared/questions/LocalBankProvider';
import { QuizBankProvider } from './shared/questions/QuizBankProvider';
import type { Question } from './shared/questions/types';

const params = new URLSearchParams(location.search);
(window as unknown as { __MINE_TEST__?: boolean }).__MINE_TEST__ = params.has('test');
const localBank = new LocalBankProvider(bank as Question[], {
  noRepeatWithin: balance.questions.noRepeatWithin,
  retryMin: balance.questions.retryAfterMin,
  retryMax: balance.questions.retryAfterMax,
  seed: params.has('seed') ? Number(params.get('seed')) : undefined,
});
// В сквозных тестах (?test) — только локальный банк: прогон не зависит от сети и ключей.
const provider = new QuizBankProvider(localBank, {
  generation: !params.has('test'),
  retryMin: balance.questions.retryAfterMin,
  retryMax: balance.questions.retryAfterMax,
});

const mounted = mountMine(document.getElementById('app')!, {
  questions: provider,
  level: params.has('level') ? Number(params.get('level')) : undefined,
  seed: params.has('seed') ? Number(params.get('seed')) : undefined,
});

// Для отладки и сквозных тестов.
(window as unknown as { mine: typeof mounted }).mine = mounted;
