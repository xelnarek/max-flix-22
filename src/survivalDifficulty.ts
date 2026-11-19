export interface SurvivalDifficultyProfile {
  /** Multiplier applied to each archetype's configured base HP. */
  readonly enemyHealthMultiplier: number;
  /** Reserved for explicit wave modifiers; normal Survival progression keeps movement neutral. */
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
 * - Enemy health and arrival cadence start higher and continue scaling by wave.
 * - Normal wave progression never accelerates enemy movement. Game combat
 *   tuning keeps the 0.88x movement baseline, preserving readable dodge windows.
 * - Enemy ability cadence and group sizes increase pressure without making
 *   ordinary enemies run faster; named wave mutators may still define exceptions.
 * - Device-specific live-enemy caps remain the final performance guardrail.
 * - All values have explicit limits so late runs stay predictable.
 */
export function getSurvivalDifficultyProfile(wave: number): SurvivalDifficultyProfile {
  const currentWave = safeWave(wave);
  const waveIndex = currentWave - 1;
  return {
    enemyHealthMultiplier: 1.45 + Math.min(2.55, waveIndex * 0.09),
    enemySpeedMultiplier: 1,
    spawnIntervalSeconds: Math.max(4.55, 5.15 - waveIndex * 0.025),
    extraGroupSize: Math.min(6, Math.floor(waveIndex / 3)),
    enemyAbilityRateMultiplier: Number((1.18 + Math.min(0.78, waveIndex * 0.025)).toFixed(2)),
  };
}
