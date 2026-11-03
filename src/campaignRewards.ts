export interface CampaignSectorRewardBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const CAMPAIGN_REWARD_BOUNDS: Readonly<Record<1 | 2 | 3, CampaignSectorRewardBounds>> = Object.freeze({
  1: { minX: -29, maxX: 29, minZ: -10, maxZ: 10 },
  2: { minX: 43, maxX: 109, minZ: -10, maxZ: 10 },
  3: { minX: 123, maxX: 198, minZ: -10, maxZ: 10 },
});

function normalizeRoll(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

/**
 * Positions roaming campaign pickups inside the sector the operator is
 * currently exploring. A small safety margin keeps drops out of gate seams
 * and the outer arena walls. Survival retains its separate arena spawner.
 */
export function chooseCampaignRewardSpawnPoint(
  sector: number,
  horizontalRoll: number,
  depthRoll: number,
): { x: number; z: number } {
  const safeSector = sector === 2 ? 2 : sector === 3 ? 3 : 1;
  const bounds = CAMPAIGN_REWARD_BOUNDS[safeSector];
  const xRoll = normalizeRoll(horizontalRoll);
  const zRoll = normalizeRoll(depthRoll);
  return {
    x: bounds.minX + (bounds.maxX - bounds.minX) * xRoll,
    z: bounds.minZ + (bounds.maxZ - bounds.minZ) * zRoll,
  };
}
