export interface EnemyTacticalPoint {
  readonly x: number;
  readonly z: number;
}

export interface EnemyTacticalVelocity {
  readonly x: number;
  readonly z: number;
}

export interface EnemyIncomingProjectile {
  readonly mesh?: {
    readonly position?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
  };
  readonly vel?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly hitIds?: ReadonlySet<string>;
  readonly orbiting?: boolean;
}

export interface EnemyDodgeActor extends EnemyTacticalPoint {
  readonly id: string;
  readonly y: number;
}

export interface MutableEnemyTacticalVelocity {
  x: number;
  z: number;
}

const finite = (value: number): boolean => Number.isFinite(value);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Aim slightly ahead of a moving operator instead of firing at the position
 * they occupied on the launch frame. The lead is deliberately partial and
 * capped, so dodging remains useful and slow arcing attacks stay fair.
 */
export function predictEnemyAimPoint(
  origin: EnemyTacticalPoint,
  target: EnemyTacticalPoint,
  targetVelocity: EnemyTacticalVelocity,
  projectileSpeed: number,
  leadFraction = 0.68,
  maxLeadSeconds = 0.62,
): EnemyTacticalPoint {
  if (
    ![origin.x, origin.z, target.x, target.z, targetVelocity.x, targetVelocity.z,
      projectileSpeed, leadFraction, maxLeadSeconds].every(finite) ||
    projectileSpeed <= 0
  ) {
    return { x: target.x, z: target.z };
  }

  const rx = target.x - origin.x;
  const rz = target.z - origin.z;
  const distance = Math.hypot(rx, rz);
  if (distance < 1e-5) return { x: target.x, z: target.z };

  // Limit malformed or transient velocity spikes before solving the intercept.
  const velocityLength = Math.hypot(targetVelocity.x, targetVelocity.z);
  const velocityScale = velocityLength > 8.0 ? 8.0 / velocityLength : 1;
  const vx = targetVelocity.x * velocityScale;
  const vz = targetVelocity.z * velocityScale;
  const a = vx * vx + vz * vz - projectileSpeed * projectileSpeed;
  const b = 2 * (rx * vx + rz * vz);
  const c = distance * distance;

  let interceptSeconds = distance / projectileSpeed;
  if (Math.abs(a) < 1e-7) {
    if (Math.abs(b) > 1e-7) {
      const candidate = -c / b;
      if (candidate > 0 && finite(candidate)) interceptSeconds = candidate;
    }
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0 && finite(discriminant)) {
      const root = Math.sqrt(discriminant);
      const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)]
        .filter((value) => value > 0 && finite(value));
      if (candidates.length > 0) interceptSeconds = Math.min(...candidates);
    }
  }

  const leadSeconds = clamp(
    interceptSeconds * clamp(leadFraction, 0, 1),
    0,
    clamp(maxLeadSeconds, 0, 1.0),
  );
  return {
    x: target.x + vx * leadSeconds,
    z: target.z + vz * leadSeconds,
  };
}

function stableDodgeSide(actorId: string, projectileIndex: number): number {
  const key = actorId + ':' + projectileIndex;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  }
  return (hash & 1) === 0 ? -1 : 1;
}

/**
 * Finds one imminent player projectile whose swept path would clip an enemy,
 * then returns a deterministic perpendicular sidestep. Distant shots, shots
 * moving away, already-hit projectiles and vertical misses are ignored.
 */
export function calculateEnemyProjectileDodge(
  actor: EnemyDodgeActor,
  projectiles: readonly EnemyIncomingProjectile[],
  maxLookAheadSeconds = 0.72,
  collisionRadius = 1.02,
  verticalTolerance = 0.95,
  out: MutableEnemyTacticalVelocity = { x: 0, z: 0 },
): EnemyTacticalVelocity {
  out.x = 0;
  out.z = 0;
  if (
    !finite(actor.x) || !finite(actor.y) || !finite(actor.z) ||
    !finite(maxLookAheadSeconds) || !finite(collisionRadius) ||
    !finite(verticalTolerance) ||
    maxLookAheadSeconds <= 0 ||
    collisionRadius <= 0
  ) {
    return out;
  }

  const lookAhead = Math.min(1.0, maxLookAheadSeconds);
  const radius = clamp(collisionRadius, 0.2, 2.5);
  const radiusSquared = radius * radius;
  const targetY = actor.y + 0.62;
  let bestScore = 0;
  let bestDodgeX = 0;
  let bestDodgeZ = 0;

  for (let index = 0; index < projectiles.length; index++) {
    const projectile = projectiles[index];
    const position = projectile.mesh?.position;
    const velocity = projectile.vel;
    if (
      !position || !velocity || projectile.orbiting || projectile.hitIds?.has(actor.id) ||
      !finite(position.x) || !finite(position.y) || !finite(position.z) ||
      !finite(velocity.x) || !finite(velocity.y) || !finite(velocity.z)
    ) continue;

    const speedSquared = velocity.x * velocity.x + velocity.z * velocity.z;
    if (speedSquared < 6.25) continue;

    const relativeX = position.x - actor.x;
    const relativeZ = position.z - actor.z;
    const broadphaseReach = Math.sqrt(speedSquared) * lookAhead + radius;
    if (relativeX * relativeX + relativeZ * relativeZ > broadphaseReach * broadphaseReach) continue;

    const time = -(relativeX * velocity.x + relativeZ * velocity.z) / speedSquared;
    if (time < 0.055 || time > lookAhead) continue;

    const closestX = relativeX + velocity.x * time;
    const closestZ = relativeZ + velocity.z * time;
    const closestDistanceSquared = closestX * closestX + closestZ * closestZ;
    if (closestDistanceSquared > radiusSquared) continue;

    const projectileY = position.y + velocity.y * time;
    if (Math.abs(projectileY - targetY) > Math.max(0.2, verticalTolerance)) continue;

    const speed = Math.sqrt(speedSquared);
    const perpendicularX = -velocity.z / speed;
    const perpendicularZ = velocity.x / speed;
    const sideProjection = closestX * perpendicularX + closestZ * perpendicularZ;
    const side = Math.abs(sideProjection) > 1e-4
      ? Math.sign(sideProjection)
      : stableDodgeSide(actor.id, index);
    const clearance = 1 - Math.sqrt(closestDistanceSquared) / radius;
    const urgency = 1 - time / lookAhead;
    const score = clearance * 0.72 + urgency * 0.28;
    if (score <= bestScore) continue;

    const strength = clamp(0.48 + score * 0.52, 0.48, 1);
    bestScore = score;
    bestDodgeX = perpendicularX * side * strength;
    bestDodgeZ = perpendicularZ * side * strength;
  }

  out.x = bestDodgeX;
  out.z = bestDodgeZ;
  return out;
}
