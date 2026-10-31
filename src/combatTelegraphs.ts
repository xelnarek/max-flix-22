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
