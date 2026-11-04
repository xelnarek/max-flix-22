function safeWholeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

/**
 * Survival eliminations become modestly more valuable as waves harden.
 * The 1.25 ceiling limits runaway late-run scoring and keeps early runs useful.
 */
export function getSurvivalKillScoreMultiplier(wave: number): number {
  const safeWave = Math.max(1, safeWholeNumber(wave, 1));
  return 1 + Math.min(0.25, (safeWave - 1) * 0.015);
}

/**
 * Clear bonus rewards actual combat, not simply waiting for the next timer.
 * At least three eliminations in the previous wave are required.
 */
export function getSurvivalWaveClearBonus(wave: number, killsThisWave: number): number {
  const safeWave = Math.max(1, safeWholeNumber(wave, 1));
  const safeKills = safeWholeNumber(killsThisWave, 0);
  if (safeKills < 3) return 0;

  const waveProgress = Math.min(20, safeWave - 1);
  const killContribution = Math.min(15, safeKills);
  return Math.min(420, 60 + waveProgress * 12 + killContribution * 8);
}
