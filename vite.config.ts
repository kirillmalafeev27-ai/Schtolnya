import { defineConfig, type Plugin } from 'vite';

/**
 * Phaser 4.2.1 выбирает текстуру в пакетном шейдере точным сравнением интерполированного индекса
 * (`outTexDatum == float(INDEX)`). Из-за погрешности интерполяции один из двух треугольников спрайта
 * иногда не совпадает ни с одним индексом и рисуется прозрачным — у слов-звуков «отрезало» половину.
 * Округляем индекс перед сравнением (DECISIONS.md).
 */
function phaserTexIdFix(): Plugin {
  return {
    name: 'phaser-texid-fix',
    enforce: 'pre',
    transform(code, id) {
      if (!/phaser[\\/]dist[\\/]phaser(\.esm)?\.js(\?.*)?$/.test(id)) return null;
      const fixed = code.split('outTexDatum ==').join('floor(outTexDatum + 0.5) ==');
      if (fixed === code) this.warn('phaser-texid-fix: шаблон шейдера не найден — проверь версию Phaser');
      return { code: fixed, map: null };
    },
  };
}

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  plugins: [phaserTexIdFix()],
  // Без предсборки, иначе исправление шейдера не дойдёт до dev-сервера.
  optimizeDeps: { exclude: ['phaser'] },
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: 'index.html' } },
    chunkSizeWarningLimit: 2500,
    assetsInlineLimit: 0,
  },
});
