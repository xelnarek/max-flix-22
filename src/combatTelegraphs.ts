/**
 * Small, allocation-free combat geometry checks used by boss telegraphs.
 */
export function isWithinBossImpactRadius(
  playerX: number,
  playerZ: number,
  impactX: number,
  impactZ: number,
  radius: number
): boolean {
  if (![playerX, playerZ, impactX, impactZ, radius].every(Number.isFinite)) return false;
  const safeRadius = Math.max(0, radius);
  const dx = playerX - impactX;
  const dz = playerZ - impactZ;
  return dx * dx + dz * dz <= safeRadius * safeRadius;
}

/**
 * Checks whether an operator is standing inside a boss's locked, one-way attack lane.
 * The local +Z axis is the lane direction, matching THREE.Group.rotation.y.
 */
export function isInsideBossAttackLane(
  playerX: number,
  playerZ: number,
  originX: number,
  originZ: number,
  direction: number,
  length: number,
  width: number,
  bodyRadius = 0.28
): boolean {
  if (![playerX, playerZ, originX, originZ, direction, length, width, bodyRadius].every(Number.isFinite)) {
    return false;
  }
  const safeLength = Math.max(0, length);
  const safeWidth = Math.max(0, width);
  const safeBodyRadius = Math.max(0, bodyRadius);
  if (safeLength <= 0 || safeWidth <= 0) return false;

  const dx = playerX - originX;
  const dz = playerZ - originZ;
  const forwardX = Math.sin(direction);
  const forwardZ = Math.cos(direction);
  const sideX = Math.cos(direction);
  const sideZ = -Math.sin(direction);
  const along = dx * forwardX + dz * forwardZ;
  const lateral = dx * sideX + dz * sideZ;

  return along >= -safeBodyRadius &&
    along <= safeLength + safeBodyRadius &&
    Math.abs(lateral) <= safeWidth * 0.5 + safeBodyRadius;
}

/**
 * A perfect dodge must start inside the warned lane and move laterally far enough
 * to leave it before impact. Running along the lane is deliberately not rewarded.
 */
export function isEffectiveBossLaneDodge(
  playerX: number,
  playerZ: number,
  dashDirectionX: number,
  dashDirectionZ: number,
  dashDistance: number,
  originX: number,
  originZ: number,
  laneDirection: number,
  laneLength: number,
  laneWidth: number,
  bodyRadius = 0.28
): boolean {
  const values = [
    playerX, playerZ, dashDirectionX, dashDirectionZ, dashDistance,
    originX, originZ, laneDirection, laneLength, laneWidth, bodyRadius,
  ];
  if (!values.every(Number.isFinite) || dashDistance <= 0) return false;
  if (!isInsideBossAttackLane(
    playerX, playerZ, originX, originZ, laneDirection, laneLength, laneWidth, bodyRadius
  )) return false;

  const directionMagnitude = Math.hypot(dashDirectionX, dashDirectionZ);
  if (directionMagnitude <= 0.0001) return false;
  const directionX = dashDirectionX / directionMagnitude;
  const directionZ = dashDirectionZ / directionMagnitude;
  const sideX = Math.cos(laneDirection);
  const sideZ = -Math.sin(laneDirection);
  const lateralTravel = Math.abs(directionX * sideX + directionZ * sideZ) * dashDistance;
  const requiredTravel = Math.max(0.75, Math.max(0, laneWidth) * 0.5 + 0.18);
  if (lateralTravel < requiredTravel) return false;

  const endX = playerX + directionX * dashDistance;
  const endZ = playerZ + directionZ * dashDistance;
  return !isInsideBossAttackLane(
    endX, endZ, originX, originZ, laneDirection, laneLength, laneWidth, bodyRadius
  );
}
