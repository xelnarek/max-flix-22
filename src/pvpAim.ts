export interface PvpAimDirection {
  x: number;
  z: number;
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function safePreviousDirection(previous: PvpAimDirection): PvpAimDirection {
  if (!finite(previous.x) || !finite(previous.z)) return { x: 0, z: 1 };
  const length = Math.hypot(previous.x, previous.z);
  if (!finite(length) || length <= 1e-6) return { x: 0, z: 1 };
  return { x: previous.x / length, z: previous.z / length };
}

export function getPvpAimAngle(direction: PvpAimDirection): number {
  const safe = safePreviousDirection(direction);
  return Math.atan2(safe.x, safe.z);
}

export function pvpAimDirectionFromAngle(angle: number): PvpAimDirection {
  if (!finite(angle)) return { x: 0, z: 1 };
  return { x: Math.sin(angle), z: Math.cos(angle) };
}

/** Archero-inspired timing cursor: left edge -> right edge -> left edge. */
export const PVP_AIM_SWEEP_HALF_ARC = 68 * Math.PI / 180;
export const PVP_AIM_SWEEP_PERIOD_SECONDS = 3.2;
export const PVP_AIM_SWEEP_RADIUS = 2.75;
export const PVP_AIM_SWEEP_SEGMENTS = 40;

/**
 * The sweep centre belongs to the player, not to a tracked opponent.
 * A deliberate movement direction reorients the arc; releasing movement
 * keeps the last facing direction so the player can time the shot while still.
 */
export function getPvpAimSweepCenterAngle(
  moveX: number,
  moveZ: number,
  previousAngle: number,
  movementThreshold = 0.18,
): number {
  const fallback = finite(previousAngle)
    ? Math.atan2(Math.sin(previousAngle), Math.cos(previousAngle))
    : 0;
  if (!finite(moveX) || !finite(moveZ)) return fallback;
  const threshold = finite(movementThreshold) ? Math.max(0, movementThreshold) : 0.18;
  const magnitude = Math.hypot(moveX, moveZ);
  if (!finite(magnitude) || magnitude < threshold) return fallback;
  return Math.atan2(moveX, moveZ);
}

export function getPvpSweepAimAngle(
  elapsedSeconds: number,
  centerAngle: number,
  halfArc = PVP_AIM_SWEEP_HALF_ARC,
  periodSeconds = PVP_AIM_SWEEP_PERIOD_SECONDS,
): number {
  if (!finite(centerAngle)) return 0;
  const elapsed = finite(elapsedSeconds) ? elapsedSeconds : 0;
  const period = finite(periodSeconds) && periodSeconds > 0 ? periodSeconds : PVP_AIM_SWEEP_PERIOD_SECONDS;
  const arc = finite(halfArc) ? Math.max(0, Math.min(Math.PI, Math.abs(halfArc))) : PVP_AIM_SWEEP_HALF_ARC;
  const phase = ((elapsed % period) + period) % period / period;
  const travel = phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
  const angle = centerAngle + (travel * 2 - 1) * arc;
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}


/** Convert screen-relative movement (positive Y = up) into arena world X/Z. */
export function pvpScreenMovementToWorld(screenX: number, screenY: number, portrait: boolean): PvpAimDirection {
  if (!finite(screenX) || !finite(screenY)) return { x: 0, z: 0 };
  const world = portrait
    ? { x: -screenY, z: -screenX }
    : { x: screenX, z: -screenY };
  return { x: world.x === 0 ? 0 : world.x, z: world.z === 0 ? 0 : world.z };
}


export interface PvpAimPreviewBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PvpAimPreviewObstacle {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface PvpAimPreviewTarget {
  x: number;
  z: number;
}

export interface PvpAimPreview {
  x: number;
  z: number;
  distance: number;
  blocked: boolean;
  onTarget: boolean;
  impact: 'cover' | 'boundary' | 'range';
}

function rayRectangleDistance(
  origin: PvpAimPreviewTarget,
  direction: PvpAimDirection,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  maxDistance: number,
): number | null {
  let near = 0;
  let far = maxDistance;
  for (const axis of [
    { position: origin.x, direction: direction.x, min: minX, max: maxX },
    { position: origin.z, direction: direction.z, min: minZ, max: maxZ },
  ]) {
    if (Math.abs(axis.direction) < 1e-8) {
      if (axis.position < axis.min || axis.position > axis.max) return null;
      continue;
    }
    const first = (axis.min - axis.position) / axis.direction;
    const second = (axis.max - axis.position) / axis.direction;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (far < near) return null;
  }
  if (far < 0 || near > maxDistance) return null;
  return near > 1e-4 ? near : far > 1e-4 ? far : null;
}

/** Show the first physical cover/boundary along the manual firing direction. */
export function calculatePvpAimPreview(
  origin: PvpAimPreviewTarget,
  directionInput: PvpAimDirection,
  bounds: PvpAimPreviewBounds,
  obstacles: PvpAimPreviewObstacle[],
  target?: PvpAimPreviewTarget,
  maxDistance = 56,
): PvpAimPreview {
  const direction = safePreviousDirection(directionInput);
  const safeOrigin = {
    x: finite(origin.x) ? origin.x : 0,
    z: finite(origin.z) ? origin.z : 0,
  };
  const range = finite(maxDistance) ? Math.max(1, maxDistance) : 56;
  const edgeDistances = [
    direction.x > 1e-8 ? (bounds.maxX - safeOrigin.x) / direction.x
      : direction.x < -1e-8 ? (bounds.minX - safeOrigin.x) / direction.x : Number.POSITIVE_INFINITY,
    direction.z > 1e-8 ? (bounds.maxZ - safeOrigin.z) / direction.z
      : direction.z < -1e-8 ? (bounds.minZ - safeOrigin.z) / direction.z : Number.POSITIVE_INFINITY,
  ].filter((distance) => Number.isFinite(distance) && distance >= 0);
  const boundaryDistance = edgeDistances.length ? Math.min(range, ...edgeDistances) : range;

  let nearestCover = Number.POSITIVE_INFINITY;
  for (const obstacle of obstacles) {
    if (![obstacle.x, obstacle.z, obstacle.width, obstacle.depth].every(finite)) continue;
    if (obstacle.width <= 0 || obstacle.depth <= 0) continue;
    const hitDistance = rayRectangleDistance(
      safeOrigin,
      direction,
      obstacle.x - obstacle.width * 0.5 - 0.16,
      obstacle.x + obstacle.width * 0.5 + 0.16,
      obstacle.z - obstacle.depth * 0.5 - 0.16,
      obstacle.z + obstacle.depth * 0.5 + 0.16,
      Math.min(range, boundaryDistance),
    );
    if (hitDistance !== null && hitDistance < nearestCover) nearestCover = hitDistance;
  }

  const blocked = nearestCover < boundaryDistance;
  const impact = blocked ? 'cover' : boundaryDistance < range ? 'boundary' : 'range';
  const stopDistance = Math.max(0.7, Math.min(range, boundaryDistance, nearestCover) - (blocked ? 0.2 : 0));
  let onTarget = false;
  if (target && finite(target.x) && finite(target.z) && !blocked) {
    const targetX = target.x - safeOrigin.x;
    const targetZ = target.z - safeOrigin.z;
    const alongRay = targetX * direction.x + targetZ * direction.z;
    const acrossRay = Math.abs(targetX * direction.z - targetZ * direction.x);
    onTarget = alongRay >= 0 && alongRay <= stopDistance + 0.25 && acrossRay <= 0.95;
  }

  return {
    x: safeOrigin.x + direction.x * stopDistance,
    z: safeOrigin.z + direction.z * stopDistance,
    distance: stopDistance,
    blocked,
    onTarget,
    impact,
  };
}
