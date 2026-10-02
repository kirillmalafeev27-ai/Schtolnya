// Настройка комикс-кита палитрой игры.
import { palette } from '../config/palette';
import { setInk } from '../shared/comicKit';

export function setupKit(): void {
  setInk(palette.ink, palette.panel);
}
