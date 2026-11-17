export type SurvivalTacticalRole = 'bruiser' | 'flanker' | 'ranged' | 'support';

export interface SurvivalRetreatInput {
  readonly role: SurvivalTacticalRole;
  readonly hp: number;
  readonly maxHp: number;
  readonly distanceToPlayer: number;
  readonly retreatTimer: number;
  readonly retreatCooldown: number;
  readonly dt: number;
}

export interface SurvivalRetreatState {
  readonly active: boolean;
  readonly started: boolean;
  readonly remainingSeconds: number;
  readonly cooldownRemaining: number;
}

export interface SurvivalTacticalPoint {
  readonly x: number;
  readonly z: number;
}

export interface SurvivalRetreatTargetInput {
  readonly role: SurvivalTacticalRole;
  readonly playerX: number;
  readonly playerZ: number;
  readonly enemyX: number;
  readonly enemyZ: number;
  readonly slot: number;
}

interface RetreatProfile {
  readonly healthThreshold: number;
  readonly triggerDistance: number;
  readonly releaseDistance: number;
  readonly minimumRadius: number;
  readonly maximumRadius: number;
}

const RETREAT_PROFILES: Record<SurvivalTacticalRole, RetreatProfile> = {
  ranged: {
    healthThreshold: 0.36,
    triggerDistance: 8.8,
    releaseDistance: 11.8,
    minimumRadius: 10.0,
    maximumRadius: 11.8,
  },
  support: {
    healthThreshold: 0.40,
    triggerDistance: 7.2,
    releaseDistance: 9.8,
    minimumRadius: 8.5,
    maximumRadius: 9.8,
  },
  flanker: {
    healthThreshold: 0.20,
    triggerDistance: 4.5,
    releaseDistance: 7.8,
    minimumRadius: 6.7,
    maximumRadius: 7.8,
  },
  bruiser: {
    healthThreshold: 0.12,
    triggerDistance: 3.0,
    releaseDistance: 6.8,
    minimumRadius: 6.0,
    maximumRadius: 6.8,
  },
};

const RETREAT_DURATION_SECONDS = 2.6;
const RETREAT_COOLDOWN_SECONDS = 10.5;

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Advance a small, role-aware retreat state. Ranged and support units preserve
 * themselves earlier; flankers and bruisers hold their ground until more
 * severely wounded. Cooldown and distance hysteresis prevent rapid toggling.
 */
export function advanceSurvivalRetreatState(input: SurvivalRetreatInput): SurvivalRetreatState {
  const profile = RETREAT_PROFILES[input.role];
  const hp = finite(input.hp) ? Math.max(0, input.hp) : 0;
  const maxHp = finite(input.maxHp) ? Math.max(0, input.maxHp) : 0;
  const healthRatio = maxHp > 0 ? clamp(hp / maxHp, 0, 1) : 1;
  const distance = finite(input.distanceToPlayer) ? Math.max(0, input.distanceToPlayer) : Number.POSITIVE_INFINITY;
  const dt = finite(input.dt) ? clamp(input.dt, 0, 0.25) : 0;
  let remainingSeconds = finite(input.retreatTimer) ? Math.max(0, input.retreatTimer - dt) : 0;
  let cooldownRemaining = finite(input.retreatCooldown) ? Math.max(0, input.retreatCooldown - dt) : 0;

  if (remainingSeconds > 0) {
    // A retreat ends early once the unit has restored a safe buffer or has
    // recovered enough health; the cooldown still prevents an immediate restart.
    if (distance >= profile.releaseDistance || healthRatio >= profile.healthThreshold + 0.14) {
      remainingSeconds = 0;
    }
  }

  let started = false;
  if (
    remainingSeconds <= 0 &&
    cooldownRemaining <= 0 &&
    healthRatio <= profile.healthThreshold &&
    distance <= profile.triggerDistance
  ) {
    remainingSeconds = RETREAT_DURATION_SECONDS;
    cooldownRemaining = RETREAT_COOLDOWN_SECONDS;
    started = true;
  }

  return {
    active: remainingSeconds > 0,
    started,
    remainingSeconds,
    cooldownRemaining,
  };
}

/**
 * Move flankers toward a short lead point on the operator's current path.
 * This lets the two assigned flank lanes close ahead of a running operator
 * instead of following the exact position already being vacated.
 */
export function getSurvivalFlankInterceptOffset(
  role: SurvivalTacticalRole,
  playerVelocity: SurvivalTacticalPoint,
): SurvivalTacticalPoint {
  if (
    role !== 'flanker' ||
    !finite(playerVelocity.x) ||
    !finite(playerVelocity.z)
  ) {
    return { x: 0, z: 0 };
  }

  const speed = Math.hypot(playerVelocity.x, playerVelocity.z);
  if (speed < 0.45) return { x: 0, z: 0 };

  const leadSeconds = Math.min(0.42, 1.65 / speed);
  return {
    x: playerVelocity.x * leadSeconds,
    z: playerVelocity.z * leadSeconds,
  };
}

/**
 * Return a stable point on the safe side of the player-facing ring. The
 * selected side is derived from the squad slot, so the actor does not swap
 * retreat direction between frames when the two positions nearly overlap.
 */
export function getSurvivalRetreatTarget(input: SurvivalRetreatTargetInput): SurvivalTacticalPoint {
  const values = [input.playerX, input.playerZ, input.enemyX, input.enemyZ, input.slot];
  if (!values.every(finite)) return { x: input.enemyX, z: input.enemyZ };

  const profile = RETREAT_PROFILES[input.role];
  const dx = input.enemyX - input.playerX;
  const dz = input.enemyZ - input.playerZ;
  const distance = Math.hypot(dx, dz);
  const side = Math.abs(Math.floor(input.slot)) % 2 === 0 ? 1 : -1;
  const baseAngle = distance > 0.25
    ? Math.atan2(dx, dz)
    : side * Math.PI * 0.5;
  const angle = baseAngle + side * 0.14;
  const radius = clamp(distance, profile.minimumRadius, profile.maximumRadius);

  return {
    x: input.playerX + Math.sin(angle) * radius,
    z: input.playerZ + Math.cos(angle) * radius,
  };
}
