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
 * - HP and movement pressure rise every wave.
 * - New group members enter in measured six-wave steps.
 * - Spawn cadence bottoms out at 5.2 seconds so the late game stays intense,
 *   while the separate device enemy cap remains the performance guardrail.
 * - Special cooldowns tighten gradually without shortening telegraph windows.
 */
export function getSurvivalDifficultyProfile(wave: number): SurvivalDifficultyProfile {
  const currentWave = safeWave(wave);
  const waveIndex = currentWave - 1;
  return {
    enemyHealthMultiplier: 1 + Math.min(2.55, waveIndex * 0.095),
    enemySpeedMultiplier: 0.70 * (1 + Math.min(0.48, waveIndex * 0.018)),
    spawnIntervalSeconds: Math.max(5.2, 9.8 - waveIndex * 0.20),
    extraGroupSize: Math.min(2, Math.floor(waveIndex / 6)),
    enemyAbilityRateMultiplier: 1 + Math.min(0.28, waveIndex * 0.012),
  };
}
