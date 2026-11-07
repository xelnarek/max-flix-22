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

/** Normalize untrusted client input at both the network and simulation boundaries. */
export function sanitizePvpInputIntent(input: Partial<PvpInputIntent> | null | undefined): PvpInputIntent {
  const finiteOrZero = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0;
  let moveX = Math.max(-1, Math.min(1, finiteOrZero(input?.moveX)));
  let moveZ = Math.max(-1, Math.min(1, finiteOrZero(input?.moveZ)));
  const magnitude = Math.hypot(moveX, moveZ);
  if (magnitude > 1) {
    moveX /= magnitude;
    moveZ /= magnitude;
  }
  const rawAngle = finiteOrZero(input?.aimAngle);
  const aimAngle = Math.atan2(Math.sin(rawAngle), Math.cos(rawAngle));
  return {
    moveX,
    moveZ,
    aimAngle,
    isFiring: input?.isFiring === true,
    wantDash: input?.wantDash === true,
    wantAbility: input?.wantAbility === true,
  };
}

function clampPvpPosition(player: PvpPlayerState): void {
  player.x = Math.max(PVP_ARENA_BOUNDS.minX + PVP_PLAYER_RADIUS, Math.min(PVP_ARENA_BOUNDS.maxX - PVP_PLAYER_RADIUS, player.x));
  player.z = Math.max(PVP_ARENA_BOUNDS.minZ + PVP_PLAYER_RADIUS, Math.min(PVP_ARENA_BOUNDS.maxZ - PVP_PLAYER_RADIUS, player.z));
}

/** Distance from a point to a finite segment, used to prevent fast projectiles tunnelling. */
function pointSegmentDistanceSq(
  pointX: number,
  pointZ: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
): { distanceSq: number; t: number } {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 1e-9
    ? Math.max(0, Math.min(1, ((pointX - startX) * dx + (pointZ - startZ) * dz) / lengthSq))
    : 0;
  const nearestX = startX + dx * t;
  const nearestZ = startZ + dz * t;
  const ox = pointX - nearestX;
  const oz = pointZ - nearestZ;
  return { distanceSq: ox * ox + oz * oz, t };
}

/** Returns the first swept collision point along a projectile segment, if any. */
function firstProjectileObstacleHit(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  radius: number,
  obstacles: PvpObstacle[],
): number | null {
  const distance = Math.hypot(endX - startX, endZ - startZ);
  const steps = Math.max(1, Math.ceil(distance / Math.max(0.08, radius * 0.45)));
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const x = startX + (endX - startX) * t;
    const z = startZ + (endZ - startZ) * t;
    if (checkObstacleCollision(x, z, radius, obstacles).hit) return t;
  }
  return null;
}

function hasPvpLineOfSight(
  source: PvpPlayerState,
  target: PvpPlayerState,
  obstacles: PvpObstacle[],
): boolean {
  return firstProjectileObstacleHit(
    source.x,
    source.z,
    target.x,
    target.z,
    0.12,
    obstacles,
  ) === null;
}

function applyPvpAbilityDamage(
  source: PvpPlayerState,
  target: PvpPlayerState,
  state: PvpArenaState,
  requestedDamage: number,
  stunSeconds = 0,
): number {
  const safeDamage = Number.isFinite(requestedDamage) ? Math.max(0, requestedDamage) : 0;
  const actualDamage = Math.min(safeDamage, Math.max(0, target.hp) + Math.max(0, target.shieldHp));
  if (actualDamage <= 0) return 0;

  let remaining = actualDamage;
  if (target.shieldHp > 0) {
    const absorbed = Math.min(target.shieldHp, remaining);
    target.shieldHp -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) target.hp = Math.max(0, target.hp - remaining);

  source.damageDealt += actualDamage;
  if (stunSeconds > 0 && target.hp > 0) target.stunTimer = Math.max(target.stunTimer, stunSeconds);
  state.lastHitEvent = {
    targetSlot: target.slot,
    damage: actualDamage,
    sourceSlot: source.slot,
    x: target.x,
    z: target.z,
  };
  return actualDamage;
}

function separatePvpPlayers(state: PvpArenaState): void {
  const p1 = state.p1;
  const p2 = state.p2;
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const distance = Math.hypot(dx, dz);
  const minimumDistance = PVP_PLAYER_RADIUS * 2;
  if (distance >= minimumDistance) return;

  const safeDistance = distance > 1e-5 ? distance : 1e-5;
  const directionX = distance > 1e-5 ? dx / safeDistance : 1;
  const directionZ = distance > 1e-5 ? dz / safeDistance : 0;
  const overlap = minimumDistance - distance;
  const halfPush = overlap * 0.5;
  p1.x -= directionX * halfPush;
  p1.z -= directionZ * halfPush;
  p2.x += directionX * halfPush;
  p2.z += directionZ * halfPush;

  for (const player of [p1, p2]) {
    clampPvpPosition(player);
    const collision = checkObstacleCollision(player.x, player.z, PVP_PLAYER_RADIUS, state.obstacles);
    if (collision.hit) {
      player.x += collision.pushX;
      player.z += collision.pushZ;
      clampPvpPosition(player);
    }
  }
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
  state.p1.isFiring = false;

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
  state.p2.isFiring = false;

  state.projectiles = [];
  state.pickup.active = true;
  state.pickup.respawnTimer = 0;
  state.roundWinner = null;
  state.roundEndTimer = 0;
  state.lastHitEvent = undefined;
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
  // Keep a delayed or malformed frame from teleporting entities or skipping cooldowns.
  const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
  if (safeDt <= 0) return;
  const safeP1Input = p1Input ? sanitizePvpInputIntent(p1Input) : undefined;
  const safeP2Input = p2Input ? sanitizePvpInputIntent(p2Input) : undefined;

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
    state.countdownTimer -= safeDt;
    if (state.countdownTimer <= 0) {
      state.countdownTimer = 0;
      state.status = 'in_round';
    }
    return;
  }

  // Handle round end delay
  if (state.status === 'round_end') {
    state.roundEndTimer -= safeDt;
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
    state.pickup.respawnTimer -= safeDt;
    if (state.pickup.respawnTimer <= 0) {
      state.pickup.active = true;
      state.pickup.respawnTimer = 0;
    }
  }

  // Step players
  stepPlayer(state.p1, safeP1Input, state, safeDt);
  stepPlayer(state.p2, safeP2Input, state, safeDt);
  separatePvpPlayers(state);

  // One fair medkit claim per spawn: nearest eligible player wins. Exact ties
  // alternate by round, so P1 never receives a permanent update-order advantage.
  if (state.pickup.active) {
    const pickupRadius = PVP_PLAYER_RADIUS + 0.8;
    const candidates = ([state.p1, state.p2] as const)
      .map((player) => ({
        player,
        distance: Math.hypot(player.x - state.pickup.x, player.z - state.pickup.z),
        missingHpRatio: player.maxHp > 0 ? (player.maxHp - player.hp) / player.maxHp : 0,
      }))
      .filter(({ player, distance }) => distance < pickupRadius && player.hp < player.maxHp)
      .sort((a, b) =>
        a.distance - b.distance ||
        b.missingHpRatio - a.missingHpRatio ||
        (state.round % 2 === 1 ? (a.player.slot === 'p1' ? -1 : 1) : (a.player.slot === 'p2' ? -1 : 1))
      );
    const winner = candidates[0]?.player;
    if (winner) {
      winner.hp = Math.min(winner.maxHp, winner.hp + state.pickup.healAmount);
      state.pickup.active = false;
      state.pickup.respawnTimer = state.pickup.respawnTimeSeconds;
    }
  }

  // Swept projectile collision prevents fast shots or a delayed server tick from skipping cover.
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    const startX = proj.x;
    const startZ = proj.z;
    const travelX = proj.vx * safeDt;
    const travelZ = proj.vz * safeDt;
    const endX = startX + travelX;
    const endZ = startZ + travelZ;
    proj.life -= safeDt;

    if (proj.life <= 0) {
      state.projectiles.splice(i, 1);
      continue;
    }

    const obstacleT = firstProjectileObstacleHit(startX, startZ, endX, endZ, proj.radius, state.obstacles);
    const targetPlayer = proj.ownerSlot === 'p1' ? state.p2 : state.p1;
    const shooterPlayer = proj.ownerSlot === 'p1' ? state.p1 : state.p2;
    const targetHit = pointSegmentDistanceSq(targetPlayer.x, targetPlayer.z, startX, startZ, endX, endZ);
    const playerHitRadius = PVP_PLAYER_RADIUS + proj.radius;
    const hitPlayer = targetHit.distanceSq <= playerHitRadius * playerHitRadius;
    const playerT = hitPlayer ? targetHit.t : Number.POSITIVE_INFINITY;

    if (hitPlayer && (obstacleT === null || playerT <= obstacleT)) {
      proj.x = startX + travelX * playerT;
      proj.z = startZ + travelZ * playerT;
      let damageRemaining = Math.max(0, Number.isFinite(proj.damage) ? proj.damage : 0);
      const actualDamage = Math.min(damageRemaining, targetPlayer.shieldHp + targetPlayer.hp);
      shooterPlayer.damageDealt += actualDamage;
      shooterPlayer.shotsHit += 1;

      if (targetPlayer.shieldHp > 0) {
        const absorb = Math.min(targetPlayer.shieldHp, damageRemaining);
        targetPlayer.shieldHp -= absorb;
        damageRemaining -= absorb;
      }
      if (damageRemaining > 0) targetPlayer.hp = Math.max(0, targetPlayer.hp - damageRemaining);

      state.lastHitEvent = {
        targetSlot: targetPlayer.slot,
        damage: actualDamage,
        sourceSlot: shooterPlayer.slot,
        x: targetPlayer.x,
        z: targetPlayer.z,
      };

      proj.pierce--;
      if (proj.pierce <= 0) state.projectiles.splice(i, 1);
      if (targetPlayer.hp <= 0) {
        handleKnockout(state, shooterPlayer.slot);
        break;
      }
    } else if (obstacleT !== null) {
      state.projectiles.splice(i, 1);
    } else {
      proj.x = endX;
      proj.z = endZ;
      if (
        proj.x < PVP_ARENA_BOUNDS.minX - 2 ||
        proj.x > PVP_ARENA_BOUNDS.maxX + 2 ||
        proj.z < PVP_ARENA_BOUNDS.minZ - 2 ||
        proj.z > PVP_ARENA_BOUNDS.maxZ + 2
      ) state.projectiles.splice(i, 1);
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
  const safeInput = sanitizePvpInputIntent(input);

  // Aim update
  player.aimAngle = safeInput.aimAngle;
  player.rot = safeInput.aimAngle;
  player.isFiring = safeInput.isFiring;

  // Dash initiation
  if (safeInput.wantDash && !player.isDashing && player.dashCooldownTimer <= 0) {
    player.isDashing = true;
    player.dashTimer = PVP_DASH_DURATION;
    player.dashCooldownTimer = PVP_DASH_COOLDOWN;
  }

  // Ability initiation
  if (safeInput.wantAbility && player.abilityCooldownTimer <= 0) {
    triggerPlayerAbility(player, state);
  }

  // Movement
  let speed = player.isDashing ? PVP_DASH_SPEED : PVP_BASE_SPEED;
  let moveDirX = safeInput.moveX;
  let moveDirZ = safeInput.moveZ;
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
    // Substep fast dash motion so the player cannot tunnel through pallet barriers.
    const totalX = moveDirX * speed * dt;
    const totalZ = moveDirZ * speed * dt;
    const distance = Math.hypot(totalX, totalZ);
    const steps = Math.max(1, Math.ceil(distance / 0.24));
    const stepX = totalX / steps;
    const stepZ = totalZ / steps;

    for (let step = 0; step < steps; step++) {
      const oldX = player.x;
      const oldZ = player.z;
      const candidateX = Math.max(PVP_ARENA_BOUNDS.minX + PVP_PLAYER_RADIUS, Math.min(PVP_ARENA_BOUNDS.maxX - PVP_PLAYER_RADIUS, oldX + stepX));
      const candidateZ = Math.max(PVP_ARENA_BOUNDS.minZ + PVP_PLAYER_RADIUS, Math.min(PVP_ARENA_BOUNDS.maxZ - PVP_PLAYER_RADIUS, oldZ + stepZ));
      const fullCollision = checkObstacleCollision(candidateX, candidateZ, PVP_PLAYER_RADIUS, state.obstacles);
      if (!fullCollision.hit) {
        player.x = candidateX;
        player.z = candidateZ;
      } else {
        // Slide along a blocked face instead of sticking or teleporting through it.
        const xOnly = checkObstacleCollision(candidateX, oldZ, PVP_PLAYER_RADIUS, state.obstacles);
        const zOnly = checkObstacleCollision(oldX, candidateZ, PVP_PLAYER_RADIUS, state.obstacles);
        if (!xOnly.hit) player.x = candidateX;
        if (!zOnly.hit) player.z = candidateZ;
        if (xOnly.hit && zOnly.hit) {
          player.x += fullCollision.pushX;
          player.z += fullCollision.pushZ;
        }
        clampPvpPosition(player);
      }
    }
  }
  clampPvpPosition(player);

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
  const dx = opponent.x - player.x;
  const dz = opponent.z - player.z;
  const distance = Math.hypot(dx, dz);
  const hasLineOfSight = hasPvpLineOfSight(player, opponent, state.obstacles);

  switch (player.operatorId) {
    case 'marcin': {
      // The defensive shield always protects Marcin; its push requires visible proximity.
      player.shieldHp = 250;
      if (distance < 4.5 && hasLineOfSight) {
        const pushX = dx / (distance || 1) * 3.5;
        const pushZ = dz / (distance || 1) * 3.5;
        const nextX = Math.max(PVP_ARENA_BOUNDS.minX + PVP_PLAYER_RADIUS, Math.min(PVP_ARENA_BOUNDS.maxX - PVP_PLAYER_RADIUS, opponent.x + pushX));
        const nextZ = Math.max(PVP_ARENA_BOUNDS.minZ + PVP_PLAYER_RADIUS, Math.min(PVP_ARENA_BOUNDS.maxZ - PVP_PLAYER_RADIUS, opponent.z + pushZ));
        if (!checkObstacleCollision(nextX, nextZ, PVP_PLAYER_RADIUS, state.obstacles).hit) {
          opponent.x = nextX;
          opponent.z = nextZ;
        }
      }
      break;
    }
    case 'grzesiek': {
      // A genuine frontal forklift charge: an opponent behind or beside Grzesiek is not hit.
      player.isDashing = true;
      player.dashTimer = PVP_DASH_DURATION * 1.8;
      player.dashCooldownTimer = Math.max(player.dashCooldownTimer, PVP_DASH_COOLDOWN);
      const forwardX = Math.sin(angle);
      const forwardZ = Math.cos(angle);
      const alignment = distance > 1e-5 ? (dx * forwardX + dz * forwardZ) / distance : 1;
      if (distance < 3.8 && alignment >= Math.cos(Math.PI / 4) && hasLineOfSight) {
        applyPvpAbilityDamage(player, opponent, state, 180, 0.8);
      }
      break;
    }
    case 'dawid': {
      // Tri-beam laser spread; swept collision later resolves cover and hit ordering.
      const fanAngles = [-0.18, 0, 0.18];
      for (const offset of fanAngles) {
        const currentAngle = angle + offset;
        state.projectiles.push({
          id: `ability_${player.slot}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ownerSlot: player.slot,
          x: player.x + Math.sin(currentAngle) * (PVP_PLAYER_RADIUS + 0.2),
          y: 0.6,
          z: player.z + Math.cos(currentAngle) * (PVP_PLAYER_RADIUS + 0.2),
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
      // Hydraulic shockwave is stopped by full pallet cover.
      if (distance < 5.2 && hasLineOfSight) {
        applyPvpAbilityDamage(player, opponent, state, 150, 0.5);
      }
      break;
    }
    case 'piotr': {
      // Diagnostic shock needs line of sight; cover blocks the electrical burst.
      if (distance < 7.0 && hasLineOfSight) {
        applyPvpAbilityDamage(player, opponent, state, 110, 1.1);
      }
      break;
    }
  }

  // Check knockout from direct ability hit.
  if (opponent.hp <= 0 && state.status === 'in_round') {
    handleKnockout(state, player.slot);
  }
}
