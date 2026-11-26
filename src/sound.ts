/**
 * Advanced Web Audio procedural sound synthesizer for Operacja B4.
 * 100% procedural with zero external audio assets.
 */
export interface AudioSettings {
  master: number;
  music: number;
  effects: number;
}

class SoundEngine {
  private static readonly SETTINGS_KEY = 'maxFlizAudioSettings:v1';
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private musicInterval: number | null = null;
  private musicStep: number = 0;
  private musicPlaying: boolean = false;
  private musicRequested: boolean = false;
  private musicGain: GainNode | null = null;
  private masterBus: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private musicIntensity: 'menu' | 'combat' | 'boss' = 'combat';
  private lastAttackWhooshAt = -Infinity;
  private lastUiHoverAt = -Infinity;
  private lastXpPickupAt = -Infinity;
  private lastEnemyDeathAt = -Infinity;
  private lastCritPingAt = -Infinity;
  private lastDashAt = -Infinity;
  private lastFirearmImpactAt: Partial<Record<'pistol' | 'smg' | 'rifle' | 'shotgun' | 'heavy-rifle' | 'minigun' | 'rocket' | 'flame' | 'plasma' | 'gauss' | 'grenade', number>> = {};
  private gunshotNoiseBuffer: AudioBuffer | null = null;
  private explosionNoiseBuffer: AudioBuffer | null = null;
  private settings: AudioSettings = { master: 0.82, music: 0.48, effects: 0.82 };

  constructor() {
    this.loadSettings();
  }

  private clampVolume(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  }

  private loadSettings() {
    try {
      const raw = window.localStorage.getItem(SoundEngine.SETTINGS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<AudioSettings>;
      this.settings = {
        master: this.clampVolume(saved.master ?? this.settings.master),
        music: this.clampVolume(saved.music ?? this.settings.music),
        effects: this.clampVolume(saved.effects ?? this.settings.effects),
      };
    } catch {
      // Audio must remain available even when browser storage is blocked or corrupted.
    }
  }

  private persistSettings() {
    try {
      window.localStorage.setItem(SoundEngine.SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Keep the current session's settings when storage is unavailable.
    }
  }

  private ensureAudioGraph() {
    if (!this.ctx) return;
    if (!this.masterCompressor) {
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.masterCompressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.masterCompressor.ratio.setValueAtTime(8, this.ctx.currentTime);
      this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.masterCompressor.release.setValueAtTime(0.14, this.ctx.currentTime);
      this.masterCompressor.connect(this.ctx.destination);
    }
    if (!this.masterBus) {
      this.masterBus = this.ctx.createGain();
      this.masterBus.connect(this.masterCompressor);
    }
    if (!this.musicBus) {
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.masterBus);
    }
    if (!this.effectsBus) {
      this.effectsBus = this.ctx.createGain();
      this.effectsBus.connect(this.masterBus);
    }
    const now = this.ctx.currentTime;
    this.masterBus.gain.setTargetAtTime(this.settings.master, now, 0.025);
    this.musicBus.gain.setTargetAtTime(this.settings.music, now, 0.025);
    this.effectsBus.gain.setTargetAtTime(this.settings.effects, now, 0.025);
  }

  private applyVolumeSettings() {
    this.ensureAudioGraph();
  }

  public getAudioSettings(): AudioSettings {
    return { ...this.settings };
  }

  public setMasterVolume(value: number) {
    this.settings.master = this.clampVolume(value);
    this.applyVolumeSettings();
    this.persistSettings();
  }

  public setMusicVolume(value: number) {
    this.settings.music = this.clampVolume(value);
    this.applyVolumeSettings();
    this.persistSettings();
  }

  public setEffectsVolume(value: number) {
    this.settings.effects = this.clampVolume(value);
    this.applyVolumeSettings();
    this.persistSettings();
  }

  public setAudioSettings(settings: Partial<AudioSettings>) {
    if (settings.master !== undefined) this.settings.master = this.clampVolume(settings.master);
    if (settings.music !== undefined) this.settings.music = this.clampVolume(settings.music);
    if (settings.effects !== undefined) this.settings.effects = this.clampVolume(settings.effects);
    this.applyVolumeSettings();
    this.persistSettings();
  }

  public initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (!this.ctx) return;
    this.ensureAudioGraph();
    if (this.ctx.state === 'suspended') {
      // A browser may reject resume until the next trusted user gesture; do not leak that rejection.
      void this.ctx.resume().catch(() => undefined);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      // Preserve the user's current music preference while silencing all audio.
      this.stopMusic(false);
    } else if (this.musicRequested) {
      this.startMusic();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playJump() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.16);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);

    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.17);
  }

  public playBounce() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(840, t + 0.3);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.32);

    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.33);
  }

  public playPickup(combo = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const basePitch = Math.min(1.0 + (combo - 1) * 0.15, 2.0);
    const baseNotes = [523.25, 659.25, 783.99, 1046.5];

    baseNotes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const startTime = t + idx * 0.038;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * basePitch, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.19);
    });
  }

  /** Short arcade sweep and restrained mechanical ticks for the B4 slot-machine spin. */
  public playRouletteSpin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const context = this.ctx;
    const bus = this.effectsBus ?? context.destination;
    const start = context.currentTime;
    const sweep = context.createOscillator();
    const sweepGain = context.createGain();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(135, start);
    sweep.frequency.exponentialRampToValueAtTime(690, start + 1.18);
    sweepGain.gain.setValueAtTime(0.0001, start);
    sweepGain.gain.linearRampToValueAtTime(0.075, start + 0.10);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, start + 1.24);
    sweep.connect(sweepGain);
    sweepGain.connect(bus);
    sweep.start(start);
    sweep.stop(start + 1.26);

    for (let index = 0; index < 5; index++) {
      const tickStart = start + 0.12 + index * 0.19;
      const tick = context.createOscillator();
      const tickGain = context.createGain();
      tick.type = 'square';
      tick.frequency.setValueAtTime(430 + index * 54, tickStart);
      tickGain.gain.setValueAtTime(0.0001, tickStart);
      tickGain.gain.linearRampToValueAtTime(0.022, tickStart + 0.006);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, tickStart + 0.045);
      tick.connect(tickGain);
      tickGain.connect(bus);
      tick.start(tickStart);
      tick.stop(tickStart + 0.05);
    }
  }

  /** A distinct, short detent click; later reels use a slightly higher pitch. */
  public playRouletteStop(reelIndex: number) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const context = this.ctx;
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const safeIndex = Number.isFinite(reelIndex) ? Math.max(0, Math.min(2, Math.floor(reelIndex))) : 0;
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(310 + safeIndex * 105, start);
    oscillator.frequency.exponentialRampToValueAtTime(145 + safeIndex * 35, start + 0.085);
    gain.gain.setValueAtTime(0.16, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
    oscillator.connect(gain);
    gain.connect(this.effectsBus ?? context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.12);
  }

  /** A bright major reward chord, or a lower warning chord for hostile deliveries. */
  public playRouletteResult(isRisk = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const context = this.ctx;
    const bus = this.effectsBus ?? context.destination;
    const start = context.currentTime;
    const notes = isRisk ? [196, 155.56, 130.81] : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + index * (isRisk ? 0.075 : 0.045);
      oscillator.type = isRisk ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.linearRampToValueAtTime(isRisk ? 0.075 : 0.12, noteStart + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + (isRisk ? 0.24 : 0.38));
      oscillator.connect(gain);
      gain.connect(bus);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + (isRisk ? 0.25 : 0.39));
    });
  }

  public playWoosh() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  public playElectricalSparks() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.05);
    osc.frequency.linearRampToValueAtTime(400, t + 0.1);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  public playSirenAlert() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.linearRampToValueAtTime(450, t + 0.25);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.26);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.27);
  }

  public playAbility(charId: string) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    if (charId === 'marcin') {
      // A short diesel starter, tracked engine rev and radio confirmation for the WZ-404.
      const engine = this.ctx.createOscillator();
      const engineGain = this.ctx.createGain();
      engine.type = 'sawtooth';
      engine.frequency.setValueAtTime(62, t);
      engine.frequency.exponentialRampToValueAtTime(118, t + 0.28);
      engine.frequency.exponentialRampToValueAtTime(78, t + 0.68);
      engineGain.gain.setValueAtTime(0.0001, t);
      engineGain.gain.exponentialRampToValueAtTime(0.23, t + 0.07);
      engineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.82);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, t);
      filter.frequency.linearRampToValueAtTime(760, t + 0.25);
      engine.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(this.effectsBus ?? this.ctx.destination);
      engine.start(t);
      engine.stop(t + 0.84);

      const radio = this.ctx.createOscillator();
      const radioGain = this.ctx.createGain();
      radio.type = 'square';
      radio.frequency.setValueAtTime(880, t + 0.24);
      radio.frequency.setValueAtTime(1320, t + 0.34);
      radio.frequency.setValueAtTime(990, t + 0.44);
      radioGain.gain.setValueAtTime(0.0001, t + 0.24);
      radioGain.gain.exponentialRampToValueAtTime(0.09, t + 0.27);
      radioGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.58);
      radio.connect(radioGain);
      radioGain.connect(this.effectsBus ?? this.ctx.destination);
      radio.start(t + 0.24);
      radio.stop(t + 0.59);
    } else if (charId === 'grzesiek') {
      // Turbo engine dash
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.linearRampToValueAtTime(620, t + 0.32);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    } else if (charId === 'dawid') {
      // Tile throw ricochet ping
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(920, t);
      osc.frequency.exponentialRampToValueAtTime(1600, t + 0.09);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.28);
      gain.gain.setValueAtTime(0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (charId === 'piotr') {
      // Ominous low ritual swell followed by three sharp family-call chimes.
      const drone = this.ctx.createOscillator();
      const droneGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      drone.type = 'sawtooth';
      drone.frequency.setValueAtTime(96, t);
      drone.frequency.exponentialRampToValueAtTime(48, t + 0.62);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.72);
      droneGain.gain.setValueAtTime(0.0001, t);
      droneGain.gain.exponentialRampToValueAtTime(0.2, t + 0.09);
      droneGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.78);
      drone.connect(filter);
      filter.connect(droneGain);
      droneGain.connect(this.effectsBus ?? this.ctx.destination);
      drone.start(t);
      drone.stop(t + 0.8);

      [196, 246.9, 293.7].forEach((frequency, index) => {
        const start = t + 0.18 + index * 0.13;
        const chime = this.ctx!.createOscillator();
        const chimeGain = this.ctx!.createGain();
        chime.type = 'triangle';
        chime.frequency.setValueAtTime(frequency, start);
        chime.frequency.exponentialRampToValueAtTime(frequency * 1.5, start + 0.16);
        chimeGain.gain.setValueAtTime(0.0001, start);
        chimeGain.gain.exponentialRampToValueAtTime(0.14, start + 0.025);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
        chime.connect(chimeGain);
        chimeGain.connect(this.effectsBus ?? this.ctx!.destination);
        chime.start(start);
        chime.stop(start + 0.44);
      });
    } else {
      // Three tiny, distinct meow-like notes announce the incoming cat squad.
      [620, 760, 920].forEach((frequency, index) => {
        const start = t + index * 0.12;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, start);
        osc.frequency.exponentialRampToValueAtTime(frequency * 1.42, start + 0.07);
        osc.frequency.exponentialRampToValueAtTime(frequency * 0.76, start + 0.19);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.13, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.23);
        osc.connect(gain);
        gain.connect(this.effectsBus ?? this.ctx!.destination);
        osc.start(start);
        osc.stop(start + 0.24);
      });
    }
  }

  /** Low, punchy cannon report with a short metallic tail for the WZ-404 tank. */
  public playTankCannon() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const start = this.ctx.currentTime;
    const boom = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    boom.type = 'sawtooth';
    boom.frequency.setValueAtTime(118, start);
    boom.frequency.exponentialRampToValueAtTime(38, start + 0.22);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(920, start);
    filter.frequency.exponentialRampToValueAtTime(180, start + 0.24);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.42, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    boom.connect(filter);
    filter.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    boom.start(start);
    boom.stop(start + 0.35);

    const metal = this.ctx.createOscillator();
    const metalGain = this.ctx.createGain();
    metal.type = 'triangle';
    metal.frequency.setValueAtTime(780, start + 0.018);
    metal.frequency.exponentialRampToValueAtTime(240, start + 0.27);
    metalGain.gain.setValueAtTime(0.0001, start + 0.018);
    metalGain.gain.exponentialRampToValueAtTime(0.11, start + 0.03);
    metalGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.30);
    metal.connect(metalGain);
    metalGain.connect(this.effectsBus ?? this.ctx.destination);
    metal.start(start + 0.018);
    metal.stop(start + 0.31);
  }

  /** Soft paw-tap, quick whisker swoosh and a playful meow chirp for a cat pounce. */
  public playHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.28);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  /** Clean, positive PvP hit-confirm: a compact low impact plus a bright tick. */
  public playPvpHitConfirm() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const bus = this.effectsBus ?? this.ctx.destination;

    const impact = this.ctx.createOscillator();
    const impactGain = this.ctx.createGain();
    impact.type = 'triangle';
    impact.frequency.setValueAtTime(310, t);
    impact.frequency.exponentialRampToValueAtTime(122, t + 0.105);
    impactGain.gain.setValueAtTime(0.19, t);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    impact.connect(impactGain);
    impactGain.connect(bus);
    impact.start(t);
    impact.stop(t + 0.14);

    const tick = this.ctx.createOscillator();
    const tickGain = this.ctx.createGain();
    tick.type = 'sine';
    tick.frequency.setValueAtTime(920, t + 0.012);
    tick.frequency.exponentialRampToValueAtTime(560, t + 0.064);
    tickGain.gain.setValueAtTime(0.075, t + 0.012);
    tickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    tick.connect(tickGain);
    tickGain.connect(bus);
    tick.start(t + 0.012);
    tick.stop(t + 0.08);
  }

  private getExplosionNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const targetLength = Math.floor(this.ctx.sampleRate * 0.65);
    if (!this.explosionNoiseBuffer || this.explosionNoiseBuffer.length !== targetLength) {
      const buffer = this.ctx.createBuffer(1, targetLength, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < targetLength; i++) {
        const decay = Math.pow(1 - i / targetLength, 0.45);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
      this.explosionNoiseBuffer = buffer;
    }
    return this.explosionNoiseBuffer;
  }

  public playExplosion() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bus = this.effectsBus ?? this.ctx.destination;

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 0.56);
    subGain.gain.setValueAtTime(0.42, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    sub.connect(subGain);
    subGain.connect(bus);
    sub.start(t);
    sub.stop(t + 0.6);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.48);
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + 0.52);

    const buffer = this.getExplosionNoiseBuffer();
    if (buffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(1250, t);
      filter.frequency.exponentialRampToValueAtTime(95, t + 0.56);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.46, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.002, t + 0.58);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(bus);
      noise.start(t);
      noise.stop(t + 0.6);
    }
  }

  public playWin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const melody = [
      { f: 523.25, d: 0.12 },
      { f: 659.25, d: 0.12 },
      { f: 783.99, d: 0.12 },
      { f: 1046.5, d: 0.35 },
      { f: 880.0, d: 0.15 },
      { f: 1046.5, d: 0.55 },
    ];

    let delay = 0;
    melody.forEach((note) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = t + delay;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, st);

      gain.gain.setValueAtTime(0.26, st);
      gain.gain.exponentialRampToValueAtTime(0.01, st + note.d);

      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);

      osc.start(st);
      osc.stop(st + note.d + 0.02);
      delay += note.d * 0.9;
    });
  }

  public playEasterEgg() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = t + idx * 0.055;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);

      gain.gain.setValueAtTime(0.3, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.38);

      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);

      osc.start(st);
      osc.stop(st + 0.39);
    });
  }

  public playGameOver() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [392, 349.2, 329.6, 261.6];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = t + idx * 0.22;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, st);

      gain.gain.setValueAtTime(0.24, st);
      gain.gain.exponentialRampToValueAtTime(0.01, st + 0.3);

      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);

      osc.start(st);
      osc.stop(st + 0.32);
    });
  }

  public setMusicIntensity(intensity: 'menu' | 'combat' | 'boss') {
    this.musicIntensity = intensity;
  }

  /**
   * Layered procedural industrial synth loop generated locally with Web Audio
   * so gameplay adapts between calm menu/sector transitions, combat, and bosses.
   */
  public startMusic(intensity?: 'menu' | 'combat' | 'boss') {
    if (intensity) this.musicIntensity = intensity;
    this.musicRequested = true;
    if (this.isMuted || this.musicPlaying) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.001, now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.36, now + 0.75);
    this.musicGain.connect(this.musicBus ?? this.ctx.destination);
    this.musicStep = 0;
    this.musicPlaying = true;
    this.playMusicStep();
    this.musicInterval = window.setInterval(() => this.playMusicStep(), 240);
  }

  private playMusicStep() {
    if (!this.ctx || !this.musicGain || !this.musicPlaying || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const step = this.musicStep;
    this.musicStep = (this.musicStep + 1) % 16;

    const mode = this.musicIntensity;
    const isBoss = mode === 'boss';
    const isMenu = mode === 'menu';

    // Minor-key warehouse synth bassline; extra octave/syncopation kicks in during combat & boss phases.
    const bassline = isBoss
      ? [55, 55, 110, 55, 65.41, 0, 73.42, 73.42, 49, 49, 98, 49, 58.27, 65.41, 73.42, 82.41]
      : [55, 0, 55, 0, 65.41, 0, 73.42, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
    const bassFrequency = bassline[step];
    if (bassFrequency > 0) {
      const oscillator = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      oscillator.type = isMenu ? 'triangle' : 'sawtooth';
      oscillator.frequency.setValueAtTime(bassFrequency, now);
      filter.type = 'lowpass';
      filter.Q.value = isBoss ? 3.2 : 1.8;
      filter.frequency.setValueAtTime(isBoss ? 520 : isMenu ? 240 : 360, now);
      filter.frequency.exponentialRampToValueAtTime(isMenu ? 120 : 165, now + 0.21);
      envelope.gain.setValueAtTime(isBoss ? 0.14 : 0.11, now);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      oscillator.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.musicGain);
      oscillator.start(now);
      oscillator.stop(now + 0.23);
    }

    // Punchy industrial kick on downbeats (plus boss syncopation on step 14).
    if (step % 4 === 0 || (isBoss && step === 14)) {
      const kick = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(isBoss ? 105 : 88, now);
      kick.frequency.exponentialRampToValueAtTime(36, now + 0.15);
      kickGain.gain.setValueAtTime(isMenu ? 0.11 : isBoss ? 0.22 : 0.17, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      kick.connect(kickGain);
      kickGain.connect(this.musicGain);
      kick.start(now);
      kick.stop(now + 0.17);
    }

    // Crisp filtered hi-hat pulse on off-beats during combat/boss waves.
    if (!isMenu && step % 2 === 1) {
      const noiseBuf = this.getGunshotNoiseBuffer();
      if (noiseBuf) {
        const hat = ctx.createBufferSource();
        hat.buffer = noiseBuf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6800;
        const hatGain = ctx.createGain();
        const accent = step % 4 === 2 || isBoss ? 0.036 : 0.022;
        hatGain.gain.setValueAtTime(accent, now);
        hatGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.045);
        hat.connect(hp);
        hp.connect(hatGain);
        hatGain.connect(this.musicGain);
        hat.start(now);
        hat.stop(now + 0.05);
      }
    }

    // Tight industrial snare on beats 2 & 4 (steps 4 and 12).
    if (!isMenu && (step === 4 || step === 12)) {
      const noiseBuf = this.getGunshotNoiseBuffer();
      if (noiseBuf) {
        const snare = ctx.createBufferSource();
        snare.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1850;
        bp.Q.value = 0.9;
        const snareGain = ctx.createGain();
        snareGain.gain.setValueAtTime(isBoss ? 0.09 : 0.065, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        snare.connect(bp);
        bp.connect(snareGain);
        snareGain.connect(this.musicGain);
        snare.start(now);
        snare.stop(now + 0.12);
      }
    }

    // Distant minor synth arp / chime motif gives harmonic progression without crowding SFX.
    const arpNotes = isBoss
      ? [220, 0, 261.63, 329.63, 0, 392, 329.63, 0, 293.66, 0, 349.23, 440, 0, 493.88, 440, 392]
      : [0, 0, 329.63, 0, 0, 0, 392, 0, 0, 0, 293.66, 0, 0, 0, 440, 0];
    const arpFreq = arpNotes[step];
    if (arpFreq > 0) {
      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = isBoss ? 'triangle' : 'sine';
      chime.frequency.setValueAtTime(arpFreq, now);
      chimeGain.gain.setValueAtTime(isBoss ? 0.052 : 0.04, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + (isBoss ? 0.24 : 0.36));
      chime.connect(chimeGain);
      chimeGain.connect(this.musicGain);
      chime.start(now);
      chime.stop(now + (isBoss ? 0.25 : 0.38));
    }
  }

  public stopMusic(clearPreference = true) {
    if (clearPreference) this.musicRequested = false;
    if (this.musicInterval !== null) {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.musicPlaying = false;
    this.musicStep = 0;

    const gain = this.musicGain;
    this.musicGain = null;
    if (gain && this.ctx) {
      const now = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.035);
      window.setTimeout(() => gain.disconnect(), 240);
    }
  }

  public playPerkPickup() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.045);
      gain.gain.setValueAtTime(0.2, t + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.005, t + i * 0.045 + 0.2);
      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);
      osc.start(t + i * 0.045);
      osc.stop(t + i * 0.045 + 0.22);
    });
  }

  public playShieldBreak() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.25);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  public playDoubleJump() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(780, t + 0.18);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  public playWhistle() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.linearRampToValueAtTime(2600, t + 0.08);
    osc.frequency.linearRampToValueAtTime(2400, t + 0.16);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.18);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playMagnetHum() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** Short original synthesized report for each firearm class; deliberately distinct from melee whooshes. */
  public playFirearmShot(archetype: 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'heavy-rifle' | 'minigun' | 'rocket' | 'flame' | 'plasma' | 'gauss' | 'grenade') {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const profiles = {
      pistol: { wave: 'triangle' as OscillatorType, start: 190, end: 48, duration: 0.085, volume: 0.14, tick: 1320 },
      smg: { wave: 'square' as OscillatorType, start: 255, end: 82, duration: 0.052, volume: 0.085, tick: 1760 },
      rifle: { wave: 'sawtooth' as OscillatorType, start: 145, end: 39, duration: 0.105, volume: 0.13, tick: 1180 },
      shotgun: { wave: 'sawtooth' as OscillatorType, start: 96, end: 26, duration: 0.17, volume: 0.19, tick: 920 },
      'heavy-rifle': { wave: 'square' as OscillatorType, start: 118, end: 32, duration: 0.14, volume: 0.17, tick: 740 },
      minigun: { wave: 'square' as OscillatorType, start: 290, end: 112, duration: 0.045, volume: 0.07, tick: 2040 },
      rocket: { wave: 'sine' as OscillatorType, start: 72, end: 25, duration: 0.25, volume: 0.22, tick: 510 },
      flame: { wave: 'sawtooth' as OscillatorType, start: 390, end: 165, duration: 0.09, volume: 0.065, tick: 0 },
      plasma: { wave: 'sine' as OscillatorType, start: 720, end: 155, duration: 0.15, volume: 0.12, tick: 2140 },
      gauss: { wave: 'sawtooth' as OscillatorType, start: 980, end: 58, duration: 0.19, volume: 0.15, tick: 2480 },
      grenade: { wave: 'sine' as OscillatorType, start: 68, end: 24, duration: 0.22, volume: 0.18, tick: 430 },
    } as const;
    const profile = profiles[archetype];
    const t = this.ctx.currentTime;
    const bus = this.effectsBus ?? this.ctx.destination;
    const pitchJitter = 0.94 + Math.random() * 0.12;

    const body = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    body.type = profile.wave;
    body.frequency.setValueAtTime(profile.start * pitchJitter, t);
    body.frequency.exponentialRampToValueAtTime(Math.max(18, profile.end * pitchJitter), t + profile.duration);
    envelope.gain.setValueAtTime(profile.volume, t);
    envelope.gain.exponentialRampToValueAtTime(0.001, t + profile.duration);
    body.connect(envelope);
    envelope.connect(bus);
    body.start(t);
    body.stop(t + profile.duration + 0.01);

    if (profile.tick > 0) {
      const transient = this.ctx.createOscillator();
      const transientEnvelope = this.ctx.createGain();
      transient.type = 'square';
      transient.frequency.setValueAtTime(profile.tick * (0.96 + Math.random() * 0.08), t);
      transient.frequency.exponentialRampToValueAtTime(Math.max(90, profile.tick * 0.35), t + 0.026);
      transientEnvelope.gain.setValueAtTime(
        archetype === 'rocket' || archetype === 'shotgun' || archetype === 'grenade' ? 0.072 : 0.04,
        t,
      );
      transientEnvelope.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
      transient.connect(transientEnvelope);
      transientEnvelope.connect(bus);
      transient.start(t);
      transient.stop(t + 0.036);
    }

    // Crimsonland-style ballistic transient noise layer: adds gunpowder crack,
    // shotgun blast, flamethrower rush, or gauss discharge tail using one cached buffer.
    const noiseBuffer = this.getGunshotNoiseBuffer();
    if (noiseBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      const noiseGain = this.ctx.createGain();
      const isEnergy = archetype === 'plasma' || archetype === 'gauss';
      const isBlast = archetype === 'shotgun' || archetype === 'rocket' || archetype === 'grenade';
      const isHeavy = archetype === 'heavy-rifle' || archetype === 'rifle';
      filter.type = archetype === 'flame' ? 'bandpass' : isEnergy ? 'highpass' : 'bandpass';
      filter.frequency.setValueAtTime(
        (archetype === 'flame' ? 680
          : isEnergy ? 2250
            : isBlast ? 540
              : isHeavy ? 1180 : 1620) * (0.95 + Math.random() * 0.1),
        t,
      );
      filter.Q.setValueAtTime(archetype === 'flame' ? 0.65 : isEnergy ? 1.8 : 0.85, t);
      const noiseDuration = archetype === 'rocket' || archetype === 'grenade' ? 0.24
        : archetype === 'shotgun' ? 0.17
          : archetype === 'flame' ? 0.125
            : isHeavy || archetype === 'gauss' ? 0.115 : 0.072;
      const noisePeak = archetype === 'shotgun' ? 0.165
        : archetype === 'rocket' || archetype === 'grenade' ? 0.17
          : archetype === 'flame' ? 0.092
            : isHeavy || archetype === 'gauss' ? 0.115
              : archetype === 'minigun' || archetype === 'smg' ? 0.068 : 0.092;
      noiseGain.gain.setValueAtTime(noisePeak, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDuration);
      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(bus);
      noiseSource.start(t);
      noiseSource.stop(t + noiseDuration + 0.01);
    }
  }

  private getGunshotNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.gunshotNoiseBuffer && this.gunshotNoiseBuffer.sampleRate === this.ctx.sampleRate) {
      return this.gunshotNoiseBuffer;
    }
    const sampleRate = this.ctx.sampleRate || 44100;
    const length = Math.max(1024, Math.floor(sampleRate * 0.26));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.gunshotNoiseBuffer = buffer;
    return buffer;
  }

  /** Crisp mechanical chamber click when trying to shoot on an empty/reloading weapon. */
  public playFirearmDryClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bus = this.effectsBus ?? this.ctx.destination;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1640, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.022);
    env.gain.setValueAtTime(0.055, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.026);
    osc.connect(env);
    env.connect(bus);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  /** Per-firearm reload handling: a mechanical rack on start and a crisp chamber-ready cue. */
  public playFirearmReload(archetype: 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'heavy-rifle' | 'minigun' | 'rocket' | 'flame' | 'plasma' | 'gauss' | 'grenade', phase: 'start' | 'complete') {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bus = this.effectsBus ?? this.ctx.destination;
    const heavy = archetype === 'rocket' || archetype === 'grenade' || archetype === 'minigun' || archetype === 'heavy-rifle' || archetype === 'gauss';
    const base = archetype === 'shotgun' ? 115 : heavy ? 82 : archetype === 'plasma' ? 360 : 175;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = phase === 'start' ? (heavy ? 'sawtooth' : 'square') : 'triangle';
    oscillator.frequency.setValueAtTime(phase === 'start' ? base * 2.1 : base * 3.2, t);
    oscillator.frequency.exponentialRampToValueAtTime(phase === 'start' ? base * 0.72 : base * 4.4, t + (phase === 'start' ? 0.16 : 0.085));
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(phase === 'start' ? 0.095 : 0.075, t + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + (phase === 'start' ? 0.18 : 0.11));
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(t);
    oscillator.stop(t + (phase === 'start' ? 0.19 : 0.12));

    if (phase === 'start') {
      const latch = this.ctx.createOscillator();
      const latchGain = this.ctx.createGain();
      latch.type = 'square';
      latch.frequency.setValueAtTime(680 + (heavy ? 120 : 0), t + 0.035);
      latch.frequency.exponentialRampToValueAtTime(250, t + 0.075);
      latchGain.gain.setValueAtTime(0.0001, t + 0.035);
      latchGain.gain.exponentialRampToValueAtTime(0.045, t + 0.04);
      latchGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
      latch.connect(latchGain);
      latchGain.connect(bus);
      latch.start(t + 0.035);
      latch.stop(t + 0.09);
    }
  }

  /** Short, weapon-class-specific impact ticks; avoids stacking the generic melee smack on every bullet. */
  public playFirearmImpact(archetype: 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'heavy-rifle' | 'minigun' | 'rocket' | 'flame' | 'plasma' | 'gauss' | 'grenade') {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const profiles = {
      pistol: [880, 0.045, 0.045], smg: [1180, 0.026, 0.025], rifle: [690, 0.052, 0.04],
      shotgun: [250, 0.095, 0.075], 'heavy-rifle': [420, 0.075, 0.065], minigun: [1420, 0.022, 0.022],
      rocket: [95, 0.18, 0.12], grenade: [108, 0.23, 0.15], flame: [520, 0.065, 0.035], plasma: [1540, 0.12, 0.055], gauss: [2100, 0.09, 0.07],
    } as const;
    const [frequency, duration, volume] = profiles[archetype];
    const t = this.ctx.currentTime;
    const minimumGap = archetype === 'shotgun' || archetype === 'rocket' || archetype === 'grenade' || archetype === 'gauss' ? 0.065 : 0.028;
    if (t - (this.lastFirearmImpactAt[archetype] ?? -Infinity) < minimumGap) return;
    this.lastFirearmImpactAt[archetype] = t;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = archetype === 'rocket' || archetype === 'grenade' || archetype === 'shotgun' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.42), t + duration);
    envelope.gain.setValueAtTime(volume, t);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(envelope);
    envelope.connect(this.effectsBus ?? this.ctx.destination);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.01);
  }

  public playAttackWhoosh() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Several weapons can fire in the same frame; avoid a harsh stack of identical whooshes.
    if (t - this.lastAttackWhooshAt < 0.13) return;
    this.lastAttackWhooshAt = t;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.14);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playSmack() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.16);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  public playSciskCrush() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Heavy bicep crush impact (punch + shockwave)
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(300, t);
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.35);
    subGain.gain.setValueAtTime(0.6, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    sub.connect(subGain);
    subGain.connect(this.effectsBus ?? this.ctx.destination);
    sub.start(t);
    sub.stop(t + 0.37);

    // Crackle & crunch
    const noiseOsc = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();
    noiseOsc.type = 'square';
    noiseOsc.frequency.setValueAtTime(450, t);
    noiseOsc.frequency.exponentialRampToValueAtTime(80, t + 0.2);
    noiseGain.gain.setValueAtTime(0.35, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    noiseOsc.connect(noiseGain);
    noiseGain.connect(this.effectsBus ?? this.ctx.destination);
    noiseOsc.start(t);
    noiseOsc.stop(t + 0.22);
  }

  public playMolotovThrow() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // 1. Burning wick sizzle
    const sizzle = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    sizzle.type = 'sawtooth';
    sizzle.frequency.setValueAtTime(800, t);
    sizzle.frequency.linearRampToValueAtTime(1400, t + 0.25);
    sGain.gain.setValueAtTime(0.18, t);
    sGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    sizzle.connect(sGain);
    sGain.connect(this.effectsBus ?? this.ctx.destination);
    sizzle.start(t);
    sizzle.stop(t + 0.26);

    // 2. High arc air whoosh
    const whoosh = this.ctx.createOscillator();
    const wGain = this.ctx.createGain();
    whoosh.type = 'triangle';
    whoosh.frequency.setValueAtTime(140, t);
    whoosh.frequency.exponentialRampToValueAtTime(380, t + 0.15);
    whoosh.frequency.exponentialRampToValueAtTime(90, t + 0.35);
    wGain.gain.setValueAtTime(0.3, t);
    wGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    whoosh.connect(wGain);
    wGain.connect(this.effectsBus ?? this.ctx.destination);
    whoosh.start(t);
    whoosh.stop(t + 0.36);
  }

  public playGlassShatter() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Heavy impact thud
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(200, t);
    thud.frequency.exponentialRampToValueAtTime(38, t + 0.28);
    thudGain.gain.setValueAtTime(0.5, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    thud.connect(thudGain);
    thudGain.connect(this.effectsBus ?? this.ctx.destination);
    thud.start(t);
    thud.stop(t + 0.3);

    // Glass shards tinkling / fracturing
    const glassPitches = [1900, 2600, 3400, 4200, 1400];
    glassPitches.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.02);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + idx * 0.02 + 0.15);
      gain.gain.setValueAtTime(0.2, t + idx * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.02 + 0.16);
      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);
      osc.start(t + idx * 0.02);
      osc.stop(t + idx * 0.02 + 0.17);
    });
  }

  public playFireCrackle() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Fire explosion whoosh / roar
    const roar = this.ctx.createOscillator();
    const roarGain = this.ctx.createGain();
    roar.type = 'sawtooth';
    roar.frequency.setValueAtTime(80, t);
    roar.frequency.linearRampToValueAtTime(180, t + 0.15);
    roar.frequency.exponentialRampToValueAtTime(45, t + 0.55);
    roarGain.gain.setValueAtTime(0.4, t);
    roarGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    roar.connect(roarGain);
    roarGain.connect(this.effectsBus ?? this.ctx.destination);
    roar.start(t);
    roar.stop(t + 0.56);

    // Sizzling flame bursts
    [0.05, 0.15, 0.28].forEach((offset) => {
      const pop = this.ctx!.createOscillator();
      const popGain = this.ctx!.createGain();
      pop.type = 'square';
      pop.frequency.setValueAtTime(400 + Math.random() * 300, t + offset);
      popGain.gain.setValueAtTime(0.18, t + offset);
      popGain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.08);
      pop.connect(popGain);
      popGain.connect(this.effectsBus ?? this.ctx!.destination);
      pop.start(t + offset);
      pop.stop(t + offset + 0.09);
    });
  }

  public playCinematicBoom() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.8);

    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.86);
  }

  public playSirens() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.25);
    osc.frequency.linearRampToValueAtTime(440, t + 0.5);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.52);

    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.53);
  }

  public playBossWarning() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Two descending industrial alarm pulses followed by a restrained low impact.
    [0, 0.34].forEach((offset, index) => {
      const alarm = this.ctx!.createOscillator();
      const envelope = this.ctx!.createGain();
      alarm.type = 'sawtooth';
      alarm.frequency.setValueAtTime(index === 0 ? 620 : 520, t + offset);
      alarm.frequency.linearRampToValueAtTime(index === 0 ? 420 : 350, t + offset + 0.28);
      envelope.gain.setValueAtTime(0.13, t + offset);
      envelope.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.3);
      alarm.connect(envelope);
      envelope.connect(this.effectsBus ?? this.ctx!.destination);
      alarm.start(t + offset);
      alarm.stop(t + offset + 0.31);
    });

    const impact = this.ctx.createOscillator();
    const impactGain = this.ctx.createGain();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(76, t + 0.68);
    impact.frequency.exponentialRampToValueAtTime(34, t + 0.95);
    impactGain.gain.setValueAtTime(0.2, t + 0.68);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.97);
    impact.connect(impactGain);
    impactGain.connect(this.effectsBus ?? this.ctx.destination);
    impact.start(t + 0.68);
    impact.stop(t + 0.98);
  }

  public playEvilLaugh() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    [180, 150, 130, 110, 90].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = t + idx * 0.12;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, st);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.8, st + 0.1);

      gain.gain.setValueAtTime(0.3, st);
      gain.gain.exponentialRampToValueAtTime(0.01, st + 0.11);

      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);

      osc.start(st);
      osc.stop(st + 0.12);
    });
  }

  public playPomazaniecEntrance() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [659.25, 783.99, 987.77, 783.99, 1174.66];
    notes.forEach((frequency, index) => {
      const start = now + index * 0.095;
      const osc = this.ctx!.createOscillator();
      const overtone = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      overtone.type = 'sine';
      osc.frequency.setValueAtTime(frequency, start);
      overtone.frequency.setValueAtTime(frequency * 2.01, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(index === 4 ? 0.14 : 0.095, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain);
      overtone.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);
      osc.start(start);
      overtone.start(start);
      osc.stop(start + 0.23);
      overtone.stop(start + 0.18);
    });
  }

  /** Soft, slightly squeaky air-swish used by the tiny riders' lollipop throws. */
  public playLollipopThrow() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const start = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, start);
    osc.frequency.exponentialRampToValueAtTime(250, start + 0.16);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.065, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(start);
    osc.stop(start + 0.19);
  }

  /** Bright candy-like ping for a lollipop hit or a Pomazaniec defeated. */
  public playLollipopHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const start = this.ctx.currentTime;
    [880, 1174.66].forEach((frequency, index) => {
      const at = start + index * 0.045;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.11 : 0.075, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);
      osc.start(at);
      osc.stop(at + 0.18);
    });
  }

  /** A tiny celebratory jingle when the five-bike raid is cleared. */
  public playPomazaniecVictory() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const start = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const at = start + index * 0.075;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.085, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);
      osc.start(at);
      osc.stop(at + 0.29);
    });
  }

  public playAlert() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.1);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  public playUiHover() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastUiHoverAt < 0.09) return;
    this.lastUiHoverAt = t;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, t);
    osc.frequency.exponentialRampToValueAtTime(980, t + 0.028);
    gain.gain.setValueAtTime(0.025, t);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.03);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.035);
  }

  public playUiTabSwitch() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bus = this.effectsBus ?? this.ctx.destination;
    [540, 810].forEach((freq, idx) => {
      const at = t + idx * 0.028;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, at);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, at + 0.045);
      gain.gain.setValueAtTime(idx === 0 ? 0.06 : 0.045, at);
      gain.gain.exponentialRampToValueAtTime(0.0005, at + 0.055);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(at);
      osc.stop(at + 0.06);
    });
  }

  public playUiSelect() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bus = this.effectsBus ?? this.ctx.destination;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(930, t + 0.055);
    gain.gain.setValueAtTime(0.075, t);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.065);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  public playUiConfirm() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bus = this.effectsBus ?? this.ctx.destination;
    [523.25, 783.99].forEach((freq, idx) => {
      const at = t + idx * 0.045;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(0.095, at);
      gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.13);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(at);
      osc.stop(at + 0.14);
    });
  }

  public playUiBack() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(290, t + 0.08);
    gain.gain.setValueAtTime(0.075, t);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.095);
  }

  public playDash() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastDashAt < 0.09) return;
    this.lastDashAt = t;
    const bus = this.effectsBus ?? this.ctx.destination;

    const thump = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(190, t);
    thump.frequency.exponentialRampToValueAtTime(58, t + 0.13);
    thumpGain.gain.setValueAtTime(0.18, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.14);
    thump.connect(thumpGain);
    thumpGain.connect(bus);
    thump.start(t);
    thump.stop(t + 0.15);

    const buffer = this.getGunshotNoiseBuffer();
    if (buffer) {
      const air = this.ctx.createBufferSource();
      air.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.6;
      filter.frequency.setValueAtTime(520, t);
      filter.frequency.exponentialRampToValueAtTime(1950, t + 0.09);
      filter.frequency.exponentialRampToValueAtTime(680, t + 0.17);
      const airGain = this.ctx.createGain();
      airGain.gain.setValueAtTime(0.15, t);
      airGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      air.connect(filter);
      filter.connect(airGain);
      airGain.connect(bus);
      air.start(t);
      air.stop(t + 0.19);
    }
  }

  public playXpPickup(streakTier = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastXpPickupAt < 0.045) return;
    this.lastXpPickupAt = t;
    const bus = this.effectsBus ?? this.ctx.destination;
    const pitchScale = Math.min(1.55, 1 + Math.max(0, streakTier - 1) * 0.085);
    const osc = this.ctx.createOscillator();
    const shimmer = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    shimmer.type = 'triangle';
    osc.frequency.setValueAtTime(660 * pitchScale, t);
    osc.frequency.exponentialRampToValueAtTime(990 * pitchScale, t + 0.09);
    shimmer.frequency.setValueAtTime(1320 * pitchScale, t);
    gain.gain.setValueAtTime(0.095, t);
    gain.gain.exponentialRampToValueAtTime(0.0006, t + 0.13);
    osc.connect(gain);
    shimmer.connect(gain);
    gain.connect(bus);
    osc.start(t);
    shimmer.start(t);
    osc.stop(t + 0.14);
    shimmer.stop(t + 0.11);
  }

  public playEnemyDeath(isHeavy = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastEnemyDeathAt < (isHeavy ? 0.04 : 0.065)) return;
    this.lastEnemyDeathAt = t;
    const bus = this.effectsBus ?? this.ctx.destination;

    const punch = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    punch.type = isHeavy ? 'sawtooth' : 'triangle';
    punch.frequency.setValueAtTime(isHeavy ? 145 : 185, t);
    punch.frequency.exponentialRampToValueAtTime(isHeavy ? 36 : 54, t + (isHeavy ? 0.22 : 0.11));
    gain.gain.setValueAtTime(isHeavy ? 0.19 : 0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + (isHeavy ? 0.23 : 0.12));
    punch.connect(gain);
    gain.connect(bus);
    punch.start(t);
    punch.stop(t + (isHeavy ? 0.24 : 0.13));

    const noiseBuf = this.getGunshotNoiseBuffer();
    if (noiseBuf) {
      const puff = this.ctx.createBufferSource();
      puff.buffer = noiseBuf;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = isHeavy ? 950 : 1200;
      const puffGain = this.ctx.createGain();
      puffGain.gain.setValueAtTime(isHeavy ? 0.12 : 0.065, t);
      puffGain.gain.exponentialRampToValueAtTime(0.0008, t + (isHeavy ? 0.14 : 0.08));
      puff.connect(lp);
      lp.connect(puffGain);
      puffGain.connect(bus);
      puff.start(t);
      puff.stop(t + (isHeavy ? 0.15 : 0.09));
    }
  }

  public playCritPing() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastCritPingAt < 0.08) return;
    this.lastCritPingAt = t;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1480, t);
    osc.frequency.exponentialRampToValueAtTime(2220, t + 0.055);
    gain.gain.setValueAtTime(0.065, t);
    gain.gain.exponentialRampToValueAtTime(0.0006, t + 0.09);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.095);
  }

  public playLevelUpFanfare(context: 'levelup' | 'rank-up' | 'boss-reward' | 'chaos-roulette' = 'levelup') {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bus = this.effectsBus ?? this.ctx.destination;
    const chord =
      context === 'boss-reward'
        ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
        : context === 'rank-up'
          ? [440, 554.37, 659.25, 880, 1108.73]
          : context === 'chaos-roulette'
            ? [493.88, 622.25, 739.99, 987.77]
            : [440, 554.37, 659.25, 880];
    chord.forEach((freq, idx) => {
      const at = t + idx * 0.055;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = idx === chord.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(idx === chord.length - 1 ? 0.14 : 0.1, at);
      gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.34);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(at);
      osc.stop(at + 0.36);
    });
  }
}

export const sound = new SoundEngine();


