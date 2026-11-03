import { chooseSpacedSpawnPoint, type EnemySpacingActor, type HorizontalArenaBounds, type HorizontalVector } from './enemySpacing.ts';

export interface SurvivalSpawnObstacle {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
}

export interface SurvivalEventSpawnOptions {
  minimumPlayerDistance?: number;
  minimumEnemyDistance?: number;
  obstaclePadding?: number;
  arenaInsetX?: number;
  arenaInsetZ?: number;
}

/**
 * Finds a clear position for one of the five Survival secret-event riders.
 * Ring candidates preserve the event's surrounding-the-player presentation;
 * perimeter/grid candidates keep the event usable when the player is near a
 * wall or the preferred ring intersects warehouse scenery.
 */
export function chooseSurvivalEventSpawnPoint(
  origin: HorizontalVector,
  baseAngle: number,
  bounds: HorizontalArenaBounds,
  obstacles: readonly SurvivalSpawnObstacle[],
  occupied: readonly EnemySpacingActor[],
  options: SurvivalEventSpawnOptions = {},
): HorizontalVector | null {
  if (
    ![origin.x, origin.z, baseAngle, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite)
  ) return null;

  const minXBound = Math.min(bounds.minX, bounds.maxX);
  const maxXBound = Math.max(bounds.minX, bounds.maxX);
  const minZBound = Math.min(bounds.minZ, bounds.maxZ);
  const maxZBound = Math.max(bounds.minZ, bounds.maxZ);
  const insetX = Math.min(Math.max(0, options.arenaInsetX ?? 2.8), (maxXBound - minXBound) / 2);
  const insetZ = Math.min(Math.max(0, options.arenaInsetZ ?? 1.8), (maxZBound - minZBound) / 2);
  const minX = minXBound + insetX;
  const maxX = maxXBound - insetX;
  const minZ = minZBound + insetZ;
  const maxZ = maxZBound - insetZ;
  const minimumPlayerDistance = Math.max(0, options.minimumPlayerDistance ?? 7.8);
  const minimumEnemyDistance = Math.max(0, options.minimumEnemyDistance ?? 2.2);
  const obstaclePadding = Math.max(0, options.obstaclePadding ?? 0.85);
  const candidates: HorizontalVector[] = [];
  const seen = new Set<string>();

  const addCandidate = (x: number, z: number, requirePlayerClearance = true, requireObstacleClearance = true) => {
    const point = {
      x: Math.max(minX, Math.min(maxX, x)),
      z: Math.max(minZ, Math.min(maxZ, z)),
    };
    if (requirePlayerClearance && Math.hypot(point.x - origin.x, point.z - origin.z) < minimumPlayerDistance) return;
    if (requireObstacleClearance && obstacles.some((obstacle) =>
      Math.abs(point.x - obstacle.x) < obstacle.halfWidth + obstaclePadding &&
      Math.abs(point.z - obstacle.z) < obstacle.halfDepth + obstaclePadding
    )) return;
    const key = point.x.toFixed(2) + ':' + point.z.toFixed(2);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(point);
  };

  // Prefer a compact ring, then progressively widen it without moving riders
  // so far away that the secret event loses its visual connection to the player.
  const ringRadii = [8.0, 9.5, 11.0, 12.5, 14.0];
  for (let ring = 0; ring < ringRadii.length; ring++) {
    for (let step = 0; step < 16; step++) {
      const angle = baseAngle + (step / 16) * Math.PI * 2 + ring * 0.11;
      const radius = ringRadii[ring];
      addCandidate(origin.x + Math.sin(angle) * radius, origin.z + Math.cos(angle) * radius);
    }
  }

  // When the ring is obstructed, search all four arena edges before giving up.
  if (candidates.length === 0) {
    const edgeSteps = 16;
    for (let step = 0; step <= edgeSteps; step++) {
      const t = step / edgeSteps;
      const x = minX + (maxX - minX) * t;
      const z = minZ + (maxZ - minZ) * t;
      addCandidate(x, minZ);
      addCandidate(x, maxZ);
      addCandidate(minX, z);
      addCandidate(maxX, z);
    }
  }

  // Dense fallback for unusual layouts where perimeter points are all blocked.
  if (candidates.length === 0) {
    const gridSteps = 12;
    for (let xStep = 0; xStep <= gridSteps; xStep++) {
      for (let zStep = 0; zStep <= gridSteps; zStep++) {
        addCandidate(
          minX + ((maxX - minX) * xStep) / gridSteps,
          minZ + ((maxZ - minZ) * zStep) / gridSteps,
        );
      }
    }
  }

  return chooseSpacedSpawnPoint(candidates, occupied, minimumEnemyDistance);
}
