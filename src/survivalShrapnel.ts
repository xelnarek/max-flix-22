export interface SurvivalShrapnelProfile {
  /** Small splash radius measured in world units around the confirmed critical impact. */
  radius: number;
  /** Fraction of the direct critical hit reused as damage for each secondary target. */
  damageMultiplier: number;
  /** Maximum number of secondary targets hit by one critical volley. */
  maxTargets: number;
}

const safeRank = (rank: number): number =>
  Number.isFinite(rank) ? Math.min(3, Math.max(0, Math.floor(rank))) : 0;

const safeStrength = (strength: number): number =>
  Number.isFinite(strength) ? Math.min(1.65, Math.max(1, strength)) : 1;

/**
 * Archero-style critical impact fragments.
 * One shared volley token in the game loop limits the burst to one proc,
 * even when a weapon launches several projectiles in the same shot.
 */
export function getSurvivalShrapnelProfile(
  rank: number,
  crystalCascadeActive = false,
  strength = 1,
): SurvivalShrapnelProfile {
  const level = safeRank(rank);
  if (level === 0) return { radius: 0, damageMultiplier: 0, maxTargets: 0 };

  const cascadeBonus = crystalCascadeActive ? 1 : 0;
  return {
    radius: 2.2 + (level - 1) * 0.3 + (crystalCascadeActive ? 0.65 : 0),
    damageMultiplier: Math.min(
      0.46,
      (0.26 + (level - 1) * 0.045 + (crystalCascadeActive ? 0.05 : 0)) * safeStrength(strength),
    ),
    maxTargets: Math.min(3, (level >= 3 ? 2 : 1) + cascadeBonus),
  };
}
