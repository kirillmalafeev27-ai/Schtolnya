// Общий микшер серии (план, 10): шины эффектов и эмбиента, эхо штольни, приглушение после взрыва.
// AudioContext создаётся только по жесту игрока; до этого все вызовы — тихие пустышки.

export type Bus = 'sfx' | 'ambient';

export interface VoiceOpts {
  bus?: Bus;
  /** Панорама −1…1. */
  pan?: number;
  gain?: number;
  /** Доля сигнала в эхо штольни. */
  echo?: number;
  /** false — звук не приглушается (сам источник приглушения). */
  duck?: boolean;
  /** Сколько секунд жить узлам голоса; Infinity — пока не вызван stop(). */
  life?: number;
  /** Разброс высоты (доля), по умолчанию из настроек микшера. */
  jitter?: number;
}

/** Голос: точка подключения источников, время старта и множитель высоты. */
export interface Voice {
  ctx: BaseAudioContext;
  out: AudioNode;
  t: number;
  rate: number;
  mixer: Mixer;
  stop(fadeS?: number): void;
}

export interface MixerVolumes {
  sfx: number;
  ambient: number;
  on: boolean;
}

interface Echo {
  input: GainNode;
}

export class Mixer {
  ctx: AudioContext | null = null;
  /** Офлайн-контекст для проверки пресетов (tools/audio-check). */
  private offline: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private sfxDuck: GainNode | null = null;
  private ambDuck: GainNode | null = null;
  private echoSfx: Echo | null = null;
  private echoAmb: Echo | null = null;
  private white: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;
  private vol: MixerVolumes = { sfx: 0.8, ambient: 0.55, on: true };
  private paused = false;
  /** Сколько голосов сейчас живо — защита от лавины звуков. */
  private live = 0;
  onUnlock: (() => void) | null = null;

  constructor(
    private readonly cfg: { duckLevel: number; duckMs: number; pitchJitter: number; maxVoices?: number },
  ) {}

  /** Контекст запущен и звук включён. */
  get ready(): boolean {
    if (this.offline) return true;
    return !!this.ctx && this.ctx.state === 'running' && this.vol.on;
  }

  get now(): number {
    return this.base?.currentTime ?? 0;
  }

  private get base(): BaseAudioContext | null {
    return this.offline ?? this.ctx;
  }

  /** Отрисовка в OfflineAudioContext: для проверки громкости пресетов без динамиков. */
  static offline(ctx: BaseAudioContext): Mixer {
    const m = new Mixer({ duckLevel: 0.35, duckMs: 300, pitchJitter: 0 });
    m.offline = ctx;
    m.build();
    return m;
  }

  /** Вызывать из обработчика жеста (клик, тап, клавиша). Повторные вызовы безопасны. */
  unlock(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.build();
      this.onUnlock?.();
    }
    if (this.ctx.state === 'suspended' && !this.paused) void this.ctx.resume().catch(() => undefined);
  }

  setVolumes(v: Partial<MixerVolumes>): void {
    this.vol = { ...this.vol, ...v };
    this.applyVolumes();
  }

  get volumes(): MixerVolumes {
    return { ...this.vol };
  }

  /** Пауза игры глушит весь звук (контекст засыпает). */
  setPaused(on: boolean): void {
    this.paused = on;
    const ctx = this.ctx;
    if (!ctx) return;
    if (on && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
    if (!on && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  }

  /** Приглушить всё, кроме источника, на duckMs (10.5). */
  duck(): void {
    const ctx = this.base;
    if (!ctx || !this.sfxDuck || !this.ambDuck) return;
    const t = ctx.currentTime;
    const back = t + this.cfg.duckMs / 1000;
    for (const g of [this.sfxDuck.gain, this.ambDuck.gain]) {
      g.cancelScheduledValues(t);
      g.setTargetAtTime(this.cfg.duckLevel, t, 0.012);
      g.setTargetAtTime(1, back, 0.09);
    }
  }

  /** Создать голос. null — звук сейчас невозможен (нет жеста, выключен, пауза, перегруз). */
  voice(o: VoiceOpts = {}): Voice | null {
    const ctx = this.base;
    if (!ctx || !this.ready || this.paused) return null;
    if (this.live >= (this.cfg.maxVoices ?? 48)) return null;
    const bus = o.bus ?? 'sfx';
    const dest = bus === 'ambient' ? this.ambDuck! : o.duck === false ? this.sfxBus! : this.sfxDuck!;
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    let tail: AudioNode = g;
    let panner: StereoPannerNode | null = null;
    if (o.pan && typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(panner);
      tail = panner;
    }
    tail.connect(dest);
    let send: GainNode | null = null;
    const echo = bus === 'ambient' ? this.echoAmb : this.echoSfx;
    if (o.echo && echo) {
      send = ctx.createGain();
      send.gain.value = o.echo;
      tail.connect(send);
      send.connect(echo.input);
    }
    this.live++;
    let alive = true;
    const release = () => {
      if (!alive) return;
      alive = false;
      this.live--;
      try {
        g.disconnect();
        panner?.disconnect();
        send?.disconnect();
      } catch {
        // уже отключено
      }
    };
    const life = o.life ?? 2;
    if (Number.isFinite(life)) window.setTimeout(release, (life + 0.3) * 1000);
    const j = o.jitter ?? this.cfg.pitchJitter;
    return {
      ctx,
      out: g,
      t: ctx.currentTime + 0.004,
      rate: 1 + (Math.random() * 2 - 1) * j,
      mixer: this,
      stop: (fadeS = 0.08) => {
        if (!alive) return;
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + fadeS);
        window.setTimeout(release, (fadeS + 0.05) * 1000);
      },
    };
  }

  /** Буфер белого или «коричневого» шума (2 с), общий для всех голосов. */
  noise(kind: 'white' | 'brown' = 'white'): AudioBuffer | null {
    return kind === 'white' ? this.white : this.brown;
  }

  destroy(): void {
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }

  // ───────────── граф ─────────────

  private build(): void {
    const ctx = this.base!;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.sfxDuck = ctx.createGain();
    this.sfxDuck.connect(this.sfxBus);
    this.ambBus = ctx.createGain();
    this.ambBus.connect(this.master);
    this.ambDuck = ctx.createGain();
    this.ambDuck.connect(this.ambBus);
    this.echoSfx = this.makeEcho(this.sfxBus, 0.23, 0.36);
    this.echoAmb = this.makeEcho(this.ambBus, 0.31, 0.42);
    this.white = this.makeNoise('white');
    this.brown = this.makeNoise('brown');
    this.applyVolumes();
  }

  /** Эхо штольни: задержка с затухающей обратной связью и срезом верхов. */
  private makeEcho(dest: AudioNode, delayS: number, feedback: number): Echo {
    const ctx = this.base!;
    const input = ctx.createGain();
    const d = ctx.createDelay(1);
    d.delayTime.value = delayS;
    const fb = ctx.createGain();
    fb.gain.value = feedback;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1700;
    const out = ctx.createGain();
    out.gain.value = 0.55;
    input.connect(d);
    d.connect(lp);
    lp.connect(fb);
    fb.connect(d);
    lp.connect(out);
    out.connect(dest);
    return { input };
  }

  private makeNoise(kind: 'white' | 'brown'): AudioBuffer {
    const ctx = this.base!;
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') data[i] = w;
      else {
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }
    return buf;
  }

  private applyVolumes(): void {
    const ctx = this.base;
    if (!ctx || !this.master || !this.sfxBus || !this.ambBus) return;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.on ? 1 : 0, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.ambBus.gain.setTargetAtTime(this.vol.ambient, t, 0.03);
  }
}
