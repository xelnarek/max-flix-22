import { sound } from './sound.ts';

export interface CinematicIntroCallbacks {
  onComplete: () => void;
  onStartGame?: () => void;
}

/**
 * A lightweight, current-generation opening sequence. All artwork is procedural
 * Canvas 2D so it stays sharp on phones without downloading a video or large
 * image bundle.
 */
export class CinematicIntroManager {
  private readonly callbacks: CinematicIntroCallbacks;
  private overlay: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private progress: HTMLElement | null = null;
  private timeLabel: HTMLElement | null = null;
  private sceneLabel: HTMLElement | null = null;
  private rafId: number | null = null;
  private active = false;
  private startedAt = 0;
  private lastFrameAt = 0;
  private lastRenderAt = 0;
  private elapsed = 0;
  private readonly duration = 13.5;
  private frameInterval = 1000 / 30;
  private reducedMotion = false;
  private readonly onResize = () => this.resizeCanvas();
  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.active) {
      event.preventDefault();
      this.stop();
    }
  };

  constructor(callbacks: CinematicIntroCallbacks) {
    this.callbacks = callbacks;
  }

  public isRunning(): boolean {
    return this.active;
  }

  public start(): void {
    if (this.active) return;
    this.cleanup();
    this.active = true;
    this.elapsed = 0;
    this.startedAt = performance.now();
    this.lastFrameAt = this.startedAt;
    this.lastRenderAt = this.startedAt;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const mobile = window.innerWidth < 760 || navigator.maxTouchPoints > 0;
    this.frameInterval = mobile ? 1000 / 30 : 1000 / 45;
    this.mount();
    if (!this.ctx || !this.canvas) {
      this.active = false;
      this.cleanup();
      this.callbacks.onComplete();
      return;
    }
    try { sound.playCinematicBoom(); } catch { /* Audio is optional; the intro must still play. */ }
    this.render(0);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Return to the title screen by default. A gameplay launch can suppress that
   * transition when replacing the intro with an already-starting run.
   */
  public stop(startGame = false, returnToMenu = true): void {
    if (!this.active) return;
    this.active = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
    this.cleanup();
    if (startGame) this.callbacks.onStartGame?.();
    else if (returnToMenu) this.callbacks.onComplete();
  }

  private mount(): void {
    const overlay = document.createElement('section');
    overlay.id = 'cinematic-intro-overlay';
    overlay.className = 'cinematic-intro-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Cinematic opening — Max-Flix: Granica Absurdu');
    overlay.innerHTML = `
      <canvas class="cinematic-intro-canvas" aria-hidden="true"></canvas>
      <div class="cinematic-intro-vignette" aria-hidden="true"></div>
      <div class="cinematic-intro-top">
        <div class="cinematic-intro-brand"><span class="cinematic-live-dot"></span> MAX-FLIX <span>•</span> OPERACJA B4</div>
        <div class="cinematic-intro-status"><span id="cinematic-intro-scene">SYSTEM ONLINE</span><span id="cinematic-intro-time">00:00</span></div>
        <button id="cinematic-intro-skip" class="cinematic-intro-skip" type="button">POMIŃ INTRO <span aria-hidden="true">↗</span></button>
      </div>
      <div class="cinematic-intro-copy">
        <div class="cinematic-intro-kicker">MAGAZYN SHOWDOWN • 2026</div>
        <h1>MAX-FLIX</h1>
        <div class="cinematic-intro-subtitle">GRANICA <span>ABSURDU</span></div>
        <p>Jedna hala. Pięciu operatorów. Dostawa, której nikt nie zamierza oddać bez walki.</p>
        <div class="cinematic-intro-tags"><span>KAMPANIA • MEGA-MAPA</span><span>SURVIVAL SHIFT</span><span>BOSSOWIE • EWOLUCJE</span></div>
      </div>
      <div class="cinematic-intro-bottom">
        <div class="cinematic-intro-progress"><span id="cinematic-intro-progress"></span></div>
        <div class="cinematic-intro-bottom-row">
          <span>SEKTOR B4 <b> / </b> STATUS: ZAGROŻENIE</span>
          <button id="cinematic-intro-play" type="button">WEJDŹ NA ZMIANĘ <span aria-hidden="true">→</span></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.canvas = overlay.querySelector<HTMLCanvasElement>('.cinematic-intro-canvas');
    this.ctx = this.canvas?.getContext('2d', { alpha: false }) ?? null;
    this.progress = overlay.querySelector<HTMLElement>('#cinematic-intro-progress');
    this.timeLabel = overlay.querySelector<HTMLElement>('#cinematic-intro-time');
    this.sceneLabel = overlay.querySelector<HTMLElement>('#cinematic-intro-scene');

    this.resizeCanvas();
    overlay.querySelector('#cinematic-intro-skip')?.addEventListener('click', () => this.stop());
    overlay.querySelector('#cinematic-intro-play')?.addEventListener('click', () => this.stop(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.stop();
    });
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    const ratio = Math.max(0.32, Math.min(2.4, window.innerWidth / Math.max(1, window.innerHeight)));
    const longEdge = Math.min(1600, Math.max(720, Math.round(Math.max(window.innerWidth, window.innerHeight) * dpr)));
    if (ratio >= 1) {
      this.canvas.width = longEdge;
      this.canvas.height = Math.max(540, Math.round(longEdge / ratio));
    } else {
      this.canvas.height = longEdge;
      this.canvas.width = Math.max(420, Math.round(longEdge * ratio));
    }
  }

  private cleanup(): void {
    if (this.overlay?.parentElement) this.overlay.remove();
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.progress = null;
    this.timeLabel = null;
    this.sceneLabel = null;
  }

  private loop = (now: number): void => {
    if (!this.active) return;
    const dt = Math.min(0.08, Math.max(0, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;
    this.elapsed = this.reducedMotion
      ? Math.min(this.duration, this.elapsed + dt * 2.4)
      : Math.min(this.duration, (now - this.startedAt) / 1000);
    if (now - this.lastRenderAt >= this.frameInterval || this.reducedMotion) {
      this.render(this.elapsed);
      this.lastRenderAt = now;
    }
    if (this.elapsed >= this.duration) {
      this.stop();
      return;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private render(seconds: number): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const p = Math.max(0, Math.min(1, seconds / this.duration));
    const threat = Math.max(0, 1 - Math.abs(seconds - 5.2) / 2.1);
    const reveal = Math.max(0, Math.min(1, (seconds - 7.0) / 2.5));
    const titleIn = Math.max(0, Math.min(1, (seconds - 9.2) / 1.8));

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#071322');
    bg.addColorStop(0.55, '#101c2b');
    bg.addColorStop(1, '#050a12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.62);
    glow.addColorStop(0, 'rgba(31,121,153,0.28)');
    glow.addColorStop(0.48, 'rgba(18,48,72,0.16)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // A slow cinematic push-in gives the warehouse depth without a video asset.
    const dolly = 1 + Math.min(0.045, seconds * 0.0032);
    const forkliftFadeIn = Math.max(0, Math.min(1, (seconds - 1.25) / 0.85));
    const forkliftFadeOut = 1 - Math.max(0, Math.min(1, (seconds - 7.4) / 1.1));
    const forkliftAmount = forkliftFadeIn * forkliftFadeOut;
    ctx.save();
    ctx.translate((w - w * dolly) * 0.5, (h - h * dolly) * 0.5);
    ctx.scale(dolly, dolly);
    this.drawWarehouse(ctx, w, h, seconds);
    this.drawPalletStacks(ctx, w, h, seconds);
    this.drawAtmosphere(ctx, w, h, seconds);
    this.drawForklift(ctx, w, h, seconds, forkliftAmount);
    this.drawThreat(ctx, w, h, threat, seconds);
    this.drawOperators(ctx, w, h, reveal, seconds);
    if (titleIn > 0) this.drawTitleLight(ctx, w, h, titleIn, seconds);
    ctx.restore();

    const phase = seconds < 3.5 ? 'approach'
      : seconds < 6.8 ? 'alert'
      : seconds < 9.5 ? 'team'
      : 'title';
    if (this.overlay && this.overlay.dataset.phase !== phase) this.overlay.dataset.phase = phase;
    this.overlay?.classList.toggle('is-alert', phase === 'alert');
    this.overlay?.classList.toggle('is-team-reveal', phase === 'team');
    this.overlay?.classList.toggle('is-title-reveal', titleIn > 0.04);

    if (this.progress) this.progress.style.width = `${p * 100}%`;
    if (this.timeLabel) {
      const current = Math.floor(seconds);
      this.timeLabel.textContent = `00:${String(current).padStart(2, '0')}`;
    }
    if (this.sceneLabel) {
      this.sceneLabel.textContent = seconds < 3.5 ? 'OBIEKT: CENTRUM LOGISTYCZNE'
        : seconds < 6.8 ? 'ALERT: SABOTAŻ DOSTAWY'
        : seconds < 9.5 ? 'OPERATORZY: GOTOWI'
        : 'PROTOKÓŁ: GRANICA ABSURDU';
    }
  }

  private drawWarehouse(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const horizon = h * 0.49;
    ctx.save();

    // Loading dock, roof trusses and inspection lights establish a real warehouse silhouette.
    const dockGradient = ctx.createLinearGradient(w * 0.34, horizon * 0.08, w * 0.66, horizon);
    dockGradient.addColorStop(0, 'rgba(40,83,105,0.22)');
    dockGradient.addColorStop(0.5, 'rgba(9,24,36,0.78)');
    dockGradient.addColorStop(1, 'rgba(40,83,105,0.22)');
    ctx.fillStyle = dockGradient;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, horizon * 0.18);
    ctx.lineTo(w * 0.65, horizon * 0.18);
    ctx.lineTo(w * 0.68, horizon * 0.96);
    ctx.lineTo(w * 0.32, horizon * 0.96);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(153,190,207,0.28)';
    ctx.lineWidth = Math.max(1.2, w / 950);
    ctx.stroke();

    for (let beam = 0; beam < 7; beam++) {
      const bx = w * (0.08 + beam * 0.14);
      const by = h * (0.06 + Math.abs(beam - 3) * 0.026);
      ctx.strokeStyle = 'rgba(144,181,198,0.16)';
      ctx.lineWidth = Math.max(1, w / 1500);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(w * 0.5 + (bx - w * 0.5) * 0.48, horizon * 0.52);
      ctx.stroke();
    }

    for (let light = 0; light < 5; light++) {
      const lx = w * (0.18 + light * 0.16);
      const pulse = 0.55 + Math.sin(t * 2.6 + light) * 0.12;
      ctx.fillStyle = `rgba(245,190,104,${pulse * 0.7})`;
      ctx.beginPath();
      ctx.ellipse(lx, h * 0.12, w * 0.013, h * 0.004, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(245,190,104,${pulse * 0.06})`;
      ctx.beginPath();
      ctx.moveTo(lx - w * 0.015, h * 0.12);
      ctx.lineTo(lx + w * 0.015, h * 0.12);
      ctx.lineTo(lx + w * 0.08, horizon);
      ctx.lineTo(lx - w * 0.08, horizon);
      ctx.closePath();
      ctx.fill();
    }

    ctx.lineWidth = Math.max(1, w / 1100);
    for (let side of [-1, 1]) {
      const xEdge = side < 0 ? w * 0.03 : w * 0.97;
      const xInner = side < 0 ? w * 0.31 : w * 0.69;
      ctx.strokeStyle = 'rgba(117,164,190,0.24)';
      ctx.fillStyle = 'rgba(29,62,82,0.22)';
      ctx.beginPath();
      ctx.moveTo(xEdge, horizon * 0.7);
      ctx.lineTo(xInner, horizon);
      ctx.lineTo(xInner, h * 0.92);
      ctx.lineTo(xEdge, h * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let level = 0; level < 5; level++) {
        const y = horizon * (0.72 + level * 0.13);
        const inset = (xInner - xEdge) * (0.2 + level * 0.12);
        ctx.strokeStyle = level === 0 ? 'rgba(245,158,11,0.36)' : 'rgba(113,159,185,0.3)';
        ctx.beginPath();
        ctx.moveTo(xEdge + inset * (side < 0 ? 1 : -1), y);
        ctx.lineTo(xInner, y + level * h * 0.025);
        ctx.stroke();
      }
      for (let bay = 0; bay < 5; bay++) {
        const x = xEdge + (xInner - xEdge) * (0.18 + bay * 0.16);
        const top = horizon * (0.72 + bay * 0.025);
        ctx.strokeStyle = 'rgba(174,199,211,0.24)';
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, h * (0.78 + bay * 0.018));
        ctx.stroke();
        if (bay % 2 === 0) {
          ctx.fillStyle = 'rgba(177,124,67,0.28)';
          ctx.fillRect(x - w * 0.018, top + h * 0.045, w * 0.035, h * 0.06);
        }
      }
    }
    ctx.strokeStyle = 'rgba(93,154,184,0.17)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 15; i++) {
      const v = i / 15;
      const y = horizon + (h - horizon) * v * v;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - w * 0.5 * v, y);
      ctx.lineTo(w * 0.5 + w * 0.5 * v, y);
      ctx.stroke();
    }
    for (let i = -8; i <= 8; i++) {
      const offset = i / 8;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + offset * w * 0.07, horizon);
      ctx.lineTo(w * 0.5 + offset * w * 0.72, h);
      ctx.stroke();
    }

    const beamX = w * (0.2 + 0.6 * ((Math.sin(t * 0.5) + 1) / 2));
    const beam = ctx.createLinearGradient(beamX - w * 0.08, 0, beamX + w * 0.08, h * 0.72);
    beam.addColorStop(0, 'rgba(56,189,248,0)');
    beam.addColorStop(0.5, 'rgba(56,189,248,0.09)');
    beam.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, w, h * 0.8);
    ctx.restore();
  }

  private drawThreat(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, t: number): void {
    if (amount <= 0) return;
    ctx.save();
    const alpha = amount * 0.75;
    const y = h * (0.48 + Math.sin(t * 4) * 0.025);
    ctx.fillStyle = `rgba(239,68,68,${alpha * 0.12})`;
    ctx.fillRect(0, y - h * 0.1, w, h * 0.2);
    ctx.strokeStyle = `rgba(248,113,113,${alpha})`;
    ctx.lineWidth = Math.max(2, w / 420);
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = w * 0.018;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, y);
    ctx.lineTo(w * 0.88, y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(239,68,68,${alpha})`;
    for (let i = 0; i < 7; i++) {
      const x = w * (0.17 + i * 0.11);
      ctx.beginPath();
      ctx.arc(x, y, w * (0.003 + (i % 2) * 0.002), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawOperators(ctx: CanvasRenderingContext2D, w: number, h: number, reveal: number, t: number): void {
    if (reveal <= 0) return;
    const colors = ['#f59e0b', '#d6a84f', '#38bdf8', '#a78bfa', '#fb7185'];
    const symbols = ['WZ', '44', 'XL', '⚡', 'B4'];
    const labels = ['DOWODZENIE', 'SIŁA', 'WIELKI FORMAT', 'IMPULS', 'PRECYZJA'];
    const gap = w * 0.115;
    for (let i = 0; i < 5; i++) {
      const x = w * 0.5 + (i - 2) * gap;
      const rise = (1 - reveal) * h * 0.24;
      const y = h * 0.63 + rise + Math.sin(t * 2 + i) * h * 0.007;
      const r = w * 0.027;
      ctx.save();
      ctx.globalAlpha = reveal;
      ctx.shadowColor = colors[i];
      ctx.shadowBlur = r * 0.8;
      ctx.fillStyle = 'rgba(9,21,34,0.9)';
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = Math.max(2, w / 700);
      ctx.beginPath();
      ctx.roundRect(x - r * 1.1, y - r * 1.25, r * 2.2, r * 2.8, r * 0.35);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = colors[i];
      ctx.font = `900 ${Math.round(r * 0.72)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(symbols[i], x, y + r * 0.15);
      ctx.fillStyle = '#dce7ef';
      ctx.font = `800 ${Math.max(8, Math.round(w * 0.009))}px system-ui, sans-serif`;
      ctx.fillText(labels[i], x, y + r * 2.1);
      ctx.restore();
    }
  }

  private drawPalletStacks(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    ctx.save();
    const drawStack = (x: number, y: number, scale: number, tone: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 102, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#76502e';
      ctx.fillRect(-88, -5, 176, 12);
      ctx.fillStyle = '#c28b4c';
      for (let slat = 0; slat < 5; slat++) ctx.fillRect(-80 + slat * 40, -4, 27, 10);
      ctx.fillStyle = '#4b3525';
      ctx.fillRect(-88, 7, 176, 8);

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const bx = -78 + col * 79 + row * 5;
          const by = -60 + row * 29;
          const bw = 72;
          const bh = 27;
          const gradient = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
          gradient.addColorStop(0, tone === 0 ? '#bd8750' : '#6e8793');
          gradient.addColorStop(1, tone === 0 ? '#765034' : '#344e60');
          ctx.fillStyle = gradient;
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeStyle = 'rgba(240,224,197,0.35)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
          ctx.fillStyle = 'rgba(235,240,241,0.68)';
          ctx.fillRect(bx + 12, by + 8, 18, 8);
          ctx.fillStyle = 'rgba(24,34,42,0.55)';
          ctx.fillRect(bx + 34, by + 9, 27, 5);
        }
      }
      ctx.restore();
    };

    drawStack(w * 0.075, h * 0.87, Math.max(0.55, Math.min(1.0, w / 900)), 0);
    drawStack(w * 0.91, h * 0.89, Math.max(0.48, Math.min(0.88, w / 1050)), 1);
    ctx.restore();
  }

  private drawForklift(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, amount: number): void {
    if (amount <= 0.01) return;
    const travel = Math.max(0, Math.min(1, (t - 1.25) / 6.1));
    const x = w * (-0.24 + travel * 0.66);
    const y = h * 0.79 + Math.sin(t * 2.5) * h * 0.002;
    const scale = w * 0.00112;

    ctx.save();
    ctx.globalAlpha = amount;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(8, 62, 154, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Forklift mast and cargo rise above the chassis.
    ctx.fillStyle = '#273744';
    ctx.fillRect(105, -148, 10, 190);
    ctx.fillRect(121, -140, 7, 182);
    ctx.strokeStyle = '#90a4ae';
    ctx.lineWidth = 3;
    ctx.strokeRect(105, -148, 10, 190);
    ctx.strokeRect(121, -140, 7, 182);
    ctx.fillStyle = '#d69a3c';
    ctx.fillRect(129, -126, 70, 70);
    ctx.fillStyle = '#9b6a32';
    ctx.fillRect(137, -118, 55, 54);
    ctx.strokeStyle = 'rgba(255,225,170,0.42)';
    ctx.lineWidth = 2;
    ctx.strokeRect(137, -118, 55, 54);
    ctx.fillStyle = '#e7b56c';
    ctx.fillRect(118, 24, 135, 6);
    ctx.fillRect(118, 30, 12, 5);

    // Rear engine housing and front counterweight.
    const chassis = ctx.createLinearGradient(-105, -25, 106, 48);
    chassis.addColorStop(0, '#f8c65d');
    chassis.addColorStop(0.52, '#d98a21');
    chassis.addColorStop(1, '#965318');
    ctx.fillStyle = chassis;
    ctx.beginPath();
    ctx.roundRect(-118, -34, 235, 85, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,226,162,0.62)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Driver cab, dark glass and protective roof.
    ctx.fillStyle = '#1a2d3b';
    ctx.beginPath();
    ctx.roundRect(-53, -132, 94, 106, 12);
    ctx.fill();
    ctx.strokeStyle = '#e7b354';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-53, -132); ctx.lineTo(43, -132);
    ctx.moveTo(-44, -132); ctx.lineTo(-44, -28);
    ctx.moveTo(34, -132); ctx.lineTo(34, -28);
    ctx.stroke();
    const glass = ctx.createLinearGradient(-35, -124, 28, -40);
    glass.addColorStop(0, 'rgba(88,179,205,0.72)');
    glass.addColorStop(1, 'rgba(15,42,61,0.9)');
    ctx.fillStyle = glass;
    ctx.fillRect(-35, -119, 63, 78);
    ctx.fillStyle = '#172330';
    ctx.beginPath();
    ctx.arc(-3, -83, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-10, -74, 24, 28);
    ctx.strokeStyle = '#f1c05c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-4, -48); ctx.lineTo(8, -29);
    ctx.stroke();

    // Tyres and hub highlights.
    for (const wheelX of [-76, 78]) {
      ctx.fillStyle = '#101923';
      ctx.beginPath();
      ctx.arc(wheelX, 48, 29, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#667987';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = '#c4d0d7';
      ctx.beginPath();
      ctx.arc(wheelX, 48, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#566b79';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wheelX - 16, 48); ctx.lineTo(wheelX + 16, 48);
      ctx.moveTo(wheelX, 32); ctx.lineTo(wheelX, 64);
      ctx.stroke();
    }

    // Amber work lights and a short, moving beam.
    const lamp = ctx.createRadialGradient(112, -7, 1, 112, -7, 76);
    lamp.addColorStop(0, 'rgba(255,225,138,0.58)');
    lamp.addColorStop(1, 'rgba(255,190,70,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(75, -85, 170, 150);
    ctx.fillStyle = '#fff0b0';
    ctx.beginPath();
    ctx.arc(112, -7, 7 + Math.sin(t * 8) * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    ctx.save();
    for (let i = 0; i < 34; i++) {
      const seed = i * 0.6180339887;
      const x = ((seed + t * (0.012 + (i % 4) * 0.002)) % 1) * w;
      const y = h * (0.16 + ((i * 0.137 + Math.sin(t * 0.42 + i) * 0.025) % 0.76));
      const pulse = 0.18 + (Math.sin(t * 2.2 + i * 1.7) + 1) * 0.12;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = i % 5 === 0 ? '#f6bd61' : '#9ed4e7';
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + (i % 3) * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawTitleLight(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, t: number): void {
    const light = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.48);
    light.addColorStop(0, `rgba(39,139,173,${0.28 * amount})`);
    light.addColorStop(1, 'rgba(39,139,173,0)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = amount * (0.48 + Math.sin(t * 6) * 0.07);
    ctx.strokeStyle = '#f3b64b';
    ctx.lineWidth = Math.max(1, w / 1200);
    ctx.strokeRect(w * 0.12, h * 0.16, w * 0.76, h * 0.62);
    ctx.restore();
  }
}
