// Встраивание игры (план, 13.4): mountMine(container, options) → { destroy() }.

import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/900.css';
import '@fontsource/bangers/400.css';
import './ui/styles.css';
import { MineApp, type FinishInfo } from './app/MineApp';
import type { KeyValueStorage } from './app/storage';
import type { QuestionProvider } from './shared/questions/types';

export type { FinishInfo } from './app/MineApp';
export type { Question, QuestionProvider } from './shared/questions/types';

export interface MountOptions {
  questions: QuestionProvider;
  storage?: KeyValueStorage;
  level?: number;
  seed?: number;
  onFinish?: (r: FinishInfo) => void;
}

export function mountMine(container: HTMLElement, options: MountOptions): { destroy(): void; app: MineApp } {
  const app = new MineApp(container, options);
  void app.boot();
  return {
    app,
    destroy() {
      app.destroy();
    },
  };
}
