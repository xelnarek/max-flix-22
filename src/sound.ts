/**
 * Advanced Web Audio procedural sound synthesizer for Max-Fliz 3D.
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
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private lastAttackWhooshAt = -Infinity;
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
    if (!this.masterBus) {
      this.masterBus = this.ctx.createGain();
      this.masterBus.connect(this.ctx.destination);
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

  public playCoffeePowerup() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Ascending arpeggio + cheerful fanfare
    [392, 523, 659, 784, 1046].forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = t + i * 0.05;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, st);
      gain.gain.setValueAtTime(0.2, st);
      gain.gain.exponentialRampToValueAtTime(0.01, st + 0.15);
      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);
      osc.start(st);
      osc.stop(st + 0.16);
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
      this.playMolotovThrow();
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
  public playCatPounce() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const start = this.ctx.currentTime;
    const paw = this.ctx.createOscillator();
    const pawGain = this.ctx.createGain();
    paw.type = 'sine';
    paw.frequency.setValueAtTime(190, start);
    paw.frequency.exponentialRampToValueAtTime(72, start + 0.10);
    pawGain.gain.setValueAtTime(0.0001, start);
    pawGain.gain.exponentialRampToValueAtTime(0.12, start + 0.008);
    pawGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
    paw.connect(pawGain);
    pawGain.connect(this.effectsBus ?? this.ctx.destination);
    paw.start(start);
    paw.stop(start + 0.14);

    const meow = this.ctx.createOscillator();
    const meowGain = this.ctx.createGain();
    meow.type = 'triangle';
    meow.frequency.setValueAtTime(680 + Math.random() * 150, start + 0.035);
    meow.frequency.exponentialRampToValueAtTime(1040 + Math.random() * 120, start + 0.12);
    meow.frequency.exponentialRampToValueAtTime(520, start + 0.24);
    meowGain.gain.setValueAtTime(0.0001, start + 0.035);
    meowGain.gain.exponentialRampToValueAtTime(0.075, start + 0.06);
    meowGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    meow.connect(meowGain);
    meowGain.connect(this.effectsBus ?? this.ctx.destination);
    meow.start(start + 0.035);
    meow.stop(start + 0.26);
  }

  public playHonk() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    [329.6, 415.3].forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.26);
      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

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

  public playExplosion() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.6);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.62);

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    noise.connect(noiseGain);
    noiseGain.connect(this.effectsBus ?? this.ctx.destination);
    noise.start(t);
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

  /**
   * A quiet, original industrial synth loop. It is generated locally with Web Audio,
   * so the game needs no downloaded music assets and works offline.
   */
  public startMusic() {
    this.musicRequested = true;
    if (this.isMuted || this.musicPlaying) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.001, now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.34, now + 0.8);
    this.musicGain.connect(this.musicBus ?? this.ctx.destination);
    this.musicStep = 0;
    this.musicPlaying = true;
    this.playMusicStep();
    this.musicInterval = window.setInterval(() => this.playMusicStep(), 310);
  }

  private playMusicStep() {
    if (!this.ctx || !this.musicGain || !this.musicPlaying || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const step = this.musicStep;
    this.musicStep = (this.musicStep + 1) % 16;

    // Slow minor-key bass motif with restrained metallic accents.
    const bassline = [55, 0, 55, 0, 65.41, 0, 73.42, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
    const bassFrequency = bassline[step];
    if (bassFrequency > 0) {
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(bassFrequency, now);
      envelope.gain.setValueAtTime(0.12, now);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      oscillator.connect(envelope);
      envelope.connect(this.musicGain);
      oscillator.start(now);
      oscillator.stop(now + 0.27);
    }

    // Soft industrial kick on each second beat; deliberately low in the mix.
    if (step % 4 === 0) {
      const kick = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(82, now);
      kick.frequency.exponentialRampToValueAtTime(38, now + 0.16);
      kickGain.gain.setValueAtTime(0.16, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      kick.connect(kickGain);
      kickGain.connect(this.musicGain);
      kick.start(now);
      kick.stop(now + 0.18);
    }

    // A short, distant metal chime gives the loop progression without crowding SFX.
    if (step === 6 || step === 14) {
      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(step === 6 ? 392 : 440, now);
      chimeGain.gain.setValueAtTime(0.045, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      chime.connect(chimeGain);
      chimeGain.connect(this.musicGain);
      chime.start(now);
      chime.stop(now + 0.44);
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

  public playReclamation() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Executive stamp drop (low frequency rumble + heavy impact)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.4);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(this.effectsBus ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.42);

    // Metallic seal resonance
    const metallic = this.ctx.createOscillator();
    const mGain = this.ctx.createGain();
    metallic.type = 'triangle';
    metallic.frequency.setValueAtTime(1470, t + 0.05);
    metallic.frequency.exponentialRampToValueAtTime(735, t + 0.45);
    mGain.gain.setValueAtTime(0.3, t + 0.05);
    mGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    metallic.connect(mGain);
    mGain.connect(this.effectsBus ?? this.ctx.destination);
    metallic.start(t + 0.05);
    metallic.stop(t + 0.47);
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

  public playGlassBreak() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    this.playGlassShatter();
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

  public playApplause() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Victory fanfare + clapping taps
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = t + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);

      gain.gain.setValueAtTime(0.28, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.4);

      osc.connect(gain);
      gain.connect(this.effectsBus ?? this.ctx!.destination);

      osc.start(st);
      osc.stop(st + 0.42);
    });
  }

  /** A short, playful bicycle-bell/chiptune sting for the once-per-run secret encounter. */
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
}

export const sound = new SoundEngine();


