import {
  chooseSpacedSpawnPoint,
  type EnemySpacingActor,
  type HorizontalArenaBounds,
  type HorizontalVector,
} from './enemySpacing.ts';

export interface SpawnObstacle {
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
}

export interface NearbySpawnOptions {
  minimumPlayerDistance?: number;
  maximumPlayerDistance?: number;
  minimumOccupiedDistance?: number;
  obstaclePadding?: number;
  arenaInset?: number;
  candidateCount?: number;
}

/**
 * Creates a visible, reachable spawn around the player's current position.
 * Candidates are bounded by the active arena, avoid obstacle footprints, and
 * keep clearance from existing enemies and pickups. The two roll inputs make
 * the behaviour deterministic in tests while the caller supplies Math.random()
 * during gameplay.
 */
export function chooseNearbySpawnPoint(
  origin: HorizontalVector,
  bounds: HorizontalArenaBounds,
  obstacles: readonly SpawnObstacle[],
  occupied: readonly EnemySpacingActor[],
  angleRoll: number,
  radiusRoll: number,
  options: NearbySpawnOptions = {},
): HorizontalVector | null {
  if (![origin.x, origin.z, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite)) {
    return null;
  }

  const minXBound = Math.min(bounds.minX, bounds.maxX);
  const maxXBound = Math.max(bounds.minX, bounds.maxX);
  const minZBound = Math.min(bounds.minZ, bounds.maxZ);
  const maxZBound = Math.max(bounds.minZ, bounds.maxZ);
  const inset = Math.max(0, Number.isFinite(options.arenaInset ?? 0) ? (options.arenaInset ?? 1.8) : 1.8);
  const safeInsetX = Math.min(inset, (maxXBound - minXBound) / 2);
  const safeInsetZ = Math.min(inset, (maxZBound - minZBound) / 2);
  const minX = minXBound + safeInsetX;
  const maxX = maxXBound - safeInsetX;
  const minZ = minZBound + safeInsetZ;
  const maxZ = maxZBound - safeInsetZ;
  const minimumPlayerDistance = Math.max(0, options.minimumPlayerDistance ?? 5.0);
  const maximumPlayerDistance = Math.max(minimumPlayerDistance, options.maximumPlayerDistance ?? 12.0);
  const minimumOccupiedDistance = Math.max(0, options.minimumOccupiedDistance ?? 2.8);
  const obstaclePadding = Math.max(0, options.obstaclePadding ?? 1.0);
  const count = Math.max(8, Math.min(48, Math.floor(options.candidateCount ?? 28)));
  const safeAngleRoll = Number.isFinite(angleRoll) ? Math.max(0, Math.min(0.999999, angleRoll)) : 0.5;
  const safeRadiusRoll = Number.isFinite(radiusRoll) ? Math.max(0, Math.min(1, radiusRoll)) : 0.5;
  const baseAngle = safeAngleRoll * Math.PI * 2;
  const preferredRadius = minimumPlayerDistance + (maximumPlayerDistance - minimumPlayerDistance) * safeRadiusRoll;
  const candidates: HorizontalVector[] = [];
  const seen = new Set<string>();
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < count; index++) {
    const ringOffset = ((index % 5) - 2) * 0.34;
    const radius = Math.max(minimumPlayerDistance, Math.min(maximumPlayerDistance, preferredRadius + ringOffset));
    const angle = baseAngle + index * goldenAngle;
    const x = Math.max(minX, Math.min(maxX, origin.x + Math.sin(angle) * radius));
    const z = Math.max(minZ, Math.min(maxZ, origin.z + Math.cos(angle) * radius));
    const distanceToPlayer = Math.hypot(x - origin.x, z - origin.z);
    if (distanceToPlayer < minimumPlayerDistance - 0.05 || distanceToPlayer > maximumPlayerDistance + 0.05) continue;
    if (obstacles.some((obstacle) =>
      [obstacle.x, obstacle.z, obstacle.halfWidth, obstacle.halfDepth].every(Number.isFinite) &&
      Math.abs(x - obstacle.x) < Math.max(0, obstacle.halfWidth) + obstaclePadding &&
      Math.abs(z - obstacle.z) < Math.max(0, obstacle.halfDepth) + obstaclePadding
    )) continue;
    const key = x.toFixed(2) + ':' + z.toFixed(2);
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ x, z });
    }
  }

  if (candidates.length === 0) return null;
  const selected = chooseSpacedSpawnPoint(candidates, occupied, minimumOccupiedDistance);
  if (!selected) return null;

  // chooseSpacedSpawnPoint deliberately returns the least-crowded fallback
  // when a wave fills the arena. Do not use that fallback when the best point
  // would still overlap an existing actor or pickup.
  let nearestOccupied = Number.POSITIVE_INFINITY;
  for (const actor of occupied) {
    if (actor.state === 'defeated' || !Number.isFinite(actor.x) || !Number.isFinite(actor.z)) continue;
    nearestOccupied = Math.min(nearestOccupied, Math.hypot(selected.x - actor.x, selected.z - actor.z));
  }
  if (nearestOccupied < Math.max(1.4, minimumOccupiedDistance * 0.58)) return null;
  return selected;
}
