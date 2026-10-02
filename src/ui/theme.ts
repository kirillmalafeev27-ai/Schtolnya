// Переносит палитру в CSS-переменные корня: в стилях цвета берутся только отсюда (план, 0.4).

import { palette, rgba } from '../config/palette';

export function applyTheme(root: HTMLElement): void {
  const p = palette;
  const vars: Record<string, string> = {
    '--ink': p.ink,
    '--ink-70': rgba(p.ink, 0.7),
    '--ink-55': rgba(p.ink, 0.55),
    '--ink-35': rgba(p.ink, 0.35),
    '--ink-15': rgba(p.ink, 0.15),
    '--page': p.page,
    '--page-dots': p.pageDots,
    '--panel': p.panel,
    '--panel-90': rgba(p.panel, 0.9),
    '--caption': p.caption,
    '--cave': p.caveDeep,
    '--chalk': p.chalk,
    '--gold': p.gold.base,
    '--gold-shadow': p.gold.shadow,
    '--gold-light': p.gold.light,
    '--gold-engrave': p.gold.engrave,
    '--dyn': p.dynamite.base,
    '--dyn-shadow': p.dynamite.shadow,
    '--dyn-light': p.dynamite.light,
    '--dyn-label': p.dynamite.label,
    '--good': p.good,
    '--good-35': rgba(p.good, 0.35),
    '--bad': p.bad,
    '--bad-35': rgba(p.bad, 0.35),
    '--hint-two': p.hints.twoSteps,
    '--daylight': p.daylight,
    '--lantern': p.lantern,
    '--bedrock': p.bedrock.base,
    '--bedrock-light': p.bedrock.light,
    '--bedrock-shadow': p.bedrock.shadow,
    '--kobold-eyes': p.kobold.eyes,
    '--kobold': p.kobold.skin,
    '--hero-scarf': p.hero.scarf,
    '--timber': p.timber.base,
    '--timber-light': p.timber.light,
    '--timber-shadow': p.timber.shadow,
    '--floor': p.floor.base,
    '--floor-light': p.floor.light,
    '--rock': p.rock.base,
    '--rock-light': p.rock.light,
    '--muted': p.floor.shadow,
    '--muted-light': p.floor.pebble,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}
