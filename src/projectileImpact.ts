import { getEnemyPlayerContactDistance, type EnemyContactBody } from './enemyPlayerCollision.ts';

export interface ProjectileSegmentPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MutableProjectileSegmentPoint {
  x: number;
  y: number;
  z: number;
}

export interface ProjectileActorImpact {
  readonly actor?: EnemyContactBody;
  readonly t: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ProjectileEnemyImpact extends ProjectileActorImpact {
  readonly actor: EnemyContactBody;
}

/** Caller-owned reusable output record for swept body collision. */
export interface ProjectileImpactScratch {
  t: number;
  x: number;
  y: number;
  z: number;
}

/** Caller-owned reusable output record for swept enemy collision. */
export interface ProjectileEnemyImpactScratch extends ProjectileImpactScratch {
  actor: EnemyContactBody | null;
}

/**
 * First intersection of a swept projectile segment with a vertical body
 * cylinder. Horizontal circle and vertical tolerance intervals are intersected
 * so collision ordering uses the actual first contact, not the point of
 * closest approach at the centre of the target.
 *
 * Pass a reusable output record from a hot update loop to avoid per-hit
 * allocation. Calls without one retain the original allocation-based API.
 */
export function findFirstProjectileBodyImpact(
  start: ProjectileSegmentPoint,
  end: ProjectileSegmentPoint,
  target: ProjectileSegmentPoint,
  radius: number,
  verticalTolerance: number,
  out?: ProjectileImpactScratch,
): ProjectileActorImpact | null {
  if (
    !Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(start.z) ||
    !Number.isFinite(end.x) || !Number.isFinite(end.y) || !Number.isFinite(end.z) ||
    !Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.z) ||
    !Number.isFinite(radius) || !Number.isFinite(verticalTolerance)
  ) {
    return null;
  }

  const safeRadius = Math.max(0.05, radius);
  const safeVerticalTolerance = Math.max(0.05, verticalTolerance);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const sx = start.x - target.x;
  const sz = start.z - target.z;
  const a = dx * dx + dz * dz;
  const c = sx * sx + sz * sz - safeRadius * safeRadius;

  let horizontalStart = 0;
  let horizontalEnd = 1;
  if (c > 0) {
    if (a < 1e-10) return null;
    const b = 2 * (sx * dx + sz * dz);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const root = Math.sqrt(discriminant);
    const first = (-b - root) / (2 * a);
    const last = (-b + root) / (2 * a);
    horizontalStart = Math.max(0, first);
    horizontalEnd = Math.min(1, last);
  }

  let verticalStart = 0;
  let verticalEnd = 1;
  if (Math.abs(dy) < 1e-8) {
    if (Math.abs(start.y - target.y) > safeVerticalTolerance) return null;
  } else {
    const first = (target.y - safeVerticalTolerance - start.y) / dy;
    const last = (target.y + safeVerticalTolerance - start.y) / dy;
    verticalStart = Math.max(0, Math.min(first, last));
    verticalEnd = Math.min(1, Math.max(first, last));
  }

  const t = Math.max(horizontalStart, verticalStart, 0);
  if (t > Math.min(horizontalEnd, verticalEnd, 1)) return null;

  const result = out ?? { t: 0, x: 0, y: 0, z: 0 };
  result.t = t;
  result.x = start.x + dx * t;
  result.y = start.y + dy * t;
  result.z = start.z + dz * t;
  return result;
}

/**
 * Returns the earliest swept impact against a living enemy. The closest living
 * body containing the segment start is treated as the shooter and ignored;
 * any other overlapping actor still blocks the shot at t=0.
 *
 * Optional target, body-impact and result records let real-time callers reuse
 * collision state instead of allocating objects for each projectile/enemy.
 */
export function findFirstProjectileEnemyImpact(
  start: ProjectileSegmentPoint,
  end: ProjectileSegmentPoint,
  enemies: readonly EnemyContactBody[],
  verticalTolerance = 0.9,
  out?: ProjectileEnemyImpactScratch,
  targetScratch?: MutableProjectileSegmentPoint,
  bodyImpactScratch?: ProjectileImpactScratch,
  ignoredActorIds?: ReadonlySet<string>,
  ignoreActorContainingStart = true,
  radiusMultiplier = 0.68,
): ProjectileEnemyImpact | null {
  if (
    !Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(start.z) ||
    !Number.isFinite(end.x) || !Number.isFinite(end.y) || !Number.isFinite(end.z) ||
    !Number.isFinite(verticalTolerance)
  ) {
    return null;
  }

  let owner: EnemyContactBody | null = null;
  let ownerDistanceSq = Number.POSITIVE_INFINITY;
  const safeRadiusMultiplier = Number.isFinite(radiusMultiplier)
    ? Math.max(0.25, Math.min(2.0, radiusMultiplier))
    : 0.68;

  // Hostile volleys can contain their shooter in the candidate list. Player
  // shots must disable this rule: a nearby enemy at the muzzle is a valid hit.
  if (ignoreActorContainingStart) {
    for (const actor of enemies) {
      if (
        ignoredActorIds?.has(actor.id) ||
        actor.state === 'defeated' ||
        !Number.isFinite(actor.x) || !Number.isFinite(actor.y) || !Number.isFinite(actor.z)
      ) {
        continue;
      }
      const radius = Math.max(0.45, getEnemyPlayerContactDistance(actor.type) * safeRadiusMultiplier);
      const dx = start.x - actor.x;
      const dz = start.z - actor.z;
      const distanceSq = dx * dx + dz * dz;
      if (
        distanceSq <= radius * radius &&
        Math.abs(start.y - (actor.y + 0.62)) <= Math.max(0.3, verticalTolerance) &&
        distanceSq < ownerDistanceSq
      ) {
        owner = actor;
        ownerDistanceSq = distanceSq;
      }
    }
  }

  const target = targetScratch ?? { x: 0, y: 0, z: 0 };
  const bodyImpact = bodyImpactScratch ?? { t: 0, x: 0, y: 0, z: 0 };
  let firstActor: EnemyContactBody | null = null;
  let firstT = Number.POSITIVE_INFINITY;
  let firstX = 0;
  let firstY = 0;
  let firstZ = 0;

  for (const actor of enemies) {
    if (
      actor === owner ||
      ignoredActorIds?.has(actor.id) ||
      actor.state === 'defeated' ||
      !Number.isFinite(actor.x) || !Number.isFinite(actor.y) || !Number.isFinite(actor.z)
    ) {
      continue;
    }

    target.x = actor.x;
    target.y = actor.y + 0.62;
    target.z = actor.z;
    const hit = findFirstProjectileBodyImpact(
      start,
      end,
      target,
      Math.max(0.45, getEnemyPlayerContactDistance(actor.type) * safeRadiusMultiplier),
      verticalTolerance,
      bodyImpact,
    );
    if (!hit || hit.t >= firstT) continue;
    firstActor = actor;
    firstT = hit.t;
    firstX = hit.x;
    firstY = hit.y;
    firstZ = hit.z;
  }

  if (!firstActor) return null;
  const result = out ?? { t: 0, x: 0, y: 0, z: 0, actor: firstActor };
  result.t = firstT;
  result.x = firstX;
  result.y = firstY;
  result.z = firstZ;
  result.actor = firstActor;
  return result as ProjectileEnemyImpact;
}
