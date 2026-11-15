/**
 * Fair-play hit test for Cthulhu's phase-two directional tentacle lash.
 * The direction is normalized internally so callers can pass a raw aim vector.
 */
export function isWithinCthulhuLashLane(
  playerX: number,
  playerZ: number,
  originX: number,
  originZ: number,
  directionX: number,
  directionZ: number,
  length = 15.5,
  halfWidth = 2.15,
  minForward = 0.7,
): boolean {
  const values = [playerX, playerZ, originX, originZ, directionX, directionZ, length, halfWidth, minForward];
  if (!values.every(Number.isFinite) || length <= 0 || halfWidth < 0) return false;

  const directionLength = Math.hypot(directionX, directionZ);
  if (directionLength < 1e-6) return false;

  const dirX = directionX / directionLength;
  const dirZ = directionZ / directionLength;
  const relativeX = playerX - originX;
  const relativeZ = playerZ - originZ;
  const along = relativeX * dirX + relativeZ * dirZ;
  const across = Math.abs(relativeX * dirZ - relativeZ * dirX);

  return along >= minForward && along <= length && across <= halfWidth;
}
