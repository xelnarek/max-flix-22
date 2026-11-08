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
 * A deliberate, readable difficulty curve:
 * - Enemies start assertively instead of spending the opening waves at reduced speed.
 * - Health, group size and ability pressure rise in bounded wave steps.
 * - Spawn cadence bottoms out at 4.2 seconds; the device enemy cap remains the
 *   performance guardrail on handheld hardware.
 * - Special cooldowns tighten gradually without shortening visible wind-ups.
 */
export function getSurvivalDifficultyProfile(wave: number): SurvivalDifficultyProfile {
  const currentWave = safeWave(wave);
  const waveIndex = currentWave - 1;
  return {
    enemyHealthMultiplier: 1.18 + Math.min(1.82, waveIndex * 0.075),
    enemySpeedMultiplier: 0.90 * (1 + Math.min(0.40, waveIndex * 0.014)),
    spawnIntervalSeconds: Math.max(4.2, 7.4 - waveIndex * 0.13),
    extraGroupSize: Math.min(3, Math.floor(waveIndex / 5)),
    enemyAbilityRateMultiplier: 1 + Math.min(0.40, waveIndex * 0.014),
  };
}
