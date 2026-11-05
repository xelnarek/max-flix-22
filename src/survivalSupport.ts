export interface SurvivalSupportUnit {
  id: string;
  coalitionId?: number;
  x: number;
  z: number;
  state: string;
  type?: string;
}

export const SURVIVAL_SUPPORT_PULSE_RADIUS = 6.4;
export const SURVIVAL_SUPPORT_PULSE_INTERVAL_SECONDS = 8.5;
export const SURVIVAL_SUPPORT_SHIELD_SECONDS = 4.6;

const UNSHIELDABLE_BOSS_TYPES = new Set([
  'walczak',
  'krol_leto',
  'bosman_krakow',
  'sebix_m',
]);

/**
 * Pick the nearest living members of the support unit's current coalition.
 * The selector is deterministic and side-effect free, so the engine can run
 * it only when the support pulse is ready rather than scanning every frame.
 */
export function selectSurvivalSupportPulseTargets(
  support: SurvivalSupportUnit,
  candidates: readonly SurvivalSupportUnit[],
  radius = SURVIVAL_SUPPORT_PULSE_RADIUS,
  maxTargets = 3,
): string[] {
  if (
    !support.id ||
    !Number.isFinite(support.coalitionId) ||
    !Number.isFinite(support.x) ||
    !Number.isFinite(support.z)
  ) return [];

  const safeRadius = Number.isFinite(radius)
    ? Math.max(0, Math.min(12, radius))
    : SURVIVAL_SUPPORT_PULSE_RADIUS;
  const safeTargetCount = Number.isFinite(maxTargets)
    ? Math.max(0, Math.min(3, Math.floor(maxTargets)))
    : 3;
  if (safeTargetCount === 0 || safeRadius === 0) return [];

  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      if (
        !candidate.id ||
        candidate.id === support.id ||
        seen.has(candidate.id) ||
        candidate.coalitionId !== support.coalitionId ||
        candidate.state === 'defeated' ||
        UNSHIELDABLE_BOSS_TYPES.has(candidate.type ?? '') ||
        !Number.isFinite(candidate.x) ||
        !Number.isFinite(candidate.z)
      ) return false;
      seen.add(candidate.id);
      return true;
    })
    .map((candidate) => ({
      candidate,
      distance: Math.hypot(candidate.x - support.x, candidate.z - support.z),
    }))
    .filter((entry) => Number.isFinite(entry.distance) && entry.distance <= safeRadius)
    .sort((a, b) => a.distance - b.distance || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, safeTargetCount)
    .map((entry) => entry.candidate.id);
}
