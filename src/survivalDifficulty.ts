export interface SurvivalDifficultyProfile {
  /** Multiplier applied to each archetype's configured base HP. */
  readonly enemyHealthMultiplier: number;
  /** Applied after the archetype's normal movement tuning. */
  readonly enemySpeedMultiplier: number;
  /** Time between regular enemy groups; lower values mean more pressure. */
  readonly spawnIntervalSeconds: number;
  /** Extra members added to each wave group, still bounded by the device cap. */
  readonly extraGroupSize: number;
  /** Cooldown timer rate for enemy special actions (not their visible wind-ups). */
  readonly enemyAbilityRateMultiplier: number;
}

function safeWave(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

/**
 * A more demanding Survival curve:
 * - Enemies begin at full movement speed and arrive more frequently from wave 1.
 * - Their health and special-attack cadence increase as the run progresses.
 * - Groups grow every three waves, while the device-specific live-enemy cap
 *   remains the final performance guardrail on handheld hardware.
 * - All values have explicit limits so late runs stay predictable.
 */
export function getSurvivalDifficultyProfile(wave: number): SurvivalDifficultyProfile {
  const currentWave = safeWave(wave);
  const waveIndex = currentWave - 1;
  return {
    enemyHealthMultiplier: 1.28 + Math.min(2.1, waveIndex * 0.085),
    enemySpeedMultiplier: 1 + Math.min(0.55, waveIndex * 0.018),
    spawnIntervalSeconds: Math.max(3.0, 5.5 - waveIndex * 0.11),
    extraGroupSize: Math.min(6, Math.floor(waveIndex / 3)),
    enemyAbilityRateMultiplier: 1.10 + Math.min(0.60, waveIndex * 0.02),
  };
}
