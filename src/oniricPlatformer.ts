export const ONIRIC_VIEW_WIDTH = 960;
export const ONIRIC_VIEW_HEIGHT = 540;
export const ONIRIC_WORLD_WIDTH = 2720;
export const ONIRIC_GOAL_X = 2580;
export const ONIRIC_PIXEL_GLITCH_WIDTH = 160;
export const ONIRIC_PIXEL_GLITCH_DURATION_MS = 15_000;

export interface OniricPlatform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OniricCollectible {
  id: string;
  x: number;
  y: number;
}

export interface OniricPlatformerState {
  player: { x: number; y: number; vx: number; vy: number; width: number; height: number; onGround: boolean };
  lives: number;
  collected: boolean[];
  remainingSeconds: number;
  checkpointX: number;
  checkpointTop: number;
  invulnerableSeconds: number;
  elapsedSeconds: number;
  finished: boolean;
  won: boolean;
}

export interface OniricPlatformerInput {
  left?: boolean;
  right?: boolean;
  jumpPressed?: boolean;
}

export interface OniricPlatformerResult {
  won: boolean;
  collected: number;
  lives: number;
}

export const ONIRIC_PLATFORMS: readonly OniricPlatform[] = [
  { x: 0, y: 456, width: 350, height: 100 },
  { x: 430, y: 390, width: 150, height: 22 },
  { x: 650, y: 318, width: 160, height: 22 },
  { x: 900, y: 440, width: 260, height: 116 },
  { x: 1230, y: 370, width: 160, height: 22 },
  { x: 1450, y: 298, width: 160, height: 22 },
  { x: 1720, y: 430, width: 220, height: 126 },
  { x: 2010, y: 358, width: 160, height: 22 },
  { x: 2220, y: 286, width: 160, height: 22 },
  { x: 2450, y: 440, width: 330, height: 116 },
];

export const ONIRIC_COLLECTIBLES: readonly OniricCollectible[] = [
  { id: 'pocket-watch-one', x: 500, y: 350 },
  { id: 'pocket-watch-two', x: 1305, y: 330 },
  { id: 'pocket-watch-three', x: 2292, y: 246 },
];

const HAZARDS = [
  { x: 1015, y: 405, width: 34, height: 35 },
  { x: 1810, y: 394, width: 34, height: 35 },
];

const CHECKPOINTS = [
  { x: 1320, top: 370 },
  { x: 1800, top: 430 },
  { x: 2090, top: 358 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const overlaps = (aX: number, aY: number, aW: number, aH: number, bX: number, bY: number, bW: number, bH: number) =>
  aX < bX + bW && aX + aW > bX && aY < bY + bH && aY + aH > bY;

export function createOniricPlatformerState(): OniricPlatformerState {
  return {
    player: { x: 76, y: 410, vx: 0, vy: 0, width: 30, height: 46, onGround: true },
    lives: 3,
    collected: ONIRIC_COLLECTIBLES.map(() => false),
    remainingSeconds: 68,
    checkpointX: 76,
    checkpointTop: 456,
    invulnerableSeconds: 0,
    elapsedSeconds: 0,
    finished: false,
    won: false,
  };
}

/**
 * Deterministic physics step shared by the browser mini-game and unit tests.
 * Coordinates use a side-on 2D plane: X is horizontal, Y points down.
 */
export function stepOniricPlatformer(
  state: OniricPlatformerState,
  input: OniricPlatformerInput,
  deltaSeconds: number,
): OniricPlatformerState {
  if (state.finished) return state;
  const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 1 / 30);
  if (dt <= 0) return state;

  state.elapsedSeconds += dt;
  state.remainingSeconds = Math.max(0, state.remainingSeconds - dt);
  state.invulnerableSeconds = Math.max(0, state.invulnerableSeconds - dt);

  const player = state.player;
  const direction = Number(Boolean(input.right)) - Number(Boolean(input.left));
  const targetSpeed = direction * 268;
  const blend = Math.min(1, dt * 12);
  player.vx += (targetSpeed - player.vx) * blend;

  if (input.jumpPressed && player.onGround) {
    player.vy = -540;
    player.onGround = false;
  }

  const previousY = player.y;
  const previousBottom = previousY + player.height;
  player.vy = Math.min(860, player.vy + 1420 * dt);
  player.x = clamp(player.x + player.vx * dt, 0, ONIRIC_WORLD_WIDTH - player.width);
  player.y += player.vy * dt;
  player.onGround = false;

  for (const platform of ONIRIC_PLATFORMS) {
    const horizontalOverlap = player.x + player.width > platform.x + 2 &&
      player.x < platform.x + platform.width - 2;
    const crossedTop = previousBottom <= platform.y + 9 &&
      player.y + player.height >= platform.y &&
      player.vy >= 0;
    if (horizontalOverlap && crossedTop) {
      player.y = platform.y - player.height;
      player.vy = 0;
      player.onGround = true;
      break;
    }
  }

  if (player.y > ONIRIC_VIEW_HEIGHT + 90) {
    loseOniricLife(state);
  }

  if (state.invulnerableSeconds <= 0) {
    const hazardHit = HAZARDS.some((hazard) =>
      overlaps(player.x + 4, player.y + 7, player.width - 8, player.height - 8,
        hazard.x, hazard.y, hazard.width, hazard.height));
    if (hazardHit) loseOniricLife(state);
  }

  for (let i = 0; i < ONIRIC_COLLECTIBLES.length; i++) {
    if (state.collected[i]) continue;
    const item = ONIRIC_COLLECTIBLES[i];
    if (overlaps(player.x - 8, player.y - 8, player.width + 16, player.height + 16, item.x - 15, item.y - 15, 30, 30)) {
      state.collected[i] = true;
    }
  }

  for (const checkpoint of CHECKPOINTS) {
    if (player.x >= checkpoint.x && checkpoint.x > state.checkpointX) {
      state.checkpointX = checkpoint.x;
      state.checkpointTop = checkpoint.top;
    }
  }

  const allWatchesFound = state.collected.every(Boolean);
  if (allWatchesFound && player.x + player.width >= ONIRIC_GOAL_X) {
    state.finished = true;
    state.won = true;
  }
  if (state.remainingSeconds <= 0 || state.lives <= 0) {
    state.finished = true;
    state.won = false;
  }

  return state;
}

function loseOniricLife(state: OniricPlatformerState) {
  if (state.invulnerableSeconds > 0) return;
  state.lives = Math.max(0, state.lives - 1);
  state.invulnerableSeconds = 1.5;
  state.player.x = state.checkpointX;
  state.player.y = state.checkpointTop - state.player.height;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.onGround = true;
}

export function launchOniricPlatformer(options: {
  onComplete: (result: OniricPlatformerResult) => void;
}): void {
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousBodyOverflow = document.body.style.overflow;
  const root = document.createElement('section');
  root.className = 'oniric-platformer-overlay oniric-pixel-chaos';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'oniric-platformer-title');
  root.innerHTML = [
    '<div class="oniric-platformer-card">',
    '  <header class="oniric-platformer-header">',
    '    <div><span class="oniric-platformer-kicker">ZA LUSTREM / SEKRETNY ETAP 2D</span><h2 id="oniric-platformer-title">NORKA KRÓLIKA</h2><p>Trzy zegarki. Jedna droga. Nie spóźnij się na drugą stronę.</p></div>',
    '    <button type="button" class="oniric-exit-button" data-action="exit" aria-label="Wróć do gry">WRÓĆ DO GRY</button>',
    '  </header>',
    '  <div class="oniric-platformer-hud"><span>⌚ ZEGARKI <strong data-watch-count>0 / 3</strong></span><span>♥ ŻYCIA <strong data-lives>3</strong></span><span>⏱ CZAS <strong data-time>68 s</strong></span></div>',
    '  <div class="oniric-platformer-stage">',
    '    <canvas class="oniric-platformer-canvas" width="960" height="540" aria-label="Platformówka 2D: przejdź przez króliczą norkę"></canvas>',
    '    <div class="oniric-result-panel" hidden><strong data-result-title></strong><span data-result-copy></span><div><button type="button" data-action="retry">SPRÓBUJ PONOWNIE</button><button type="button" data-action="return">WRÓĆ DO MAGAZYNU</button></div></div>',
    '  </div>',
    '  <div class="oniric-platformer-controls" aria-label="Sterowanie platformówką">',
    '    <div class="oniric-direction-pad"><button type="button" data-hold="left" aria-label="W lewo">◀</button><button type="button" data-hold="right" aria-label="W prawo">▶</button></div>',
    '    <button type="button" class="oniric-jump-button" data-hold="jump" aria-label="Skok">SKOK ↑</button>',
    '  </div>',
    '  <footer class="oniric-platformer-footer"><span>PC: A / D lub ← / → • SPACJA = SKOK</span><span>Telefon: przytrzymaj kierunek i skacz nad filiżankami</span></footer>',
    '</div>',
  ].join('');
  document.body.appendChild(root);

  const canvas = root.querySelector<HTMLCanvasElement>('.oniric-platformer-canvas');
  const outputContext = canvas?.getContext('2d', { alpha: false });
  // Render the opening chaos pass at a true 160px-wide internal resolution.
  // The final canvas is upscaled with nearest-neighbour sampling; gameplay and
  // the normal-resolution HUD remain unaffected.
  const pixelCanvas = document.createElement('canvas');
  pixelCanvas.width = ONIRIC_PIXEL_GLITCH_WIDTH;
  pixelCanvas.height = Math.round(ONIRIC_PIXEL_GLITCH_WIDTH * ONIRIC_VIEW_HEIGHT / ONIRIC_VIEW_WIDTH);
  const pixelContext = pixelCanvas.getContext('2d', { alpha: false });
  let activeContext: CanvasRenderingContext2D | null = null;
  let pixelChaosEndsAt = performance.now() + ONIRIC_PIXEL_GLITCH_DURATION_MS;
  const watchCount = root.querySelector<HTMLElement>('[data-watch-count]');
  const livesNode = root.querySelector<HTMLElement>('[data-lives]');
  const timeNode = root.querySelector<HTMLElement>('[data-time]');
  const resultPanel = root.querySelector<HTMLElement>('.oniric-result-panel');
  const resultTitle = root.querySelector<HTMLElement>('[data-result-title]');
  const resultCopy = root.querySelector<HTMLElement>('[data-result-copy]');
  const retryButton = root.querySelector<HTMLButtonElement>('[data-action="retry"]');
  const returnButton = root.querySelector<HTMLButtonElement>('[data-action="return"]');

  if (!canvas || !outputContext || !pixelContext || !watchCount || !livesNode || !timeNode || !resultPanel || !resultTitle || !resultCopy || !retryButton || !returnButton) {
    root.remove();
    options.onComplete({ won: false, collected: 0, lives: 0 });
    return;
  }

  // The rabbit-hole secret corrupts the picture for exactly 15 wall-clock
  // seconds. It is intentionally independent from the paused 3D simulation
  // and the selected 1x/2x Survival speed.
  let pixelChaosTimer = window.setTimeout(() => {
    root.classList.remove('oniric-pixel-chaos');
  }, ONIRIC_PIXEL_GLITCH_DURATION_MS);

  const restartPixelChaos = () => {
    window.clearTimeout(pixelChaosTimer);
    pixelChaosEndsAt = performance.now() + ONIRIC_PIXEL_GLITCH_DURATION_MS;
    root.classList.add('oniric-pixel-chaos');
    pixelChaosTimer = window.setTimeout(() => {
      root.classList.remove('oniric-pixel-chaos');
    }, ONIRIC_PIXEL_GLITCH_DURATION_MS);
  };

  document.body.style.overflow = 'hidden';
  const firstFocusTarget = root.querySelector<HTMLButtonElement>('[data-action="exit"]');
  firstFocusTarget?.focus();

  let state = createOniricPlatformerState();
  let rafId = 0;
  let lastFrame = 0;
  let jumpQueued = false;
  let completedCallback = false;
  const held = { left: false, right: false };
  const resize = () => {
    const ratio = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(ONIRIC_VIEW_WIDTH * ratio);
    canvas.height = Math.round(ONIRIC_VIEW_HEIGHT * ratio);
    outputContext.imageSmoothingEnabled = false;
    pixelContext.imageSmoothingEnabled = false;
  };

  const drawRounded = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) => {
    activeContext!.beginPath();
    activeContext!.roundRect(x, y, w, h, r);
    activeContext!.fillStyle = fill;
    activeContext!.fill();
    if (stroke) {
      activeContext!.strokeStyle = stroke;
      activeContext!.lineWidth = 2;
      activeContext!.stroke();
    }
  };

  const drawWatch = (x: number, y: number, cameraX: number, pulse: number) => {
    const sx = x - cameraX;
    activeContext!.save();
    activeContext!.translate(sx, y + Math.sin(pulse * 3 + x) * 4);
    activeContext!.shadowColor = '#fbbf24';
    activeContext!.shadowBlur = 18;
    activeContext!.fillStyle = '#fbbf24';
    activeContext!.beginPath();
    activeContext!.arc(0, 0, 13, 0, Math.PI * 2);
    activeContext!.fill();
    activeContext!.shadowBlur = 0;
    activeContext!.strokeStyle = '#78350f';
    activeContext!.lineWidth = 2;
    activeContext!.beginPath();
    activeContext!.arc(0, 0, 9, 0, Math.PI * 2);
    activeContext!.stroke();
    activeContext!.strokeStyle = '#78350f';
    activeContext!.lineWidth = 2;
    activeContext!.beginPath();
    activeContext!.moveTo(0, 0);
    activeContext!.lineTo(0, -6);
    activeContext!.moveTo(0, 0);
    activeContext!.lineTo(5, 3);
    activeContext!.stroke();
    activeContext!.fillStyle = '#fde68a';
    activeContext!.fillRect(-3, -18, 6, 5);
    activeContext!.restore();
  };

  const drawRabbit = (cameraX: number, pulse: number) => {
    const x = ONIRIC_GOAL_X + 88 - cameraX;
    const y = 392 + Math.sin(pulse * 2) * 3;
    activeContext!.save();
    activeContext!.translate(x, y);
    activeContext!.fillStyle = '#f8fafc';
    activeContext!.beginPath();
    activeContext!.ellipse(0, 0, 23, 25, 0, 0, Math.PI * 2);
    activeContext!.fill();
    activeContext!.beginPath();
    activeContext!.ellipse(-9, -29, 6, 20, -0.2, 0, Math.PI * 2);
    activeContext!.ellipse(7, -31, 6, 21, 0.2, 0, Math.PI * 2);
    activeContext!.fill();
    activeContext!.fillStyle = '#f9a8d4';
    activeContext!.beginPath();
    activeContext!.ellipse(-9, -29, 2.7, 13, -0.2, 0, Math.PI * 2);
    activeContext!.ellipse(7, -31, 2.7, 14, 0.2, 0, Math.PI * 2);
    activeContext!.fill();
    activeContext!.fillStyle = '#241333';
    activeContext!.beginPath();
    activeContext!.arc(-7, -4, 2.4, 0, Math.PI * 2);
    activeContext!.arc(7, -4, 2.4, 0, Math.PI * 2);
    activeContext!.fill();
    activeContext!.fillStyle = '#fb7185';
    activeContext!.beginPath();
    activeContext!.arc(0, 2, 3, 0, Math.PI * 2);
    activeContext!.fill();
    activeContext!.strokeStyle = '#fbbf24';
    activeContext!.lineWidth = 3;
    activeContext!.beginPath();
    activeContext!.arc(19, 14, 9, 0, Math.PI * 2);
    activeContext!.stroke();
    activeContext!.restore();
  };

  const drawScene = () => {
    const pixelMode = performance.now() < pixelChaosEndsAt;
    activeContext = pixelMode ? pixelContext : outputContext;
    const ratio = pixelMode
      ? pixelCanvas.width / ONIRIC_VIEW_WIDTH
      : canvas.width / ONIRIC_VIEW_WIDTH;
    activeContext!.setTransform(ratio, 0, 0, ratio, 0, 0);
    const cameraX = clamp(state.player.x - 310, 0, ONIRIC_WORLD_WIDTH - ONIRIC_VIEW_WIDTH);
    const pulse = state.elapsedSeconds;

    const sky = activeContext!.createLinearGradient(0, 0, 0, ONIRIC_VIEW_HEIGHT);
    sky.addColorStop(0, '#160d2c');
    sky.addColorStop(0.52, '#39204d');
    sky.addColorStop(1, '#17142c');
    activeContext!.fillStyle = sky;
    activeContext!.fillRect(0, 0, ONIRIC_VIEW_WIDTH, ONIRIC_VIEW_HEIGHT);

    for (let i = 0; i < 28; i++) {
      const x = ((i * 137 + pulse * (8 + i % 3)) % (ONIRIC_VIEW_WIDTH + 40)) - 20;
      const y = 35 + (i * 71) % 260;
      activeContext!.fillStyle = i % 3 === 0 ? '#f9a8d4' : '#fde68a';
      activeContext!.globalAlpha = 0.35 + ((i % 4) * 0.12);
      activeContext!.fillRect(x, y, i % 5 === 0 ? 4 : 2, i % 5 === 0 ? 4 : 2);
    }
    activeContext!.globalAlpha = 1;

    // A layered storybook skyline scrolls more slowly than the platforms.
    for (let i = 0; i < 9; i++) {
      const x = i * 160 - (cameraX * 0.28 % 160);
      activeContext!.fillStyle = i % 2 ? '#27183c' : '#302049';
      activeContext!.beginPath();
      activeContext!.moveTo(x, 350);
      activeContext!.lineTo(x + 55, 210 + (i % 3) * 20);
      activeContext!.lineTo(x + 110, 350);
      activeContext!.closePath();
      activeContext!.fill();
      activeContext!.fillRect(x + 28, 300, 55, 55);
      activeContext!.fillStyle = '#f0abfc';
      activeContext!.fillRect(x + 52, 274, 7, 32);
    }

    // Oversized clockwork moon.
    activeContext!.save();
    activeContext!.globalAlpha = 0.72;
    activeContext!.fillStyle = '#f5d0fe';
    activeContext!.beginPath();
    activeContext!.arc(790, 112, 56, 0, Math.PI * 2);
    activeContext!.fill();
    activeContext!.strokeStyle = '#7e22ce';
    activeContext!.lineWidth = 5;
    activeContext!.beginPath();
    activeContext!.arc(790, 112, 43, 0, Math.PI * 2);
    activeContext!.stroke();
    activeContext!.strokeStyle = '#581c87';
    activeContext!.lineWidth = 3;
    activeContext!.beginPath();
    activeContext!.moveTo(790, 112);
    activeContext!.lineTo(790, 82);
    activeContext!.moveTo(790, 112);
    activeContext!.lineTo(813, 124);
    activeContext!.stroke();
    activeContext!.restore();

    for (const platform of ONIRIC_PLATFORMS) {
      const x = platform.x - cameraX;
      if (x + platform.width < -20 || x > ONIRIC_VIEW_WIDTH + 20) continue;
      drawRounded(x, platform.y, platform.width, platform.height, 7, '#3c244f', '#c084fc');
      activeContext!.fillStyle = '#f0abfc';
      activeContext!.fillRect(x, platform.y, platform.width, 7);
      for (let tile = 0; tile < Math.ceil(platform.width / 34); tile++) {
        activeContext!.fillStyle = tile % 2 ? 'rgba(255,255,255,.07)' : 'rgba(15,23,42,.17)';
        activeContext!.fillRect(x + tile * 34 + 2, platform.y + 12, 30, Math.max(7, platform.height - 15));
      }
    }

    // Teacup hazards.
    for (const hazard of HAZARDS) {
      const x = hazard.x - cameraX;
      if (x < -60 || x > ONIRIC_VIEW_WIDTH + 60) continue;
      drawRounded(x, hazard.y, hazard.width, hazard.height, 8, '#fb7185', '#fecdd3');
      activeContext!.fillStyle = '#fff1f2';
      activeContext!.fillRect(x + 6, hazard.y + 8, hazard.width - 12, 7);
      activeContext!.strokeStyle = '#fecdd3';
      activeContext!.lineWidth = 4;
      activeContext!.beginPath();
      activeContext!.arc(x + hazard.width + 5, hazard.y + 17, 8, -Math.PI / 2, Math.PI / 2);
      activeContext!.stroke();
      activeContext!.fillStyle = '#fbcfe8';
      activeContext!.fillRect(x + 12, hazard.y - 6, 10, 5);
    }

    ONIRIC_COLLECTIBLES.forEach((item, index) => {
      if (!state.collected[index]) drawWatch(item.x, item.y, cameraX, pulse);
    });

    // Rabbit-hole exit with a glowing arch and a clear goal marker.
    const portalX = ONIRIC_GOAL_X - cameraX;
    activeContext!.save();
    activeContext!.shadowColor = '#c084fc';
    activeContext!.shadowBlur = 24;
    activeContext!.strokeStyle = '#e9d5ff';
    activeContext!.lineWidth = 10;
    activeContext!.beginPath();
    activeContext!.arc(portalX + 28, 425, 42, Math.PI, 0);
    activeContext!.stroke();
    activeContext!.shadowBlur = 0;
    activeContext!.fillStyle = 'rgba(168,85,247,.25)';
    activeContext!.fillRect(portalX - 12, 425, 80, 34);
    activeContext!.fillStyle = '#f5d0fe';
    activeContext!.font = '900 13px system-ui';
    activeContext!.textAlign = 'center';
    activeContext!.fillText(state.collected.every(Boolean) ? 'WRÓĆ DO ŚWIATA' : '3 ZEGARKI', portalX + 28, 374);
    activeContext!.restore();
    drawRabbit(cameraX, pulse);

    // Player avatar: original little warehouse operator in a reflective vest.
    const p = state.player;
    const px = p.x - cameraX;
    activeContext!.save();
    activeContext!.translate(px + p.width / 2, p.y + p.height / 2);
    if (state.invulnerableSeconds > 0 && Math.floor(pulse * 16) % 2 === 0) activeContext!.globalAlpha = 0.45;
    activeContext!.fillStyle = '#0f172a';
    activeContext!.fillRect(-12, 8, 9, 15);
    activeContext!.fillRect(3, 8, 9, 15);
    activeContext!.fillStyle = '#f97316';
    activeContext!.fillRect(-13, -9, 26, 22);
    activeContext!.fillStyle = '#fde68a';
    activeContext!.fillRect(-10, -5, 20, 4);
    activeContext!.fillStyle = '#f1c7a5';
    activeContext!.beginPath();
    activeContext!.arc(0, -18, 12, 0, Math.PI * 2);
    activeContext!.fill();
    activeContext!.fillStyle = '#fbbf24';
    activeContext!.fillRect(-14, -31, 28, 7);
    activeContext!.fillRect(-10, -36, 20, 7);
    activeContext!.fillStyle = '#1e293b';
    activeContext!.fillRect(4, -20, 3, 3);
    activeContext!.fillStyle = '#2563eb';
    activeContext!.fillRect(-8, 21, 8, 4);
    activeContext!.fillRect(3, 21, 8, 4);
    activeContext!.restore();

    activeContext!.fillStyle = 'rgba(15,23,42,.72)';
    activeContext!.fillRect(16, 14, 250, 34);
    activeContext!.fillStyle = '#fdf4ff';
    activeContext!.font = '800 12px system-ui';
    activeContext!.textAlign = 'left';
    activeContext!.fillText('KIERUNEK: KRÓLIK → NORKA', 28, 36);

    if (pixelMode) {
      // Nearest-neighbour upscale produces chunky pixels, not just a CSS tint.
      outputContext!.setTransform(1, 0, 0, 1, 0, 0);
      outputContext!.imageSmoothingEnabled = false;
      outputContext!.drawImage(pixelCanvas, 0, 0, canvas.width, canvas.height);
      const glitchPhase = Math.floor((performance.now() / 1000) * 18);
      outputContext!.fillStyle = 'rgba(255, 0, 180, 0.13)';
      outputContext!.fillRect(0, (glitchPhase * 37) % canvas.height, canvas.width, Math.max(3, canvas.height * 0.018));
      outputContext!.fillStyle = 'rgba(0, 255, 255, 0.10)';
      outputContext!.fillRect(0, (glitchPhase * 61 + 23) % canvas.height, canvas.width, Math.max(2, canvas.height * 0.009));
    }
  };

  const updateHud = () => {
    watchCount.textContent = state.collected.filter(Boolean).length + ' / ' + ONIRIC_COLLECTIBLES.length;
    livesNode.textContent = String(state.lives);
    timeNode.textContent = Math.ceil(state.remainingSeconds) + ' s';
  };

  const showResult = () => {
    resultPanel.hidden = false;
    if (state.won) {
      resultTitle.textContent = 'UDAŁO SIĘ! PO DRUGIEJ STRONIE';
      resultCopy.textContent = 'Królik oddaje Ci zegarek. Zebrane zegarki: ' + state.collected.filter(Boolean).length + '/3. Wracasz do magazynu z dodatkową nagrodą.';
      retryButton.hidden = true;
    } else {
      resultTitle.textContent = 'NORKA SIĘ ZAMKNĘŁA';
      resultCopy.textContent = 'Zebrane zegarki: ' + state.collected.filter(Boolean).length + '/3. Sekret został odkryty, ale premia za przejście czeka na kolejną próbę.';
      retryButton.hidden = false;
    }
  };

  const resetRun = () => {
    restartPixelChaos();
    state = createOniricPlatformerState();
    held.left = false;
    held.right = false;
    jumpQueued = false;
    lastFrame = 0;
    resultPanel.hidden = true;
    updateHud();
    drawScene();
    if (!rafId && !completedCallback) rafId = window.requestAnimationFrame(frame);
  };

  let lastHudSecond = -1;
  const frame = (now: number) => {
    const dt = lastFrame ? Math.min(1 / 30, Math.max(0, (now - lastFrame) / 1000)) : 1 / 60;
    lastFrame = now;
    if (!state.finished) {
      stepOniricPlatformer(state, { left: held.left, right: held.right, jumpPressed: jumpQueued }, dt);
      jumpQueued = false;
      const second = Math.ceil(state.remainingSeconds);
      if (second !== lastHudSecond) {
        lastHudSecond = second;
        updateHud();
      }
      if (state.finished) showResult();
    }
    drawScene();
    // Stop rendering once the result panel is shown. A retry explicitly
    // starts a fresh frame loop, avoiding a 60 FPS idle render on phones.
    if (!completedCallback && !state.finished) rafId = window.requestAnimationFrame(frame);
    else rafId = 0;
  };

  const clearHeldInput = () => {
    held.left = false;
    held.right = false;
    jumpQueued = false;
  };

  const onWindowBlur = () => {
    clearHeldInput();
    lastFrame = 0;
  };

  const onVisibilityChange = () => {
    if (document.hidden) onWindowBlur();
  };

  const finish = () => {
    if (completedCallback) return;
    completedCallback = true;
    window.cancelAnimationFrame(rafId);
    window.clearTimeout(pixelChaosTimer);
    window.removeEventListener('resize', resize);
    window.removeEventListener('blur', onWindowBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    document.body.style.overflow = previousBodyOverflow;
    root.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
    options.onComplete({
      won: state.won,
      collected: state.collected.filter(Boolean).length,
      lives: state.lives,
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Tab') {
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([hidden])',
      ));
      if (focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (['ArrowLeft', 'KeyA'].includes(event.code)) held.left = true;
    if (['ArrowRight', 'KeyD'].includes(event.code)) held.right = true;
    if (['Space', 'ArrowUp', 'KeyW'].includes(event.code) && !event.repeat) jumpQueued = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space', 'Escape'].includes(event.code)) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (event.code === 'Escape') finish();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (['ArrowLeft', 'KeyA'].includes(event.code)) held.left = false;
    if (['ArrowRight', 'KeyD'].includes(event.code)) held.right = false;
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  root.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach((button) => {
    const control = button.dataset.hold;
    if (control !== 'left' && control !== 'right' && control !== 'jump') return;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (control === 'jump') jumpQueued = true;
      else held[control] = true;
      button.setPointerCapture?.(event.pointerId);
    });
    const release = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (control !== 'jump') held[control] = false;
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  root.querySelector('[data-action="exit"]')?.addEventListener('click', finish);
  returnButton.addEventListener('click', finish);
  retryButton.addEventListener('click', resetRun);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('resize', resize, { passive: true });
  resize();
  updateHud();
  drawScene();
  rafId = window.requestAnimationFrame(frame);
}
