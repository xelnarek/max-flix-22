import type { CharacterId } from './types.ts';

export interface PvpVector2 {
  x: number;
  z: number;
}

export interface PvpObstacle {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  type: 'pallet' | 'barrier' | 'pillar';
}

export interface PvpPickup {
  id: string;
  x: number;
  z: number;
  active: boolean;
  healAmount: number;
  respawnTimeSeconds: number;
  respawnTimer: number;
}

export interface PvpProjectile {
  id: string;
  ownerSlot: 'p1' | 'p2';
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  damage: number;
  life: number;
  pierce: number;
  color: number;
}

export type PvpSlot = 'p1' | 'p2';

export interface PvpPlayerState {
  slot: PvpSlot;
  operatorId: CharacterId;
  name: string;
  nickname: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  hp: number;
  maxHp: number;
  shieldHp: number;
  isDashing: boolean;
  dashTimer: number;
  dashCooldownTimer: number;
  attackCooldownTimer: number;
  abilityCooldownTimer: number;
  score: number; // rounds won
  isReady: boolean;
  connected: boolean;
  aimAngle: number;
  isFiring: boolean;
  stunTimer: number;
  // stats for match summary
  damageDealt: number;
  shotsFired: number;
  shotsHit: number;
}

export type PvpMatchStatus = 'waiting' | 'ready' | 'countdown' | 'in_round' | 'round_end' | 'match_end';

export interface PvpArenaState {
  status: PvpMatchStatus;
  round: number;
  currentRound: number;
  maxRounds: number; // usually 3 (best of 3)
  roundsToWin: number; // usually 2
  countdownTimer: number;
  roundEndTimer: number;
  roundWinner: PvpSlot | 'draw' | null;
  matchWinner: PvpSlot | null;
  winner: PvpSlot | null;
  score: { p1: number; p2: number };
  stats: {
    p1: { damageDealt: number; shotsFired: number; shotsHit: number };
    p2: { damageDealt: number; shotsFired: number; shotsHit: number };
  };
  p1: PvpPlayerState;
  p2: PvpPlayerState;
  obstacles: PvpObstacle[];
  pickup: PvpPickup;
  projectiles: PvpProjectile[];
  lastHitEvent?: {
    targetSlot: PvpSlot;
    damage: number;
    sourceSlot: PvpSlot;
    x: number;
    z: number;
  };
}

export interface PvpInputIntent {
  moveX: number;
  moveZ: number;
  aimAngle: number;
  isFiring: boolean;
  wantDash?: boolean;
  wantAbility?: boolean;
}

export const PVP_ARENA_BOUNDS = {
  minX: -22,
  maxX: 22,
  minZ: -12,
  maxZ: 12,
};

export const PVP_SPAWN_P1 = { x: -16, y: 0.5, z: 0, rot: Math.PI / 2 };
export const PVP_SPAWN_P2 = { x: 16, y: 0.5, z: 0, rot: -Math.PI / 2 };

export const PVP_NORMALIZED_HP = 1000;
export const PVP_BASE_SPEED = 9.5;
export const PVP_DASH_SPEED = 24.0;
export const PVP_DASH_DURATION = 0.22;
export const PVP_DASH_COOLDOWN = 3.2;
export const PVP_ABILITY_COOLDOWN = 9.0;
export const PVP_PLAYER_RADIUS = 0.65;

export interface OperatorPvpProfile {
  name: string;
  projectileSpeed: number;
  projectileDamage: number;
  attackCooldown: number;
  projectileRadius: number;
  color: number;
  abilityName: string;
  abilityDesc: string;
}

export const PVP_OPERATOR_PROFILES: Record<CharacterId, OperatorPvpProfile> = {
  marcin: {
    name: 'Audytor Marcin',
    projectileSpeed: 26,
    projectileDamage: 85,
    attackCooldown: 0.28,
    projectileRadius: 0.28,
    color: 0x3b82f6,
    abilityName: 'Pieczęć WZ (Tarcza BHP)',
    abilityDesc: 'Tymczasowa tarcza pochłaniająca 250 pkt obrażeń i odpychająca wroga.',
  },
  grzesiek: {
    name: 'Grzesiek Monter',
    projectileSpeed: 19,
    projectileDamage: 135,
    attackCooldown: 0.48,
    projectileRadius: 0.42,
    color: 0xf59e0b,
    abilityName: 'Szarża Paleciaka',
    abilityDesc: 'Potężny taran na wprost zadający 180 pkt obrażeń i ogłuszający na 0.8s.',
  },
  dawid: {
    name: 'Dawid Handlowiec',
    projectileSpeed: 30,
    projectileDamage: 65,
    attackCooldown: 0.22,
    projectileRadius: 0.22,
    color: 0x10b981,
    abilityName: 'Laserowy Protokół Strat',
    abilityDesc: 'Potrójna wiązka laserowa w wachlarzu zadająca 3x65 pkt obrażeń.',
  },
  mateusz: {
    name: 'Mateusz Kierownik',
    projectileSpeed: 21,
    projectileDamage: 115,
    attackCooldown: 0.38,
    projectileRadius: 0.35,
    color: 0xef4444,
    abilityName: 'Hydrauliczne Przełamanie',
    abilityDesc: 'Impuls uderzeniowy o promieniu 5m zadający 150 pkt obrażeń.',
  },
  piotr: {
    name: 'Piotr Serwisant',
    projectileSpeed: 24,
    projectileDamage: 95,
    attackCooldown: 0.32,
    projectileRadius: 0.32,
    color: 0x8b5cf6,
    abilityName: 'Impuls Zwarcia B4',
    abilityDesc: 'Wyładowanie elektryczne paraliżujące przeciwnika na 1.1s i zadające 110 dmg.',
  },
};

export function createDefaultPvpObstacles(): PvpObstacle[] {
  return [
    // Symmetric central cover
    { id: 'cover_center_n', x: 0, z: -5.0, width: 4.5, depth: 2.4, height: 1.5, type: 'pallet' },
    { id: 'cover_center_s', x: 0, z: 5.0, width: 4.5, depth: 2.4, height: 1.5, type: 'pallet' },
    // West flanking barricades
    { id: 'barrier_west', x: -8.0, z: 0, width: 1.8, depth: 4.8, height: 1.4, type: 'barrier' },
    // East flanking barricades
    { id: 'barrier_east', x: 8.0, z: 0, width: 1.8, depth: 4.8, height: 1.4, type: 'barrier' },
    // Corner support pillars
    { id: 'pillar_nw', x: -14.0, z: -7.5, width: 2.0, depth: 2.0, height: 3.5, type: 'pillar' },
    { id: 'pillar_sw', x: -14.0, z: 7.5, width: 2.0, depth: 2.0, height: 3.5, type: 'pillar' },
    { id: 'pillar_ne', x: 14.0, z: -7.5, width: 2.0, depth: 2.0, height: 3.5, type: 'pillar' },
    { id: 'pillar_se', x: 14.0, z: 7.5, width: 2.0, depth: 2.0, height: 3.5, type: 'pillar' },
  ];
}

export function createInitialPvpPlayer(slot: 'p1' | 'p2', operatorId: CharacterId, name: string): PvpPlayerState {
  const spawn = slot === 'p1' ? PVP_SPAWN_P1 : PVP_SPAWN_P2;
  return {
    slot,
    operatorId,
    name,
    nickname: name,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    rot: spawn.rot,
    hp: PVP_NORMALIZED_HP,
    maxHp: PVP_NORMALIZED_HP,
    shieldHp: 0,
    isDashing: false,
    dashTimer: 0,
    dashCooldownTimer: 0,
    attackCooldownTimer: 0,
    abilityCooldownTimer: 0,
    score: 0,
    isReady: false,
    connected: true,
    aimAngle: spawn.rot,
    isFiring: false,
    stunTimer: 0,
    damageDealt: 0,
    shotsFired: 0,
    shotsHit: 0,
  };
}

export function createInitialPvpArenaState(
  p1Operator: CharacterId = 'marcin',
  p1Name = 'Gracz 1',
  p2Operator: CharacterId = 'grzesiek',
  p2Name = 'Gracz 2'
): PvpArenaState {
  const p1 = createInitialPvpPlayer('p1', p1Operator, p1Name);
  const p2 = createInitialPvpPlayer('p2', p2Operator, p2Name);
  return {
    status: 'waiting',
    round: 1,
    currentRound: 1,
    maxRounds: 3,
    roundsToWin: 2,
    countdownTimer: 3.0,
    roundEndTimer: 0,
    roundWinner: null,
    matchWinner: null,
    winner: null,
    score: { p1: 0, p2: 0 },
    stats: {
      p1: { damageDealt: 0, shotsFired: 0, shotsHit: 0 },
      p2: { damageDealt: 0, shotsFired: 0, shotsHit: 0 },
    },
    p1,
    p2,
    obstacles: createDefaultPvpObstacles(),
    pickup: {
      id: 'center_medkit',
      x: 0,
      z: 0,
      active: true,
      healAmount: 220,
      respawnTimeSeconds: 14.0,
      respawnTimer: 0,
    },
    projectiles: [],
  };
}

export function resetPvpRound(state: PvpArenaState) {
  state.p1.x = PVP_SPAWN_P1.x;
  state.p1.y = PVP_SPAWN_P1.y;
  state.p1.z = PVP_SPAWN_P1.z;
  state.p1.rot = PVP_SPAWN_P1.rot;
  state.p1.aimAngle = PVP_SPAWN_P1.rot;
  state.p1.hp = PVP_NORMALIZED_HP;
  state.p1.shieldHp = 0;
  state.p1.isDashing = false;
  state.p1.dashTimer = 0;
  state.p1.dashCooldownTimer = 0;
  state.p1.attackCooldownTimer = 0;
  state.p1.abilityCooldownTimer = 0;
  state.p1.stunTimer = 0;

  state.p2.x = PVP_SPAWN_P2.x;
  state.p2.y = PVP_SPAWN_P2.y;
  state.p2.z = PVP_SPAWN_P2.z;
  state.p2.rot = PVP_SPAWN_P2.rot;
  state.p2.aimAngle = PVP_SPAWN_P2.rot;
  state.p2.hp = PVP_NORMALIZED_HP;
  state.p2.shieldHp = 0;
  state.p2.isDashing = false;
  state.p2.dashTimer = 0;
  state.p2.dashCooldownTimer = 0;
  state.p2.attackCooldownTimer = 0;
  state.p2.abilityCooldownTimer = 0;
  state.p2.stunTimer = 0;

  state.projectiles = [];
  state.pickup.active = true;
  state.pickup.respawnTimer = 0;
  state.roundWinner = null;
  state.countdownTimer = 3.0;
  state.status = 'countdown';
}

export function checkObstacleCollision(x: number, z: number, radius: number, obstacles: PvpObstacle[]): { hit: boolean; pushX: number; pushZ: number } {
  let hit = false;
  let pushX = 0;
  let pushZ = 0;

  for (const obs of obstacles) {
    const halfW = obs.width / 2;
    const halfD = obs.depth / 2;

    const closestX = Math.max(obs.x - halfW, Math.min(x, obs.x + halfW));
    const closestZ = Math.max(obs.z - halfD, Math.min(z, obs.z + halfD));

    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      hit = true;
      const dist = Math.sqrt(distSq);
      if (dist < 1e-4) {
        const penLeft = x - (obs.x - halfW);
        const penRight = obs.x + halfW - x;
        const penTop = z - (obs.z - halfD);
        const penBottom = obs.z + halfD - z;
        const minPen = Math.min(penLeft, penRight, penTop, penBottom);
        if (minPen === penLeft) pushX -= penLeft + radius;
        else if (minPen === penRight) pushX += penRight + radius;
        else if (minPen === penTop) pushZ -= penTop + radius;
        else pushZ += penBottom + radius;
      } else {
        const overlap = radius - dist;
        pushX += (dx / dist) * overlap;
        pushZ += (dz / dist) * overlap;
      }
    }
  }

  return { hit, pushX, pushZ };
}

export function stepPvpArena(state: PvpArenaState, dt: number, p1Input?: PvpInputIntent, p2Input?: PvpInputIntent): void {
  // Clear transient hit events from previous frame
  state.lastHitEvent = undefined;

  // Sync helpers for external consumers
  state.currentRound = state.round;
  state.winner = state.matchWinner;
  state.score = { p1: state.p1.score, p2: state.p2.score };
  state.stats = {
    p1: { damageDealt: state.p1.damageDealt, shotsFired: state.p1.shotsFired, shotsHit: state.p1.shotsHit },
    p2: { damageDealt: state.p2.damageDealt, shotsFired: state.p2.shotsFired, shotsHit: state.p2.shotsHit },
  };

  // Handle countdown
  if (state.status === 'countdown') {
    state.countdownTimer -= dt;
    if (state.countdownTimer <= 0) {
      state.countdownTimer = 0;
      state.status = 'in_round';
    }
    return;
  }

  // Handle round end delay
  if (state.status === 'round_end') {
    state.roundEndTimer -= dt;
    if (state.roundEndTimer <= 0) {
      if (state.p1.score >= state.roundsToWin || state.p2.score >= state.roundsToWin) {
        state.status = 'match_end';
        state.matchWinner = state.p1.score >= state.roundsToWin ? 'p1' : 'p2';
        state.winner = state.matchWinner;
      } else {
        state.round++;
        state.currentRound = state.round;
        resetPvpRound(state);
      }
    }
    return;
  }

  if (state.status !== 'in_round') {
    return;
  }

  // Update pickup respawn
  if (!state.pickup.active) {
    state.pickup.respawnTimer -= dt;
    if (state.pickup.respawnTimer <= 0) {
      state.pickup.active = true;
      state.pickup.respawnTimer = 0;
    }
  }

  // Step players
  stepPlayer(state.p1, p1Input, state, dt);
  stepPlayer(state.p2, p2Input, state, dt);

  // Check pickup collection
  if (state.pickup.active) {
    const p1Dist = Math.hypot(state.p1.x - state.pickup.x, state.p1.z - state.pickup.z);
    if (p1Dist < PVP_PLAYER_RADIUS + 0.8 && state.p1.hp < state.p1.maxHp) {
      state.p1.hp = Math.min(state.p1.maxHp, state.p1.hp + state.pickup.healAmount);
      state.pickup.active = false;
      state.pickup.respawnTimer = state.pickup.respawnTimeSeconds;
    } else {
      const p2Dist = Math.hypot(state.p2.x - state.pickup.x, state.p2.z - state.pickup.z);
      if (p2Dist < PVP_PLAYER_RADIUS + 0.8 && state.p2.hp < state.p2.maxHp) {
        state.p2.hp = Math.min(state.p2.maxHp, state.p2.hp + state.pickup.healAmount);
        state.pickup.active = false;
        state.pickup.respawnTimer = state.pickup.respawnTimeSeconds;
      }
    }
  }

  // Step projectiles
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    proj.x += proj.vx * dt;
    proj.z += proj.vz * dt;
    proj.life -= dt;

    if (
      proj.life <= 0 ||
      proj.x < PVP_ARENA_BOUNDS.minX - 2 ||
      proj.x > PVP_ARENA_BOUNDS.maxX + 2 ||
      proj.z < PVP_ARENA_BOUNDS.minZ - 2 ||
      proj.z > PVP_ARENA_BOUNDS.maxZ + 2
    ) {
      state.projectiles.splice(i, 1);
      continue;
    }

    // Obstacle collision
    const obsCol = checkObstacleCollision(proj.x, proj.z, proj.radius, state.obstacles);
    if (obsCol.hit) {
      state.projectiles.splice(i, 1);
      continue;
    }

    // Player collision
    const targetPlayer = proj.ownerSlot === 'p1' ? state.p2 : state.p1;
    const shooterPlayer = proj.ownerSlot === 'p1' ? state.p1 : state.p2;

    const distToTarget = Math.hypot(targetPlayer.x - proj.x, targetPlayer.z - proj.z);
    if (distToTarget < PVP_PLAYER_RADIUS + proj.radius) {
      // Hit target!
      let damageRemaining = proj.damage;
      shooterPlayer.damageDealt += damageRemaining;
      shooterPlayer.shotsHit += 1;

      // Shield absorb
      if (targetPlayer.shieldHp > 0) {
        const absorb = Math.min(targetPlayer.shieldHp, damageRemaining);
        targetPlayer.shieldHp -= absorb;
        damageRemaining -= absorb;
      }

      if (damageRemaining > 0) {
        targetPlayer.hp = Math.max(0, targetPlayer.hp - damageRemaining);
      }

      state.lastHitEvent = {
        targetSlot: targetPlayer.slot,
        damage: proj.damage,
        sourceSlot: shooterPlayer.slot,
        x: targetPlayer.x,
        z: targetPlayer.z,
      };

      proj.pierce--;
      if (proj.pierce <= 0) {
        state.projectiles.splice(i, 1);
      }

      // Check knockout
      if (targetPlayer.hp <= 0) {
        handleKnockout(state, shooterPlayer.slot);
        break;
      }
    }
  }
}

function handleKnockout(state: PvpArenaState, winningSlot: 'p1' | 'p2') {
  state.status = 'round_end';
  state.roundWinner = winningSlot;
  state.roundEndTimer = 2.4;
  if (winningSlot === 'p1') {
    state.p1.score++;
  } else {
    state.p2.score++;
  }
  state.score = { p1: state.p1.score, p2: state.p2.score };
  if (state.p1.score >= state.roundsToWin || state.p2.score >= state.roundsToWin) {
    state.matchWinner = state.p1.score >= state.roundsToWin ? 'p1' : 'p2';
    state.winner = state.matchWinner;
  }
}

function stepPlayer(player: PvpPlayerState, input: PvpInputIntent | undefined, state: PvpArenaState, dt: number) {
  // Cooldown updates
  if (player.dashCooldownTimer > 0) player.dashCooldownTimer = Math.max(0, player.dashCooldownTimer - dt);
  if (player.attackCooldownTimer > 0) player.attackCooldownTimer = Math.max(0, player.attackCooldownTimer - dt);
  if (player.abilityCooldownTimer > 0) player.abilityCooldownTimer = Math.max(0, player.abilityCooldownTimer - dt);

  // Stun handling
  if (player.stunTimer > 0) {
    player.stunTimer = Math.max(0, player.stunTimer - dt);
    return;
  }

  // Dash duration handling
  if (player.isDashing) {
    player.dashTimer -= dt;
    if (player.dashTimer <= 0) {
      player.isDashing = false;
      player.dashTimer = 0;
    }
  }

  if (!input) return;

  // Aim update
  player.aimAngle = input.aimAngle;
  player.rot = input.aimAngle;
  player.isFiring = Boolean(input.isFiring);

  // Dash initiation
  if (input.wantDash && !player.isDashing && player.dashCooldownTimer <= 0) {
    player.isDashing = true;
    player.dashTimer = PVP_DASH_DURATION;
    player.dashCooldownTimer = PVP_DASH_COOLDOWN;
  }

  // Ability initiation
  if (input.wantAbility && player.abilityCooldownTimer <= 0) {
    triggerPlayerAbility(player, state);
  }

  // Movement
  let speed = player.isDashing ? PVP_DASH_SPEED : PVP_BASE_SPEED;
  let moveDirX = input.moveX;
  let moveDirZ = input.moveZ;
  const moveLen = Math.hypot(moveDirX, moveDirZ);
  if (moveLen > 1) {
    moveDirX /= moveLen;
    moveDirZ /= moveLen;
  }

  // If dashing and no direction held, dash forward along aim
  if (player.isDashing && moveLen < 0.1) {
    moveDirX = Math.sin(player.aimAngle);
    moveDirZ = Math.cos(player.aimAngle);
  }

  if (Math.abs(moveDirX) > 0.001 || Math.abs(moveDirZ) > 0.001) {
    player.x += moveDirX * speed * dt;
    player.z += moveDirZ * speed * dt;
  }

  // Arena bounds clamping
  player.x = Math.max(PVP_ARENA_BOUNDS.minX + PVP_PLAYER_RADIUS, Math.min(PVP_ARENA_BOUNDS.maxX - PVP_PLAYER_RADIUS, player.x));
  player.z = Math.max(PVP_ARENA_BOUNDS.minZ + PVP_PLAYER_RADIUS, Math.min(PVP_ARENA_BOUNDS.maxZ - PVP_PLAYER_RADIUS, player.z));

  // Obstacle collision resolution
  const obsCollision = checkObstacleCollision(player.x, player.z, PVP_PLAYER_RADIUS, state.obstacles);
  if (obsCollision.hit) {
    player.x += obsCollision.pushX;
    player.z += obsCollision.pushZ;
  }

  // Firing primary attack
  if (player.isFiring && player.attackCooldownTimer <= 0) {
    firePlayerPrimary(player, state);
  }
}

function firePlayerPrimary(player: PvpPlayerState, state: PvpArenaState) {
  const profile = PVP_OPERATOR_PROFILES[player.operatorId] || PVP_OPERATOR_PROFILES.marcin;
  player.attackCooldownTimer = profile.attackCooldown;
  player.shotsFired++;

  const angle = player.aimAngle;
  const dirX = Math.sin(angle);
  const dirZ = Math.cos(angle);

  const spawnOffset = PVP_PLAYER_RADIUS + 0.35;
  const spawnX = player.x + dirX * spawnOffset;
  const spawnZ = player.z + dirZ * spawnOffset;

  state.projectiles.push({
    id: `proj_${player.slot}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ownerSlot: player.slot,
    x: spawnX,
    y: 0.6,
    z: spawnZ,
    vx: dirX * profile.projectileSpeed,
    vz: dirZ * profile.projectileSpeed,
    radius: profile.projectileRadius,
    damage: profile.projectileDamage,
    life: 2.2,
    pierce: 1,
    color: profile.color,
  });
}

function triggerPlayerAbility(player: PvpPlayerState, state: PvpArenaState) {
  player.abilityCooldownTimer = PVP_ABILITY_COOLDOWN;
  const opponent = player.slot === 'p1' ? state.p2 : state.p1;
  const angle = player.aimAngle;

  switch (player.operatorId) {
    case 'marcin': {
      // Shield 250 HP + small push
      player.shieldHp = 250;
      const dist = Math.hypot(opponent.x - player.x, opponent.z - player.z);
      if (dist < 4.5) {
        const dx = (opponent.x - player.x) / (dist || 1);
        const dz = (opponent.z - player.z) / (dist || 1);
        opponent.x += dx * 3.5;
        opponent.z += dz * 3.5;
      }
      break;
    }
    case 'grzesiek': {
      // Forklift charge
      player.isDashing = true;
      player.dashTimer = PVP_DASH_DURATION * 1.8;
      const dist = Math.hypot(opponent.x - player.x, opponent.z - player.z);
      if (dist < 3.2) {
        opponent.hp = Math.max(0, opponent.hp - 180);
        opponent.stunTimer = 0.8;
        player.damageDealt += 180;
      }
      break;
    }
    case 'dawid': {
      // Tri-beam laser spread
      const fanAngles = [-0.18, 0, 0.18];
      for (const offset of fanAngles) {
        const currentAngle = angle + offset;
        state.projectiles.push({
          id: `proj_ability_${player.slot}_${Math.random()}`,
          ownerSlot: player.slot,
          x: player.x,
          y: 0.6,
          z: player.z,
          vx: Math.sin(currentAngle) * 32,
          vz: Math.cos(currentAngle) * 32,
          radius: 0.28,
          damage: 70,
          life: 1.8,
          pierce: 1,
          color: 0x10b981,
        });
      }
      break;
    }
    case 'mateusz': {
      // Hydraulic ground slam AoE
      const dist = Math.hypot(opponent.x - player.x, opponent.z - player.z);
      if (dist < 5.2) {
        opponent.hp = Math.max(0, opponent.hp - 150);
        player.damageDealt += 150;
        opponent.stunTimer = 0.5;
      }
      break;
    }
    case 'piotr': {
      // Diagnostic shock burst
      const dist = Math.hypot(opponent.x - player.x, opponent.z - player.z);
      if (dist < 7.0) {
        opponent.hp = Math.max(0, opponent.hp - 110);
        opponent.stunTimer = 1.1;
        player.damageDealt += 110;
      }
      break;
    }
  }

  // Check knockout from direct ability hit
  if (opponent.hp <= 0 && state.status === 'in_round') {
    handleKnockout(state, player.slot);
  }
}
