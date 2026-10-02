// Предпросмотр всех текстур манифеста (только для разработки): ?gray — в оттенках серого, ?only=rock — фильтр.
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/900.css';
import '@fontsource/bangers/400.css';
import { renderEntry } from '../art/ArtFactory';
import { manifest } from '../art/manifest';
import { recipes } from '../art/recipes';
import { setupKit } from '../art/setupKit';

const params = new URLSearchParams(location.search);
if (params.has('gray')) document.body.classList.add('gray');
const only = params.get('only');
const scale = Number(params.get('scale') ?? 1);
const dark = params.has('dark');

async function main() {
  await Promise.all([document.fonts.load('900 48px Rubik'), document.fonts.load('48px Bangers')]);
  setupKit();
  const grid = document.getElementById('grid')!;
  const t0 = performance.now();
  let n = 0;
  for (const e of manifest()) {
    if (only && !e.key.startsWith(only) && e.recipe !== only) continue;
    const c = renderEntry(e, 128, recipes);
    n++;
    c.style.width = `${c.width * scale}px`;
    c.style.height = `${c.height * scale}px`;
    const f = document.createElement('figure');
    if (dark) f.classList.add('dark');
    f.append(c, Object.assign(document.createElement('figcaption'), { textContent: e.key }));
    grid.appendChild(f);
  }
  document.title = `art ${n} in ${(performance.now() - t0).toFixed(0)}ms`;
  (window as unknown as { artReady: boolean }).artReady = true;
}
void main();
