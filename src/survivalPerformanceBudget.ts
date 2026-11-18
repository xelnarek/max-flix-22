export interface SurvivalPerformanceBudget {
  /** Base live-enemy ceiling before temporary event bonuses are applied. */
  readonly enemyCap: number;
  /** Largest regular spawn group before the remaining-cap clamp. */
  readonly groupCap: number;
  /** Maximum extra enemies a roulette reward or risk may add at once. */
  readonly maxRouletteExtraEnemies: number;
  /** Simultaneous radial projectiles in the Survival bullet nova. */
  readonly novaProjectileCount: number;
  /** Explosion fragments emitted by one radial blast. */
  readonly explosionParticleCount: number;
  /** Maximum per-enemy visual rings for a whole-screen time-lock. */
  readonly timeLockImpactLimit: number;
  /** Number of XP crystals emitted by the XP-rain event. */
  readonly xpRainGemCount: number;
}

function safeTier(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(2, Math.floor(value))) : 1;
}

/**
 * Centralized Survival effects budget. Tier 0 is the strongest handheld
 * profile, tier 2 is the most constrained. Desktop deliberately has a higher
 * cap, but still uses fixed ceilings to avoid runaway allocations.
 */
export function getSurvivalPerformanceBudget(
  isMobile: boolean,
  adaptiveTier: number,
): SurvivalPerformanceBudget {
  if (!isMobile) {
    return {
      enemyCap: 42,
      groupCap: 10,
      maxRouletteExtraEnemies: 4,
      novaProjectileCount: 20,
      explosionParticleCount: 26,
      timeLockImpactLimit: 18,
      xpRainGemCount: 10,
    };
  }

  const tier = safeTier(adaptiveTier);
  if (tier >= 2) {
    return {
      enemyCap: 16,
      groupCap: 5,
      maxRouletteExtraEnemies: 1,
      novaProjectileCount: 10,
      explosionParticleCount: 10,
      timeLockImpactLimit: 5,
      xpRainGemCount: 6,
    };
  }
  if (tier === 1) {
    return {
      enemyCap: 20,
      groupCap: 7,
      maxRouletteExtraEnemies: 2,
      novaProjectileCount: 14,
      explosionParticleCount: 14,
      timeLockImpactLimit: 7,
      xpRainGemCount: 8,
    };
  }
  return {
    enemyCap: 22,
    groupCap: 8,
    maxRouletteExtraEnemies: 3,
    novaProjectileCount: 16,
    explosionParticleCount: 18,
    timeLockImpactLimit: 9,
    xpRainGemCount: 8,
  };
}
