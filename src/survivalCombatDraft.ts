export interface SurvivalRicochetTarget {
  id: string;
  x: number;
  z: number;
  state?: string;
}

export interface SurvivalRicochetProfile {
  bounceCount: number;
  maxDistance: number;
  damageRetention: number;
}

export interface SurvivalRadiationProfile {
  radius: number;
  intervalSeconds: number;
  damage: number;
  maxTargets: number;
}

const safeRank = (rank: number): number =>
  Number.isFinite(rank) ? Math.min(3, Math.max(0, Math.floor(rank))) : 0;

/** Archero-style chained projectiles: each rank adds one controlled target jump. */
export function getSurvivalRicochetProfile(rank: number, chainReactorActive = false): SurvivalRicochetProfile {
  const level = safeRank(rank);
  if (level === 0) return { bounceCount: 0, maxDistance: 0, damageRetention: 1 };
  return {
    bounceCount: level,
    maxDistance: 6.5 + level * 0.7 + (chainReactorActive ? 1.8 : 0),
    damageRetention: Math.min(0.9, 0.66 + (level - 1) * 0.05 + (chainReactorActive ? 0.09 : 0)),
  };
}

/** Crimsonland-inspired radiation pulses, bounded for mobile crowd sizes. */
export function getSurvivalRadiationProfile(rank: number, chainReactorActive = false): SurvivalRadiationProfile {
  const level = safeRank(rank);
  if (level === 0) return { radius: 0, intervalSeconds: 0, damage: 0, maxTargets: 0 };
  const baseDamage = level >= 2 ? 2 : 1;
  return {
    radius: 3.1 + level * 0.55 + (chainReactorActive ? 0.8 : 0),
    intervalSeconds: Math.max(1.9, 3.5 - (level - 1) * 0.32) * (chainReactorActive ? 0.82 : 1),
    damage: baseDamage + (chainReactorActive ? 1 : 0),
    maxTargets: Math.min(10, 4 + level * 2),
  };
}

/** Select one deterministic, unhit target for a ricochet hop. */
export function chooseSurvivalRicochetTarget(
  origin: { x: number; z: number },
  candidates: readonly SurvivalRicochetTarget[],
  alreadyHit: ReadonlySet<string>,
  maxDistance: number,
): SurvivalRicochetTarget | null {
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.z) ||
      !Number.isFinite(maxDistance) || maxDistance <= 0) return null;

  const maxDistanceSq = maxDistance * maxDistance;
  let closestDistanceSq = maxDistanceSq;
  let selected: SurvivalRicochetTarget | null = null;
  for (const candidate of candidates) {
    if (!candidate.id || candidate.state === 'defeated' || alreadyHit.has(candidate.id) ||
        !Number.isFinite(candidate.x) || !Number.isFinite(candidate.z)) continue;
    const dx = candidate.x - origin.x;
    const dz = candidate.z - origin.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > closestDistanceSq) continue;
    if (distanceSq < closestDistanceSq ||
        (selected !== null && distanceSq === closestDistanceSq && candidate.id < selected.id)) {
      closestDistanceSq = distanceSq;
      selected = candidate;
    }
  }
  return selected;
}
