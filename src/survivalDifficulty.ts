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
 * A controlled Survival difficulty curve:
 * - Enemy health and arrival cadence start slightly higher than before.
 * - Enemy movement speed is intentionally unchanged to preserve readable dodges.
 * - Attack cooldowns tighten only a little; visible projectile speed and wind-up
 *   windows are not modified here.
 * - Groups grow every three waves, while the device-specific live-enemy cap
 *   remains the final performance guardrail on handheld hardware.
 * - All values have explicit limits so late runs stay predictable.
 */
export function getSurvivalDifficultyProfile(wave: number): SurvivalDifficultyProfile {
  const currentWave = safeWave(wave);
  const waveIndex = currentWave - 1;
  return {
    enemyHealthMultiplier: 1.45 + Math.min(2.55, waveIndex * 0.09),
    enemySpeedMultiplier: Number((1 + Math.min(0.14, waveIndex * 0.005)).toFixed(2)),
    spawnIntervalSeconds: Math.max(4.55, 5.15 - waveIndex * 0.025),
    extraGroupSize: Math.min(6, Math.floor(waveIndex / 3)),
    enemyAbilityRateMultiplier: Number((1.18 + Math.min(0.78, waveIndex * 0.025)).toFixed(2)),
  };
}
