export const CTHULHU_RETRO_WIDTH = 480;
export const CTHULHU_RETRO_HEIGHT = 270;
export const CTHULHU_RETRO_FLOOR = 226;
export const CTHULHU_RETRO_CORE_OPEN_SECONDS = 2.15;
export const CTHULHU_RETRO_CORE_DAMAGE_MULTIPLIER = 1.5;
export const CTHULHU_RETRO_BOSS_MAX_HP = 180;

export type CthulhuRetroAttack = 'slam' | 'lash' | 'grab';

export interface CthulhuRetroInput {
  left?: boolean;
  right?: boolean;
  dodgePressed?: boolean;
  attackHeld?: boolean;
}

export interface CthulhuRetroProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface CthulhuRetroShockwave {
  x: number;
  life: number;
}

export interface CthulhuRetroState {
  elapsed: number;
  introSeconds: number;
  player: {
    x: number;
    y: number;
    vy: number;
    hp: number;
    maxHp: number;
    invulnerability: number;
    dodgeSeconds: number;
    dodgeCooldown: number;
    attackCooldown: number;
    facing: -1 | 1;
    grounded: boolean;
    animation: number;
  };
  boss: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    phase: 1 | 2;
    windup: number;
    attackCooldown: number;
    strikeSeconds: number;
    coreOpenSeconds: number;
    attack: CthulhuRetroAttack;
    nextAttack: CthulhuRetroAttack;
    grabX: number;
    hitFlash: number;
    riseSeconds: number;
    defeated: boolean;
  };
  projectiles: CthulhuRetroProjectile[];
  shockwaves: CthulhuRetroShockwave[];
  hitsTaken: number;
  successfulHits: number;
  screenShake: number;
  damageFlash: number;
  finished: boolean;
  won: boolean;
}

const PLAYER_WIDTH = 14;
const PLAYER_HEIGHT = 26;
const PLAYER_MAX_X = 205;
const BOSS_CORE_X_OFFSET = -2;
const BOSS_CORE_Y_OFFSET = -69;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createCthulhuRetroState(): CthulhuRetroState {
  return {
    elapsed: 0,
    introSeconds: 2.7,
    player: {
      x: 66, y: CTHULHU_RETRO_FLOOR - PLAYER_HEIGHT, vy: 0,
      hp: 100, maxHp: 100, invulnerability: 0, dodgeSeconds: 0,
      dodgeCooldown: 0, attackCooldown: 0, facing: 1, grounded: true, animation: 0,
    },
    boss: {
      x: 382, y: CTHULHU_RETRO_FLOOR, hp: CTHULHU_RETRO_BOSS_MAX_HP,
      maxHp: CTHULHU_RETRO_BOSS_MAX_HP, phase: 1, windup: 0,
      attackCooldown: 0.28, strikeSeconds: 0, coreOpenSeconds: 0,
      attack: 'slam', nextAttack: 'lash', grabX: 66, hitFlash: 0,
      riseSeconds: 1.45, defeated: false,
    },
    projectiles: [],
    shockwaves: [],
    hitsTaken: 0,
    successfulHits: 0,
    screenShake: 0,
    damageFlash: 0,
    finished: false,
    won: false,
  };
}

function takeCthulhuRetroDamage(state: CthulhuRetroState, damage: number): void {
  const player = state.player;
  if (player.invulnerability > 0 || player.dodgeSeconds > 0 || state.finished) return;
  player.hp = Math.max(0, player.hp - damage);
  player.invulnerability = 0.92;
  state.hitsTaken++;
  state.damageFlash = 0.24;
  state.screenShake = Math.max(state.screenShake, 0.28);
  if (player.hp <= 0) {
    state.finished = true;
    state.won = false;
  }
}

function resolveCthulhuRetroAttack(state: CthulhuRetroState): void {
  const boss = state.boss;
  const player = state.player;
  boss.strikeSeconds = 0.32;
  boss.coreOpenSeconds = CTHULHU_RETRO_CORE_OPEN_SECONDS;
  boss.attackCooldown = boss.phase === 2 ? 0.92 : 1.38;
  boss.hitFlash = 0.10;
  if (boss.attack === 'slam') {
    state.shockwaves.push({ x: boss.x - 28, life: 2.3 });
    state.screenShake = Math.max(state.screenShake, 0.24);
    return;
  }
  if (boss.attack === 'lash') {
    const playerAboveLash = player.y < CTHULHU_RETRO_FLOOR - PLAYER_HEIGHT - 23;
    if (!playerAboveLash && player.x < boss.x - 18) takeCthulhuRetroDamage(state, 32);
    return;
  }
  if (player.grounded && Math.abs(player.x - boss.grabX) <= 18) takeCthulhuRetroDamage(state, 40);
}

/**
 * Deterministic update for the isolated retro R'lyeh boss arena.
 * The original Survival simulation is paused while this state is active.
 */
export function stepCthulhuRetroState(
  state: CthulhuRetroState,
  input: CthulhuRetroInput,
  deltaSeconds: number,
): CthulhuRetroState {
  if (state.finished) return state;
  const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 1 / 30);
  if (dt <= 0) return state;

  state.elapsed += dt;
  state.introSeconds = Math.max(0, state.introSeconds - dt);
  state.screenShake = Math.max(0, state.screenShake - dt);
  state.damageFlash = Math.max(0, state.damageFlash - dt);

  const player = state.player;
  const boss = state.boss;
  player.invulnerability = Math.max(0, player.invulnerability - dt);
  player.dodgeSeconds = Math.max(0, player.dodgeSeconds - dt);
  player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt);
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.animation += dt * (Math.abs(Number(Boolean(input.right)) - Number(Boolean(input.left))) > 0 ? 9 : 2.2);

  const direction = Number(Boolean(input.right)) - Number(Boolean(input.left));
  if (direction !== 0) player.facing = direction as -1 | 1;

  if (input.dodgePressed && player.dodgeCooldown <= 0 && state.introSeconds <= 1.7) {
    player.dodgeSeconds = 0.42;
    player.dodgeCooldown = 1.35;
    if (player.grounded) {
      player.vy = -174;
      player.grounded = false;
    }
  }

  if (player.dodgeSeconds > 0) {
    player.x += (direction || player.facing) * 154 * dt;
  } else {
    player.x += direction * 106 * dt;
  }
  player.x = clamp(player.x, 24, PLAYER_MAX_X);
  player.vy = Math.min(290, player.vy + 520 * dt);
  player.y += player.vy * dt;
  if (player.y + PLAYER_HEIGHT >= CTHULHU_RETRO_FLOOR) {
    player.y = CTHULHU_RETRO_FLOOR - PLAYER_HEIGHT;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  if (input.attackHeld && player.attackCooldown <= 0 && state.introSeconds <= 1.7) {
    const projectileY = player.y + 11;
    const travelTime = Math.max(0.12, (boss.x - player.x) / 282);
    const targetCoreY = boss.y + BOSS_CORE_Y_OFFSET;
    state.projectiles.push({
      x: player.x + (player.facing > 0 ? PLAYER_WIDTH : 0),
      y: projectileY,
      vx: 282,
      vy: clamp((targetCoreY - projectileY) / travelTime, -190, 125),
      life: 1.8,
    });
    player.attackCooldown = 0.36;
  }

  boss.riseSeconds = Math.max(0, boss.riseSeconds - dt);
  boss.coreOpenSeconds = Math.max(0, boss.coreOpenSeconds - dt);
  boss.strikeSeconds = Math.max(0, boss.strikeSeconds - dt);
  boss.hitFlash = Math.max(0, boss.hitFlash - dt);

  for (let index = state.projectiles.length - 1; index >= 0; index--) {
    const projectile = state.projectiles[index];
    projectile.x += projectile.vx * dt;
    projectile.y += (projectile.vy || 0) * dt;
    projectile.life -= dt;
    const coreX = boss.x + BOSS_CORE_X_OFFSET;
    const coreY = boss.y + BOSS_CORE_Y_OFFSET;
    if (projectile.x >= coreX - 16 && projectile.x <= coreX + 20 &&
        Math.abs(projectile.y - coreY) <= 17) {
      if (boss.coreOpenSeconds > 0 && !boss.defeated) {
        const damage = 15 * CTHULHU_RETRO_CORE_DAMAGE_MULTIPLIER;
        boss.hp = Math.max(0, boss.hp - damage);
        boss.hitFlash = 0.20;
        state.successfulHits++;
        state.screenShake = Math.max(state.screenShake, 0.08);
        if (boss.hp <= 0) {
          boss.defeated = true;
          state.finished = true;
          state.won = true;
        }
      }
      state.projectiles.splice(index, 1);
      continue;
    }
    if (projectile.life <= 0 || projectile.x > CTHULHU_RETRO_WIDTH + 20) {
      state.projectiles.splice(index, 1);
    }
  }
  if (state.finished) return state;

  for (let index = state.shockwaves.length - 1; index >= 0; index--) {
    const wave = state.shockwaves[index];
    wave.x -= (boss.phase === 2 ? 224 : 190) * dt;
    wave.life -= dt;
    const playerCenter = player.x + PLAYER_WIDTH / 2;
    const isGroundedForWave = player.y > CTHULHU_RETRO_FLOOR - PLAYER_HEIGHT - 9;
    if (Math.abs(wave.x - playerCenter) <= 6 && isGroundedForWave) {
      takeCthulhuRetroDamage(state, 30);
      state.shockwaves.splice(index, 1);
      continue;
    }
    if (wave.x < 4 || wave.life <= 0) state.shockwaves.splice(index, 1);
  }
  if (state.finished) return state;

  if (boss.hp <= boss.maxHp * 0.5) boss.phase = 2;
  if (boss.windup > 0) {
    boss.windup = Math.max(0, boss.windup - dt);
    if (boss.windup <= 0 && boss.riseSeconds <= 0) resolveCthulhuRetroAttack(state);
  } else if (boss.strikeSeconds <= 0 && boss.attackCooldown > 0) {
    boss.attackCooldown = Math.max(0, boss.attackCooldown - dt);
  } else if (boss.strikeSeconds <= 0 && boss.attackCooldown <= 0 && boss.riseSeconds <= 0) {
    boss.attack = boss.nextAttack;
    boss.nextAttack = boss.nextAttack === 'slam'
      ? 'lash'
      : boss.nextAttack === 'lash'
        ? 'grab'
        : 'slam';
    boss.grabX = player.x;
    boss.windup = boss.phase === 2 ? 0.64 : 0.92;
  }

  return state;
}

export function getCthulhuRetroPhaseLabel(phase: 1 | 2): string {
  return phase === 2 ? 'FAZA II • GNIEW GŁĘBIN' : 'FAZA I • PRZEBUDZENIE';
}

export function launchCthulhuRetroArena(options: {
  onComplete: (result: { won: boolean; hitsTaken: number; successfulHits: number }) => void;
}): void {
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousBodyOverflow = document.body.style.overflow;
  const root = document.createElement('section');
  root.className = 'cthulhu-retro-overlay';
  root.style.zIndex = '2147483647';
  root.style.isolation = 'isolate';
  root.style.pointerEvents = 'auto';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'cthulhu-retro-title');
  root.innerHTML = [
    '<div class="cthulhu-retro-shell">',
    '  <header class="cthulhu-retro-header">',
    '    <div><span class="cthulhu-retro-kicker">ZAKAZANY SEKTOR / MAPA SEKRETNA 04</span><h2 id="cthulhu-retro-title">R’LYEH — MIASTO POD CZARNĄ WODĄ</h2><p>NECRONOMICON // 8-BIT ELDER GOD ENCOUNTER</p></div>',
    '    <button type="button" class="cthulhu-retro-exit" data-action="exit">WRÓĆ DO MAGAZYNU</button>',
    '  </header>',
    '  <div class="cthulhu-retro-hud">',
    '    <div class="cthulhu-retro-hp"><span>OPERATOR</span><div class="cthulhu-retro-bar"><i data-player-bar></i></div><strong data-player-hp>100%</strong></div>',
    '    <div class="cthulhu-retro-boss-hp"><span>CTHULHU / PAN R’LYEH</span><div class="cthulhu-retro-bar"><i data-boss-bar></i></div><strong data-boss-hp>180 / 180</strong></div>',
    '    <strong class="cthulhu-retro-phase" data-phase>FAZA I</strong>',
    '  </div>',
    '  <div class="cthulhu-retro-stage">',
    '    <canvas class="cthulhu-retro-canvas" width="960" height="540" aria-label="Osobna retro mapa R’lyeh i walka z ogromnym Cthulhu"></canvas>',
    '    <div class="cthulhu-retro-result" hidden><strong data-result-title></strong><span data-result-copy></span><div><button type="button" data-action="retry">PONÓW WALKĘ</button><button type="button" data-action="return">WRÓĆ DO MAGAZYNU</button></div></div>',
    '  </div>',
    '  <div class="cthulhu-retro-controls" aria-label="Sterowanie walką z Cthulhu">',
    '    <div class="cthulhu-retro-move"><button type="button" data-hold="left" aria-label="W lewo">◀</button><button type="button" data-hold="right" aria-label="W prawo">▶</button></div>',
    '    <div class="cthulhu-retro-actions"><button type="button" data-hold="dodge" aria-label="Unik i skok">UNIK</button><button type="button" class="cthulhu-retro-fire" data-hold="attack" aria-label="Atakuj">ATAK ✦</button></div>',
    '  </div>',
    '  <footer class="cthulhu-retro-footer"><span>PC: A/D lub ←/→ • SPACJA / SHIFT = UNIK • J / K / X = ATAK</span><span>Telefon: przesuń operatora, unikaj telegraphów, atakuj odsłonięty rdzeń</span></footer>',
    '</div>',
  ].join('');
  document.body.appendChild(root);

  const canvas = root.querySelector<HTMLCanvasElement>('.cthulhu-retro-canvas');
  const output = canvas?.getContext('2d', { alpha: false });
  const pixelCanvas = document.createElement('canvas');
  pixelCanvas.width = CTHULHU_RETRO_WIDTH;
  pixelCanvas.height = CTHULHU_RETRO_HEIGHT;
  const pixel = pixelCanvas.getContext('2d', { alpha: false });
  const playerBar = root.querySelector<HTMLElement>('[data-player-bar]');
  const playerHp = root.querySelector<HTMLElement>('[data-player-hp]');
  const bossBar = root.querySelector<HTMLElement>('[data-boss-bar]');
  const bossHp = root.querySelector<HTMLElement>('[data-boss-hp]');
  const phaseLabel = root.querySelector<HTMLElement>('[data-phase]');
  const resultPanel = root.querySelector<HTMLElement>('.cthulhu-retro-result');
  const resultTitle = root.querySelector<HTMLElement>('[data-result-title]');
  const resultCopy = root.querySelector<HTMLElement>('[data-result-copy]');
  const retryButton = root.querySelector<HTMLButtonElement>('[data-action="retry"]');
  const returnButton = root.querySelector<HTMLButtonElement>('[data-action="return"]');

  if (!canvas || !output || !pixel || !playerBar || !playerHp || !bossBar || !bossHp ||
      !phaseLabel || !resultPanel || !resultTitle || !resultCopy || !retryButton || !returnButton) {
    root.remove();
    options.onComplete({ won: false, hitsTaken: 0, successfulHits: 0 });
    return;
  }

  const audio = (() => {
    try { return typeof window.AudioContext === 'function' ? new window.AudioContext() : null; }
    catch { return null; }
  })();
  const playAbyssBass = (strength = 1) => {
    if (!audio) return;
    try {
      if (audio.state === 'suspended') void audio.resume();
      const now = audio.currentTime;
      const oscillator = audio.createOscillator();
      const sub = audio.createOscillator();
      const gain = audio.createGain();
      const subGain = audio.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(74, now);
      oscillator.frequency.exponentialRampToValueAtTime(31, now + 0.34);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16 * strength, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(43, now);
      sub.frequency.exponentialRampToValueAtTime(25, now + 0.48);
      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.exponentialRampToValueAtTime(0.24 * strength, now + 0.035);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
      oscillator.connect(gain);
      sub.connect(subGain);
      gain.connect(audio.destination);
      subGain.connect(audio.destination);
      oscillator.start(now);
      sub.start(now);
      oscillator.stop(now + 0.54);
      sub.stop(now + 0.60);
    } catch {
      // Audio is a cosmetic layer; gameplay never depends on Web Audio support.
    }
  };

  let state = createCthulhuRetroState();
  let rafId = 0;
  let lastFrame = 0;
  let lastHudTick = -1;
  let completed = false;
  const held = { left: false, right: false, dodge: false, attack: false };
  const keyHeld = { left: false, right: false, dodge: false, attack: false };
  const activePointers = new Map<number, { control: 'left' | 'right' | 'dodge' | 'attack' }>();
  const activeTouches = new Map<number, { control: 'left' | 'right' | 'dodge' | 'attack' }>();
  let dodgeQueued = false;

  const syncControl = (control: 'left' | 'right' | 'dodge' | 'attack') => {
    const pointerHeld = Array.from(activePointers.values()).some((entry) => entry.control === control);
    const touchHeld = Array.from(activeTouches.values()).some((entry) => entry.control === control);
    held[control] = keyHeld[control] || pointerHeld || touchHeld;
    root.querySelector<HTMLButtonElement>('[data-hold="' + control + '"]')
      ?.classList.toggle('is-pressed', held[control]);
  };

  const resize = () => {
    const ratio = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(960 * ratio);
    canvas.height = Math.round(540 * ratio);
    output.imageSmoothingEnabled = false;
    pixel.imageSmoothingEnabled = false;
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, now: number) => {
    const sky = ctx.createLinearGradient(0, 0, 0, CTHULHU_RETRO_HEIGHT);
    sky.addColorStop(0, '#080a19');
    sky.addColorStop(0.46, '#15112c');
    sky.addColorStop(1, '#102b35');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CTHULHU_RETRO_WIDTH, CTHULHU_RETRO_HEIGHT);

    // Deep-sea stars and bioluminescent plankton drift in different layers.
    for (let i = 0; i < 74; i++) {
      const x = (i * 79 + Math.floor(now * (2 + i % 4))) % CTHULHU_RETRO_WIDTH;
      const y = 8 + (i * 43) % 148;
      const size = i % 9 === 0 ? 2 : 1;
      ctx.fillStyle = i % 4 === 0 ? '#70f5d0' : i % 3 === 0 ? '#cf78e8' : '#a8bad7';
      ctx.globalAlpha = 0.30 + (i % 5) * 0.11;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;

    // A bruised violet moon hangs over the drowned city.
    ctx.fillStyle = 'rgba(188, 98, 190, .16)';
    ctx.beginPath();
    ctx.arc(104, 62, 43, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34264d';
    ctx.beginPath();
    ctx.arc(104, 62, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a35b9f';
    ctx.fillRect(95, 49, 4, 4);
    ctx.fillRect(116, 69, 7, 3);
    ctx.fillRect(82, 74, 8, 4);

    // The city skyline is purpose-built for this encounter, not a recolour of a warehouse map.
    const towers = [
      [0, 35, 56, 116], [42, 70, 28, 88], [81, 26, 44, 130], [133, 58, 38, 94],
      [184, 19, 48, 135], [241, 62, 40, 92], [284, 32, 34, 124], [325, 58, 47, 98],
      [382, 24, 42, 132], [430, 52, 50, 104],
    ];
    for (let i = 0; i < towers.length; i++) {
      const [x, width, top, height] = towers[i];
      ctx.fillStyle = i % 2 ? '#17152c' : '#1c1b38';
      ctx.fillRect(x, top, width, height);
      ctx.fillStyle = '#40315a';
      ctx.fillRect(x + 2, top, width - 4, 3);
      ctx.fillStyle = '#0b2530';
      ctx.fillRect(x + 5, top + 10, 3, height - 12);
      ctx.fillRect(x + width - 9, top + 17, 3, height - 20);
      ctx.fillStyle = '#4a2b68';
      for (let band = 0; band < Math.floor(height / 18); band++) {
        ctx.fillRect(x + 2, top + 15 + band * 18, width - 4, 2);
      }
      ctx.fillStyle = i % 3 === 0 ? '#4ce6c1' : '#9b4ea8';
      ctx.fillRect(x + Math.floor(width / 2), top - 5, 2, 7);
      if (i % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(x, top + 8);
        ctx.lineTo(x + width / 2, top - 10);
        ctx.lineTo(x + width, top + 8);
        ctx.closePath();
        ctx.fillStyle = '#1a1834';
        ctx.fill();
      }
    }

    // Foreground sea mist separates the player lane from the monolithic skyline.
    ctx.fillStyle = 'rgba(25, 107, 111, .16)';
    ctx.fillRect(0, 160, CTHULHU_RETRO_WIDTH, 40);
    ctx.fillStyle = 'rgba(93, 227, 197, .08)';
    for (let i = 0; i < 12; i++) {
      const x = (i * 47 + now * (13 + i % 3)) % 510 - 20;
      ctx.fillRect(x, 173 + (i % 4) * 8, 22 + (i % 3) * 8, 1);
    }

    // Massive broken obelisks frame the independent R'lyeh arena.
    ctx.fillStyle = '#101a2a';
    ctx.fillRect(9, 99, 12, 125);
    ctx.fillRect(3, 94, 24, 8);
    ctx.fillRect(14, 82, 3, 18);
    ctx.fillRect(458, 72, 13, 152);
    ctx.fillRect(451, 68, 27, 9);
    ctx.fillRect(462, 55, 4, 18);
    ctx.fillStyle = '#5a3b78';
    ctx.fillRect(17, 110, 2, 90);
    ctx.fillRect(462, 81, 2, 115);
    ctx.fillStyle = '#52edcc';
    ctx.globalAlpha = 0.45 + Math.sin(now * 2) * 0.12;
    ctx.fillRect(16, 147, 3, 18);
    ctx.fillRect(462, 128, 3, 24);
    ctx.globalAlpha = 1;
  };

  const drawArenaFloor = (ctx: CanvasRenderingContext2D, now: number) => {
    ctx.fillStyle = '#0a121e';
    ctx.fillRect(0, CTHULHU_RETRO_FLOOR, CTHULHU_RETRO_WIDTH, 44);
    ctx.fillStyle = '#243044';
    ctx.fillRect(0, CTHULHU_RETRO_FLOOR, CTHULHU_RETRO_WIDTH, 5);
    ctx.fillStyle = '#4d4569';
    ctx.fillRect(0, CTHULHU_RETRO_FLOOR - 2, CTHULHU_RETRO_WIDTH, 2);
    for (let x = 0; x < CTHULHU_RETRO_WIDTH; x += 24) {
      ctx.fillStyle = x % 48 === 0 ? '#1e2b3b' : '#152433';
      ctx.fillRect(x + 1, CTHULHU_RETRO_FLOOR + 6, 22, 17);
      ctx.fillStyle = '#344159';
      ctx.fillRect(x + 1, CTHULHU_RETRO_FLOOR + 6, 22, 2);
    }
    ctx.strokeStyle = 'rgba(75, 235, 200, .48)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x = 38 + i * 94;
      ctx.beginPath();
      ctx.moveTo(x, CTHULHU_RETRO_FLOOR + 7);
      ctx.lineTo(x + 10, CTHULHU_RETRO_FLOOR + 16);
      ctx.lineTo(x + 22, CTHULHU_RETRO_FLOOR + 9);
      ctx.stroke();
    }
    ctx.fillStyle = '#55f3c9';
    ctx.globalAlpha = 0.28 + Math.sin(now * 2.4) * 0.12;
    ctx.fillRect(0, CTHULHU_RETRO_FLOOR - 1, CTHULHU_RETRO_WIDTH, 1);
    ctx.globalAlpha = 1;
  };

  const drawBoss = (ctx: CanvasRenderingContext2D, now: number) => {
    const boss = state.boss;
    const rise = 1 - boss.riseSeconds / 1.45;
    const y = boss.y + boss.riseSeconds * 45;
    const pulse = Math.sin(now * (boss.phase === 2 ? 6 : 3.4));
    const wingFlap = Math.sin(now * (boss.phase === 2 ? 5.2 : 2.5)) * (boss.phase === 2 ? 9 : 5);
    const vulnerable = boss.coreOpenSeconds > 0;
    ctx.save();
    ctx.translate(boss.x, y);

    // The wings span almost the entire right half of the playfield.
    ctx.fillStyle = boss.phase === 2 ? '#3d1c53' : '#162a3d';
    ctx.strokeStyle = boss.phase === 2 ? '#e55cb5' : '#4c6e86';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-19, -100);
    ctx.lineTo(-78, -128 - wingFlap);
    ctx.lineTo(-103, -92 - wingFlap);
    ctx.lineTo(-78, -72);
    ctx.lineTo(-90, -45);
    ctx.lineTo(-55, -54);
    ctx.lineTo(-34, -28);
    ctx.lineTo(-17, -78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(19, -100);
    ctx.lineTo(81, -133 + wingFlap);
    ctx.lineTo(105, -92 + wingFlap);
    ctx.lineTo(78, -72);
    ctx.lineTo(92, -43);
    ctx.lineTo(53, -54);
    ctx.lineTo(34, -28);
    ctx.lineTo(17, -78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(111, 229, 200, .52)';
    ctx.lineWidth = 1;
    for (const side of [-1, 1]) {
      for (let rib = 0; rib < 4; rib++) {
        ctx.beginPath();
        ctx.moveTo(side * 18, -91);
        ctx.lineTo(side * (42 + rib * 14), -119 + Math.abs(rib - 1.5) * 10 + wingFlap * side * 0.25);
        ctx.stroke();
      }
    }

    // Crowned cephalopod head, lit by two acidic green eyes.
    ctx.fillStyle = boss.hitFlash > 0 ? '#bbf9dc' : boss.phase === 2 ? '#347d7b' : '#285a62';
    ctx.beginPath();
    ctx.ellipse(0, -124, 31, 25, -0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#77baa6';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#1a2534';
    ctx.fillRect(-19, -133, 11, 10);
    ctx.fillRect(9, -133, 11, 10);
    ctx.fillStyle = '#b7ffb0';
    ctx.shadowColor = '#8bffbd';
    ctx.shadowBlur = 10;
    ctx.fillRect(-16, -131, 5, 5);
    ctx.fillRect(12, -131, 5, 5);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#0b1925';
    ctx.beginPath();
    ctx.ellipse(0, -108, 17, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Five crown spikes and seven distinct facial tentacles.
    ctx.fillStyle = '#477b78';
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 11;
      ctx.beginPath();
      ctx.moveTo(x - 4, -143);
      ctx.lineTo(x, -160 - (2 - Math.abs(i - 2)) * 3);
      ctx.lineTo(x + 4, -143);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 7;
      const swing = Math.sin(now * 3.1 + i * 1.1) * 4;
      ctx.strokeStyle = i % 2 ? '#58a99a' : '#8aab91';
      ctx.lineWidth = i === 3 ? 7 : 5;
      ctx.beginPath();
      ctx.moveTo(x, -105);
      ctx.quadraticCurveTo(x + swing, -83, x + (i - 3) * 11 + swing, -59 - (i % 2) * 5);
      ctx.stroke();
      ctx.fillStyle = '#c3d4aa';
      for (let dot = 0; dot < 3; dot++) {
        ctx.fillRect(x + (i - 3) * 4 + dot * 2, -91 + dot * 7, 2, 2);
      }
    }

    // Heavy torso and shoulder plates.
    ctx.fillStyle = boss.hitFlash > 0 ? '#c8ffe8' : boss.phase === 2 ? '#214b60' : '#183b4a';
    ctx.beginPath();
    ctx.ellipse(0, -61, 40, 49, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#426f79';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#315b66';
    ctx.fillRect(-44, -89, 17, 26);
    ctx.fillRect(27, -89, 17, 26);
    ctx.fillStyle = '#101d31';
    ctx.fillRect(-22, -35, 14, 28);
    ctx.fillRect(8, -35, 14, 28);

    // Arms reach outward while the huge lower tentacles rake the stone.
    ctx.strokeStyle = '#397f79';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(-32, -83);
    ctx.quadraticCurveTo(-65, -76 + Math.sin(now * 2) * 8, -77, -39);
    ctx.moveTo(32, -83);
    ctx.quadraticCurveTo(66, -80 - Math.sin(now * 2.2) * 7, 76, -38);
    ctx.stroke();
    ctx.strokeStyle = '#a9b996';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-78, -39);
    ctx.lineTo(-91, -29);
    ctx.moveTo(76, -38);
    ctx.lineTo(91, -28);
    ctx.stroke();

    // Six long tentacles frame the core and make the boss read as enormous.
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const row = i % 3;
      const wave = Math.sin(now * 2.1 + i * 0.9) * 8;
      const startX = side * (16 + row * 8);
      ctx.strokeStyle = i % 2 ? '#276e72' : '#4f8e81';
      ctx.lineWidth = 8 - row;
      ctx.beginPath();
      ctx.moveTo(startX, -42);
      ctx.bezierCurveTo(
        startX + side * (18 + wave), -16,
        side * (45 + row * 19), -8 + wave,
        side * (76 + row * 20), -2 + wave,
      );
      ctx.stroke();
      ctx.fillStyle = '#a2ddba';
      ctx.fillRect(side * (76 + row * 20) - 2, -5 + wave, 5, 4);
    }

    // Runes orbiting the creature are animated even when the core is shut.
    ctx.save();
    ctx.rotate(now * (boss.phase === 2 ? 0.95 : 0.42));
    ctx.strokeStyle = vulnerable ? '#ff5bd2' : '#52d7bf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -69, 55 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const x = Math.cos(angle) * 55;
      const yRune = -69 + Math.sin(angle) * 55;
      ctx.fillStyle = i % 2 ? '#b85cba' : '#7bf0d1';
      ctx.fillRect(x - 2, yRune - 3, 5, 6);
    }
    ctx.restore();

    // Core is a separate iris. It becomes a bright target for exactly 2.15 s.
    ctx.fillStyle = vulnerable ? '#ff54ce' : '#124d55';
    ctx.shadowColor = vulnerable ? '#ff69dd' : '#35e3c1';
    ctx.shadowBlur = vulnerable ? 19 : 5;
    ctx.beginPath();
    ctx.ellipse(BOSS_CORE_X_OFFSET, BOSS_CORE_Y_OFFSET, vulnerable ? 12 : 7, vulnerable ? 14 : 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = vulnerable ? '#fff2c8' : '#67b6a1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(BOSS_CORE_X_OFFSET, BOSS_CORE_Y_OFFSET, vulnerable ? 17 : 11, vulnerable ? 19 : 13, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff2c8';
    ctx.fillRect(BOSS_CORE_X_OFFSET - 2, BOSS_CORE_Y_OFFSET - 3, 4, 7);

    if (boss.strikeSeconds > 0) {
      ctx.strokeStyle = 'rgba(255, 90, 192, .9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -62, 67 + (0.32 - boss.strikeSeconds) * 90, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, now: number) => {
    const player = state.player;
    const blink = player.invulnerability > 0 && Math.floor(now * 18) % 2 === 0;
    if (blink) return;
    const stride = player.grounded ? Math.sin(player.animation * 1.6) * 2 : 0;
    ctx.save();
    ctx.translate(Math.round(player.x), Math.round(player.y));
    if (player.facing < 0) {
      ctx.translate(PLAYER_WIDTH, 0);
      ctx.scale(-1, 1);
    }
    if (player.dodgeSeconds > 0) ctx.globalAlpha = 0.70;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(-2, PLAYER_HEIGHT + 1, PLAYER_WIDTH + 5, 2);
    ctx.fillStyle = '#17283a';
    ctx.fillRect(2, 17 + stride, 4, 8 - stride);
    ctx.fillRect(8, 17 - stride, 4, 8 + stride);
    ctx.fillStyle = '#0b1624';
    ctx.fillRect(0, 23, 7, 3);
    ctx.fillRect(7, 23, 7, 3);
    ctx.fillStyle = '#d86d34';
    ctx.fillRect(1, 7, 12, 12);
    ctx.fillStyle = '#f4c36c';
    ctx.fillRect(2, 9, 10, 2);
    ctx.fillRect(2, 15, 10, 2);
    ctx.fillStyle = '#fff0c6';
    ctx.fillRect(6, 8, 2, 10);
    ctx.fillStyle = '#e7b78d';
    ctx.fillRect(3, 1, 9, 8);
    ctx.fillStyle = '#e0ad37';
    ctx.fillRect(1, 0, 12, 3);
    ctx.fillRect(3, -3, 8, 4);
    ctx.fillStyle = '#19283a';
    ctx.fillRect(9, 3, 2, 2);
    ctx.fillStyle = '#58e7cf';
    ctx.fillRect(11, 8, 2, 3);
    ctx.restore();
  };

  const drawScene = () => {
    const ctx = pixel;
    const shake = state.screenShake > 0 ? (Math.random() - 0.5) * state.screenShake * 6 : 0;
    ctx.save();
    ctx.translate(shake, Math.abs(shake) * 0.25);
    drawBackground(ctx, state.elapsed);
    drawArenaFloor(ctx, state.elapsed);

    // Necronomicon remains visible for the opening seconds, then the book is swallowed by the portal.
    if (state.introSeconds > 0.55) {
      const progress = clamp((2.7 - state.introSeconds) / 2.15, 0, 1);
      const fade = progress > 0.82 ? 1 - (progress - 0.82) / 0.18 : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(250, 203 - Math.sin(progress * Math.PI) * 16);
      ctx.fillStyle = '#24172d';
      ctx.fillRect(-22, -7, 44, 15);
      ctx.fillStyle = '#b39259';
      ctx.fillRect(-20, -8, 40, 2);
      ctx.fillStyle = '#d5c59a';
      ctx.fillRect(-16, -5, 32, 9);
      ctx.fillStyle = '#4c2348';
      ctx.fillRect(-22, -8, 3, 16);
      ctx.fillStyle = '#73f1d1';
      ctx.strokeStyle = '#73f1d1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -13, 13 + Math.sin(state.elapsed * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(-2, -15, 4, 5);
      ctx.restore();
      for (let rune = 0; rune < 6; rune++) {
        const angle = state.elapsed * 1.8 + rune / 6 * Math.PI * 2;
        const x = 250 + Math.cos(angle) * (24 + progress * 28);
        const y = 185 + Math.sin(angle) * 16 - progress * 30;
        ctx.fillStyle = rune % 2 ? '#de69c2' : '#71f5cf';
        ctx.fillRect(Math.round(x), Math.round(y), 3, 4);
      }
    }

    // Slam shockwaves and active lane warnings are painted below the player.
    for (const wave of state.shockwaves) {
      ctx.strokeStyle = '#ff5dba';
      ctx.lineWidth = 3;
      ctx.globalAlpha = clamp(wave.life, 0, 1);
      ctx.beginPath();
      ctx.ellipse(wave.x, CTHULHU_RETRO_FLOOR + 1, 12, 5 + (2.3 - wave.life) * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f4b2dd';
      ctx.fillRect(wave.x - 5, CTHULHU_RETRO_FLOOR - 4, 10, 3);
      ctx.globalAlpha = 1;
    }

    drawBoss(ctx, state.elapsed);

    for (const projectile of state.projectiles) {
      ctx.save();
      ctx.shadowColor = '#81ffe0';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#efffe5';
      ctx.fillRect(projectile.x - 4, projectile.y - 2, 9, 4);
      ctx.fillStyle = '#54efd1';
      ctx.fillRect(projectile.x - 10, projectile.y - 1, 7, 2);
      ctx.restore();
    }

    drawPlayer(ctx, state.elapsed);

    if (state.boss.windup > 0 && state.boss.riseSeconds <= 0) {
      const warning = state.boss.attack === 'slam'
        ? 'FALA UDERZENIOWA — SKOCZ!'
        : state.boss.attack === 'lash'
          ? 'MACKA NADCHODZI — UNIK / SKOK!'
          : 'NAMIERZANIE — ODSUŃ SIĘ!';
      ctx.fillStyle = 'rgba(8, 9, 24, .9)';
      ctx.fillRect(116, 12, 248, 19);
      ctx.strokeStyle = state.boss.phase === 2 ? '#ff5db8' : '#e2a4e8';
      ctx.strokeRect(116, 12, 248, 19);
      ctx.fillStyle = '#fff0da';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(warning, 240, 25);
    }

    if (state.boss.coreOpenSeconds > 0) {
      ctx.fillStyle = 'rgba(25, 7, 35, .92)';
      ctx.fillRect(155, 36, 170, 16);
      ctx.strokeStyle = '#ff67d8';
      ctx.strokeRect(155, 36, 170, 16);
      ctx.fillStyle = '#ffe8f8';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RDZEN ODKRYTY • ATAKUJ!  +50%', 240, 47);
    }

    if (state.boss.phase === 2) {
      ctx.fillStyle = 'rgba(48, 8, 47, .72)';
      ctx.fillRect(8, 36, 114, 14);
      ctx.fillStyle = '#ff8bd3';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('GNIEW GLEBIN', 15, 46);
    }

    if (state.damageFlash > 0) {
      ctx.fillStyle = 'rgba(255, 38, 128, ' + (state.damageFlash * 0.5) + ')';
      ctx.fillRect(0, 0, CTHULHU_RETRO_WIDTH, CTHULHU_RETRO_HEIGHT);
    }

    if (state.introSeconds > 1.5) {
      ctx.fillStyle = 'rgba(5, 6, 18, .88)';
      ctx.fillRect(50, 87, 380, 38);
      ctx.strokeStyle = '#b95fb3';
      ctx.strokeRect(50, 87, 380, 38);
      ctx.fillStyle = '#f6d4f3';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NECRONOMICON OTWIERA BRAME', 240, 102);
      ctx.fillStyle = '#83f1cf';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('ZATOPIONE MIASTO R’LYEH • NIE MA ODWROTU', 240, 115);
    }
    ctx.restore();

    output.setTransform(1, 0, 0, 1, 0, 0);
    output.imageSmoothingEnabled = false;
    output.drawImage(pixelCanvas, 0, 0, canvas.width, canvas.height);
  };

  const updateHud = () => {
    const playerPercent = state.player.hp / state.player.maxHp * 100;
    const bossPercent = state.boss.hp / state.boss.maxHp * 100;
    playerBar.style.width = playerPercent + '%';
    bossBar.style.width = bossPercent + '%';
    playerHp.textContent = state.player.hp + '%';
    bossHp.textContent = Math.ceil(state.boss.hp) + ' / ' + state.boss.maxHp;
    phaseLabel.textContent = getCthulhuRetroPhaseLabel(state.boss.phase);
    phaseLabel.classList.toggle('is-phase-two', state.boss.phase === 2);
  };

  const showResult = () => {
    resultPanel.hidden = false;
    if (state.won) {
      resultTitle.textContent = 'R’LYEH ZAPADA SIĘ POD FALE';
      resultCopy.textContent = 'CTHULHU POKONANY. Rdzeń pradawnego boga gaśnie, a zatopione miasto rozpada się na pikselowe odłamki. Nagroda po powrocie: +6 000 punktów.';
      retryButton.hidden = true;
    } else {
      resultTitle.textContent = 'GŁĘBINY ZATRZYMAŁY OPERATORA';
      resultCopy.textContent = 'Cthulhu przeżył. Możesz ponowić walkę albo wrócić do magazynu bez premii za pokonanie bossa.';
      retryButton.hidden = false;
    }
  };

  const clearHeldInput = () => {
    activePointers.clear();
    activeTouches.clear();
    dodgeQueued = false;
    for (const control of ['left', 'right', 'dodge', 'attack'] as const) {
      keyHeld[control] = false;
      held[control] = false;
      root.querySelector<HTMLButtonElement>('[data-hold="' + control + '"]')?.classList.remove('is-pressed');
    }
  };

  const finish = () => {
    if (completed) return;
    completed = true;
    window.cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointerup', releasePointer, true);
    window.removeEventListener('pointercancel', releasePointer, true);
    window.removeEventListener('touchend', releaseTouch, true);
    window.removeEventListener('touchcancel', releaseTouch, true);
    window.removeEventListener('blur', onWindowBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    clearHeldInput();
    if (audio) void audio.close().catch(() => undefined);
    document.body.style.overflow = previousBodyOverflow;
    root.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
    options.onComplete({
      won: state.won,
      hitsTaken: state.hitsTaken,
      successfulHits: state.successfulHits,
    });
  };

  const resetRun = () => {
    state = createCthulhuRetroState();
    clearHeldInput();
    lastFrame = 0;
    lastHudTick = -1;
    resultPanel.hidden = true;
    updateHud();
    drawScene();
    if (!rafId && !completed) rafId = window.requestAnimationFrame(frame);
    playAbyssBass(0.7);
  };

  const onWindowBlur = () => clearHeldInput();
  const onVisibilityChange = () => { if (document.hidden) onWindowBlur(); };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Tab') {
      const focusable = Array.from(root.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
        .filter((button) => !button.closest('[hidden]'));
      if (focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
      return;
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish();
      return;
    }
    if (['ArrowLeft', 'KeyA'].includes(event.code)) {
      keyHeld.left = true; syncControl('left');
    }
    if (['ArrowRight', 'KeyD'].includes(event.code)) {
      keyHeld.right = true; syncControl('right');
    }
    if (['Space', 'ArrowUp', 'KeyW', 'ShiftLeft', 'ShiftRight', 'KeyQ'].includes(event.code)) {
      if (!event.repeat) dodgeQueued = true;
      keyHeld.dodge = true; syncControl('dodge');
    }
    if (['KeyJ', 'KeyK', 'KeyX', 'KeyF', 'Numpad0'].includes(event.code)) {
      keyHeld.attack = true; syncControl('attack');
      playAbyssBass(0.10);
    }
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'ArrowUp', 'KeyW', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyJ', 'KeyK', 'KeyX', 'KeyF', 'Numpad0'].includes(event.code)) {
      event.preventDefault(); event.stopPropagation();
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (['ArrowLeft', 'KeyA'].includes(event.code)) { keyHeld.left = false; syncControl('left'); }
    if (['ArrowRight', 'KeyD'].includes(event.code)) { keyHeld.right = false; syncControl('right'); }
    if (['Space', 'ArrowUp', 'KeyW', 'ShiftLeft', 'ShiftRight', 'KeyQ'].includes(event.code)) {
      keyHeld.dodge = false; syncControl('dodge');
    }
    if (['KeyJ', 'KeyK', 'KeyX', 'KeyF', 'Numpad0'].includes(event.code)) {
      keyHeld.attack = false; syncControl('attack');
    }
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'ArrowUp', 'KeyW', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyJ', 'KeyK', 'KeyX', 'KeyF', 'Numpad0'].includes(event.code)) {
      event.preventDefault(); event.stopPropagation();
    }
  };

  const releasePointer = (event: PointerEvent) => {
    const owner = activePointers.get(event.pointerId);
    if (!owner) return;
    activePointers.delete(event.pointerId);
    syncControl(owner.control);
  };
  const releaseTouch = (event: TouchEvent) => {
    for (const touch of Array.from(event.changedTouches)) {
      const owner = activeTouches.get(touch.identifier);
      if (!owner) continue;
      activeTouches.delete(touch.identifier);
      syncControl(owner.control);
    }
  };

  root.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach((button) => {
    const control = button.dataset.hold;
    if (control !== 'left' && control !== 'right' && control !== 'dodge' && control !== 'attack') return;
    button.style.touchAction = 'none';
    button.style.pointerEvents = 'auto';
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault(); event.stopPropagation();
      activePointers.set(event.pointerId, { control });
      syncControl(control);
      if (control === 'dodge') dodgeQueued = true;
      if (control === 'attack') playAbyssBass(0.12);
      try { button.setPointerCapture(event.pointerId); } catch { /* global release remains available */ }
    });
    button.addEventListener('touchstart', (event) => {
      event.preventDefault(); event.stopPropagation();
      for (const touch of Array.from(event.changedTouches)) activeTouches.set(touch.identifier, { control });
      syncControl(control);
      if (control === 'dodge' && event.changedTouches.length > 0) dodgeQueued = true;
      if (control === 'attack') playAbyssBass(0.12);
    }, { passive: false });
    button.addEventListener('lostpointercapture', releasePointer);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  window.addEventListener('pointerup', releasePointer, true);
  window.addEventListener('pointercancel', releasePointer, true);
  window.addEventListener('touchend', releaseTouch, { capture: true, passive: false });
  window.addEventListener('touchcancel', releaseTouch, { capture: true, passive: false });
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('resize', resize, { passive: true });
  root.querySelector('[data-action="exit"]')?.addEventListener('click', finish);
  returnButton.addEventListener('click', finish);
  retryButton.addEventListener('click', resetRun);

  document.body.style.overflow = 'hidden';
  root.querySelector<HTMLButtonElement>('[data-action="exit"]')?.focus();
  resize();
  updateHud();
  drawScene();

  const frame = (now: number) => {
    const dt = lastFrame ? Math.min(1 / 30, Math.max(0, (now - lastFrame) / 1000)) : 1 / 60;
    lastFrame = now;
    const previousCoreOpen = state.boss.coreOpenSeconds;
    const previousWindup = state.boss.windup;
    const previousHp = state.boss.hp;
    const previousPhase = state.boss.phase;
    const previousProjectileCount = state.projectiles.length;
    stepCthulhuRetroState(state, {
      left: held.left,
      right: held.right,
      dodgePressed: dodgeQueued,
      attackHeld: held.attack,
    }, dt);
    dodgeQueued = false;

    if (state.boss.strikeSeconds > 0 && previousWindup > 0 && state.boss.windup <= 0) {
      playAbyssBass(state.boss.phase === 2 ? 1.45 : 1.0);
    }
    if (state.projectiles.length > previousProjectileCount) playAbyssBass(0.10);
    if (state.boss.hp < previousHp) playAbyssBass(0.22);
    if (state.boss.phase !== previousPhase) playAbyssBass(1.3);
    if (state.won && !state.boss.defeated) state.boss.defeated = true;
    const hudTick = Math.floor(state.elapsed * 10);
    if (hudTick !== lastHudTick || previousCoreOpen !== state.boss.coreOpenSeconds) {
      lastHudTick = hudTick;
      updateHud();
    }
    if (state.finished) showResult();
    drawScene();
    if (!completed && !state.finished) rafId = window.requestAnimationFrame(frame);
    else rafId = 0;
  };
  rafId = window.requestAnimationFrame(frame);
}
