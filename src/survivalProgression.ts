/**
 * Survival progression keeps the first upgrade accessible and slightly softens
 * the long-run XP curve without turning every pickup into an instant level.
 */
export function getSurvivalXpRequirement(level: number): number {
  const safeLevel = Number.isFinite(level)
    ? Math.max(1, Math.floor(level))
    : 1;

  // Preserve the first two onboarding thresholds. From level three onward,
  // shave 10% off the old curve so later upgrades arrive often enough to matter.
  if (safeLevel === 1) return 9;
  if (safeLevel === 2) return 15;
  return Math.max(12, Math.round((10 + safeLevel * 3) * 0.90));
}
