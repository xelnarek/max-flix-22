export interface PvpAimDirection {
  x: number;
  z: number;
}

export const PVP_AIM_DEADZONE = 0.16;
/** Direction can be adjusted gently before the player crosses the fire threshold. */
export const PVP_AIM_DIRECTION_DEADZONE = 0.06;
/** Separate press/release thresholds prevent firing from flickering around the stick centre. */
export const PVP_AIM_FIRE_START_DEADZONE = 0.16;
export const PVP_AIM_FIRE_STOP_DEADZONE = 0.09;
export const DEFAULT_PVP_AIM_DIRECTION: Readonly<PvpAimDirection> = Object.freeze({ x: 0, z: 1 });

function finite(value: number): boolean { return Number.isFinite(value); }

function safePreviousDirection(previous: PvpAimDirection): PvpAimDirection {
  if (!finite(previous.x) || !finite(previous.z)) return { ...DEFAULT_PVP_AIM_DIRECTION };
  const length = Math.hypot(previous.x, previous.z);
  if (length <= 1e-6) return { ...DEFAULT_PVP_AIM_DIRECTION };
  return { x: previous.x / length, z: previous.z / length };
}

export function isPvpAimInputActive(x: number, z: number, deadzone = PVP_AIM_DEADZONE): boolean {
  return finite(x) && finite(z) && finite(deadzone) && Math.hypot(x, z) >= Math.max(0, deadzone);
}

/** Hysteresis keeps the right-stick trigger stable while the thumb jitters near centre. */
export function shouldPvpAimFire(x: number, z: number, currentlyFiring: boolean): boolean {
  const threshold = currentlyFiring ? PVP_AIM_FIRE_STOP_DEADZONE : PVP_AIM_FIRE_START_DEADZONE;
  return isPvpAimInputActive(x, z, threshold);
}

export function normalizePvpAimDirection(
  x: number,
  z: number,
  previous: PvpAimDirection = DEFAULT_PVP_AIM_DIRECTION,
  deadzone = PVP_AIM_DEADZONE,
): PvpAimDirection {
  if (!isPvpAimInputActive(x, z, deadzone)) return safePreviousDirection(previous);
  const length = Math.hypot(x, z);
  if (!finite(length) || length <= 1e-6) return safePreviousDirection(previous);
  return { x: x / length, z: z / length };
}

export function getPvpAimAngle(direction: PvpAimDirection): number {
  const safe = safePreviousDirection(direction);
  return Math.atan2(safe.x, safe.z);
}

export function pvpAimDirectionFromAngle(angle: number): PvpAimDirection {
  if (!finite(angle)) return { ...DEFAULT_PVP_AIM_DIRECTION };
  return { x: Math.sin(angle), z: Math.cos(angle) };
}


/** Convert a screen-space aim drag into world X/Z for the current PvP camera axis. */
export function pvpScreenAimToWorld(x: number, y: number, portrait: boolean): PvpAimDirection {
  if (!finite(x) || !finite(y)) return { ...DEFAULT_PVP_AIM_DIRECTION };
  // Portrait PvP rotates the view 90° to keep the long arena lane vertical.
  const world = portrait ? { x: y, z: -x } : { x, z: y };
  return { x: world.x === 0 ? 0 : world.x, z: world.z === 0 ? 0 : world.z };
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
