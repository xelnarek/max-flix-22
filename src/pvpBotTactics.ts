import type { CharacterId } from './types.ts';
import {
  checkObstacleCollision,
  hasPvpLineOfSight,
  PVP_ARENA_BOUNDS,
  PVP_OPERATOR_PROFILES,
  PVP_PLAYER_RADIUS,
  type PvpArenaState,
  type PvpPlayerState,
  type PvpProjectile,
  type PvpVector2,
} from './pvpArena.ts';

export interface PvpBotDecision {
  moveX: number;
  moveZ: number;
  aimAngle: number;
  isFiring: boolean;
  wantDash: boolean;
  wantAbility: boolean;
}

export interface PvpBotDecisionContext {
  bot: PvpPlayerState;
  opponent: PvpPlayerState;
  state: Pick<PvpArenaState, 'round' | 'obstacles' | 'pickup' | 'perkDrop' | 'projectiles'>;
  opponentVelocity: PvpVector2;
  orbitSign: 1 | -1;
}

interface ProjectileThreat {
  urgency: number;
  timeToClosest: number;
  escape: PvpVector2;
  projectileId: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function normalize(x: number, z: number): PvpVector2 {
  const length = Math.hypot(x, z);
  if (!Number.isFinite(length) || length < 1e-6) return { x: 0, z: 0 };
  return { x: x / length, z: z / length };
}

function findIncomingThreat(
  bot: PvpPlayerState,
  projectiles: PvpProjectile[],
  opponentSlot: PvpPlayerState['slot'],
): ProjectileThreat | null {
  let strongest: ProjectileThreat | null = null;

  for (const projectile of projectiles) {
    if (projectile.ownerSlot !== opponentSlot || projectile.life <= 0) continue;
    if (![projectile.x, projectile.z, projectile.vx, projectile.vz, projectile.radius].every(Number.isFinite)) continue;

    const speedSq = projectile.vx * projectile.vx + projectile.vz * projectile.vz;
    if (speedSq < 1e-5) continue;

    const relativeX = bot.x - projectile.x;
    const relativeZ = bot.z - projectile.z;
    const maxLookAhead = Math.min(0.72, projectile.life);
    const timeToClosest = clamp(
      (relativeX * projectile.vx + relativeZ * projectile.vz) / speedSq,
      0,
      maxLookAhead,
    );
    const closestX = projectile.x + projectile.vx * timeToClosest;
    const closestZ = projectile.z + projectile.vz * timeToClosest;
    const radial = normalize(bot.x - closestX, bot.z - closestZ);
    const closestDistance = Math.hypot(bot.x - closestX, bot.z - closestZ);
    const dangerRadius = PVP_PLAYER_RADIUS + Math.max(0, projectile.radius) + 0.42;
    const threatRange = dangerRadius * 2.8;
    if (closestDistance >= threatRange) continue;

    const proximity = clamp((threatRange - closestDistance) / (dangerRadius * 2.1), 0, 1);
    const timing = 1 - 0.28 * (timeToClosest / Math.max(0.08, maxLookAhead));
    const urgency = clamp(proximity * timing, 0, 1);
    const velocity = normalize(projectile.vx, projectile.vz);
    const side = bot.slot === 'p1' ? 1 : -1;
    const perpendicular = { x: -velocity.z * side, z: velocity.x * side };
    const radialWeight = radial.x === 0 && radial.z === 0 ? 0 : 0.72;
    const escape = normalize(
      radial.x * radialWeight + perpendicular.x * (1 - radialWeight),
      radial.z * radialWeight + perpendicular.z * (1 - radialWeight),
    );

    if (!strongest || urgency > strongest.urgency) {
      strongest = { urgency, timeToClosest, escape, projectileId: projectile.id };
    }
  }

  return strongest;
}

function pathIsClear(
  bot: PvpPlayerState,
  direction: PvpVector2,
  obstacles: PvpArenaState['obstacles'],
): boolean {
  const travelDistance = 3.2;
  for (let step = 1; step <= 4; step++) {
    const distance = (travelDistance * step) / 4;
    const x = bot.x + direction.x * distance;
    const z = bot.z + direction.z * distance;
    if (
      x < PVP_ARENA_BOUNDS.minX + PVP_PLAYER_RADIUS ||
      x > PVP_ARENA_BOUNDS.maxX - PVP_PLAYER_RADIUS ||
      z < PVP_ARENA_BOUNDS.minZ + PVP_PLAYER_RADIUS ||
      z > PVP_ARENA_BOUNDS.maxZ - PVP_PLAYER_RADIUS
    ) return false;
    if (checkObstacleCollision(x, z, PVP_PLAYER_RADIUS + 0.04, obstacles).hit) return false;
  }
  return true;
}

function chooseNavigableDirection(
  bot: PvpPlayerState,
  opponent: PvpPlayerState,
  obstacles: PvpArenaState['obstacles'],
  desired: PvpVector2,
  objective?: PvpVector2,
): PvpVector2 {
  const wanted = normalize(desired.x, desired.z);
  if (wanted.x === 0 && wanted.z === 0) return wanted;

  const baseAngle = Math.atan2(wanted.z, wanted.x);
  const offsets = [0, 0.28, -0.28, 0.58, -0.58, 0.92, -0.92, 1.3, -1.3, 1.75, -1.75, 2.35, -2.35, Math.PI];
  const currentObjectiveDistance = objective
    ? Math.hypot(objective.x - bot.x, objective.z - bot.z)
    : 0;
  const currentHasSight = hasPvpLineOfSight(bot, opponent, obstacles);
  let best: PvpVector2 = { x: 0, z: 0 };
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const offset of offsets) {
    const angle = baseAngle + offset;
    const direction = { x: Math.cos(angle), z: Math.sin(angle) };
    if (!pathIsClear(bot, direction, obstacles)) continue;

    const travelDistance = 3.2;
    const nextX = bot.x + direction.x * travelDistance;
    const nextZ = bot.z + direction.z * travelDistance;
    const alignment = direction.x * wanted.x + direction.z * wanted.z;
    let score = alignment * 2.6;

    if (objective) {
      const nextObjectiveDistance = Math.hypot(objective.x - nextX, objective.z - nextZ);
      score += (currentObjectiveDistance - nextObjectiveDistance) * 0.72;
    } else {
      const nextOpponentDistance = Math.hypot(opponent.x - nextX, opponent.z - nextZ);
      score -= Math.abs(nextOpponentDistance - 10.5) * 0.12;
      if (nextOpponentDistance < 3.1) score -= (3.1 - nextOpponentDistance) * 1.8;
    }

    const nextBot = { ...bot, x: nextX, z: nextZ };
    const nextHasSight = hasPvpLineOfSight(nextBot, opponent, obstacles);
    if (!currentHasSight && nextHasSight) score += 1.35;
    else if (currentHasSight && !nextHasSight) score -= 0.85;

    const edgeDistance = Math.min(
      nextX - PVP_ARENA_BOUNDS.minX,
      PVP_ARENA_BOUNDS.maxX - nextX,
      nextZ - PVP_ARENA_BOUNDS.minZ,
      PVP_ARENA_BOUNDS.maxZ - nextZ,
    );
    score += clamp(edgeDistance, 0, 3) * 0.07;

    if (score > bestScore) {
      bestScore = score;
      best = direction;
    }
  }

  return best;
}

function getAimAngle(
  bot: PvpPlayerState,
  opponent: PvpPlayerState,
  opponentVelocity: PvpVector2,
  useDirectAim: boolean,
): number {
  const distance = Math.hypot(opponent.x - bot.x, opponent.z - bot.z);
  const profile = PVP_OPERATOR_PROFILES[bot.operatorId as CharacterId] || PVP_OPERATOR_PROFILES.marcin;
  const leadTime = useDirectAim ? 0 : clamp(distance / profile.projectileSpeed, 0, 0.48) * 0.78;
  const velocityX = clamp(Number.isFinite(opponentVelocity.x) ? opponentVelocity.x : 0, -14, 14);
  const velocityZ = clamp(Number.isFinite(opponentVelocity.z) ? opponentVelocity.z : 0, -14, 14);
  const targetX = clamp(opponent.x + velocityX * leadTime, PVP_ARENA_BOUNDS.minX, PVP_ARENA_BOUNDS.maxX);
  const targetZ = clamp(opponent.z + velocityZ * leadTime, PVP_ARENA_BOUNDS.minZ, PVP_ARENA_BOUNDS.maxZ);
  return Math.atan2(targetX - bot.x, targetZ - bot.z);
}

function shouldUseAbility(
  bot: PvpPlayerState,
  distance: number,
  hasLineOfSight: boolean,
  incomingUrgency: number,
): boolean {
  if (bot.abilityCooldownTimer > 0) return false;
  const healthRatio = bot.maxHp > 0 ? bot.hp / bot.maxHp : 1;

  switch (bot.operatorId) {
    case 'marcin':
      return healthRatio <= 0.66 || (incomingUrgency >= 0.74 && healthRatio <= 0.86);
    case 'grzesiek':
      return hasLineOfSight && distance < 3.65;
    case 'dawid':
      return hasLineOfSight && distance >= 5.5 && distance < 18;
    case 'mateusz':
      return hasLineOfSight && distance < 4.9;
    case 'piotr':
      return hasLineOfSight && distance < 6.6;
    default:
      return false;
  }
}

export function choosePvpBotDecision(context: PvpBotDecisionContext): PvpBotDecision {
  const { bot, opponent, state } = context;
  const dx = opponent.x - bot.x;
  const dz = opponent.z - bot.z;
  const distance = Math.hypot(dx, dz);
  const safeDistance = Math.max(0.001, distance);
  const towardOpponent = { x: dx / safeDistance, z: dz / safeDistance };
  const tangent = { x: -towardOpponent.z * context.orbitSign, z: towardOpponent.x * context.orbitSign };
  const lineOfSight = hasPvpLineOfSight(bot, opponent, state.obstacles);
  const threat = findIncomingThreat(bot, state.projectiles, opponent.slot);
  const incomingUrgency = threat?.urgency ?? 0;
  const healthRatio = bot.maxHp > 0 ? bot.hp / bot.maxHp : 1;

  const abilityReady = bot.abilityCooldownTimer <= 0;
  const wantAbility = shouldUseAbility(bot, distance, lineOfSight, incomingUrgency);
  const directAim = wantAbility && bot.operatorId !== 'dawid';
  const aimAngle = getAimAngle(bot, opponent, context.opponentVelocity, directAim);

  let desired: PvpVector2;
  let objective: PvpVector2 | undefined;

  const pickupDistance = Math.hypot(state.pickup.x - bot.x, state.pickup.z - bot.z);
  const shouldSeekMedkit = state.pickup.active && healthRatio <= 0.72 && pickupDistance < 27;
  const perkDistance = Math.hypot(state.perkDrop.x - bot.x, state.perkDrop.z - bot.z);
  const shouldSeekPerk = state.perkDrop.active &&
    state.perkDrop.timeLeft > 1.25 &&
    perkDistance < 22 &&
    (bot.activePerk !== state.perkDrop.type || bot.perkTimer < 1.5);

  if (threat && threat.urgency >= 0.36) {
    const side = context.orbitSign;
    const velocity = state.projectiles.find((projectile) => projectile.id === threat.projectileId);
    const projectileDirection = velocity ? normalize(velocity.vx, velocity.vz) : { x: 0, z: 1 };
    const perpendicular = { x: -projectileDirection.z * side, z: projectileDirection.x * side };
    desired = normalize(threat.escape.x * 0.78 + perpendicular.x * 0.42, threat.escape.z * 0.78 + perpendicular.z * 0.42);
  } else if (shouldSeekMedkit && (healthRatio < 0.46 || !shouldSeekPerk || perkDistance > pickupDistance)) {
    objective = { x: state.pickup.x, z: state.pickup.z };
    desired = normalize(state.pickup.x - bot.x, state.pickup.z - bot.z);
  } else if (shouldSeekPerk) {
    objective = { x: state.perkDrop.x, z: state.perkDrop.z };
    desired = normalize(state.perkDrop.x - bot.x, state.perkDrop.z - bot.z);
  } else if (!lineOfSight) {
    desired = normalize(towardOpponent.x + tangent.x * 0.3, towardOpponent.z + tangent.z * 0.3);
  } else if (distance > 12.5) {
    desired = normalize(towardOpponent.x + tangent.x * 0.18, towardOpponent.z + tangent.z * 0.18);
  } else if (distance < 7.2) {
    desired = normalize(-towardOpponent.x * 0.82 + tangent.x * 0.72, -towardOpponent.z * 0.82 + tangent.z * 0.72);
  } else {
    const rangeCorrection = clamp((distance - 10) * 0.1, -0.28, 0.28);
    desired = normalize(tangent.x + towardOpponent.x * rangeCorrection, tangent.z + towardOpponent.z * rangeCorrection);
  }

  const movement = chooseNavigableDirection(bot, opponent, state.obstacles, desired, objective);
  const wantDash = !!threat &&
    threat.urgency >= 0.68 &&
    threat.timeToClosest <= 0.48 &&
    bot.dashCooldownTimer <= 0;

  const isFiring = distance < 26 && lineOfSight && bot.hp > 0;
  return {
    moveX: movement.x,
    moveZ: movement.z,
    aimAngle,
    isFiring,
    wantDash,
    wantAbility: abilityReady && wantAbility,
  };
}
