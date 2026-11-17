import { getEnemyPlayerContactDistance, type EnemyContactBody } from './enemyPlayerCollision.ts';

export interface ProjectileSegmentPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ProjectileActorImpact {
  readonly actor: EnemyContactBody;
  readonly t: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Returns the earliest swept impact against a live enemy body. The projectile
 * starts are ignored when already inside a body (normally its firing owner),
 * preventing a shot from instantly hitting the actor that emitted it.
 */
export function findFirstProjectileEnemyImpact(
  start: ProjectileSegmentPoint,
  end: ProjectileSegmentPoint,
  enemies: readonly EnemyContactBody[],
  verticalTolerance = 0.9,
): ProjectileActorImpact | null {
  if (![start.x, start.y, start.z, end.x, end.y, end.z, verticalTolerance].every(Number.isFinite)) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-10) return null;

  let first: ProjectileActorImpact | null = null;
  for (const actor of enemies) {
    if (actor.state === 'defeated' || ![actor.x, actor.y, actor.z].every(Number.isFinite)) continue;
    const radius = Math.max(0.45, getEnemyPlayerContactDistance(actor.type) * 0.68);
    const sx = start.x - actor.x;
    const sz = start.z - actor.z;
    const startDistanceSq = sx * sx + sz * sz;
    if (startDistanceSq <= radius * radius) continue;

    const b = 2 * (sx * dx + sz * dz);
    const c = startDistanceSq - radius * radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) continue;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (t < 0 || t > 1 || (first && t >= first.t)) continue;

    const y = start.y + dy * t;
    if (Math.abs(y - (actor.y + 0.62)) > Math.max(0.3, verticalTolerance)) continue;
    first = {
      actor,
      t,
      x: start.x + dx * t,
      y,
      z: start.z + dz * t,
    };
  }
  return first;
}
