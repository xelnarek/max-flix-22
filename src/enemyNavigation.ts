import type { EnemySpacingActor, HorizontalVector } from './enemySpacing.ts';

export interface EnemyNavigationObstacle {
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
}

const EPSILON = 1e-8;

function stableSide(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  }
  return (hash & 1) === 0 ? -1 : 1;
}

function rayBoxEntryDistance(
  origin: HorizontalVector,
  direction: HorizontalVector,
  maxDistance: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): number | null {
  let entry = 0;
  let exit = maxDistance;

  for (const axis of [
    { position: origin.x, velocity: direction.x, min: minX, max: maxX },
    { position: origin.z, velocity: direction.z, min: minZ, max: maxZ },
  ]) {
    if (Math.abs(axis.velocity) < EPSILON) {
      if (axis.position < axis.min || axis.position > axis.max) return null;
      continue;
    }

    let near = (axis.min - axis.position) / axis.velocity;
    let far = (axis.max - axis.position) / axis.velocity;
    if (near > far) [near, far] = [far, near];
    entry = Math.max(entry, near);
    exit = Math.min(exit, far);
    if (exit < entry) return null;
  }

  return entry >= -EPSILON && entry <= maxDistance ? Math.max(0, entry) : null;
}

/**
 * Returns a bounded steering bias around the first rectangular obstacle in
 * the actor's forward corridor. It does not teleport or directly move actors;
 * callers blend the vector with their normal chase/separation steering.
 */
export function calculateEnemyObstacleAvoidanceVector(
  actor: EnemySpacingActor,
  target: HorizontalVector,
  obstacles: readonly EnemyNavigationObstacle[],
  lookAheadDistance = 4.2,
  clearance = 0.8,
): HorizontalVector {
  if (![actor.x, actor.z, target.x, target.z, lookAheadDistance, clearance].every(Number.isFinite)) {
    return { x: 0, z: 0 };
  }

  const targetX = target.x - actor.x;
  const targetZ = target.z - actor.z;
  const targetDistance = Math.hypot(targetX, targetZ);
  if (targetDistance < EPSILON) return { x: 0, z: 0 };

  const direction = { x: targetX / targetDistance, z: targetZ / targetDistance };
  const maxDistance = Math.min(targetDistance, Math.max(0, lookAheadDistance));
  if (maxDistance < EPSILON) return { x: 0, z: 0 };

  const safeClearance = Math.max(0, clearance);
  let nearestObstacle: EnemyNavigationObstacle | null = null;
  let nearestHitDistance = Number.POSITIVE_INFINITY;
  let nearestBounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;

  for (const obstacle of obstacles) {
    if (![obstacle.x, obstacle.z, obstacle.halfWidth, obstacle.halfDepth].every(Number.isFinite)) continue;
    const halfWidth = Math.max(0, obstacle.halfWidth) + safeClearance;
    const halfDepth = Math.max(0, obstacle.halfDepth) + safeClearance;
    const bounds = {
      minX: obstacle.x - halfWidth,
      maxX: obstacle.x + halfWidth,
      minZ: obstacle.z - halfDepth,
      maxZ: obstacle.z + halfDepth,
    };

    if (
      actor.x >= bounds.minX && actor.x <= bounds.maxX &&
      actor.z >= bounds.minZ && actor.z <= bounds.maxZ
    ) {
      // Recover deterministically if a knockback or spawn placed an actor
      // inside a collider's clearance footprint.
      const exits = [
        { distance: actor.x - bounds.minX, x: -1, z: 0 },
        { distance: bounds.maxX - actor.x, x: 1, z: 0 },
        { distance: actor.z - bounds.minZ, x: 0, z: -1 },
        { distance: bounds.maxZ - actor.z, x: 0, z: 1 },
      ];
      const minimum = Math.min(...exits.map((exit) => exit.distance));
      const tied = exits.filter((exit) => Math.abs(exit.distance - minimum) < 1e-6);
      const exit = tied[Math.floor((stableSide(actor.id) < 0 ? 1 : 0) * (tied.length - 1))] ?? tied[0];
      return { x: exit.x * 1.7, z: exit.z * 1.7 };
    }

    const hitDistance = rayBoxEntryDistance(
      actor,
      direction,
      maxDistance,
      bounds.minX,
      bounds.maxX,
      bounds.minZ,
      bounds.maxZ,
    );
    if (hitDistance !== null && hitDistance < nearestHitDistance) {
      nearestObstacle = obstacle;
      nearestHitDistance = hitDistance;
      nearestBounds = bounds;
    }
  }

  if (!nearestObstacle || !nearestBounds) return { x: 0, z: 0 };

  // Route around an expanded corner rather than simply pushing away from the
  // obstacle centre; the latter can keep actors scraping along long shelves.
  const waypointPadding = 0.55;
  const corners = [
    { x: nearestBounds.minX - waypointPadding, z: nearestBounds.minZ - waypointPadding },
    { x: nearestBounds.minX - waypointPadding, z: nearestBounds.maxZ + waypointPadding },
    { x: nearestBounds.maxX + waypointPadding, z: nearestBounds.minZ - waypointPadding },
    { x: nearestBounds.maxX + waypointPadding, z: nearestBounds.maxZ + waypointPadding },
  ];
  const preferredCornerOrder = stableSide(actor.id) < 0 ? [0, 2, 1, 3] : [3, 1, 2, 0];
  let waypoint = corners[preferredCornerOrder[0]];
  let bestRouteLength = Number.POSITIVE_INFINITY;

  for (const index of preferredCornerOrder) {
    const corner = corners[index];
    const routeLength =
      Math.hypot(corner.x - actor.x, corner.z - actor.z) +
      Math.hypot(target.x - corner.x, target.z - corner.z);
    if (routeLength < bestRouteLength - 1e-6) {
      bestRouteLength = routeLength;
      waypoint = corner;
    }
  }

  const steerX = waypoint.x - actor.x;
  const steerZ = waypoint.z - actor.z;
  const steerLength = Math.hypot(steerX, steerZ);
  if (steerLength < EPSILON) return { x: 0, z: 0 };

  const strength = Math.max(0.85, 1.55 - nearestHitDistance * 0.08);
  return {
    x: (steerX / steerLength) * strength,
    z: (steerZ / steerLength) * strength,
  };
}
