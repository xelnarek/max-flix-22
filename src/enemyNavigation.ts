import type { EnemySpacingActor, HorizontalVector } from './enemySpacing.ts';

export interface EnemyNavigationObstacle {
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
}

const EPSILON = 1e-8;
const NEGATIVE_CORNER_ORDER = [0, 2, 1, 3] as const;
const POSITIVE_CORNER_ORDER = [3, 1, 2, 0] as const;

function stableSide(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  }
  return (hash & 1) === 0 ? -1 : 1;
}

function rayBoxEntryDistance(
  originX: number,
  originZ: number,
  directionX: number,
  directionZ: number,
  maxDistance: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): number | null {
  let entry = 0;
  let exit = maxDistance;

  if (Math.abs(directionX) < EPSILON) {
    if (originX < minX || originX > maxX) return null;
  } else {
    let near = (minX - originX) / directionX;
    let far = (maxX - originX) / directionX;
    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }
    entry = Math.max(entry, near);
    exit = Math.min(exit, far);
    if (exit < entry) return null;
  }

  if (Math.abs(directionZ) < EPSILON) {
    if (originZ < minZ || originZ > maxZ) return null;
  } else {
    let near = (minZ - originZ) / directionZ;
    let far = (maxZ - originZ) / directionZ;
    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }
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
 *
 * A caller-owned output vector can be supplied for allocation-free updates.
 */
export function calculateEnemyObstacleAvoidanceVector(
  actor: EnemySpacingActor,
  target: HorizontalVector,
  obstacles: readonly EnemyNavigationObstacle[],
  lookAheadDistance = 4.2,
  clearance = 0.8,
  out: HorizontalVector = { x: 0, z: 0 },
): HorizontalVector {
  out.x = 0;
  out.z = 0;
  if (
    !Number.isFinite(actor.x) || !Number.isFinite(actor.z) ||
    !Number.isFinite(target.x) || !Number.isFinite(target.z) ||
    !Number.isFinite(lookAheadDistance) || !Number.isFinite(clearance)
  ) {
    return out;
  }

  const targetX = target.x - actor.x;
  const targetZ = target.z - actor.z;
  const targetDistance = Math.hypot(targetX, targetZ);
  if (targetDistance < EPSILON) return out;

  const directionX = targetX / targetDistance;
  const directionZ = targetZ / targetDistance;
  const maxDistance = Math.min(targetDistance, Math.max(0, lookAheadDistance));
  if (maxDistance < EPSILON) return out;

  const safeClearance = Math.max(0, clearance);
  let hasNearestBounds = false;
  let nearestHitDistance = Number.POSITIVE_INFINITY;
  let nearestMinX = 0;
  let nearestMaxX = 0;
  let nearestMinZ = 0;
  let nearestMaxZ = 0;
  const side = stableSide(actor.id);

  for (const obstacle of obstacles) {
    if (
      !Number.isFinite(obstacle.x) || !Number.isFinite(obstacle.z) ||
      !Number.isFinite(obstacle.halfWidth) || !Number.isFinite(obstacle.halfDepth)
    ) {
      continue;
    }

    const halfWidth = Math.max(0, obstacle.halfWidth) + safeClearance;
    const halfDepth = Math.max(0, obstacle.halfDepth) + safeClearance;
    const minX = obstacle.x - halfWidth;
    const maxX = obstacle.x + halfWidth;
    const minZ = obstacle.z - halfDepth;
    const maxZ = obstacle.z + halfDepth;

    if (
      actor.x >= minX && actor.x <= maxX &&
      actor.z >= minZ && actor.z <= maxZ
    ) {
      // Recover deterministically if a knockback or spawn placed an actor
      // inside a collider's clearance footprint. Tie order matches the old
      // stable left/right selection, but uses scalar distances only.
      const d0 = actor.x - minX;
      const d1 = maxX - actor.x;
      const d2 = actor.z - minZ;
      const d3 = maxZ - actor.z;
      const minimum = Math.min(d0, d1, d2, d3);
      let firstTie = -1;
      let lastTie = -1;
      if (Math.abs(d0 - minimum) < 1e-6) { if (firstTie < 0) firstTie = 0; lastTie = 0; }
      if (Math.abs(d1 - minimum) < 1e-6) { if (firstTie < 0) firstTie = 1; lastTie = 1; }
      if (Math.abs(d2 - minimum) < 1e-6) { if (firstTie < 0) firstTie = 2; lastTie = 2; }
      if (Math.abs(d3 - minimum) < 1e-6) { if (firstTie < 0) firstTie = 3; lastTie = 3; }
      const exitIndex = side < 0 ? lastTie : firstTie;
      if (exitIndex === 0) out.x = -1.7;
      else if (exitIndex === 1) out.x = 1.7;
      else if (exitIndex === 2) out.z = -1.7;
      else out.z = 1.7;
      return out;
    }

    const hitDistance = rayBoxEntryDistance(
      actor.x,
      actor.z,
      directionX,
      directionZ,
      maxDistance,
      minX,
      maxX,
      minZ,
      maxZ,
    );
    if (hitDistance !== null && hitDistance < nearestHitDistance) {
      hasNearestBounds = true;
      nearestHitDistance = hitDistance;
      nearestMinX = minX;
      nearestMaxX = maxX;
      nearestMinZ = minZ;
      nearestMaxZ = maxZ;
    }
  }

  if (!hasNearestBounds) return out;

  // Route around an expanded corner rather than pushing away from the centre.
  const waypointPadding = 0.55;
  const negativeSide = side < 0;
  const preferredOrder = negativeSide ? NEGATIVE_CORNER_ORDER : POSITIVE_CORNER_ORDER;
  let waypointX = negativeSide
    ? nearestMinX - waypointPadding
    : nearestMaxX + waypointPadding;
  let waypointZ = negativeSide
    ? nearestMinZ - waypointPadding
    : nearestMaxZ + waypointPadding;
  let bestRouteLength = Number.POSITIVE_INFINITY;

  for (let orderIndex = 0; orderIndex < 4; orderIndex++) {
    const cornerIndex = preferredOrder[orderIndex];
    let cornerX = 0;
    let cornerZ = 0;
    if (cornerIndex === 0) {
      cornerX = nearestMinX - waypointPadding;
      cornerZ = nearestMinZ - waypointPadding;
    } else if (cornerIndex === 1) {
      cornerX = nearestMinX - waypointPadding;
      cornerZ = nearestMaxZ + waypointPadding;
    } else if (cornerIndex === 2) {
      cornerX = nearestMaxX + waypointPadding;
      cornerZ = nearestMinZ - waypointPadding;
    } else {
      cornerX = nearestMaxX + waypointPadding;
      cornerZ = nearestMaxZ + waypointPadding;
    }

    const routeLength =
      Math.hypot(cornerX - actor.x, cornerZ - actor.z) +
      Math.hypot(target.x - cornerX, target.z - cornerZ);
    if (routeLength < bestRouteLength - 1e-6) {
      bestRouteLength = routeLength;
      waypointX = cornerX;
      waypointZ = cornerZ;
    }
  }

  const steerX = waypointX - actor.x;
  const steerZ = waypointZ - actor.z;
  const steerLength = Math.hypot(steerX, steerZ);
  if (steerLength < EPSILON) return out;

  const strength = Math.max(0.85, 1.55 - nearestHitDistance * 0.08);
  out.x = (steerX / steerLength) * strength;
  out.z = (steerZ / steerLength) * strength;
  return out;
}
