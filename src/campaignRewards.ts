import { chooseNearbySpawnPoint, type NearbySpawnOptions } from './arenaSpawn.ts';
import type { EnemySpacingActor, HorizontalVector } from './enemySpacing.ts';

export interface CampaignSectorRewardBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CampaignRewardObstacle {
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
}

const CAMPAIGN_REWARD_BOUNDS: Readonly<Record<1 | 2 | 3, CampaignSectorRewardBounds>> = Object.freeze({
  1: { minX: -29, maxX: 29, minZ: -10, maxZ: 10 },
  2: { minX: 43, maxX: 109, minZ: -10, maxZ: 10 },
  3: { minX: 123, maxX: 198, minZ: -10, maxZ: 10 },
});

const REWARD_OBSTACLE_CLEARANCE = 1.15;
const GRID_COLUMNS = 17;
const GRID_ROWS = 7;

function normalizeRoll(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function distanceToObstacleFootprint(x: number, z: number, obstacle: CampaignRewardObstacle): number {
  if (![obstacle.x, obstacle.z, obstacle.halfWidth, obstacle.halfDepth].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }
  const dx = Math.max(0, Math.abs(x - obstacle.x) - Math.max(0, obstacle.halfWidth));
  const dz = Math.max(0, Math.abs(z - obstacle.z) - Math.max(0, obstacle.halfDepth));
  return Math.hypot(dx, dz);
}

function isRewardPointClear(
  x: number,
  z: number,
  obstacles: readonly CampaignRewardObstacle[],
): boolean {
  return obstacles.every((obstacle) => {
    if (![obstacle.x, obstacle.z, obstacle.halfWidth, obstacle.halfDepth].every(Number.isFinite)) return true;
    return !(
      Math.abs(x - obstacle.x) <= Math.max(0, obstacle.halfWidth) + REWARD_OBSTACLE_CLEARANCE &&
      Math.abs(z - obstacle.z) <= Math.max(0, obstacle.halfDepth) + REWARD_OBSTACLE_CLEARANCE
    );
  });
}

/**
 * Positions roaming campaign pickups inside the sector the operator is
 * currently exploring. Candidate points are checked against warehouse
 * obstacle footprints so a reward does not appear inside a shelf, pallet,
 * bathtub or conveyor. Survival retains its separate arena spawner.
 */
export function chooseCampaignRewardSpawnPoint(
  sector: number,
  horizontalRoll: number,
  depthRoll: number,
  obstacles: readonly CampaignRewardObstacle[] = [],
): { x: number; z: number } {
  const safeSector = sector === 2 ? 2 : sector === 3 ? 3 : 1;
  const bounds = CAMPAIGN_REWARD_BOUNDS[safeSector];
  const xRoll = normalizeRoll(horizontalRoll);
  const zRoll = normalizeRoll(depthRoll);
  const requested = {
    x: bounds.minX + (bounds.maxX - bounds.minX) * xRoll,
    z: bounds.minZ + (bounds.maxZ - bounds.minZ) * zRoll,
  };

  if (obstacles.length === 0 || isRewardPointClear(requested.x, requested.z, obstacles)) {
    return requested;
  }

  const candidates: { x: number; z: number; distanceSq: number }[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const zFraction = 0.04 + (0.92 * row) / (GRID_ROWS - 1);
    for (let column = 0; column < GRID_COLUMNS; column++) {
      const xFraction = 0.04 + (0.92 * column) / (GRID_COLUMNS - 1);
      const x = bounds.minX + (bounds.maxX - bounds.minX) * xFraction;
      const z = bounds.minZ + (bounds.maxZ - bounds.minZ) * zFraction;
      candidates.push({ x, z, distanceSq: (x - requested.x) ** 2 + (z - requested.z) ** 2 });
    }
  }

  // Keep the reward near its originally sampled location while choosing the
  // nearest safe point. Stable sorting makes identical rolls reproducible.
  candidates.sort((a, b) => a.distanceSq - b.distanceSq);
  for (const candidate of candidates) {
    if (isRewardPointClear(candidate.x, candidate.z, obstacles)) {
      return { x: candidate.x, z: candidate.z };
    }
  }

  // Extremely dense/custom layouts may have no fully clear grid cell. In that
  // case choose the point with the greatest minimum distance from all known
  // obstacle footprints rather than returning the original blocked point.
  let safest = candidates[0] ?? requested;
  let bestClearance = -1;
  for (const candidate of candidates) {
    const clearance = obstacles.length
      ? Math.min(...obstacles.map((obstacle) => distanceToObstacleFootprint(candidate.x, candidate.z, obstacle)))
      : Number.POSITIVE_INFINITY;
    if (clearance > bestClearance) {
      bestClearance = clearance;
      safest = candidate;
    }
  }
  return { x: safest.x, z: safest.z };
}


/**
 * Places a roaming campaign reward beside the operator in the active sector.
 * This avoids the old full-sector random position that could put a pickup
 * hundreds of metres away from the player on the mega-map.
 */
export function chooseCampaignNearbyRewardSpawnPoint(
  sector: number,
  origin: HorizontalVector,
  angleRoll: number,
  radiusRoll: number,
  obstacles: readonly CampaignRewardObstacle[] = [],
  occupied: readonly EnemySpacingActor[] = [],
  options: NearbySpawnOptions = {},
): { x: number; z: number } | null {
  const safeSector = sector === 2 ? 2 : sector === 3 ? 3 : 1;
  return chooseNearbySpawnPoint(
    origin,
    CAMPAIGN_REWARD_BOUNDS[safeSector],
    obstacles,
    occupied,
    angleRoll,
    radiusRoll,
    { minimumPlayerDistance: 5.0, maximumPlayerDistance: 11.5, ...options },
  );
}
