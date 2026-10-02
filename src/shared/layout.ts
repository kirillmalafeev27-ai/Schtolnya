// Раскладка страницы-комикса из двух панелей (план, 11.1). Общий модуль серии:
// ничего не знает о правилах конкретной игры, только о форме экрана.

export interface LayoutConfig {
  landscapeRatio: number;
  quizPortraitFrac: number;
  quizPortraitMin: number;
  quizPortraitMax: number;
  quizLandscapeFrac: number;
  quizLandscapeMin: number;
  quizLandscapeMax: number;
  gutterMin: number;
  gutterMax: number;
}

export interface PageLayout {
  landscape: boolean;
  gutter: number;
  /** Высота панели вопроса в портрете или её ширина в ландшафте, CSS px. */
  quizSize: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function computePageLayout(width: number, height: number, cfg: LayoutConfig): PageLayout {
  const landscape = width / Math.max(1, height) >= cfg.landscapeRatio;
  const gutter = Math.round(clamp(Math.min(width, height) * 0.018, cfg.gutterMin, cfg.gutterMax));
  let quizSize: number;
  if (landscape) {
    quizSize = clamp(width * cfg.quizLandscapeFrac, cfg.quizLandscapeMin, cfg.quizLandscapeMax);
    // На очень узком экране мир не должен исчезнуть совсем.
    quizSize = Math.min(quizSize, width * 0.5);
  } else {
    quizSize = clamp(height * cfg.quizPortraitFrac, cfg.quizPortraitMin, cfg.quizPortraitMax);
    quizSize = Math.min(quizSize, height * 0.56);
  }
  return { landscape, gutter, quizSize: Math.round(quizSize) };
}

/** Применяет раскладку к корневому элементу через CSS-переменные и атрибут ориентации. */
export function applyPageLayout(root: HTMLElement, layout: PageLayout): void {
  root.dataset.orient = layout.landscape ? 'landscape' : 'portrait';
  root.style.setProperty('--gutter', `${layout.gutter}px`);
  root.style.setProperty('--quiz-size', `${layout.quizSize}px`);
}
