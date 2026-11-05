/**
 * Survival progression keeps the first upgrade accessible and slightly softens
 * the long-run XP curve without turning every pickup into an instant level.
 */
export function getSurvivalXpRequirement(level: number): number {
  const safeLevel = Number.isFinite(level)
    ? Math.max(1, Math.floor(level))
    : 1;

  // Level one remains unchanged (9 XP). From level two onward, ask for about
  // 8% less XP than the previous linear curve, with a small floor for stability.
  if (safeLevel === 1) return 9;
  return Math.max(12, Math.round((10 + safeLevel * 3) * 0.92));
}
