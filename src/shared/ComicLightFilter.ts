// Комиксный свет (план, 8.1 и 8.3) — общий фильтр камеры мира в системе фильтров Phaser 4.
// Свет не плавный: квантуется на три ступени, переходы заполнены растровыми точками.
// Модуль серии: ничего не знает о правилах конкретной игры — получает источники, маску проходов и настройки.

import Phaser from 'phaser';

export const MAX_LIGHTS = 12;

export interface LightSource {
  /** Позиция в мировых координатах. */
  x: number;
  y: number;
  /** Радиус в мировых единицах. */
  radius: number;
  /** Цвет в долях единицы. */
  color: readonly [number, number, number];
  intensity: number;
  /** Приоритет при нехватке мест (больше — важнее). */
  priority: number;
}

export interface ComicLightSettings {
  ambient: readonly [number, number, number];
  steps: readonly [number, number, number];
  thresholds: readonly [number, number];
  band: number;
  floorMin: number;
  /** Шаг растра в пикселях канвы (CSS px × DPR). */
  dotSpacing: number;
  /** Насколько сильно свет окрашивает сцену (0 — без окраски). */
  tintStrength: number;
}

const FRAG = `#pragma phaserTemplate(shaderName)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define MAX_LIGHTS ${MAX_LIGHTS}
uniform sampler2D uMainSampler;
uniform sampler2D uMaskSampler;
uniform vec2 uResolution;
uniform vec4 uView;
uniform vec4 uGrid;
uniform int uLightCount;
uniform vec2 uLightPos[MAX_LIGHTS];
uniform vec2 uLightRI[MAX_LIGHTS];
uniform vec3 uLightColor[MAX_LIGHTS];
uniform vec3 uAmbient;
uniform vec3 uSteps;
uniform vec3 uBands;
uniform vec4 uMisc;
uniform vec4 uVignette;
varying vec2 outTexCoord;
#pragma phaserTemplate(fragmentHeader)

float quant(float lum, float thr, float band, float lo, float hi, vec2 px, float spacing) {
  if (lum <= thr - band) return lo;
  if (lum >= thr + band) return hi;
  float t = (lum - (thr - band)) / (2.0 * band);
  vec2 r = vec2(px.x + px.y, px.x - px.y) * 0.70710678;
  vec2 c = fract(r / spacing) - 0.5;
  return length(c) < t * 0.72 ? hi : lo;
}

void main () {
  vec4 scene = texture2D(uMainSampler, outTexCoord);
  vec2 px = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * uResolution;
  vec3 light = uAmbient;
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    float d = length(px - uLightPos[i]) / max(uLightRI[i].x, 1.0);
    light += uLightColor[i] * (uLightRI[i].y * (1.0 - smoothstep(0.0, 1.0, d)));
  }
  float raw = max(max(light.r, light.g), light.b);
  float lum = raw;
  if (uView.w > 0.5) {
    vec2 world = uView.xy + px * uView.z;
    vec2 cell = vec2(world.x, world.y + uGrid.w) / uGrid.z;
    vec2 uv = (floor(cell) + 0.5) / uGrid.xy;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      float walk = texture2D(uMaskSampler, vec2(uv.x, uMisc.w > 0.5 ? 1.0 - uv.y : uv.y)).r;
      if (walk > 0.5) lum = max(lum, uMisc.x);
    }
  }
  float q = lum < uBands.x + uBands.z
    ? quant(lum, uBands.x, uBands.z, uSteps.x, uSteps.y, px, uMisc.y)
    : quant(lum, uBands.y, uBands.z, uSteps.y, uSteps.z, px, uMisc.y);
  vec3 tint = mix(vec3(1.0), light / max(raw, 0.001), uMisc.z);
  vec3 col = scene.rgb * tint * q;
  vec2 v = (outTexCoord - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  float vig = smoothstep(0.3, 0.95, length(v) * 1.15) * uVignette.a;
  col = mix(col, uVignette.rgb * scene.a, vig);
  gl_FragColor = vec4(col, scene.a);
}
`;

type BaseFilterShaderCtor = new (
  name: string,
  manager: unknown,
  key: string | null,
  source: string,
) => {
  programManager: { setUniform(name: string, value: unknown): void };
};

const RenderNodes = Phaser.Renderer.WebGL.RenderNodes as unknown as {
  BaseFilterShader: BaseFilterShaderCtor;
};

/** Контроллер фильтра: живые параметры, которые игра меняет каждый кадр. */
export class ComicLight extends Phaser.Filters.Controller {
  lights: LightSource[] = [];
  settings: ComicLightSettings;
  /** Текстура маски проходов (белый — проход), по клетке на пиксель. */
  maskTexture: Phaser.Textures.Texture | null = null;
  maskGrid = { w: 1, h: 1, cell: 128, offsetY: 32 };
  /** Перевернуть маску по вертикали (зависит от ориентации загрузки текстур; в Phaser 4 — не нужно). */
  maskFlip = false;
  vignette: [number, number, number, number] = [0, 0, 0, 0];
  readonly posBuf = new Float32Array(MAX_LIGHTS * 2);
  readonly riBuf = new Float32Array(MAX_LIGHTS * 2);
  readonly colBuf = new Float32Array(MAX_LIGHTS * 3);
  count = 0;

  constructor(camera: Phaser.Cameras.Scene2D.Camera, settings: ComicLightSettings) {
    super(camera, 'FilterComicLight');
    this.settings = settings;
  }

  /** Отобрать не больше 12 источников по приоритету и перевести их в пиксели камеры. */
  pack(): void {
    const cam = this.camera;
    const list = this.lights
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MAX_LIGHTS);
    const z = cam.zoom;
    const vx = cam.worldView.x;
    const vy = cam.worldView.y;
    this.count = list.length;
    list.forEach((l, i) => {
      this.posBuf[i * 2] = (l.x - vx) * z;
      this.posBuf[i * 2 + 1] = (l.y - vy) * z;
      this.riBuf[i * 2] = l.radius * z;
      this.riBuf[i * 2 + 1] = l.intensity;
      this.colBuf[i * 3] = l.color[0];
      this.colBuf[i * 3 + 1] = l.color[1];
      this.colBuf[i * 3 + 2] = l.color[2];
    });
  }
}

/** Рендер-нода фильтра: шейдер и униформы. */
export function makeComicLightNode(): unknown {
  const Base = RenderNodes.BaseFilterShader;
  class FilterComicLight extends Base {
    constructor(manager: unknown) {
      super('FilterComicLight', manager, null, FRAG);
    }

    setupTextures(controller: ComicLight, textures: unknown[]): void {
      const tex = controller.maskTexture;
      const gl = tex ? (tex.source[0] as unknown as { glTexture: unknown }).glTexture : null;
      textures[1] = gl ?? textures[0];
    }

    setupUniforms(controller: ComicLight): void {
      const pm = this.programManager;
      const cam = controller.camera;
      const s = controller.settings;
      controller.pack();
      pm.setUniform('uMaskSampler', 1);
      pm.setUniform('uResolution', [cam.width, cam.height]);
      pm.setUniform('uView', [
        cam.worldView.x,
        cam.worldView.y,
        1 / cam.zoom,
        controller.maskTexture ? 1 : 0,
      ]);
      const g = controller.maskGrid;
      pm.setUniform('uGrid', [g.w, g.h, g.cell, g.offsetY]);
      pm.setUniform('uLightCount', controller.count);
      pm.setUniform('uLightPos[0]', controller.posBuf);
      pm.setUniform('uLightRI[0]', controller.riBuf);
      pm.setUniform('uLightColor[0]', controller.colBuf);
      pm.setUniform('uAmbient', [s.ambient[0], s.ambient[1], s.ambient[2]]);
      pm.setUniform('uSteps', [s.steps[0], s.steps[1], s.steps[2]]);
      pm.setUniform('uBands', [s.thresholds[0], s.thresholds[1], s.band]);
      pm.setUniform('uMisc', [s.floorMin, s.dotSpacing, s.tintStrength, controller.maskFlip ? 1 : 0]);
      pm.setUniform('uVignette', controller.vignette);
    }
  }
  return FilterComicLight;
}

/** Карта рендер-нод для конфигурации игры: render.renderNodes. */
export function comicLightRenderNodes(): Record<string, unknown> {
  return { FilterComicLight: makeComicLightNode() };
}

/** Есть ли WebGL: без него фильтр недоступен и включается запасной путь (8.5). */
export function filtersSupported(game: Phaser.Game): boolean {
  return game.renderer.type === Phaser.WEBGL;
}
