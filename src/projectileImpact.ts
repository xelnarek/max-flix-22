import { getEnemyPlayerContactDistance, type EnemyContactBody } from './enemyPlayerCollision.ts';

export interface ProjectileSegmentPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
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

/**
 * First intersection of a swept projectile segment with a vertical body
 * cylinder. Horizontal circle and vertical tolerance intervals are intersected
 * so collision ordering uses the actual first contact, not the point of
 * closest approach at the centre of the target.
 */
export function findFirstProjectileBodyImpact(
  start: ProjectileSegmentPoint,
  end: ProjectileSegmentPoint,
  target: ProjectileSegmentPoint,
  radius: number,
  verticalTolerance: number,
): ProjectileActorImpact | null {
  if (![start.x, start.y, start.z, end.x, end.y, end.z, target.x, target.y, target.z, radius, verticalTolerance].every(Number.isFinite)) {
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
  return {
    t,
    x: start.x + dx * t,
    y: start.y + dy * t,
    z: start.z + dz * t,
  };
}

/**
 * Returns the earliest swept impact against a living enemy. The closest living
 * body containing the segment start is treated as the shooter and ignored;
 * any other overlapping actor still blocks the shot at t=0.
 */
export function findFirstProjectileEnemyImpact(
  start: ProjectileSegmentPoint,
  end: ProjectileSegmentPoint,
  enemies: readonly EnemyContactBody[],
  verticalTolerance = 0.9,
): ProjectileEnemyImpact | null {
  if (![start.x, start.y, start.z, end.x, end.y, end.z, verticalTolerance].every(Number.isFinite)) return null;
  let owner: EnemyContactBody | null = null;
  let ownerDistanceSq = Number.POSITIVE_INFINITY;

  for (const actor of enemies) {
    if (actor.state === 'defeated' || ![actor.x, actor.y, actor.z].every(Number.isFinite)) continue;
    const radius = Math.max(0.45, getEnemyPlayerContactDistance(actor.type) * 0.68);
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

  let first: ProjectileEnemyImpact | null = null;
  for (const actor of enemies) {
    if (actor === owner || actor.state === 'defeated' || ![actor.x, actor.y, actor.z].every(Number.isFinite)) continue;
    const hit = findFirstProjectileBodyImpact(
      start,
      end,
      { x: actor.x, y: actor.y + 0.62, z: actor.z },
      Math.max(0.45, getEnemyPlayerContactDistance(actor.type) * 0.68),
      verticalTolerance,
    );
    if (!hit || (first && hit.t >= first.t)) continue;
    first = { ...hit, actor };
  }
  return first;
}
