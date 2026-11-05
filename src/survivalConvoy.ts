/**
 * Reserve a strict global active-hazard budget for the Survival forklift event.
 * Existing hazards count first; the convoy may use only the remaining slots.
 */
export function getSurvivalConvoyHazardCount(
  activeHazards: number,
  performanceTier: number,
  laneGap: number,
): 0 | 1 | 2 {
  const active = activeHazards === Number.POSITIVE_INFINITY
    ? 3
    : Number.isFinite(activeHazards)
      ? Math.max(0, Math.floor(activeHazards))
      : 0;
  const tier = Number.isFinite(performanceTier) ? Math.max(0, Math.floor(performanceTier)) : 0;
  const gap = Number.isFinite(laneGap) ? Math.max(0, laneGap) : 0;
  const availableSlots = Math.max(0, 3 - active);
  if (availableSlots === 0) return 0;

  const desiredCount = tier >= 2 || active >= 2 || gap < 3.8 ? 1 : 2;
  return Math.min(availableSlots, desiredCount) as 0 | 1 | 2;
}
